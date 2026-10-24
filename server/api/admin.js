"use strict";

const { all, get, run, nowIso, logActivity, transaction } = require("../db");
const { hashPassword, passwordProblem, validEmail } = require("../security");
const {
  parseJson,
  courseSummary,
  getCourseContent,
  getAssessmentMeta,
  dashboardForAdmin,
  listCategories,
  listInstructors,
} = require("../services");
const { approveOrderByCode, refundOrder, paymentsConfigured } = require("../payments");
const {
  bad,
  requireAdmin,
  requireStaff,
  currentInstructorId,
  assertCourseAccess,
  publicUser,
  slugify,
  parsePage,
  text,
  email,
  intField,
  boolField,
  ensureUniqueSlug,
} = require("./helpers");

function parseObjectives(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim().slice(0, 300)).filter(Boolean).slice(0, 20);
  }
  return String(value || "")
    .split(/\r?\n/)
    .map((v) => v.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 20);
}

function validateAssetPath(value, kind = "img") {
  const v = String(value || "").trim();
  if (!v) return "";
  if (v.startsWith(`/assets/${kind}/`)) return v;
  if (v.startsWith("/uploads/")) return v;
  if (/^https:\/\//i.test(v)) return v;
  bad("Informe um caminho de arquivo válido.", 422);
}

async function fullCourse(courseId) {
  const row = await get(
    `SELECT c.*, cat.name AS category_name, cat.slug AS category_slug,
            i.name AS instructor_name, i.title AS instructor_title
       FROM courses c
       LEFT JOIN categories cat ON cat.id = c.category_id
       LEFT JOIN instructors i ON i.id = c.instructor_id
      WHERE c.id = ?`,
    Number(courseId)
  );
  if (!row) bad("Curso não encontrado.", 404);
  const content = await getCourseContent(row.id);
  const assessment = await getAssessmentMeta(row.id, { includeQuestions: true });
  const stats = await get(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS active,
            COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS completed,
            COALESCE(ROUND(AVG(progress_percent)), 0) AS avg_progress
       FROM enrollments WHERE course_id = ?`,
    row.id
  );
  return {
    course: courseSummary(row),
    modules: content.modules,
    assessment,
    stats: {
      enrollments: Number(stats.total),
      active: Number(stats.active),
      completed: Number(stats.completed),
      avgProgress: Number(stats.avg_progress),
    },
  };
}

function adminEnrollment(row) {
  return {
    id: row.id,
    userId: row.user_id,
    studentName: row.student_name,
    studentEmail: row.student_email,
    courseId: row.course_id,
    courseTitle: row.course_title,
    courseSlug: row.course_slug,
    coverImage: row.cover_image,
    status: row.status,
    progress: row.progress_percent,
    enrolledAt: row.enrolled_at,
    completedAt: row.completed_at,
    lastLessonId: row.last_lesson_id,
  };
}

function register(router) {
  /* ------------------------------- Dashboard ------------------------------ */
  router.add(
    "GET",
    "/api/admin/overview",
    async (ctx) => {
      const user = requireStaff(ctx);
      const instructorId = user.role === "instructor" ? await currentInstructorId(user) : null;
      if (user.role === "instructor" && !instructorId) {
        return { body: { role: user.role, empty: true, dashboard: await dashboardForAdmin(-1) } };
      }
      return {
        body: {
          role: user.role,
          demoMode: true,
          dashboard: await dashboardForAdmin(user.role === "instructor" ? instructorId : null),
          paymentsConfigured: paymentsConfigured(),
        },
      };
    },
    { auth: true }
  );

  /* -------------------------------- Courses ------------------------------- */
  router.add(
    "GET",
    "/api/admin/courses",
    async (ctx) => {
      const user = requireStaff(ctx);
      const instructorId = user.role === "instructor" ? await currentInstructorId(user) : null;
      const where = ["1=1"];
      const params = [];
      if (user.role === "instructor") {
        where.push("c.instructor_id = ?");
        params.push(instructorId || -1);
      }
      if (ctx.query.status) {
        where.push("c.status = ?");
        params.push(String(ctx.query.status));
      }
      if (ctx.query.q) {
        where.push("(c.title LIKE ? OR c.slug LIKE ?)");
        params.push(`%${ctx.query.q}%`, `%${ctx.query.q}%`);
      }
      const rows = await all(
        `SELECT c.*, cat.name AS category_name, cat.slug AS category_slug,
                i.name AS instructor_name, i.title AS instructor_title,
                (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) AS enrollment_count,
                (SELECT COUNT(*) FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.course_id = c.id) AS lesson_count
           FROM courses c
           LEFT JOIN categories cat ON cat.id = c.category_id
           LEFT JOIN instructors i ON i.id = c.instructor_id
          WHERE ${where.join(" AND ")}
          ORDER BY c.updated_at DESC`,
        ...params
      );
      return {
        body: {
          items: rows.map((r) => ({
            ...courseSummary(r),
            enrollmentCount: Number(r.enrollment_count),
            lessonCount: Number(r.lesson_count),
          })),
          categories: await listCategories({ activeOnly: false }),
          instructors: user.role === "admin" ? await listInstructors({ activeOnly: false }) : [],
        },
      };
    },
    { auth: true }
  );

  router.add(
    "POST",
    "/api/admin/courses",
    async (ctx) => {
      const user = requireStaff(ctx);
      const instructorId = await currentInstructorId(user);
      const title = text(ctx.body.title, "o título do curso", { min: 4, max: 180 });
      const slugBase = slugify(ctx.body.slug || title);
      const slug = await ensureUniqueSlug(slugBase);
      const categoryId = ctx.body.categoryId ? intField(ctx.body.categoryId, "categoria", { min: 1 }) : null;
      if (categoryId && !await get("SELECT id FROM categories WHERE id = ?", categoryId)) {
        bad("Categoria não encontrada.", 422);
      }
      let courseInstructor = ctx.body.instructorId
        ? intField(ctx.body.instructorId, "instrutor", { min: 1 })
        : null;
      if (user.role === "instructor") courseInstructor = instructorId;
      if (courseInstructor && !await get("SELECT id FROM instructors WHERE id = ?", courseInstructor)) {
        bad("Instrutor não encontrado.", 422);
      }
      const price = intField(ctx.body.priceCents, "preço", { min: 0, max: 100000000, fallback: 0 });
      const result = await run(
        `INSERT INTO courses (
          slug, title, subtitle, description, objectives, audience, requirements,
          category_id, instructor_id, level, modality, duration_hours, price_cents,
          is_featured, certificate_enabled, completion_percent, require_assessment, pass_score,
          status, demo, cover_image, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
        slug,
        title,
        text(ctx.body.subtitle, "o subtítulo", { required: false, max: 240 }),
        String(ctx.body.description || "").slice(0, 12000),
        JSON.stringify(parseObjectives(ctx.body.objectives)),
        String(ctx.body.audience || "").slice(0, 4000),
        String(ctx.body.requirements || "").slice(0, 4000),
        categoryId,
        courseInstructor,
        ["iniciante", "intermediario", "avancado"].includes(ctx.body.level) ? ctx.body.level : "iniciante",
        ["online", "hibrido"].includes(ctx.body.modality) ? ctx.body.modality : "online",
        intField(ctx.body.durationHours, "carga horária", { min: 0, max: 10000, fallback: 0 }),
        price,
        boolField(ctx.body.featured) ? 1 : 0,
        boolField(ctx.body.certificateEnabled, true) ? 1 : 0,
        intField(ctx.body.completionPercent, "percentual de conclusão", { min: 1, max: 100, fallback: 100 }),
        boolField(ctx.body.requireAssessment) ? 1 : 0,
        intField(ctx.body.passScore, "nota mínima", { min: 0, max: 100, fallback: 70 }),
        ["draft", "published", "archived"].includes(ctx.body.status) ? ctx.body.status : "draft",
        validateAssetPath(ctx.body.coverImage, "img"),
        user.id,
        nowIso(),
        nowIso()
      );
      const id = Number(result.lastInsertRowid);
      await logActivity(user.id, "course.created", "course", id, `Curso ${title} criado.`);
      return { status: 201, body: { id, ...await fullCourse(id) } };
    },
    { auth: true }
  );

  router.add(
    "GET",
    "/api/admin/courses/:id",
    async (ctx) => {
      requireStaff(ctx);
      const course = await assertCourseAccess(ctx, ctx.params.id);
      return {
        body: {
          ...await fullCourse(course.id),
          categories: await listCategories({ activeOnly: false }),
          instructors: await listInstructors({ activeOnly: false }),
        },
      };
    },
    { auth: true }
  );

  router.add(
    "PATCH",
    "/api/admin/courses/:id",
    async (ctx) => {
      const user = requireStaff(ctx);
      const course = await assertCourseAccess(ctx, ctx.params.id);
      const fields = [];
      const params = [];
      function set(column, value) {
        fields.push(`${column} = ?`);
        params.push(value);
      }
      if (ctx.body.title !== undefined) set("title", text(ctx.body.title, "o título do curso", { min: 4, max: 180 }));
      if (ctx.body.slug !== undefined) {
        set("slug", await ensureUniqueSlug(slugify(ctx.body.slug), course.id));
      }
      if (ctx.body.subtitle !== undefined) set("subtitle", text(ctx.body.subtitle, "o subtítulo", { required: false, max: 240 }));
      if (ctx.body.description !== undefined) set("description", String(ctx.body.description).slice(0, 12000));
      if (ctx.body.objectives !== undefined) set("objectives", JSON.stringify(parseObjectives(ctx.body.objectives)));
      if (ctx.body.audience !== undefined) set("audience", String(ctx.body.audience).slice(0, 4000));
      if (ctx.body.requirements !== undefined) set("requirements", String(ctx.body.requirements).slice(0, 4000));
      if (ctx.body.categoryId !== undefined) {
        const categoryId = ctx.body.categoryId ? intField(ctx.body.categoryId, "categoria", { min: 1 }) : null;
        if (categoryId && !await get("SELECT id FROM categories WHERE id = ?", categoryId)) bad("Categoria não encontrada.", 422);
        set("category_id", categoryId);
      }
      if (ctx.body.instructorId !== undefined && user.role === "admin") {
        const instructorId = ctx.body.instructorId ? intField(ctx.body.instructorId, "instrutor", { min: 1 }) : null;
        if (instructorId && !await get("SELECT id FROM instructors WHERE id = ?", instructorId)) bad("Instrutor não encontrado.", 422);
        set("instructor_id", instructorId);
      }
      if (ctx.body.level !== undefined) set("level", ["iniciante", "intermediario", "avancado"].includes(ctx.body.level) ? ctx.body.level : "iniciante");
      if (ctx.body.modality !== undefined) set("modality", ["online", "hibrido"].includes(ctx.body.modality) ? ctx.body.modality : "online");
      if (ctx.body.durationHours !== undefined) set("duration_hours", intField(ctx.body.durationHours, "carga horária", { min: 0, max: 10000 }));
      if (ctx.body.priceCents !== undefined) set("price_cents", intField(ctx.body.priceCents, "preço", { min: 0, max: 100000000 }));
      if (ctx.body.featured !== undefined) set("is_featured", boolField(ctx.body.featured) ? 1 : 0);
      if (ctx.body.certificateEnabled !== undefined) set("certificate_enabled", boolField(ctx.body.certificateEnabled) ? 1 : 0);
      if (ctx.body.completionPercent !== undefined) set("completion_percent", intField(ctx.body.completionPercent, "percentual de conclusão", { min: 1, max: 100 }));
      if (ctx.body.requireAssessment !== undefined) set("require_assessment", boolField(ctx.body.requireAssessment) ? 1 : 0);
      if (ctx.body.passScore !== undefined) set("pass_score", intField(ctx.body.passScore, "nota mínima", { min: 0, max: 100 }));
      if (ctx.body.status !== undefined) set("status", ["draft", "published", "archived"].includes(ctx.body.status) ? ctx.body.status : "draft");
      if (ctx.body.coverImage !== undefined) set("cover_image", validateAssetPath(ctx.body.coverImage, "img"));
      if (!fields.length) bad("Nenhuma alteração enviada.", 400);
      set("updated_at", nowIso());
      params.push(course.id);
      await run(`UPDATE courses SET ${fields.join(", ")} WHERE id = ?`, ...params);
      await logActivity(user.id, "course.updated", "course", course.id, `Curso ${course.title} atualizado.`);
      return { body: { message: "Curso atualizado.", ...await fullCourse(course.id) } };
    },
    { auth: true }
  );

  router.add(
    "DELETE",
    "/api/admin/courses/:id",
    async (ctx) => {
      const user = requireStaff(ctx);
      const course = await assertCourseAccess(ctx, ctx.params.id);
      await run("UPDATE courses SET status = 'archived', updated_at = ? WHERE id = ?", nowIso(), course.id);
      await logActivity(user.id, "course.archived", "course", course.id, `Curso ${course.title} arquivado.`);
      return { body: { message: "Curso arquivado. O histórico de matrículas foi preservado." } };
    },
    { auth: true }
  );

  /* -------------------------------- Modules -------------------------------- */
  router.add(
    "POST",
    "/api/admin/courses/:id/modules",
    async (ctx) => {
      const user = requireStaff(ctx);
      const course = await assertCourseAccess(ctx, ctx.params.id);
      const title = text(ctx.body.title, "o título do módulo", { min: 2, max: 160 });
      const max = (await get("SELECT COALESCE(MAX(position), -1) AS p FROM modules WHERE course_id = ?", course.id)).p;
      const result = await run(
        "INSERT INTO modules (course_id, title, description, position, created_at) VALUES (?, ?, ?, ?, ?)",
        course.id,
        title,
        String(ctx.body.description || "").slice(0, 1000),
        Number(ctx.body.position ?? max + 1),
        nowIso()
      );
      await logActivity(user.id, "module.created", "module", Number(result.lastInsertRowid), `Módulo ${title} criado.`);
      return { status: 201, body: { id: Number(result.lastInsertRowid), message: "Módulo criado." } };
    },
    { auth: true }
  );

  router.add(
    "PATCH",
    "/api/admin/modules/:id",
    async (ctx) => {
      const user = requireStaff(ctx);
      const module = await get("SELECT * FROM modules WHERE id = ?", Number(ctx.params.id));
      if (!module) bad("Módulo não encontrado.", 404);
      await assertCourseAccess(ctx, module.course_id);
      const title = ctx.body.title !== undefined ? text(ctx.body.title, "o título do módulo", { min: 2, max: 160 }) : module.title;
      const description = ctx.body.description !== undefined ? String(ctx.body.description).slice(0, 1000) : module.description;
      const position = ctx.body.position !== undefined ? intField(ctx.body.position, "posição", { min: 0, max: 999 }) : module.position;
      await run("UPDATE modules SET title = ?, description = ?, position = ? WHERE id = ?", title, description, position, module.id);
      await logActivity(user.id, "module.updated", "module", module.id, `Módulo ${title} atualizado.`);
      return { body: { message: "Módulo atualizado." } };
    },
    { auth: true }
  );

  router.add(
    "DELETE",
    "/api/admin/modules/:id",
    async (ctx) => {
      const user = requireStaff(ctx);
      const module = await get("SELECT * FROM modules WHERE id = ?", Number(ctx.params.id));
      if (!module) bad("Módulo não encontrado.", 404);
      await assertCourseAccess(ctx, module.course_id);
      await transaction(async (tx) => {
        await tx.run(
          "DELETE FROM materials WHERE lesson_id IN (SELECT id FROM lessons WHERE module_id = ?)",
          module.id
        );
        await tx.run(
          "DELETE FROM notes WHERE lesson_id IN (SELECT id FROM lessons WHERE module_id = ?)",
          module.id
        );
        await tx.run(
          "DELETE FROM lesson_progress WHERE lesson_id IN (SELECT id FROM lessons WHERE module_id = ?)",
          module.id
        );
        await tx.run(
          "UPDATE enrollments SET last_lesson_id = NULL WHERE last_lesson_id IN (SELECT id FROM lessons WHERE module_id = ?)",
          module.id
        );
        await tx.run("DELETE FROM lessons WHERE module_id = ?", module.id);
        await tx.run("DELETE FROM modules WHERE id = ?", module.id);
      });
      await logActivity(user.id, "module.deleted", "module", module.id, `Módulo ${module.title} removido.`);
      return { body: { message: "Módulo e aulas removidos." } };
    },
    { auth: true }
  );

  /* -------------------------------- Lessons -------------------------------- */
  router.add(
    "POST",
    "/api/admin/modules/:id/lessons",
    async (ctx) => {
      const user = requireStaff(ctx);
      const module = await get("SELECT * FROM modules WHERE id = ?", Number(ctx.params.id));
      if (!module) bad("Módulo não encontrado.", 404);
      await assertCourseAccess(ctx, module.course_id);
      const title = text(ctx.body.title, "o título da aula", { min: 2, max: 200 });
      const max = (await get("SELECT COALESCE(MAX(position), -1) AS p FROM lessons WHERE module_id = ?", module.id)).p;
      const result = await run(
        `INSERT INTO lessons (module_id, title, description, content, video_url, duration_minutes, position, is_free_preview, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        module.id,
        title,
        String(ctx.body.description || "").slice(0, 2000),
        String(ctx.body.content || "").slice(0, 30000),
        validateAssetPath(ctx.body.videoUrl || "/assets/video/aula-demonstracao.mp4", "video"),
        intField(ctx.body.durationMinutes, "duração", { min: 0, max: 10000, fallback: 0 }),
        Number(ctx.body.position ?? max + 1),
        boolField(ctx.body.isFreePreview) ? 1 : 0,
        nowIso()
      );
      const id = Number(result.lastInsertRowid);
      await logActivity(user.id, "lesson.created", "lesson", id, `Aula ${title} criada.`);
      return { status: 201, body: { id, message: "Aula criada." } };
    },
    { auth: true }
  );

  router.add(
    "PATCH",
    "/api/admin/lessons/:id",
    async (ctx) => {
      const user = requireStaff(ctx);
      const lesson = await get(
        `SELECT l.*, m.course_id FROM lessons l JOIN modules m ON m.id = l.module_id WHERE l.id = ?`,
        Number(ctx.params.id)
      );
      if (!lesson) bad("Aula não encontrada.", 404);
      await assertCourseAccess(ctx, lesson.course_id);
      const title = ctx.body.title !== undefined ? text(ctx.body.title, "o título da aula", { min: 2, max: 200 }) : lesson.title;
      const description = ctx.body.description !== undefined ? String(ctx.body.description).slice(0, 2000) : lesson.description;
      const content = ctx.body.content !== undefined ? String(ctx.body.content).slice(0, 30000) : lesson.content;
      const videoUrl = ctx.body.videoUrl !== undefined ? validateAssetPath(ctx.body.videoUrl, "video") : lesson.video_url;
      const duration = ctx.body.durationMinutes !== undefined ? intField(ctx.body.durationMinutes, "duração", { min: 0, max: 10000 }) : lesson.duration_minutes;
      const position = ctx.body.position !== undefined ? intField(ctx.body.position, "posição", { min: 0, max: 999 }) : lesson.position;
      const preview = ctx.body.isFreePreview !== undefined ? (boolField(ctx.body.isFreePreview) ? 1 : 0) : lesson.is_free_preview;
      await run(
        "UPDATE lessons SET title = ?, description = ?, content = ?, video_url = ?, duration_minutes = ?, position = ?, is_free_preview = ? WHERE id = ?",
        title,
        description,
        content,
        videoUrl,
        duration,
        position,
        preview,
        lesson.id
      );
      await logActivity(user.id, "lesson.updated", "lesson", lesson.id, `Aula ${title} atualizada.`);
      return { body: { message: "Aula atualizada." } };
    },
    { auth: true }
  );

  router.add(
    "DELETE",
    "/api/admin/lessons/:id",
    async (ctx) => {
      const user = requireStaff(ctx);
      const lesson = await get(
        `SELECT l.*, m.course_id FROM lessons l JOIN modules m ON m.id = l.module_id WHERE l.id = ?`,
        Number(ctx.params.id)
      );
      if (!lesson) bad("Aula não encontrada.", 404);
      await assertCourseAccess(ctx, lesson.course_id);
      await transaction(async (tx) => {
        await tx.run("DELETE FROM materials WHERE lesson_id = ?", lesson.id);
        await tx.run("DELETE FROM notes WHERE lesson_id = ?", lesson.id);
        await tx.run("DELETE FROM lesson_progress WHERE lesson_id = ?", lesson.id);
        await tx.run("UPDATE enrollments SET last_lesson_id = NULL WHERE last_lesson_id = ?", lesson.id);
        await tx.run("DELETE FROM lessons WHERE id = ?", lesson.id);
      });
      await logActivity(user.id, "lesson.deleted", "lesson", lesson.id, `Aula ${lesson.title} removida.`);
      return { body: { message: "Aula removida." } };
    },
    { auth: true }
  );

  /* ------------------------------- Materials ------------------------------- */
  router.add(
    "POST",
    "/api/admin/lessons/:id/materials",
    async (ctx) => {
      const user = requireStaff(ctx);
      const lesson = await get(
        `SELECT l.*, m.course_id FROM lessons l JOIN modules m ON m.id = l.module_id WHERE l.id = ?`,
        Number(ctx.params.id)
      );
      if (!lesson) bad("Aula não encontrada.", 404);
      await assertCourseAccess(ctx, lesson.course_id);
      const title = text(ctx.body.title, "o título do material", { min: 2, max: 160 });
      const fileUrl = validateAssetPath(ctx.body.fileUrl, "materials");
      if (!fileUrl) bad("Informe o arquivo do material.", 422);
      const result = await run(
        "INSERT INTO materials (lesson_id, title, file_url, file_type, size_label, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        lesson.id,
        title,
        fileUrl,
        String(ctx.body.fileType || "PDF").slice(0, 30),
        String(ctx.body.sizeLabel || "").slice(0, 30),
        nowIso()
      );
      return { status: 201, body: { id: Number(result.lastInsertRowid), message: "Material anexado." } };
    },
    { auth: true }
  );

  router.add(
    "DELETE",
    "/api/admin/materials/:id",
    async (ctx) => {
      const user = requireStaff(ctx);
      const material = await get(
        `SELECT mt.*, m.course_id FROM materials mt
           JOIN lessons l ON l.id = mt.lesson_id
           JOIN modules m ON m.id = l.module_id WHERE mt.id = ?`,
        Number(ctx.params.id)
      );
      if (!material) bad("Material não encontrado.", 404);
      await assertCourseAccess(ctx, material.course_id);
      await run("DELETE FROM materials WHERE id = ?", material.id);
      return { body: { message: "Material removido." } };
    },
    { auth: true }
  );

  /* ------------------------------- Assessment ------------------------------ */
  router.add(
    "PUT",
    "/api/admin/courses/:id/assessment",
    async (ctx) => {
      const user = requireStaff(ctx);
      const course = await assertCourseAccess(ctx, ctx.params.id);
      const existing = await get("SELECT * FROM assessments WHERE course_id = ?", course.id);
      const title = text(ctx.body.title, "o título da avaliação", { min: 3, max: 200 });
      const description = String(ctx.body.description || "").slice(0, 2000);
      const passScore = intField(ctx.body.passScore, "nota mínima", { min: 0, max: 100, fallback: 70 });
      const maxAttempts = intField(ctx.body.maxAttempts, "tentativas", { min: 0, max: 100, fallback: 3 });
      const published = boolField(ctx.body.isPublished, true) ? 1 : 0;
      if (existing) {
        await run(
          "UPDATE assessments SET title = ?, description = ?, pass_score = ?, max_attempts = ?, is_published = ? WHERE id = ?",
          title,
          description,
          passScore,
          maxAttempts,
          published,
          existing.id
        );
      } else {
        await run(
          "INSERT INTO assessments (course_id, title, description, pass_score, max_attempts, is_published, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          course.id,
          title,
          description,
          passScore,
          maxAttempts,
          published,
          nowIso()
        );
      }
      await logActivity(user.id, "assessment.updated", "course", course.id, "Configuração de avaliação atualizada.");
      return { body: { message: "Avaliação atualizada.", assessment: await getAssessmentMeta(course.id, { includeQuestions: true }) } };
    },
    { auth: true }
  );

  router.add(
    "POST",
    "/api/admin/courses/:id/questions",
    async (ctx) => {
      const user = requireStaff(ctx);
      const course = await assertCourseAccess(ctx, ctx.params.id);
      let assessment = await get("SELECT * FROM assessments WHERE course_id = ?", course.id);
      if (!assessment) {
        const result = await run(
          "INSERT INTO assessments (course_id, title, description, pass_score, max_attempts, is_published, created_at) VALUES (?, ?, ?, 70, 3, 1, ?)",
          course.id,
          "Avaliação final",
          "Avaliação do curso.",
          nowIso()
        );
        assessment = await get("SELECT * FROM assessments WHERE id = ?", Number(result.lastInsertRowid));
      }
      const question = normalizeQuestion(ctx.body);
      const max = (await get("SELECT COALESCE(MAX(position), -1) AS p FROM questions WHERE assessment_id = ?", assessment.id)).p;
      const result = await run(
        "INSERT INTO questions (assessment_id, text, type, options, correct_index, explanation, position) VALUES (?, ?, ?, ?, ?, ?, ?)",
        assessment.id,
        question.text,
        question.type,
        JSON.stringify(question.options),
        question.correctIndex,
        question.explanation,
        Number(ctx.body.position ?? max + 1)
      );
      await logActivity(user.id, "question.created", "assessment", assessment.id, "Questão adicionada.");
      return { status: 201, body: { id: Number(result.lastInsertRowid), message: "Questão adicionada." } };
    },
    { auth: true }
  );

  router.add(
    "PATCH",
    "/api/admin/questions/:id",
    async (ctx) => {
      const user = requireStaff(ctx);
      const question = await get(
        `SELECT q.*, a.course_id FROM questions q JOIN assessments a ON a.id = q.assessment_id WHERE q.id = ?`,
        Number(ctx.params.id)
      );
      if (!question) bad("Questão não encontrada.", 404);
      await assertCourseAccess(ctx, question.course_id);
      const normalized = normalizeQuestion({
        text: ctx.body.text ?? question.text,
        type: ctx.body.type ?? question.type,
        options: ctx.body.options ?? parseJson(question.options, []),
        correctIndex: ctx.body.correctIndex ?? question.correct_index,
        explanation: ctx.body.explanation ?? question.explanation,
      });
      await run(
        "UPDATE questions SET text = ?, type = ?, options = ?, correct_index = ?, explanation = ? WHERE id = ?",
        normalized.text,
        normalized.type,
        JSON.stringify(normalized.options),
        normalized.correctIndex,
        normalized.explanation,
        question.id
      );
      return { body: { message: "Questão atualizada." } };
    },
    { auth: true }
  );

  router.add(
    "DELETE",
    "/api/admin/questions/:id",
    async (ctx) => {
      const user = requireStaff(ctx);
      const question = await get(
        `SELECT q.*, a.course_id FROM questions q JOIN assessments a ON a.id = q.assessment_id WHERE q.id = ?`,
        Number(ctx.params.id)
      );
      if (!question) bad("Questão não encontrada.", 404);
      await assertCourseAccess(ctx, question.course_id);
      await run("DELETE FROM questions WHERE id = ?", question.id);
      return { body: { message: "Questão removida." } };
    },
    { auth: true }
  );

  /* -------------------------------- Students ------------------------------- */
  router.add(
    "GET",
    "/api/admin/students",
    async (ctx) => {
      requireAdmin(ctx);
      const { page, limit, offset } = parsePage(ctx.query, { defaultLimit: 20, maxLimit: 100 });
      const where = ["u.role = 'student'"];
      const params = [];
      if (ctx.query.q) {
        where.push("(u.name LIKE ? OR u.email LIKE ?)");
        params.push(`%${ctx.query.q}%`, `%${ctx.query.q}%`);
      }
      if (["active", "blocked"].includes(ctx.query.status)) {
        where.push("u.status = ?");
        params.push(ctx.query.status);
      }
      const total = (await get(`SELECT COUNT(*) AS n FROM users u WHERE ${where.join(" AND ")}`, ...params)).n;
      const rows = await all(
        `SELECT u.id, u.name, u.email, u.phone, u.status, u.created_at, u.last_login_at,
                (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id AND e.status IN ('active','completed')) AS enrollment_count,
                (SELECT COUNT(*) FROM certificates c WHERE c.user_id = u.id) AS certificate_count,
                (SELECT COALESCE(ROUND(AVG(e.progress_percent)), 0) FROM enrollments e WHERE e.user_id = u.id AND e.status IN ('active','completed')) AS avg_progress
           FROM users u
          WHERE ${where.join(" AND ")}
          ORDER BY u.created_at DESC
          LIMIT ? OFFSET ?`,
        ...params,
        limit,
        offset
      );
      return {
        body: {
          items: rows.map((r) => ({
            id: r.id,
            name: r.name,
            email: r.email,
            phone: r.phone || "",
            status: r.status,
            createdAt: r.created_at,
            lastLoginAt: r.last_login_at,
            enrollmentCount: Number(r.enrollment_count),
            certificateCount: Number(r.certificate_count),
            avgProgress: Number(r.avg_progress),
          })),
          total: Number(total),
          page,
          pages: Math.max(1, Math.ceil(Number(total) / limit)),
        },
      };
    },
    { auth: true }
  );

  router.add(
    "GET",
    "/api/admin/students/:id",
    async (ctx) => {
      requireAdmin(ctx);
      const user = await get("SELECT * FROM users WHERE id = ? AND role = 'student'", Number(ctx.params.id));
      if (!user) bad("Aluno não encontrado.", 404);
      const enrollments = await all(
        `SELECT e.*, c.title AS course_title, c.slug AS course_slug, c.cover_image
           FROM enrollments e JOIN courses c ON c.id = e.course_id
          WHERE e.user_id = ? ORDER BY e.updated_at DESC`,
        user.id
      );
      const orders = await all(
        `SELECT o.*, c.title AS course_title FROM orders o JOIN courses c ON c.id = o.course_id WHERE o.user_id = ? ORDER BY o.created_at DESC`,
        user.id
      );
      const certificates = await all(
        "SELECT id, code, course_name, hours, issued_at FROM certificates WHERE user_id = ? ORDER BY issued_at DESC",
        user.id
      );
      const attempts = await all(
        `SELECT a.id, a.score, a.passed, a.submitted_at, s.title AS assessment_title, c.title AS course_title
           FROM attempts a JOIN assessments s ON s.id = a.assessment_id JOIN courses c ON c.id = s.course_id
          WHERE a.user_id = ? AND a.submitted_at IS NOT NULL ORDER BY a.submitted_at DESC`,
        user.id
      );
      const activity = await all(
        "SELECT action, entity, entity_id, detail, created_at FROM activity_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
        user.id
      );
      const allCourses = await all("SELECT id, title, price_cents FROM courses WHERE status = 'published' ORDER BY title");
      return {
        body: {
          student: publicUser(user),
          enrollments: enrollments.map(adminEnrollment),
          orders: orders.map((o) => ({
            id: o.id,
            code: o.code,
            status: o.status,
            totalCents: o.total_cents,
            createdAt: o.created_at,
            courseTitle: o.course_title,
          })),
          certificates,
          attempts: attempts.map((a) => ({ ...a, passed: Boolean(a.passed) })),
          activity,
          courses: allCourses,
        },
      };
    },
    { auth: true }
  );

  router.add(
    "PATCH",
    "/api/admin/students/:id",
    async (ctx) => {
      const admin = requireAdmin(ctx);
      const user = await get("SELECT * FROM users WHERE id = ? AND role = 'student'", Number(ctx.params.id));
      if (!user) bad("Aluno não encontrado.", 404);
      const status = ctx.body.status;
      if (!["active", "blocked"].includes(status)) bad("Status inválido.", 422);
      await run("UPDATE users SET status = ?, updated_at = ? WHERE id = ?", status, nowIso(), user.id);
      if (status === "blocked") await run("DELETE FROM sessions WHERE user_id = ?", user.id);
      await logActivity(admin.id, status === "blocked" ? "student.blocked" : "student.reactivated", "user", user.id, `Aluno ${user.name} ${status === "blocked" ? "bloqueado" : "reativado"}.`);
      return { body: { message: status === "blocked" ? "Acesso bloqueado." : "Acesso reativado." } };
    },
    { auth: true }
  );

  /* ------------------------------- Enrollments ----------------------------- */
  router.add(
    "GET",
    "/api/admin/enrollments",
    async (ctx) => {
      requireAdmin(ctx);
      const { page, limit, offset } = parsePage(ctx.query, { defaultLimit: 20, maxLimit: 100 });
      const where = ["1=1"];
      const params = [];
      if (ctx.query.status) {
        where.push("e.status = ?");
        params.push(String(ctx.query.status));
      }
      if (ctx.query.courseId) {
        where.push("e.course_id = ?");
        params.push(Number(ctx.query.courseId));
      }
      if (ctx.query.q) {
        where.push("(u.name LIKE ? OR u.email LIKE ? OR c.title LIKE ?)");
        params.push(`%${ctx.query.q}%`, `%${ctx.query.q}%`, `%${ctx.query.q}%`);
      }
      const total = (await get(
        `SELECT COUNT(*) AS n FROM enrollments e JOIN users u ON u.id = e.user_id JOIN courses c ON c.id = e.course_id WHERE ${where.join(" AND ")}`,
        ...params
      )).n;
      const rows = await all(
        `SELECT e.*, u.name AS student_name, u.email AS student_email,
                c.title AS course_title, c.slug AS course_slug, c.cover_image
           FROM enrollments e
           JOIN users u ON u.id = e.user_id
           JOIN courses c ON c.id = e.course_id
          WHERE ${where.join(" AND ")}
          ORDER BY e.updated_at DESC LIMIT ? OFFSET ?`,
        ...params,
        limit,
        offset
      );
      return {
        body: {
          items: rows.map(adminEnrollment),
          total: Number(total),
          page,
          pages: Math.max(1, Math.ceil(Number(total) / limit)),
        },
      };
    },
    { auth: true }
  );

  router.add(
    "POST",
    "/api/admin/enrollments",
    async (ctx) => {
      const admin = requireAdmin(ctx);
      const userId = intField(ctx.body.userId, "aluno", { min: 1 });
      const courseId = intField(ctx.body.courseId, "curso", { min: 1 });
      const student = await get("SELECT * FROM users WHERE id = ? AND role = 'student'", userId);
      if (!student) bad("Aluno não encontrado.", 404);
      const course = await get("SELECT * FROM courses WHERE id = ?", courseId);
      if (!course) bad("Curso não encontrado.", 404);
      const existing = await get("SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?", userId, courseId);
      if (existing) {
        await run("UPDATE enrollments SET status = 'active', updated_at = ? WHERE id = ?", nowIso(), existing.id);
      } else {
        await run(
          "INSERT INTO enrollments (user_id, course_id, status, source, progress_percent, enrolled_at, updated_at) VALUES (?, ?, 'active', 'admin', 0, ?, ?)",
          userId,
          courseId,
          nowIso(),
          nowIso()
        );
      }
      await logActivity(admin.id, "enrollment.created", "course", courseId, `Matrícula de ${student.name} atribuída manualmente.`);
      return { status: 201, body: { message: "Matrícula atribuída." } };
    },
    { auth: true }
  );

  router.add(
    "PATCH",
    "/api/admin/enrollments/:id",
    async (ctx) => {
      const admin = requireAdmin(ctx);
      const enrollment = await get("SELECT * FROM enrollments WHERE id = ?", Number(ctx.params.id));
      if (!enrollment) bad("Matrícula não encontrada.", 404);
      const status = ctx.body.status;
      if (!["active", "completed", "cancelled", "blocked"].includes(status)) bad("Status inválido.", 422);
      await run("UPDATE enrollments SET status = ?, updated_at = ? WHERE id = ?", status, nowIso(), enrollment.id);
      await logActivity(admin.id, "enrollment.updated", "enrollment", enrollment.id, `Matrícula atualizada para ${status}.`);
      return { body: { message: "Matrícula atualizada." } };
    },
    { auth: true }
  );

  /* ------------------------------- Instructors ----------------------------- */
  router.add(
    "GET",
    "/api/admin/instructors",
    async (ctx) => {
      requireStaff(ctx);
      return { body: { items: await listInstructors({ activeOnly: false }) } };
    },
    { auth: true }
  );

  router.add(
    "POST",
    "/api/admin/instructors",
    async (ctx) => {
      const admin = requireAdmin(ctx);
      const name = text(ctx.body.name, "o nome do instrutor", { min: 3, max: 160 });
      let userId = ctx.body.userId ? intField(ctx.body.userId, "usuário", { min: 1 }) : null;
      if (ctx.body.email) {
        const mail = email(ctx.body.email);
        if (await get("SELECT id FROM users WHERE email = ?", mail)) bad("Já existe um usuário com este e-mail.", 409);
        const password = String(ctx.body.password || "");
        const problem = passwordProblem(password);
        if (problem) bad(problem, 422);
        const result = await run(
          "INSERT INTO users (name, email, password_hash, role, status, created_at, updated_at) VALUES (?, ?, ?, 'instructor', 'active', ?, ?)",
          name,
          mail,
          hashPassword(password),
          nowIso(),
          nowIso()
        );
        userId = Number(result.lastInsertRowid);
      }
      if (userId) {
        const user = await get("SELECT id, role FROM users WHERE id = ?", userId);
        if (!user || !["instructor", "admin"].includes(user.role)) bad("Usuário inválido para instrutor.", 422);
        if (await get("SELECT id FROM instructors WHERE user_id = ?", userId)) bad("Este usuário já está vinculado a um instrutor.", 409);
      }
      const result = await run(
        "INSERT INTO instructors (user_id, name, title, bio, specialties, status, created_at) VALUES (?, ?, ?, ?, ?, 'active', ?)",
        userId,
        name,
        text(ctx.body.title, "a especialidade", { required: false, max: 160 }),
        String(ctx.body.bio || "").slice(0, 3000),
        String(ctx.body.specialties || "").slice(0, 500),
        nowIso()
      );
      await logActivity(admin.id, "instructor.created", "instructor", Number(result.lastInsertRowid), `Instrutor ${name} cadastrado.`);
      return { status: 201, body: { id: Number(result.lastInsertRowid), message: "Instrutor cadastrado." } };
    },
    { auth: true }
  );

  router.add(
    "PATCH",
    "/api/admin/instructors/:id",
    async (ctx) => {
      const admin = requireAdmin(ctx);
      const instructor = await get("SELECT * FROM instructors WHERE id = ?", Number(ctx.params.id));
      if (!instructor) bad("Instrutor não encontrado.", 404);
      const name = ctx.body.name !== undefined ? text(ctx.body.name, "o nome", { min: 3, max: 160 }) : instructor.name;
      const title = ctx.body.title !== undefined ? String(ctx.body.title).slice(0, 160) : instructor.title;
      const bio = ctx.body.bio !== undefined ? String(ctx.body.bio).slice(0, 3000) : instructor.bio;
      const specialties = ctx.body.specialties !== undefined ? String(ctx.body.specialties).slice(0, 500) : instructor.specialties;
      const status = ctx.body.status !== undefined && ["active", "inactive"].includes(ctx.body.status) ? ctx.body.status : instructor.status;
      await run(
        "UPDATE instructors SET name = ?, title = ?, bio = ?, specialties = ?, status = ? WHERE id = ?",
        name,
        title,
        bio,
        specialties,
        status,
        instructor.id
      );
      await logActivity(admin.id, "instructor.updated", "instructor", instructor.id, `Instrutor ${name} atualizado.`);
      return { body: { message: "Instrutor atualizado." } };
    },
    { auth: true }
  );

  /* --------------------------------- Orders -------------------------------- */
  router.add(
    "GET",
    "/api/admin/orders",
    async (ctx) => {
      requireAdmin(ctx);
      const { page, limit, offset } = parsePage(ctx.query, { defaultLimit: 20, maxLimit: 100 });
      const where = ["1=1"];
      const params = [];
      if (ctx.query.status) {
        where.push("o.status = ?");
        params.push(String(ctx.query.status));
      }
      if (ctx.query.q) {
        where.push("(o.code LIKE ? OR u.name LIKE ? OR u.email LIKE ? OR c.title LIKE ?)");
        params.push(`%${ctx.query.q}%`, `%${ctx.query.q}%`, `%${ctx.query.q}%`, `%${ctx.query.q}%`);
      }
      const total = (await get(
        `SELECT COUNT(*) AS n FROM orders o JOIN users u ON u.id = o.user_id JOIN courses c ON c.id = o.course_id WHERE ${where.join(" AND ")}`,
        ...params
      )).n;
      const rows = await all(
        `SELECT o.*, u.name AS student_name, u.email AS student_email, c.title AS course_title, c.slug AS course_slug
           FROM orders o JOIN users u ON u.id = o.user_id JOIN courses c ON c.id = o.course_id
          WHERE ${where.join(" AND ")}
          ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
        ...params,
        limit,
        offset
      );
      const summary = await get(
        `SELECT COALESCE(SUM(CASE WHEN status = 'approved' THEN total_cents ELSE 0 END), 0) AS revenue,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending,
                COUNT(CASE WHEN status = 'approved' THEN 1 END) AS approved
           FROM orders`
      );
      return {
        body: {
          items: rows.map((o) => ({
            id: o.id,
            code: o.code,
            studentName: o.student_name,
            studentEmail: o.student_email,
            courseTitle: o.course_title,
            courseSlug: o.course_slug,
            status: o.status,
            amountCents: o.amount_cents,
            discountCents: o.discount_cents,
            totalCents: o.total_cents,
            paymentMethod: o.payment_method,
            provider: o.provider,
            providerRef: o.provider_ref,
            checkoutUrl: o.checkout_url,
            createdAt: o.created_at,
            paidAt: o.paid_at,
          })),
          total: Number(total),
          page,
          pages: Math.max(1, Math.ceil(Number(total) / limit)),
          summary: {
            revenueCents: Number(summary.revenue),
            pending: Number(summary.pending),
            approved: Number(summary.approved),
          },
          paymentsConfigured: paymentsConfigured(),
        },
      };
    },
    { auth: true }
  );

  router.add(
    "PATCH",
    "/api/admin/orders/:id",
    async (ctx) => {
      const admin = requireAdmin(ctx);
      const order = await get("SELECT * FROM orders WHERE id = ?", Number(ctx.params.id));
      if (!order) bad("Pedido não encontrado.", 404);
      const status = ctx.body.status;
      if (status === "approved") {
        const result = await approveOrderByCode(order.code, {
          provider: "manual",
          providerRef: `manual-${admin.id}-${Date.now()}`,
          method: ctx.body.paymentMethod || "manual",
        });
        if (result.error) bad(result.error, result.status || 400);
        await logActivity(admin.id, "order.approved", "order", order.id, `Pedido ${order.code} aprovado manualmente.`);
        return { body: { message: "Pagamento aprovado e acesso liberado." } };
      }
      if (status === "refunded") {
        const result = await refundOrder(order.id, admin.id);
        if (result.error) bad(result.error, result.status || 400);
        return { body: { message: "Pedido reembolsado." } };
      }
      if (["cancelled", "refused"].includes(status)) {
        await run("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?", status, nowIso(), order.id);
        if (status === "cancelled") {
          await run(
            "UPDATE enrollments SET status = 'cancelled', updated_at = ? WHERE user_id = ? AND course_id = ? AND status = 'active'",
            nowIso(),
            order.user_id,
            order.course_id
          );
        }
        await logActivity(admin.id, "order.updated", "order", order.id, `Pedido ${order.code} marcado como ${status}.`);
        return { body: { message: `Pedido atualizado para ${status}.` } };
      }
      bad("Status de pedido inválido.", 422);
    },
    { auth: true }
  );

  /* --------------------------------- Coupons ------------------------------- */
  router.add(
    "GET",
    "/api/admin/coupons",
    async (ctx) => {
      requireAdmin(ctx);
      const items = (await all("SELECT * FROM coupons ORDER BY created_at DESC")).map((c) => ({
        id: c.id,
        code: c.code,
        description: c.description,
        percentOff: c.percent_off,
        amountOffCents: c.amount_off_cents,
        maxUses: c.max_uses,
        usedCount: c.used_count,
        validUntil: c.valid_until,
        active: Boolean(c.active),
        createdAt: c.created_at,
      }));
      return { body: { items } };
    },
    { auth: true }
  );

  router.add(
    "POST",
    "/api/admin/coupons",
    async (ctx) => {
      const admin = requireAdmin(ctx);
      const code = text(ctx.body.code, "o código do cupom", { min: 3, max: 40 }).toUpperCase().replace(/\s+/g, "");
      if (await get("SELECT id FROM coupons WHERE code = ?", code)) bad("Já existe um cupom com este código.", 409);
      const percent = intField(ctx.body.percentOff, "percentual", { min: 0, max: 100, fallback: 0 });
      const amount = intField(ctx.body.amountOffCents, "valor", { min: 0, max: 100000000, fallback: 0 });
      if (!percent && !amount) bad("Informe um desconto percentual ou em reais.", 422);
      const result = await run(
        "INSERT INTO coupons (code, description, percent_off, amount_off_cents, max_uses, used_count, valid_until, active, created_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)",
        code,
        String(ctx.body.description || "").slice(0, 300),
        percent,
        amount,
        intField(ctx.body.maxUses, "limite de usos", { min: 0, max: 100000, fallback: 0 }),
        ctx.body.validUntil ? String(ctx.body.validUntil).slice(0, 30) : null,
        boolField(ctx.body.active, true) ? 1 : 0,
        nowIso()
      );
      await logActivity(admin.id, "coupon.created", "coupon", Number(result.lastInsertRowid), `Cupom ${code} criado.`);
      return { status: 201, body: { message: "Cupom criado." } };
    },
    { auth: true }
  );

  router.add(
    "PATCH",
    "/api/admin/coupons/:id",
    async (ctx) => {
      requireAdmin(ctx);
      const coupon = await get("SELECT * FROM coupons WHERE id = ?", Number(ctx.params.id));
      if (!coupon) bad("Cupom não encontrado.", 404);
      const active = ctx.body.active !== undefined ? boolField(ctx.body.active) : Boolean(coupon.active);
      const maxUses = ctx.body.maxUses !== undefined ? intField(ctx.body.maxUses, "limite de usos", { min: 0, max: 100000 }) : coupon.max_uses;
      const validUntil = ctx.body.validUntil !== undefined ? (ctx.body.validUntil ? String(ctx.body.validUntil).slice(0, 30) : null) : coupon.valid_until;
      await run("UPDATE coupons SET active = ?, max_uses = ?, valid_until = ? WHERE id = ?", active ? 1 : 0, maxUses, validUntil, coupon.id);
      return { body: { message: "Cupom atualizado." } };
    },
    { auth: true }
  );

  /* ---------------------------------- FAQs --------------------------------- */
  router.add(
    "GET",
    "/api/admin/faqs",
    async (ctx) => {
      requireAdmin(ctx);
      return { body: { items: (await all("SELECT * FROM faqs ORDER BY position, id")).map((f) => ({ ...f, published: Boolean(f.published) })) } };
    },
    { auth: true }
  );

  router.add(
    "POST",
    "/api/admin/faqs",
    async (ctx) => {
      requireAdmin(ctx);
      const question = text(ctx.body.question, "a pergunta", { min: 5, max: 300 });
      const answer = text(ctx.body.answer, "a resposta", { min: 10, max: 3000 });
      const max = (await get("SELECT COALESCE(MAX(position), -1) AS p FROM faqs")).p;
      await run(
        "INSERT INTO faqs (question, answer, position, published) VALUES (?, ?, ?, ?)",
        question,
        answer,
        Number(ctx.body.position ?? max + 1),
        boolField(ctx.body.published, true) ? 1 : 0
      );
      return { status: 201, body: { message: "Pergunta criada." } };
    },
    { auth: true }
  );

  router.add(
    "PATCH",
    "/api/admin/faqs/:id",
    async (ctx) => {
      requireAdmin(ctx);
      const faq = await get("SELECT * FROM faqs WHERE id = ?", Number(ctx.params.id));
      if (!faq) bad("Pergunta não encontrada.", 404);
      const question = ctx.body.question !== undefined ? text(ctx.body.question, "a pergunta", { min: 5, max: 300 }) : faq.question;
      const answer = ctx.body.answer !== undefined ? text(ctx.body.answer, "a resposta", { min: 10, max: 3000 }) : faq.answer;
      const published = ctx.body.published !== undefined ? (boolField(ctx.body.published) ? 1 : 0) : faq.published;
      const position = ctx.body.position !== undefined ? intField(ctx.body.position, "posição", { min: 0, max: 999 }) : faq.position;
      await run("UPDATE faqs SET question = ?, answer = ?, published = ?, position = ? WHERE id = ?", question, answer, published, position, faq.id);
      return { body: { message: "Pergunta atualizada." } };
    },
    { auth: true }
  );

  router.add(
    "DELETE",
    "/api/admin/faqs/:id",
    async (ctx) => {
      requireAdmin(ctx);
      await run("DELETE FROM faqs WHERE id = ?", Number(ctx.params.id));
      return { body: { message: "Pergunta removida." } };
    },
    { auth: true }
  );

  /* ------------------------------ Testimonials ----------------------------- */
  router.add(
    "GET",
    "/api/admin/testimonials",
    async (ctx) => {
      requireAdmin(ctx);
      return {
        body: {
          items: (await all("SELECT * FROM testimonials ORDER BY id DESC")).map((t) => ({
            ...t,
            authorized: Boolean(t.authorized),
            published: Boolean(t.published),
          })),
        },
      };
    },
    { auth: true }
  );

  router.add(
    "POST",
    "/api/admin/testimonials",
    async (ctx) => {
      const admin = requireAdmin(ctx);
      const studentName = text(ctx.body.studentName, "o nome do aluno", { min: 2, max: 120 });
      const quote = text(ctx.body.quote, "o depoimento", { min: 20, max: 2000 });
      const authorized = boolField(ctx.body.authorized);
      const published = boolField(ctx.body.published);
      if (published && !authorized) bad("Só é possível publicar depoimentos com autorização registrada.", 422);
      const result = await run(
        "INSERT INTO testimonials (student_name, course_name, quote, photo_url, authorized, published, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        studentName,
        String(ctx.body.courseName || "").slice(0, 160),
        quote,
        validateAssetPath(ctx.body.photoUrl, "img"),
        authorized ? 1 : 0,
        published ? 1 : 0,
        nowIso()
      );
      await logActivity(admin.id, "testimonial.created", "testimonial", Number(result.lastInsertRowid), "Depoimento cadastrado.");
      return { status: 201, body: { message: "Depoimento cadastrado." } };
    },
    { auth: true }
  );

  router.add(
    "PATCH",
    "/api/admin/testimonials/:id",
    async (ctx) => {
      requireAdmin(ctx);
      const t = await get("SELECT * FROM testimonials WHERE id = ?", Number(ctx.params.id));
      if (!t) bad("Depoimento não encontrado.", 404);
      const authorized = ctx.body.authorized !== undefined ? boolField(ctx.body.authorized) : Boolean(t.authorized);
      const published = ctx.body.published !== undefined ? boolField(ctx.body.published) : Boolean(t.published);
      if (published && !authorized) bad("Registre a autorização antes de publicar o depoimento.", 422);
      await run(
        "UPDATE testimonials SET student_name = ?, course_name = ?, quote = ?, photo_url = ?, authorized = ?, published = ? WHERE id = ?",
        ctx.body.studentName !== undefined ? text(ctx.body.studentName, "o nome", { min: 2, max: 120 }) : t.student_name,
        ctx.body.courseName !== undefined ? String(ctx.body.courseName).slice(0, 160) : t.course_name,
        ctx.body.quote !== undefined ? text(ctx.body.quote, "o depoimento", { min: 20, max: 2000 }) : t.quote,
        ctx.body.photoUrl !== undefined ? validateAssetPath(ctx.body.photoUrl, "img") : t.photo_url,
        authorized ? 1 : 0,
        published ? 1 : 0,
        t.id
      );
      return { body: { message: "Depoimento atualizado." } };
    },
    { auth: true }
  );

  router.add(
    "DELETE",
    "/api/admin/testimonials/:id",
    async (ctx) => {
      requireAdmin(ctx);
      await run("DELETE FROM testimonials WHERE id = ?", Number(ctx.params.id));
      return { body: { message: "Depoimento removido." } };
    },
    { auth: true }
  );

  /* ------------------------------- Categories ------------------------------ */
  router.add(
    "GET",
    "/api/admin/categories",
    async (ctx) => {
      requireStaff(ctx);
      return { body: { items: await listCategories({ activeOnly: false }) } };
    },
    { auth: true }
  );

  router.add(
    "POST",
    "/api/admin/categories",
    async (ctx) => {
      requireAdmin(ctx);
      const name = text(ctx.body.name, "o nome da categoria", { min: 2, max: 80 });
      const slug = slugify(ctx.body.slug || name);
      if (await get("SELECT id FROM categories WHERE slug = ?", slug)) bad("Já existe uma categoria com este identificador.", 409);
      const max = (await get("SELECT COALESCE(MAX(position), -1) AS p FROM categories")).p;
      await run(
        "INSERT INTO categories (name, slug, description, icon, position, active) VALUES (?, ?, ?, ?, ?, ?)",
        name,
        slug,
        String(ctx.body.description || "").slice(0, 500),
        String(ctx.body.icon || "graduation").slice(0, 40),
        Number(ctx.body.position ?? max + 1),
        boolField(ctx.body.active, true) ? 1 : 0
      );
      return { status: 201, body: { message: "Categoria criada." } };
    },
    { auth: true }
  );

  router.add(
    "PATCH",
    "/api/admin/categories/:id",
    async (ctx) => {
      requireAdmin(ctx);
      const category = await get("SELECT * FROM categories WHERE id = ?", Number(ctx.params.id));
      if (!category) bad("Categoria não encontrada.", 404);
      await run(
        "UPDATE categories SET name = ?, description = ?, active = ? WHERE id = ?",
        ctx.body.name !== undefined ? text(ctx.body.name, "o nome", { min: 2, max: 80 }) : category.name,
        ctx.body.description !== undefined ? String(ctx.body.description).slice(0, 500) : category.description,
        ctx.body.active !== undefined ? (boolField(ctx.body.active) ? 1 : 0) : category.active,
        category.id
      );
      return { body: { message: "Categoria atualizada." } };
    },
    { auth: true }
  );

  /* ---------------------------------- Leads -------------------------------- */
  router.add(
    "GET",
    "/api/admin/leads",
    async (ctx) => {
      requireAdmin(ctx);
      const where = ["1=1"];
      const params = [];
      if (ctx.query.status) {
        where.push("status = ?");
        params.push(String(ctx.query.status));
      }
      if (ctx.query.q) {
        where.push("(name LIKE ? OR email LIKE ? OR message LIKE ?)");
        params.push(`%${ctx.query.q}%`, `%${ctx.query.q}%`, `%${ctx.query.q}%`);
      }
      const items = await all(
        `SELECT * FROM leads WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT 200`,
        ...params
      );
      return { body: { items } };
    },
    { auth: true }
  );

  router.add(
    "PATCH",
    "/api/admin/leads/:id",
    async (ctx) => {
      requireAdmin(ctx);
      const lead = await get("SELECT * FROM leads WHERE id = ?", Number(ctx.params.id));
      if (!lead) bad("Contato não encontrado.", 404);
      if (!["new", "contacted", "archived"].includes(ctx.body.status)) bad("Status inválido.", 422);
      await run("UPDATE leads SET status = ? WHERE id = ?", ctx.body.status, lead.id);
      return { body: { message: "Contato atualizado." } };
    },
    { auth: true }
  );

  /* -------------------------------- Settings ------------------------------- */
  const SETTING_KEYS = new Set([
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
  ]);

  router.add(
    "GET",
    "/api/admin/settings",
    async (ctx) => {
      requireAdmin(ctx);
      const items = {};
      for (const row of await all("SELECT key, value FROM settings")) items[row.key] = row.value;
      return { body: { settings: items } };
    },
    { auth: true }
  );

  router.add(
    "PUT",
    "/api/admin/settings",
    async (ctx) => {
      const admin = requireAdmin(ctx);
      const values = ctx.body.settings;
      if (!values || typeof values !== "object") bad("Envie as configurações.", 422);
      for (const [key, value] of Object.entries(values)) {
        if (!SETTING_KEYS.has(key)) continue;
        if (key === "contact_instagram" && value && !/^https:\/\/(www\.)?instagram\.com\//i.test(String(value))) {
          bad("Informe uma URL válida do Instagram.", 422);
        }
        if (key === "contact_email" && value && !validEmail(value)) bad("E-mail de contato inválido.", 422);
        await run(
          "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
          key,
          String(value ?? "").slice(0, 12000)
        );
      }
      await logActivity(admin.id, "settings.updated", "settings", null, "Configurações institucionais atualizadas.");
      return { body: { message: "Configurações salvas." } };
    },
    { auth: true }
  );

  /* -------------------------------- Activity ------------------------------- */
  router.add(
    "GET",
    "/api/admin/activity",
    async (ctx) => {
      requireAdmin(ctx);
      const items = await all(
        `SELECT a.*, u.name AS user_name FROM activity_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC LIMIT 100`
      );
      return { body: { items } };
    },
    { auth: true }
  );
}

function normalizeQuestion(body) {
  const questionText = text(body.text, "o enunciado da questão", { min: 5, max: 1000 });
  const type = body.type === "boolean" ? "boolean" : "multiple";
  let options;
  if (type === "boolean") {
    options = ["Verdadeiro", "Falso"];
  } else {
    options = Array.isArray(body.options)
      ? body.options.map((o) => String(o || "").trim().slice(0, 300)).filter(Boolean)
      : String(body.options || "")
          .split(/\r?\n/)
          .map((o) => o.trim())
          .filter(Boolean);
    if (options.length < 2) bad("Informe pelo menos duas alternativas.", 422);
    if (options.length > 6) bad("Use no máximo seis alternativas.", 422);
  }
  const correctIndex = Number(body.correctIndex);
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
    bad("Informe a alternativa correta.", 422);
  }
  return {
    text: questionText,
    type,
    options,
    correctIndex,
    explanation: String(body.explanation || "").slice(0, 2000),
  };
}

module.exports = { register };
