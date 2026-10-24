"use strict";

const { all, get, run, nowIso, transaction, logActivity, getSetting } = require("./db");
const { newCertificateCode } = require("./security");

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function asBool(value) {
  return Boolean(value);
}

function courseSummary(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    objectives: parseJson(row.objectives, []),
    audience: row.audience,
    requirements: row.requirements,
    category: row.category_id
      ? { id: row.category_id, name: row.category_name, slug: row.category_slug }
      : null,
    instructor: row.instructor_id
      ? { id: row.instructor_id, name: row.instructor_name, title: row.instructor_title }
      : null,
    level: row.level,
    modality: row.modality,
    durationHours: row.duration_hours,
    priceCents: row.price_cents,
    isFree: row.price_cents === 0,
    featured: Boolean(row.is_featured),
    certificateEnabled: Boolean(row.certificate_enabled),
    completionPercent: row.completion_percent,
    requireAssessment: Boolean(row.require_assessment),
    passScore: row.pass_score,
    status: row.status,
    demo: Boolean(row.demo),
    coverImage: row.cover_image,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const COURSE_SELECT = `
  SELECT c.*,
         cat.name AS category_name,
         cat.slug AS category_slug,
         i.name AS instructor_name,
         i.title AS instructor_title
    FROM courses c
    LEFT JOIN categories cat ON cat.id = c.category_id
    LEFT JOIN instructors i ON i.id = c.instructor_id
`;

async function getCourseRow(identifier, { includeArchived = false } = {}) {
  const byId = /^\d+$/.test(String(identifier));
  let sql = `${COURSE_SELECT} WHERE ${byId ? "c.id = ?" : "c.slug = ?"}`;
  if (!includeArchived) sql += " AND c.status != 'archived'";
  return await get(sql, byId ? Number(identifier) : String(identifier));
}

async function getCourse(identifier, options) {
  return courseSummary(await getCourseRow(identifier, options));
}

async function listCategories({ activeOnly = true } = {}) {
  return (await all(
    `SELECT id, name, slug, description, icon, position, active
       FROM categories ${activeOnly ? "WHERE active = 1" : ""}
      ORDER BY position, name`
  )).map((c) => ({ ...c, active: Boolean(c.active) }));
}

async function listInstructors({ activeOnly = true } = {}) {
  return (await all(
    `SELECT id, user_id, name, title, bio, specialties, status, created_at
       FROM instructors ${activeOnly ? "WHERE status = 'active'" : ""}
      ORDER BY name`
  )).map((i) => ({ ...i, userId: i.user_id }));
}

async function lessonCount(courseId) {
  const row = await get(
    `SELECT COUNT(*) AS total
       FROM lessons l
       JOIN modules m ON m.id = l.module_id
      WHERE m.course_id = ?`,
    courseId
  );
  return Number(row ? row.total : 0);
}

async function getCourseContent(courseId) {
  const modules = await all(
    "SELECT id, course_id, title, description, position FROM modules WHERE course_id = ? ORDER BY position, id",
    courseId
  );
  const lessons = await all(
    `SELECT l.* FROM lessons l
       JOIN modules m ON m.id = l.module_id
      WHERE m.course_id = ?
      ORDER BY m.position, l.position, l.id`,
    courseId
  );
  const materials = await all(
    `SELECT mt.* FROM materials mt
       JOIN lessons l ON l.id = mt.lesson_id
       JOIN modules m ON m.id = l.module_id
      WHERE m.course_id = ?
      ORDER BY mt.id`,
    courseId
  );
  const byModule = new Map(modules.map((m) => [m.id, []]));
  for (const lesson of lessons) {
    const item = {
      id: lesson.id,
      moduleId: lesson.module_id,
      title: lesson.title,
      description: lesson.description,
      content: lesson.content,
      videoUrl: lesson.video_url,
      durationMinutes: lesson.duration_minutes,
      position: lesson.position,
      isFreePreview: Boolean(lesson.is_free_preview),
      materials: materials
        .filter((mt) => mt.lesson_id === lesson.id)
        .map((mt) => ({
          id: mt.id,
          title: mt.title,
          fileUrl: mt.file_url,
          fileType: mt.file_type,
          sizeLabel: mt.size_label,
        })),
    };
    byModule.get(lesson.module_id)?.push(item);
  }
  return {
    modules: modules.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      position: m.position,
      lessons: byModule.get(m.id) || [],
    })),
    lessons,
  };
}

