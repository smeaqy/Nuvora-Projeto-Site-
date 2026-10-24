"use strict";

const { all, get, run, nowIso, logActivity, transaction } = require("../db");
const {
  parseJson,
  courseSummary,
  getCourseRow,
  getCourseContent,
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
} = require("../services");
const { newOrderCode } = require("../security");
const { createPreference, paymentsConfigured } = require("../payments");
const { requireStudent, bad, boolField } = require("./helpers");

async function courseRowForEnrollment(enrollment) {
  return await getCourseRow(enrollment.course_id);
}

async function enrollmentCourse(enrollmentId) {
  return await get(
    `SELECT e.*, c.title AS course_title, c.slug AS course_slug
       FROM enrollments e JOIN courses c ON c.id = e.course_id
      WHERE e.id = ?`,
    enrollmentId
  );
}

async function lessonContext(lessonId) {
  return await get(
    `SELECT l.*, m.course_id, m.title AS module_title, m.id AS module_id,
            c.title AS course_title, c.slug AS course_slug, c.status AS course_status
       FROM lessons l
       JOIN modules m ON m.id = l.module_id
       JOIN courses c ON c.id = m.course_id
      WHERE l.id = ?`,
    Number(lessonId)
  );
}

async function assertLessonAccess(user, lessonId) {
  const lesson = await lessonContext(lessonId);
  if (!lesson) bad("Aula não encontrada.", 404);
  const enrollment = await getEnrollment(user.id, lesson.course_id);
  if (!enrollment || ["cancelled", "blocked"].includes(enrollment.status)) {
    bad("Você não tem acesso a esta aula.", 403);
  }
  return { lesson, enrollment };
}

function sanitizedOrder(order) {
  return {
    id: order.id,
    code: order.code,
    status: order.status,
    amountCents: order.amount_cents,
    discountCents: order.discount_cents,
    totalCents: order.total_cents,
    paymentMethod: order.payment_method,
    provider: order.provider,
    checkoutUrl: order.checkout_url,
    createdAt: order.created_at,
    paidAt: order.paid_at,
    course: order.course_title
      ? {
          id: order.course_id,
          title: order.course_title,
          slug: order.course_slug,
          coverImage: order.cover_image,
        }
      : undefined,
  };
}

async function validateCoupon(code, priceCents) {
  if (!code) return { coupon: null, discount: 0 };
  const coupon = await get("SELECT * FROM coupons WHERE code = ?", String(code).trim().toUpperCase());
  if (!coupon || !coupon.active) bad("Cupom inválido ou inativo.", 422);
  if (coupon.valid_until && new Date(coupon.valid_until).getTime() < Date.now()) {
    bad("Este cupom expirou.", 422);
  }
  if (coupon.max_uses > 0 && coupon.used_count >= coupon.max_uses) {
    bad("Este cupom atingiu o limite de utilizações.", 422);
  }
  let discount = 0;
  if (coupon.percent_off > 0) {
    discount = Math.round((priceCents * coupon.percent_off) / 100);
  }
  if (coupon.amount_off_cents > 0) {
    discount = Math.max(discount, coupon.amount_off_cents);
  }
  discount = Math.min(priceCents, Math.max(0, discount));
  return { coupon, discount };
}

