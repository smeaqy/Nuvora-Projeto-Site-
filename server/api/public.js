"use strict";

const config = require("../config");
const { all, get, run, nowIso, logActivity } = require("../db");
const {
  parseJson,
  courseSummary,
  getCourseContent,
  getAssessmentMeta,
  getEnrollment,
  listCategories,
} = require("../services");
const { rateLimit } = require("../security");
const { bad, parsePage, text, email, setting } = require("./helpers");

function courseCard(row) {
  return {
    ...courseSummary(row),
    lessonCount: Number(row.lesson_count || 0),
    enrollmentCount: Number(row.enrollment_count || 0),
  };
}

async function listPublishedCourses(query) {
  const { page, limit, offset } = parsePage(query, { defaultLimit: 12, maxLimit: 48 });
  const where = ["c.status = 'published'"];
  const params = [];
  const q = String(query.q || "").trim().slice(0, 120);
  if (q) {
    where.push("(c.title LIKE ? OR c.subtitle LIKE ? OR c.description LIKE ? OR i.name LIKE ?)");
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (query.category) {
    where.push("cat.slug = ?");
    params.push(String(query.category));
  }
  if (["iniciante", "intermediario", "avancado"].includes(query.level)) {
    where.push("c.level = ?");
    params.push(query.level);
  }
  if (["online", "hibrido"].includes(query.modality)) {
    where.push("c.modality = ?");
    params.push(query.modality);
  }
  if (query.price === "free") where.push("c.price_cents = 0");
  if (query.price === "paid") where.push("c.price_cents > 0");
  if (query.featured === "1") where.push("c.is_featured = 1");

  const sortMap = {
    recent: "c.created_at DESC",
    price_asc: "c.price_cents ASC, c.title",
    price_desc: "c.price_cents DESC, c.title",
    title: "c.title ASC",
    duration: "c.duration_hours ASC",
  };
  const order = sortMap[query.sort] || "c.is_featured DESC, c.created_at DESC";

  const baseFrom = `FROM courses c
    LEFT JOIN categories cat ON cat.id = c.category_id
    LEFT JOIN instructors i ON i.id = c.instructor_id`;
  const count = (await get(
    `SELECT COUNT(*) AS total ${baseFrom} WHERE ${where.join(" AND ")}`,
    ...params
  )).total;
  const rows = await all(
    `SELECT c.*, cat.name AS category_name, cat.slug AS category_slug,
            i.name AS instructor_name, i.title AS instructor_title,
            (SELECT COUNT(*) FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.course_id = c.id) AS lesson_count,
            (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.status IN ('active','completed')) AS enrollment_count
       ${baseFrom}
      WHERE ${where.join(" AND ")}
      ORDER BY ${order}
      LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset
  );
  return {
    items: rows.map(courseCard),
    total: Number(count),
    page,
    limit,
    pages: Math.max(1, Math.ceil(Number(count) / limit)),
    filters: {
      categories: await listCategories(),
      levels: [
        { value: "iniciante", label: "Iniciante" },
        { value: "intermediario", label: "Intermediário" },
        { value: "avancado", label: "Avançado" },
      ],
      modalities: [
        { value: "online", label: "100% online" },
        { value: "hibrido", label: "Híbrido" },
      ],
    },
  };
}

async function publicCourseDetail(slug, user) {
  const row = await get(
    `SELECT c.*, cat.name AS category_name, cat.slug AS category_slug,
            i.name AS instructor_name, i.title AS instructor_title
       FROM courses c
       LEFT JOIN categories cat ON cat.id = c.category_id
       LEFT JOIN instructors i ON i.id = c.instructor_id
      WHERE c.slug = ? AND c.status = 'published'`,
    String(slug)
  );
  if (!row) bad("Curso não encontrado.", 404);
  const summary = courseSummary(row);
  const content = await getCourseContent(row.id);
  const outline = content.modules.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    lessons: m.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      durationMinutes: l.durationMinutes,
      isFreePreview: l.isFreePreview,
      videoUrl: l.isFreePreview ? l.videoUrl : null,
      materials: l.materials,
    })),
  }));
  const assessment = await getAssessmentMeta(row.id, { includeQuestions: false });
  const related = (await Promise.all((await all(
    `SELECT c.*, cat.name AS category_name, cat.slug AS category_slug,
            i.name AS instructor_name, i.title AS instructor_title
       FROM courses c
       LEFT JOIN categories cat ON cat.id = c.category_id
       LEFT JOIN instructors i ON i.id = c.instructor_id
      WHERE c.status = 'published' AND c.id != ?
      ORDER BY (c.category_id = ?) DESC, c.is_featured DESC, c.created_at DESC
      LIMIT 3`,
    row.id,
    row.category_id
  )).map(async (r) => ({
    ...courseSummary(r),
    lessonCount: (await get(
      "SELECT COUNT(*) AS n FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.course_id = ?",
      r.id
    )).n,
  }))));
  let enrollment = null;
  if (user && user.role === "student") {
    const e = await getEnrollment(user.id, row.id);
    if (e) {
      enrollment = {
        id: e.id,
        status: e.status,
        progress: e.progress_percent,
        lastLessonId: e.last_lesson_id,
      };
    }
  }
  return {
    course: summary,
    outline,
    assessment: assessment
      ? {
          title: assessment.title,
          passScore: assessment.passScore,
          maxAttempts: assessment.maxAttempts,
          questionCount: assessment.questionCount,
        }
      : null,
    related,
    enrollment,
    lessonCount: content.lessons.length,
  };
}

function register(router) {
  router.add("GET", "/api/public/config", async () => {
    const settings = {};
    for (const key of [
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
    ]) {
      settings[key] = await setting(key);
    }
    const featuredRows = (await all(
      `SELECT c.*, cat.name AS category_name, cat.slug AS category_slug,
              i.name AS instructor_name, i.title AS instructor_title,
              (SELECT COUNT(*) FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.course_id = c.id) AS lesson_count
         FROM courses c
         LEFT JOIN categories cat ON cat.id = c.category_id
         LEFT JOIN instructors i ON i.id = c.instructor_id
        WHERE c.status = 'published'
        ORDER BY c.is_featured DESC, c.created_at DESC
        LIMIT 6`
    )).map(courseCard);
    const faqs = await all(
      "SELECT id, question, answer FROM faqs WHERE published = 1 ORDER BY position, id"
    );
    const testimonials = await all(
      "SELECT id, student_name, course_name, quote, photo_url FROM testimonials WHERE published = 1 AND authorized = 1 ORDER BY id DESC LIMIT 6"
    );
    const categories = await listCategories();
    const publishedCount = (await get("SELECT COUNT(*) AS n FROM courses WHERE status = 'published'")).n;
    return {
      body: {
        app: config.public,
        settings,
        categories,
        featuredCourses: featuredRows,
        faqs,
        testimonials,
        stats: {
          publishedCourses: Number(publishedCount),
        },
      },
    };
  });

  router.add("GET", "/api/public/courses", async (ctx) => ({
    body: await listPublishedCourses(ctx.query),
  }));

  router.add("GET", "/api/public/courses/:slug", async (ctx) => ({
    body: await publicCourseDetail(ctx.params.slug, ctx.user),
  }));

  router.add("POST", "/api/public/contact", async (ctx) => {
    const limit = rateLimit(`contact:${ctx.ip}`, 5, 60 * 60 * 1000);
    if (!limit.allowed) bad("Muitas mensagens em pouco tempo. Tente novamente mais tarde.", 429);
    const name = text(ctx.body.name, "seu nome", { min: 2, max: 120 });
    const mail = email(ctx.body.email);
    const phone = text(ctx.body.phone, "telefone", { required: false, max: 40 });
    const subject = text(ctx.body.subject, "o assunto", { required: false, max: 160 });
    const message = text(ctx.body.message, "uma mensagem", { min: 10, max: 4000 });
    const result = await run(
      "INSERT INTO leads (name, email, phone, subject, message, status, created_at) VALUES (?, ?, ?, ?, ?, 'new', ?)",
      name,
      mail,
      phone,
      subject,
      message,
      nowIso()
    );
    await logActivity(ctx.user?.id || null, "lead.created", "lead", Number(result.lastInsertRowid), `Contato recebido de ${name}.`);
    return {
      status: 201,
      body: {
        message:
          "Mensagem recebida. A equipe da BrasilTec Educação entrará em contato pelos canais informados.",
      },
    };
  });

  router.add("GET", "/api/public/certificates/:code", async (ctx) => {
    const limit = rateLimit(`verify:${ctx.ip}`, 30, 10 * 60 * 1000);
    if (!limit.allowed) bad("Muitas consultas em pouco tempo. Aguarde alguns minutos.", 429);
    const row = await get(
      `SELECT code, student_name, course_name, hours, issued_at
         FROM certificates WHERE code = ?`,
      String(ctx.params.code).trim().toUpperCase()
    );
    if (!row) bad("Certificado não encontrado. Confira o código informado.", 404);
    return {
      body: {
        valid: true,
        certificate: {
          code: row.code,
          studentName: row.student_name,
          courseName: row.course_name,
          hours: row.hours,
          issuedAt: row.issued_at,
          issuer: "BrasilTec Educação",
          verifyUrl: `${config.appUrl}/verificar-certificado?codigo=${encodeURIComponent(row.code)}`,
        },
      },
    };
  });

  router.add("GET", "/api/public/categories", async () => ({
    body: { categories: await listCategories() },
  }));
}

module.exports = { register, listPublishedCourses, publicCourseDetail };