async function getAssessmentRow(courseId) {
  return await get("SELECT * FROM assessments WHERE course_id = ?", courseId);
}

async function getAssessmentMeta(courseId, { includeQuestions = false } = {}) {
  const assessment = await getAssessmentRow(courseId);
  if (!assessment) return null;
  const questions = (await all(
    "SELECT id, text, type, options, correct_index, explanation, position FROM questions WHERE assessment_id = ? ORDER BY position, id",
    assessment.id
  )).map((q) => ({
    id: q.id,
    text: q.text,
    type: q.type,
    options: parseJson(q.options, []),
    position: q.position,
    ...(includeQuestions
      ? {
          correctIndex: q.correct_index,
          explanation: q.explanation,
        }
      : {}),
  }));
  return {
    id: assessment.id,
    courseId: assessment.course_id,
    title: assessment.title,
    description: assessment.description,
    passScore: assessment.pass_score,
    maxAttempts: assessment.max_attempts,
    isPublished: Boolean(assessment.is_published),
    questionCount: questions.length,
    questions,
  };
}

async function getEnrollment(userId, courseId) {
  return await get("SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?", userId, courseId);
}

async function progressMap(enrollmentId) {
  const rows = await all(
    "SELECT lesson_id, completed, watched_seconds, completed_at FROM lesson_progress WHERE enrollment_id = ?",
    enrollmentId
  );
  const map = new Map();
  for (const row of rows) {
    map.set(row.lesson_id, {
      completed: Boolean(row.completed),
      watchedSeconds: row.watched_seconds,
      completedAt: row.completed_at,
    });
  }
  return map;
}