function register(router) {
  router.add(
    "GET",
    "/api/student/overview",
    async (ctx) => {
      const user = requireStudent(ctx);
      const enrollments = await all(
        "SELECT * FROM enrollments WHERE user_id = ? AND status IN ('active','completed') ORDER BY updated_at DESC",
        user.id
      );
      const cards = (await Promise.all(enrollments
        .map(async (e) => {
          const row = await courseRowForEnrollment(e);
          return row ? await studentCourseCard(e, row) : null;
        })))
        .filter(Boolean);
      const inProgress = cards.filter((c) => c.status === "active");
      const completed = cards.filter((c) => c.status === "completed");
      const certificates = (await all(
        `SELECT cert.*, c.cover_image, c.slug AS course_slug
           FROM certificates cert JOIN courses c ON c.id = cert.course_id
          WHERE cert.user_id = ? ORDER BY cert.issued_at DESC`,
        user.id
      )).map((cert) => ({
        id: cert.id,
        code: cert.code,
        courseName: cert.course_name,
        hours: cert.hours,
        issuedAt: cert.issued_at,
        courseSlug: cert.course_slug,
        coverImage: cert.cover_image,
      }));
      const completedLessons = await get(
        `SELECT COUNT(*) AS n,
                COALESCE(SUM(l.duration_minutes), 0) AS minutes
           FROM lesson_progress lp
           JOIN lessons l ON l.id = lp.lesson_id
           JOIN enrollments e ON e.id = lp.enrollment_id
          WHERE e.user_id = ? AND lp.completed = 1`,
        user.id
      );
      const assessmentTasks = [];
      const courseTasks = [];
      for (const e of enrollments) {
        const course = await get("SELECT * FROM courses WHERE id = ?", e.course_id);
        if (!course) continue;
        if (course.require_assessment) {
          const passed = await hasPassedAssessment(user.id, course.id);
          if (!passed) {
            const assessment = await getAssessmentMeta(course.id);
            if (assessment) {
              assessmentTasks.push({
                type: "assessment",
                courseId: course.id,
                courseTitle: course.title,
                slug: course.slug,
                title: assessment.title,
                questionCount: assessment.questionCount,
                passScore: assessment.passScore,
                deadline: null,
              });
            }
          }
        }
        if (e.status === "active" && e.progress_percent < 100) {
          courseTasks.push({
            type: "lesson",
            courseId: course.id,
            courseTitle: course.title,
            slug: course.slug,
            progress: e.progress_percent,
            lastLessonId: e.last_lesson_id,
          });
        }
      }
      const recommended = (await all(
        `SELECT c.*, cat.name AS category_name, cat.slug AS category_slug,
                i.name AS instructor_name, i.title AS instructor_title,
                (SELECT COUNT(*) FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.course_id = c.id) AS lesson_count
           FROM courses c
           LEFT JOIN categories cat ON cat.id = c.category_id
           LEFT JOIN instructors i ON i.id = c.instructor_id
          WHERE c.status = 'published'
            AND c.id NOT IN (SELECT course_id FROM enrollments WHERE user_id = ?)
          ORDER BY c.is_featured DESC, c.created_at DESC LIMIT 3`,
        user.id
      )).map((row) => ({ ...courseSummary(row), lessonCount: Number(row.lesson_count || 0) }));

      return {
        body: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone || "",
          },
          stats: {
            inProgress: inProgress.length,
            completed: completed.length,
            certificates: certificates.length,
            lessonsCompleted: Number(completedLessons.n || 0),
            studyMinutes: Number(completedLessons.minutes || 0),
          },
          continueLearning: inProgress[0] || null,
          recentCourses: cards.slice(0, 4),
          tasks: [...assessmentTasks.slice(0, 3), ...courseTasks.slice(0, 3)].slice(0, 4),
          certificates: certificates.slice(0, 3),
          recommended,
        },
      };
    },
    { auth: true }
  );

  router.add(
    "GET",
    "/api/student/courses",
    async (ctx) => {
      const user = requireStudent(ctx);
      const filter = String(ctx.query.filter || "all");
      const enrollments = await all(
        "SELECT * FROM enrollments WHERE user_id = ? ORDER BY updated_at DESC",
        user.id
      );
      const cards = (await Promise.all(enrollments
        .map(async (e) => {
          const row = await courseRowForEnrollment(e);
          return row ? await studentCourseCard(e, row) : null;
        })))
        .filter(Boolean);
      const items = cards.filter((c) => {
        if (filter === "in_progress") return c.status === "active";
        if (filter === "completed") return c.status === "completed";
        if (filter === "not_started") return c.status === "active" && c.progress === 0;
        return c.status !== "cancelled";
      });
      return {
        body: {
          items,
          summary: {
            all: cards.filter((c) => c.status !== "cancelled").length,
            inProgress: cards.filter((c) => c.status === "active").length,
            completed: cards.filter((c) => c.status === "completed").length,
            notStarted: cards.filter((c) => c.status === "active" && c.progress === 0).length,
          },
        },
      };
    },
    { auth: true }
  );

  router.add(
    "GET",
    "/api/student/courses/:id",
    async (ctx) => {
      const user = requireStudent(ctx);
      const row = await getCourseRow(ctx.params.id, { includeArchived: true });
      if (!row) bad("Curso não encontrado.", 404);
      const enrollment = await getEnrollment(user.id, row.id);
      if (!enrollment || ["cancelled", "blocked"].includes(enrollment.status)) {
        bad("Você não tem acesso a este curso.", 403);
      }
      const content = await getCourseContent(row.id);
      const progress = await progressMap(enrollment.id);
      const assessment = await getAssessmentMeta(row.id, { includeQuestions: false });
      const attempts = assessment
        ? await all(
            "SELECT id, score, passed, started_at, submitted_at FROM attempts WHERE assessment_id = ? AND user_id = ? AND submitted_at IS NOT NULL ORDER BY submitted_at DESC",
            assessment.id,
            user.id
          )
        : [];
      const nextLesson = content.lessons.find((l) => !progress.get(l.id)?.completed);
      const certificate = await certificateRow(enrollment.id);
      const completedIds = content.lessons.filter((l) => progress.get(l.id)?.completed).map((l) => l.id);
      return {
        body: {
          course: courseSummary(row),
          enrollment: {
            id: enrollment.id,
            status: enrollment.status,
            progress: enrollment.progress_percent,
            lastLessonId: enrollment.last_lesson_id,
            enrolledAt: enrollment.enrolled_at,
            completedAt: enrollment.completed_at,
          },
          modules: content.modules.map((m) => ({
            ...m,
            lessons: m.lessons.map((l) => ({
              ...l,
              completed: completedIds.includes(l.id),
            })),
          })),
          nextLesson: nextLesson
            ? { id: nextLesson.id, title: nextLesson.title, moduleId: nextLesson.moduleId }
            : null,
          assessment: assessment
            ? {
                id: assessment.id,
                title: assessment.title,
                description: assessment.description,
                passScore: assessment.passScore,
                maxAttempts: assessment.maxAttempts,
                questionCount: assessment.questionCount,
                attempts: attempts.map((a) => ({
                  id: a.id,
                  score: a.score,
                  passed: Boolean(a.passed),
                  submittedAt: a.submitted_at,
                })),
                passed: attempts.some((a) => a.passed),
                remainingAttempts:
                  assessment.maxAttempts > 0
                    ? Math.max(0, assessment.maxAttempts - attempts.length)
                    : null,
              }
            : null,
          certificate: certificate
            ? { code: certificate.code, issuedAt: certificate.issued_at }
            : null,
        },
      };
    },
    { auth: true }
  );

  router.add(
    "POST",
    "/api/student/courses/:id/enroll",
    async (ctx) => {
      const user = requireStudent(ctx);
      const course = await get("SELECT * FROM courses WHERE id = ? AND status = 'published'", Number(ctx.params.id));
      if (!course) bad("Curso indisponível para matrícula.", 404);
      const existing = await getEnrollment(user.id, course.id);
      if (existing && ["active", "completed"].includes(existing.status)) {
        return {
          body: {
            enrolled: true,
            alreadyEnrolled: true,
            enrollment: { id: existing.id, status: existing.status, progress: existing.progress_percent },
            message: "Você já está matriculado neste curso.",
          },
        };
      }
      if (existing && existing.status === "blocked") {
        bad("Sua matrícula neste curso está bloqueada. Fale com o suporte.", 403);
      }
      if (course.price_cents === 0) {
        if (existing) {
          await run("UPDATE enrollments SET status = 'active', updated_at = ? WHERE id = ?", nowIso(), existing.id);
        } else {
          await run(
            "INSERT INTO enrollments (user_id, course_id, status, source, progress_percent, enrolled_at, updated_at) VALUES (?, ?, 'active', 'free', 0, ?, ?)",
            user.id,
            course.id,
            nowIso(),
            nowIso()
          );
        }
        const enrollment = await getEnrollment(user.id, course.id);
        await logActivity(user.id, "enrollment.created", "course", course.id, `Matrícula gratuita no curso ${course.title}.`);
        return {
          status: 201,
          body: {
            enrolled: true,
            enrollment: { id: enrollment.id, status: enrollment.status, progress: enrollment.progress_percent },
            message: "Matrícula realizada. Bom estudo!",
          },
        };
      }

      const pending = await get(
        "SELECT * FROM orders WHERE user_id = ? AND course_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1",
        user.id,
        course.id
      );
      if (pending) {
        return {
          body: {
            enrolled: false,
            order: sanitizedOrder({
              ...pending,
              course_title: course.title,
              course_slug: course.slug,
              cover_image: course.cover_image,
            }),
            paymentsConfigured: paymentsConfigured(),
            message: "Você já possui um pedido pendente para este curso.",
          },
        };
      }

      const { coupon, discount } = await validateCoupon(ctx.body.coupon, course.price_cents);
      const total = Math.max(0, course.price_cents - discount);
      let order;
      try {
        order = await transaction(async (tx) => {
          const code = newOrderCode();
          const result = await tx.run(
            `INSERT INTO orders (code, user_id, course_id, status, amount_cents, discount_cents, total_cents, coupon_id, created_at, updated_at)
             VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`,
            code,
            user.id,
            course.id,
            course.price_cents,
            discount,
            total,
            coupon ? coupon.id : null,
            nowIso(),
            nowIso()
          );
          return await tx.get("SELECT * FROM orders WHERE id = ?", Number(result.lastInsertRowid));
        });
      } catch {
        bad("Não foi possível criar o pedido. Tente novamente.", 500);
      }
      await logActivity(user.id, "order.created", "order", order.id, `Pedido ${order.code} criado para ${course.title}.`);
      let checkout = { configured: false };
      try {
        checkout = await createPreference({
          order,
          course,
          user,
        });
      } catch (error) {
        console.error("[checkout] erro:", error.message);
        checkout = { configured: paymentsConfigured(), error: "Pagamento online indisponível no momento." };
      }
      const fresh = await get("SELECT * FROM orders WHERE id = ?", order.id);
      return {
        status: 201,
        body: {
          enrolled: false,
          order: sanitizedOrder({
            ...fresh,
            course_title: course.title,
            course_slug: course.slug,
            cover_image: course.cover_image,
          }),
          paymentsConfigured: paymentsConfigured(),
          checkoutUrl: checkout.checkoutUrl || null,
          message: checkout.checkoutUrl
            ? "Pedido criado. Continue para o pagamento."
            : "Pedido criado. O pagamento online ainda não está configurado; a equipe pode aprovar o pedido manualmente.",
        },
      };
    },
    { auth: true }
  );

  router.add(
    "GET",
    "/api/student/lessons/:id",
    async (ctx) => {
      const user = requireStudent(ctx);
      const { lesson, enrollment } = await assertLessonAccess(user, ctx.params.id);
      await run("UPDATE enrollments SET last_lesson_id = ?, updated_at = ? WHERE id = ?", lesson.id, nowIso(), enrollment.id);
      const content = await getCourseContent(lesson.course_id);
      const flat = content.lessons;
      const index = flat.findIndex((l) => l.id === lesson.id);
      const previous = index > 0 ? flat[index - 1] : null;
      const next = index >= 0 && index < flat.length - 1 ? flat[index + 1] : null;
      const progress = await progressMap(enrollment.id);
      const note = await get("SELECT content, updated_at FROM notes WHERE user_id = ? AND lesson_id = ?", user.id, lesson.id);
      const completion = await computeProgress(enrollment.id, lesson.course_id);
      return {
        body: {
          lesson: {
            id: lesson.id,
            title: lesson.title,
            description: lesson.description,
            content: lesson.content,
            videoUrl: lesson.video_url,
            durationMinutes: lesson.duration_minutes,
            isFreePreview: Boolean(lesson.is_free_preview),
            moduleId: lesson.module_id,
            moduleTitle: lesson.module_title,
            completed: Boolean(progress.get(lesson.id)?.completed),
            materials: content.modules
              .flatMap((m) => m.lessons)
              .find((l) => l.id === lesson.id)?.materials || [],
          },
          course: {
            id: lesson.course_id,
            title: lesson.course_title,
            slug: lesson.course_slug,
          },
          enrollment: {
            id: enrollment.id,
            progress: completion.percent,
            completedLessons: completion.done,
            totalLessons: completion.total,
            status: enrollment.status,
          },
          previousLesson: previous ? { id: previous.id, title: previous.title } : null,
          nextLesson: next ? { id: next.id, title: next.title } : null,
          note: note ? { content: note.content, updatedAt: note.updated_at } : null,
          modules: content.modules.map((m) => ({
            id: m.id,
            title: m.title,
            lessons: m.lessons.map((l) => ({
              id: l.id,
              title: l.title,
              durationMinutes: l.durationMinutes,
              isFreePreview: l.isFreePreview,
              completed: Boolean(progress.get(l.id)?.completed),
            })),
          })),
        },
      };
    },
    { auth: true }
  );

  router.add(
    "POST",
    "/api/student/lessons/:id/complete",
    async (ctx) => {
      const user = requireStudent(ctx);
      const { lesson, enrollment } = await assertLessonAccess(user, ctx.params.id);
      const completed = boolField(ctx.body.completed, true);
      await run(
        `INSERT INTO lesson_progress (enrollment_id, lesson_id, completed, completed_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(enrollment_id, lesson_id)
         DO UPDATE SET completed = excluded.completed,
                       completed_at = excluded.completed_at,
                       updated_at = excluded.updated_at`,
        enrollment.id,
        lesson.id,
        completed ? 1 : 0,
        completed ? nowIso() : null,
        nowIso()
      );
      const updated = await recalcEnrollment(enrollment.id);
      await logActivity(
        user.id,
        completed ? "lesson.completed" : "lesson.reopened",
        "lesson",
        lesson.id,
        `${completed ? "Concluiu" : "Reabriu"} a aula ${lesson.title}.`
      );
      return {
        body: {
          completed,
          enrollment: updated
            ? {
                status: updated.status,
                progress: updated.progress_percent,
                completed: updated.status === "completed",
              }
            : null,
          message: completed ? "Aula marcada como concluída." : "Aula marcada como não concluída.",
        },
      };
    },
    { auth: true }
  );

  router.add(
    "PUT",
    "/api/student/lessons/:id/note",
    async (ctx) => {
      const user = requireStudent(ctx);
      const { lesson } = await assertLessonAccess(user, ctx.params.id);
      const content = String(ctx.body.content || "").slice(0, 10000);
      await run(
        `INSERT INTO notes (user_id, lesson_id, content, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, lesson_id)
         DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
        user.id,
        lesson.id,
        content,
        nowIso()
      );
      return { body: { message: "Anotações salvas.", updatedAt: nowIso() } };
    },
    { auth: true }
  );

  router.add(
    "GET",
    "/api/student/assessments/:courseId",
    async (ctx) => {
      const user = requireStudent(ctx);
      const courseId = Number(ctx.params.courseId);
      const course = await getCourseRow(courseId, { includeArchived: true });
      if (!course) bad("Curso não encontrado.", 404);
      const enrollment = await getEnrollment(user.id, courseId);
      if (!enrollment || ["cancelled", "blocked"].includes(enrollment.status)) {
        bad("Você não tem acesso a esta avaliação.", 403);
      }
      const assessment = await getAssessmentMeta(courseId, { includeQuestions: true });
      if (!assessment || !assessment.isPublished) bad("Este curso não possui avaliação disponível.", 404);
      const attempts = await all(
        "SELECT id, score, passed, started_at, submitted_at FROM attempts WHERE assessment_id = ? AND user_id = ? ORDER BY id DESC",
        assessment.id,
        user.id
      );
      const submitted = attempts.filter((a) => a.submitted_at);
      const inProgress = attempts.find((a) => !a.submitted_at);
      return {
        body: {
          course: courseSummary(course),
          assessment: {
            id: assessment.id,
            title: assessment.title,
            description: assessment.description,
            passScore: assessment.passScore,
            maxAttempts: assessment.maxAttempts,
            questionCount: assessment.questionCount,
            questions: assessment.questions.map((q) => ({
              id: q.id,
              text: q.text,
              type: q.type,
              options: q.options,
              position: q.position,
            })),
            attempts: submitted.map((a) => ({
              id: a.id,
              score: a.score,
              passed: Boolean(a.passed),
              submittedAt: a.submitted_at,
            })),
            bestScore: submitted.length ? Math.max(...submitted.map((a) => a.score || 0)) : null,
            remainingAttempts:
              assessment.maxAttempts > 0 ? Math.max(0, assessment.maxAttempts - submitted.length) : null,
            inProgressAttemptId: inProgress ? inProgress.id : null,
            passed: submitted.some((a) => a.passed),
          },
        },
      };
    },
    { auth: true }
  );

  router.add(
    "POST",
    "/api/student/assessments/:courseId/attempts",
    async (ctx) => {
      const user = requireStudent(ctx);
      const courseId = Number(ctx.params.courseId);
      const enrollment = await getEnrollment(user.id, courseId);
      if (!enrollment || ["cancelled", "blocked"].includes(enrollment.status)) {
        bad("Você não tem acesso a esta avaliação.", 403);
      }
      const assessment = await getAssessmentMeta(courseId, { includeQuestions: true });
      if (!assessment || !assessment.isPublished) bad("Avaliação indisponível.", 404);
      const submitted = (await get(
        "SELECT COUNT(*) AS n FROM attempts WHERE assessment_id = ? AND user_id = ? AND submitted_at IS NOT NULL",
        assessment.id,
        user.id
      )).n;
      if (assessment.maxAttempts > 0 && submitted >= assessment.maxAttempts) {
        bad("Você atingiu o limite de tentativas desta avaliação.", 403);
      }
      const inProgress = await get(
        "SELECT id FROM attempts WHERE assessment_id = ? AND user_id = ? AND submitted_at IS NULL ORDER BY id DESC LIMIT 1",
        assessment.id,
        user.id
      );
      if (inProgress) {
        return { body: { attemptId: inProgress.id, resumed: true } };
      }
      const result = await run(
        "INSERT INTO attempts (assessment_id, user_id, enrollment_id, answers, started_at) VALUES (?, ?, ?, '{}', ?)",
        assessment.id,
        user.id,
        enrollment.id,
        nowIso()
      );
      return {
        status: 201,
        body: { attemptId: Number(result.lastInsertRowid), resumed: false },
      };
    },
    { auth: true }
  );

  router.add(
    "POST",
    "/api/student/attempts/:id/submit",
    async (ctx) => {
      const user = requireStudent(ctx);
      const attempt = await get(
        "SELECT * FROM attempts WHERE id = ? AND user_id = ?",
        Number(ctx.params.id),
        user.id
      );
      if (!attempt) bad("Tentativa não encontrada.", 404);
      if (attempt.submitted_at) bad("Esta tentativa já foi enviada.", 409);
      const assessment = await get(
        `SELECT a.*, c.id AS course_id, c.title AS course_title, c.require_assessment
           FROM assessments a JOIN courses c ON c.id = a.course_id WHERE a.id = ?`,
        attempt.assessment_id
      );
      if (!assessment) bad("Avaliação não encontrada.", 404);
      const questions = await all(
        "SELECT * FROM questions WHERE assessment_id = ? ORDER BY position, id",
        assessment.id
      );
      if (!questions.length) bad("Esta avaliação ainda não possui questões.", 409);
      const answers = ctx.body.answers;
      if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
        bad("Envie as respostas da avaliação.", 422);
      }
      let correct = 0;
      const feedback = [];
      for (const q of questions) {
        const raw = answers[String(q.id)] ?? answers[q.id];
        const selected = Number.isInteger(Number(raw)) ? Number(raw) : null;
        const isCorrect = selected === q.correct_index;
        if (isCorrect) correct += 1;
        feedback.push({
          questionId: q.id,
          text: q.text,
          options: parseJson(q.options, []),
          selected,
          correctIndex: q.correct_index,
          correct: isCorrect,
          explanation: q.explanation,
        });
      }
      const score = Math.round((correct / questions.length) * 1000) / 10;
      const passed = score >= assessment.pass_score;
      await run(
        "UPDATE attempts SET answers = ?, score = ?, passed = ?, submitted_at = ? WHERE id = ?",
        JSON.stringify(answers),
        score,
        passed ? 1 : 0,
        nowIso(),
        attempt.id
      );
      let enrollmentState = null;
      if (passed) {
        enrollmentState = await recalcEnrollment(attempt.enrollment_id);
        await logActivity(user.id, "assessment.passed", "assessment", assessment.id, `Aprovação com ${score}% em ${assessment.course_title}.`);
      } else {
        await logActivity(user.id, "assessment.failed", "assessment", assessment.id, `Tentativa com ${score}% em ${assessment.course_title}.`);
      }
      return {
        body: {
          score,
          passed,
          passScore: assessment.pass_score,
          correct,
          total: questions.length,
          feedback,
          enrollment: enrollmentState
            ? { status: enrollmentState.status, progress: enrollmentState.progress_percent }
            : null,
          message: passed
            ? "Avaliação concluída. Você atingiu a nota mínima."
            : "Avaliação concluída. Revise o feedback e tente novamente, se houver tentativas disponíveis.",
        },
      };
    },
    { auth: true }
  );

  router.add(
    "GET",
    "/api/student/attempts",
    async (ctx) => {
      const user = requireStudent(ctx);
      const rows = await all(
        `SELECT a.id, a.score, a.passed, a.started_at, a.submitted_at,
                s.title AS assessment_title, c.id AS course_id, c.title AS course_title, c.slug AS course_slug
           FROM attempts a
           JOIN assessments s ON s.id = a.assessment_id
           JOIN courses c ON c.id = s.course_id
          WHERE a.user_id = ? AND a.submitted_at IS NOT NULL
          ORDER BY a.submitted_at DESC`,
        user.id
      );
      return {
        body: {
          items: rows.map((r) => ({
            id: r.id,
            score: r.score,
            passed: Boolean(r.passed),
            submittedAt: r.submitted_at,
            assessmentTitle: r.assessment_title,
            courseId: r.course_id,
            courseTitle: r.course_title,
            courseSlug: r.course_slug,
          })),
        },
      };
    },
    { auth: true }
  );

  router.add(
    "GET",
    "/api/student/certificates",
    async (ctx) => {
      const user = requireStudent(ctx);
      const issued = (await all(
        `SELECT cert.*, c.slug AS course_slug, c.cover_image
           FROM certificates cert JOIN courses c ON c.id = cert.course_id
          WHERE cert.user_id = ? ORDER BY cert.issued_at DESC`,
        user.id
      )).map((c) => ({
        id: c.id,
        code: c.code,
        courseId: c.course_id,
        courseName: c.course_name,
        courseSlug: c.course_slug,
        coverImage: c.cover_image,
        studentName: c.student_name,
        hours: c.hours,
        issuedAt: c.issued_at,
      }));
      const enrollments = await all(
        "SELECT * FROM enrollments WHERE user_id = ? AND status IN ('active','completed')",
        user.id
      );
      const eligible = [];
      for (const e of enrollments) {
        const course = await get("SELECT * FROM courses WHERE id = ?", e.course_id);
        if (!course || !course.certificate_enabled) continue;
        if (await certificateRow(e.id)) continue;
        const state = await eligibility(user.id, e, course);
        if (state.eligible) {
          eligible.push({
            courseId: course.id,
            courseTitle: course.title,
            courseSlug: course.slug,
            coverImage: course.cover_image,
            hours: course.duration_hours,
            progress: state.progress,
            eligibility: state,
          });
        }
      }
      return { body: { issued, eligible } };
    },
    { auth: true }
  );

  router.add(
    "POST",
    "/api/student/courses/:id/certificate",
    async (ctx) => {
      const user = requireStudent(ctx);
      const result = await issueCertificate(user.id, Number(ctx.params.id));
      if (result.error) bad(result.error, result.status || 400, result.eligibility || null);
      return {
        status: 201,
        body: { certificate: result.certificate, message: "Certificado emitido com sucesso." },
      };
    },
    { auth: true }
  );

  router.add(
    "GET",
    "/api/student/orders",
    async (ctx) => {
      const user = requireStudent(ctx);
      const rows = await all(
        `SELECT o.*, c.title AS course_title, c.slug AS course_slug, c.cover_image
           FROM orders o JOIN courses c ON c.id = o.course_id
          WHERE o.user_id = ? ORDER BY o.created_at DESC`,
        user.id
      );
      return {
        body: {
          items: rows.map(sanitizedOrder),
          paymentsConfigured: paymentsConfigured(),
        },
      };
    },
    { auth: true }
  );

  router.add(
    "GET",
    "/api/student/orders/:code",
    async (ctx) => {
      const user = requireStudent(ctx);
      const order = await get(
        `SELECT o.*, c.title AS course_title, c.slug AS course_slug, c.cover_image
           FROM orders o JOIN courses c ON c.id = o.course_id
          WHERE o.code = ? AND o.user_id = ?`,
        String(ctx.params.code),
        user.id
      );
      if (!order) bad("Pedido não encontrado.", 404);
      const payments = await all(
        "SELECT status, method, amount_cents, created_at FROM payments WHERE order_id = ? ORDER BY id DESC",
        order.id
      );
      const enrollment = await getEnrollment(user.id, order.course_id);
      return {
        body: {
          order: sanitizedOrder(order),
          payments,
          enrollment: enrollment
            ? { id: enrollment.id, status: enrollment.status, progress: enrollment.progress_percent }
            : null,
          paymentsConfigured: paymentsConfigured(),
        },
      };
    },
    { auth: true }
  );
}

module.exports = { register, validateCoupon, sanitizedOrder };