async function computeProgress(enrollmentId, courseId) {
  const totalRow = await get(
    `SELECT COUNT(*) AS total FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.course_id = ?`,
    courseId
  );
  const doneRow = await get(
    `SELECT COUNT(*) AS done FROM lesson_progress lp
       JOIN lessons l ON l.id = lp.lesson_id
       JOIN modules m ON m.id = l.module_id
      WHERE lp.enrollment_id = ? AND lp.completed = 1 AND m.course_id = ?`,
    enrollmentId,
    courseId
  );
  const total = Number(totalRow ? totalRow.total : 0);
  const done = Number(doneRow ? doneRow.done : 0);
  return {
    total,
    done,
    percent: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}

async function hasPassedAssessment(userId, courseId) {
  const row = await get(
    `SELECT a.id, a.pass_score
       FROM assessments a
      WHERE a.course_id = ? AND a.is_published = 1`,
    courseId
  );
  if (!row) return null;
  const passed = await get(
    `SELECT id, score, submitted_at FROM attempts
      WHERE user_id = ? AND assessment_id = ? AND passed = 1 AND submitted_at IS NOT NULL
      ORDER BY score DESC LIMIT 1`,
    userId,
    row.id
  );
  return passed || null;
}

async function certificateRow(enrollmentId) {
  return await get("SELECT * FROM certificates WHERE enrollment_id = ?", enrollmentId);
}

async function eligibility(userId, enrollment, course) {
  if (!enrollment || !course) {
    return { eligible: false, reason: "Matrícula não encontrada.", progress: 0, assessmentPassed: false };
  }
  if (enrollment.status === "blocked" || enrollment.status === "cancelled") {
    return {
      eligible: false,
      reason: "A matrícula não está ativa.",
      progress: enrollment.progress_percent,
      assessmentPassed: false,
    };
  }
  const progress = await computeProgress(enrollment.id, course.id);
  const assessmentPassed = await hasPassedAssessment(userId, course.id);
  const percentOk = progress.percent >= (course.completion_percent || 100);
  const assessmentOk = !course.require_assessment || Boolean(assessmentPassed);
  const completed = percentOk && assessmentOk;
  const reason = completed
    ? "Critérios de conclusão atendidos."
    : !percentOk
      ? `Conclua pelo menos ${course.completion_percent || 100}% das aulas.`
      : "É necessário ser aprovado na avaliação do curso.";
  return {
    eligible: completed,
    reason,
    progress: progress.percent,
    lessonsDone: progress.done,
    lessonsTotal: progress.total,
    assessmentPassed: Boolean(assessmentPassed),
  };
}

async function recalcEnrollment(enrollmentId, { userId, courseId } = {}) {
  const enrollment =
    await get("SELECT * FROM enrollments WHERE id = ?", enrollmentId) ||
    (userId && courseId ? await getEnrollment(userId, courseId) : null);
  if (!enrollment) return null;
  const course = await get("SELECT * FROM courses WHERE id = ?", enrollment.course_id);
  if (!course) return null;
  const progress = await computeProgress(enrollment.id, course.id);
  const state = await eligibility(enrollment.user_id, enrollment, course);
  const locked = enrollment.status === "cancelled" || enrollment.status === "blocked";
  const shouldComplete = state.eligible && !locked;
  const nextStatus = locked
    ? enrollment.status
    : shouldComplete
      ? "completed"
      : enrollment.status === "completed"
        ? "completed"
        : "active";
  const completedAt = shouldComplete
    ? enrollment.completed_at || nowIso()
    : nextStatus === "completed"
      ? enrollment.completed_at
      : null;
  await run(
    "UPDATE enrollments SET progress_percent = ?, status = ?, completed_at = ?, updated_at = ? WHERE id = ?",
    progress.percent,
    nextStatus,
    completedAt,
    nowIso(),
    enrollment.id
  );
  return {
    ...enrollment,
    progress_percent: progress.percent,
    status: nextStatus,
    completed_at: completedAt,
    eligibility: state,
  };
}

async function issueCertificate(userId, courseId) {
  const enrollment = await getEnrollment(userId, courseId);
  if (!enrollment) return { error: "Matrícula não encontrada.", status: 404 };
  const course = await get("SELECT * FROM courses WHERE id = ?", courseId);
  if (!course) return { error: "Curso não encontrado.", status: 404 };
  if (!course.certificate_enabled) {
    return { error: "Este curso não oferece certificado.", status: 400 };
  }
  const current = await certificateRow(enrollment.id);
  if (current) return { certificate: current };
  const state = await eligibility(userId, enrollment, course);
  if (!state.eligible) {
    return { error: state.reason, status: 400, eligibility: state };
  }
  const user = await get("SELECT name FROM users WHERE id = ?", userId);
  let code;
  let attempts = 0;
  do {
    code = newCertificateCode();
    attempts += 1;
  } while (await get("SELECT id FROM certificates WHERE code = ?", code) && attempts < 10);
  const result = await run(
    `INSERT INTO certificates (code, user_id, course_id, enrollment_id, student_name, course_name, hours, issued_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    code,
    userId,
    courseId,
    enrollment.id,
    user?.name || "Aluno",
    course.title,
    course.duration_hours,
    nowIso()
  );
  await run(
    "UPDATE enrollments SET status = 'completed', completed_at = COALESCE(completed_at, ?), updated_at = ? WHERE id = ?",
    nowIso(),
    nowIso(),
    enrollment.id
  );
  await logActivity(userId, "certificate.issued", "course", courseId, `Certificado emitido (${code}).`);
  return { certificate: await get("SELECT * FROM certificates WHERE id = ?", Number(result.lastInsertRowid)) };
}

async function studentCourseCard(enrollment, courseRow) {
  const course = courseSummary(courseRow);
  const lastLesson = enrollment.last_lesson_id
    ? await get(
        `SELECT l.id, l.title, m.title AS module_title
           FROM lessons l JOIN modules m ON m.id = l.module_id
          WHERE l.id = ?`,
        enrollment.last_lesson_id
      )
    : null;
  return {
    enrollmentId: enrollment.id,
    status: enrollment.status,
    progress: enrollment.progress_percent,
    enrolledAt: enrollment.enrolled_at,
    completedAt: enrollment.completed_at,
    lastLesson: lastLesson || null,
    certificate: await certificateRow(enrollment.id) || null,
    course,
  };
}

async function currentUser(userId) {
  const row = await get(
    "SELECT id, name, email, role, phone, bio, status, must_change_password, last_login_at, created_at FROM users WHERE id = ?",
    userId
  );
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    phone: row.phone || "",
    bio: row.bio || "",
    status: row.status,
    mustChangePassword: Boolean(row.must_change_password),
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
  };
}

async function publicSettings() {
  const keys = [
    "site_name",
    "site_tagline",
    "hero_eyebrow",
    "hero_title",
    "hero_subtitle",
    "about_title",
    "about_text",
    "institutional_note",
    "contact_instagram",
    "contact_email",
    "contact_phone",
    "contact_hours",
    "support_text",
    "demo_notice",
    "privacy_updated",
  ];
  const out = {};
  for (const key of keys) out[key] = await getSetting(key, "");
  return out;
}

async function dashboardForAdmin(scopedInstructorId = null) {
  const courseFilter = scopedInstructorId ? " AND c.instructor_id = ?" : "";
  const courseParams = scopedInstructorId ? [scopedInstructorId] : [];
  const studentCount = (await get("SELECT COUNT(*) AS n FROM users WHERE role = 'student'")).n;
  const courseCount = (await get(
    `SELECT COUNT(*) AS n FROM courses c WHERE c.status = 'published'${courseFilter}`,
    ...courseParams
  )).n;
  const activeEnrollments = (await get(
    `SELECT COUNT(*) AS n FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.status = 'active'${courseFilter}`,
    ...courseParams
  )).n;
  const completedEnrollments = (await get(
    `SELECT COUNT(*) AS n FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.status = 'completed'${courseFilter}`,
    ...courseParams
  )).n;
  const totalEnrollments = activeEnrollments + completedEnrollments;
  const completionRate =
    totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 1000) / 10 : 0;
  const revenue = (await get(
    `SELECT COALESCE(SUM(o.total_cents), 0) AS n
       FROM orders o JOIN courses c ON c.id = o.course_id
      WHERE o.status = 'approved'${courseFilter}`,
    ...courseParams
  )).n;
  const pendingOrders = (await get(
    `SELECT COUNT(*) AS n FROM orders o JOIN courses c ON c.id = o.course_id WHERE o.status = 'pending'${courseFilter}`,
    ...courseParams
  )).n;
  const topCourses = (await all(
    `SELECT c.id, c.title, c.slug, c.cover_image, COUNT(e.id) AS enrollments,
            COALESCE(ROUND(AVG(e.progress_percent)), 0) AS avg_progress
       FROM courses c
       LEFT JOIN enrollments e ON e.course_id = c.id AND e.status IN ('active','completed')
      WHERE c.status != 'archived'${courseFilter}
      GROUP BY c.id
      ORDER BY enrollments DESC, c.title
      LIMIT 6`,
    ...courseParams
  )).map((r) => ({ ...r, avgProgress: Number(r.avg_progress) }));
  const recentActivity = await all(
    `SELECT a.*, u.name AS user_name
       FROM activity_log a
       LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.created_at DESC LIMIT 12`
  );
  const recentStudents = await all(
    `SELECT u.id, u.name, u.email, u.created_at
       FROM users u WHERE u.role = 'student'
      ORDER BY u.created_at DESC LIMIT 6`
  );
  const enrollmentsByMonth = await all(
    `SELECT substr(e.enrolled_at, 1, 7) AS month, COUNT(*) AS total
       FROM enrollments e JOIN courses c ON c.id = e.course_id
      WHERE e.enrolled_at >= date('now', '-8 months')${courseFilter}
      GROUP BY month ORDER BY month`,
    ...courseParams
  );
  return {
    studentCount,
    courseCount,
    activeEnrollments,
    completedEnrollments,
    completionRate,
    revenueCents: revenue,
    pendingOrders,
    topCourses,
    recentActivity,
    recentStudents,
    enrollmentsByMonth,
  };
}

module.exports = {
  parseJson,
  asBool,
  courseSummary,
  getCourseRow,
  getCourse,
  listCategories,
  listInstructors,
  lessonCount,
  getCourseContent,
  getAssessmentRow,
  getAssessmentMeta,
  getEnrollment,
  progressMap,
  computeProgress,
  hasPassedAssessment,
  certificateRow,
  eligibility,
  recalcEnrollment,
  issueCertificate,
  studentCourseCard,
  currentUser,
  publicSettings,
  dashboardForAdmin,
  transaction,
};
