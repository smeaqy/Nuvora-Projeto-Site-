"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const { startServer, Client, credentials } = require("./helpers");

let server;
let base;
let admin;
let student;
let instructor;

const created = {
  email: `aluno.teste.${Date.now()}@example.com`,
  password: "Teste@2026",
  courseId: null,
  freeCourseId: null,
  freeCourseSlug: "excelencia-no-atendimento-ao-cliente",
  paidCourseSlug: "assistente-administrativo",
  orderCode: null,
  certificateCode: null,
};

before(async () => {
  server = await startServer();
  base = server.base;
  admin = new Client(base);
  student = new Client(base);
  instructor = new Client(base);
  const adminLogin = await admin.login(...credentials.admin);
  assert.equal(adminLogin.status, 200, "login do administrador de demonstração deve funcionar");
});

after(async () => {
  await server?.stop();
});

test("páginas públicas, SEO e catálogo respondem", async () => {
  const anon = new Client(base);
  const catalog = await anon.request("/api/public/courses");
  assert.equal(catalog.status, 200);
  assert.ok(Array.isArray(catalog.data.items));
  assert.ok(catalog.data.total >= 9);

  const course = await anon.request(`/api/public/courses/${created.freeCourseSlug}`);
  assert.equal(course.status, 200);
  assert.equal(course.data.course.slug, created.freeCourseSlug);
  assert.ok(course.data.outline.length > 0);
  created.freeCourseId = course.data.course.id;

  const filtered = await anon.request("/api/public/courses?price=free");
  assert.equal(filtered.status, 200);
  assert.ok(filtered.data.items.every((item) => item.isFree));

  const search = await anon.request("/api/public/courses?q=atendimento");
  assert.equal(search.status, 200);
  assert.ok(search.data.items.some((item) => item.slug === created.freeCourseSlug));

  const sitemap = await anon.request("/sitemap.xml");
  assert.equal(sitemap.status, 200);
  assert.match(sitemap.data, /<urlset/);
  assert.match(sitemap.data, new RegExp(created.freeCourseSlug));

  const robots = await anon.request("/robots.txt");
  assert.equal(robots.status, 200);
  assert.match(robots.data, /Disallow: \/aluno/);
  assert.match(robots.data, /Disallow: \/admin/);

  const privatePage = await anon.request("/aluno");
  assert.equal(privatePage.status, 200);
  assert.match(privatePage.data, /name="robots" content="noindex, nofollow"/);
});

test("cadastro valida dados e cria sessão autenticada", async () => {
  const invalid = await student.signup({
    name: "A",
    email: "invalido",
    password: "123",
    acceptTerms: false,
  });
  assert.equal(invalid.status, 422);
  assert.equal(invalid.data.error, true);
  assert.ok(String(invalid.data.message || "").length > 0, "erro de validação deve trazer mensagem");

  const shortPassword = await student.signup({
    name: "Aluno Válido",
    email: `curta.${Date.now()}@example.com`,
    password: "123",
  });
  assert.equal(shortPassword.status, 422);
  assert.match(shortPassword.data.message, /senha/i);

  const signup = await student.signup({
    name: "Aluno Teste Automatizado",
    email: created.email,
    password: created.password,
    phone: "(11) 99999-0000",
  });
  assert.equal(signup.status, 201);
  assert.equal(signup.data.user.email, created.email);
  assert.equal(signup.data.user.role, "student");

  const session = await student.request("/api/auth/session");
  assert.equal(session.status, 200);
  assert.equal(session.data.user.email, created.email);
});

test("rotas protegidas exigem autenticação, papel e CSRF", async () => {
  const anon = new Client(base);
  const unauthorized = await anon.request("/api/student/overview");
  assert.equal(unauthorized.status, 401);

  const forbidden = await student.request("/api/admin/overview");
  assert.equal(forbidden.status, 403);

  const noCsrf = await student.request("/api/student/lessons/1/complete", {
    method: "POST",
    body: { completed: true },
    csrf: false,
  });
  assert.equal(noCsrf.status, 403);

  const login = await instructor.login(...credentials.instructor);
  assert.equal(login.status, 200);
  assert.equal(login.data.user.role, "instructor");
  assert.equal((await instructor.request("/api/admin/overview")).status, 200);
  assert.equal((await instructor.request("/api/admin/students")).status, 403);
});

test("matrícula gratuita, progresso persistente e bloqueio de certificado", async () => {
  const enroll = await student.request(`/api/student/courses/${created.freeCourseId}/enroll`, {
    method: "POST",
    body: {},
  });
  assert.equal(enroll.status, 201);
  assert.equal(enroll.data.enrolled, true);

  const detail = await student.request(`/api/student/courses/${created.freeCourseId}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.data.enrollment.progress, 0);
  const lessons = detail.data.modules.flatMap((module) => module.lessons);
  assert.ok(lessons.length >= 2);

  const first = await student.request(`/api/student/lessons/${lessons[0].id}/complete`, {
    method: "POST",
    body: { completed: true },
  });
  assert.equal(first.status, 200);
  assert.ok(first.data.enrollment.progress > 0);

  const reopened = await student.request(`/api/student/lessons/${lessons[0].id}/complete`, {
    method: "POST",
    body: { completed: false },
  });
  assert.equal(reopened.status, 200);
  assert.equal(reopened.data.enrollment.progress, 0);

  await student.request(`/api/student/lessons/${lessons[0].id}/complete`, {
    method: "POST",
    body: { completed: true },
  });

  const note = await student.request(`/api/student/lessons/${lessons[0].id}/note`, {
    method: "PUT",
    body: { content: "Anotação persistente de teste." },
  });
  assert.equal(note.status, 200);

  const detailAgain = await student.request(`/api/student/courses/${created.freeCourseId}`);
  assert.equal(detailAgain.data.modules[0].lessons[0].completed, true);

  const lessonDetail = await student.request(`/api/student/lessons/${lessons[0].id}`);
  assert.equal(lessonDetail.status, 200);
  assert.equal(lessonDetail.data.note?.content, "Anotação persistente de teste.");

  const certificate = await student.request(`/api/student/courses/${created.freeCourseId}/certificate`, {
    method: "POST",
    body: {},
  });
  assert.equal(certificate.status, 400);
  assert.equal(certificate.data.details.eligible, false);
});

test("avaliação, conclusão do curso e emissão de certificado verificável", async () => {
  const detail = await student.request(`/api/student/courses/${created.freeCourseId}`);
  const lessons = detail.data.modules.flatMap((module) => module.lessons);
  for (const lesson of lessons) {
    await student.request(`/api/student/lessons/${lesson.id}/complete`, {
      method: "POST",
      body: { completed: true },
    });
  }

  const afterLessons = await student.request(`/api/student/courses/${created.freeCourseId}`);
  assert.equal(afterLessons.data.enrollment.progress, 100);
  assert.equal(afterLessons.data.enrollment.status, "active", "avaliação obrigatória deve manter o curso ativo");

  const assessment = await student.request(`/api/student/assessments/${created.freeCourseId}`);
  assert.equal(assessment.status, 200);
  assert.ok(assessment.data.assessment.questions.length >= 3);
  assert.equal(assessment.data.assessment.questions[0].correctIndex, undefined, "gabarito não deve ser exposto");

  await admin.login(...credentials.admin);
  const adminCourse = await admin.request(`/api/admin/courses/${created.freeCourseId}`);
  assert.equal(adminCourse.status, 200);
  const answers = {};
  for (const question of adminCourse.data.assessment.questions) {
    answers[question.id] = question.correctIndex;
  }

  const attempt = await student.request(`/api/student/assessments/${created.freeCourseId}/attempts`, {
    method: "POST",
    body: {},
  });
  assert.equal(attempt.status, 201);

  const submitted = await student.request(`/api/student/attempts/${attempt.data.attemptId}/submit`, {
    method: "POST",
    body: { answers },
  });
  assert.equal(submitted.status, 200);
  assert.equal(submitted.data.passed, true);
  assert.equal(submitted.data.score, 100);
  assert.equal(submitted.data.enrollment.status, "completed");

  const certificate = await student.request(`/api/student/courses/${created.freeCourseId}/certificate`, {
    method: "POST",
    body: {},
  });
  assert.equal(certificate.status, 201);
  created.certificateCode = certificate.data.certificate.code;
  assert.match(created.certificateCode, /^BTE-\d{4}-[A-Z0-9]{6}$/);

  const verification = await student.request(`/api/public/certificates/${created.certificateCode}`);
  assert.equal(verification.status, 200);
  assert.equal(verification.data.valid, true);
  assert.equal(verification.data.certificate.courseName, "Excelência no Atendimento ao Cliente");

  const attempts = await student.request("/api/student/attempts");
  assert.ok(attempts.data.items.some((item) => item.passed));
});

test("pedido pago fica pendente e só libera após aprovação administrativa", async () => {
  const catalog = await student.request("/api/public/courses?q=Assistente");
  const paid = catalog.data.items.find((item) => item.slug === created.paidCourseSlug);
  assert.ok(paid, "curso pago deve existir no catálogo");

  const order = await student.request(`/api/student/courses/${paid.id}/enroll`, {
    method: "POST",
    body: {},
  });
  assert.equal(order.status, 201);
  assert.equal(order.data.enrolled, false);
  assert.equal(order.data.order.status, "pending");
  created.orderCode = order.data.order.code;

  const coursesBefore = await student.request("/api/student/courses");
  assert.ok(
    !coursesBefore.data.items.some((item) => item.course.id === paid.id),
    "acesso não pode ser liberado antes do pagamento"
  );

  const approval = await admin.request(`/api/admin/orders/${order.data.order.id}`, {
    method: "PATCH",
    body: { status: "approved", paymentMethod: "pix" },
  });
  assert.equal(approval.status, 200);

  const orderAfter = await student.request(`/api/student/orders/${created.orderCode}`);
  assert.equal(orderAfter.status, 200);
  assert.equal(orderAfter.data.order.status, "approved");

  const coursesAfter = await student.request("/api/student/courses");
  assert.ok(
    coursesAfter.data.items.some((item) => item.course.id === paid.id),
    "matrícula deve ser criada após aprovação"
  );

  const overview = await admin.request("/api/admin/overview");
  assert.equal(overview.status, 200);
  assert.ok(overview.data.dashboard.revenueCents > 0);
});

test("administrador cria, publica e arquiva curso com módulo e aula", async () => {
  const create = await admin.request("/api/admin/courses", {
    method: "POST",
    body: {
      title: "Curso de Teste Automatizado",
      subtitle: "Curso criado pela suíte de testes.",
      description: "Conteúdo de validação do fluxo administrativo.",
      level: "iniciante",
      modality: "online",
      durationHours: 20,
      priceCents: 0,
      status: "draft",
      certificateEnabled: true,
      requireAssessment: false,
      completionPercent: 100,
      coverImage: "/assets/img/course-tech.jpg",
    },
  });
  assert.equal(create.status, 201);
  const courseId = create.data.id;

  const module = await admin.request(`/api/admin/courses/${courseId}/modules`, {
    method: "POST",
    body: { title: "Módulo de validação" },
  });
  assert.equal(module.status, 201);

  const lesson = await admin.request(`/api/admin/modules/${module.data.id}/lessons`, {
    method: "POST",
    body: {
      title: "Aula de validação",
      description: "Aula criada automaticamente.",
      content: "Conteúdo da aula de validação.",
      durationMinutes: 15,
    },
  });
  assert.equal(lesson.status, 201);

  const beforePublish = await student.request(`/api/public/courses/${create.data.course.slug}`);
  assert.equal(beforePublish.status, 404);

  const publish = await admin.request(`/api/admin/courses/${courseId}`, {
    method: "PATCH",
    body: { status: "published" },
  });
  assert.equal(publish.status, 200);

  const publicCourse = await student.request(`/api/public/courses/${create.data.course.slug}`);
  assert.equal(publicCourse.status, 200);
  assert.equal(publicCourse.data.outline.length, 1);
  assert.equal(publicCourse.data.outline[0].lessons.length, 1);

  const archive = await admin.request(`/api/admin/courses/${courseId}`, { method: "DELETE" });
  assert.equal(archive.status, 200);
  assert.equal((await student.request(`/api/public/courses/${create.data.course.slug}`)).status, 404);
});

test("contato registra lead visível para a administração", async () => {
  const anon = new Client(base);
  await anon.csrf();
  const contact = await anon.request("/api/public/contact", {
    method: "POST",
    body: {
      name: "Contato de Teste",
      email: "contato.teste@example.com",
      phone: "(11) 98888-7777",
      subject: "Dúvida sobre matrícula",
      message: "Mensagem enviada pela suíte automatizada para validar o formulário de contato.",
    },
  });
  assert.equal(contact.status, 201);

  const leads = await admin.request("/api/admin/leads");
  assert.equal(leads.status, 200);
  assert.ok(leads.data.items.some((lead) => lead.email === "contato.teste@example.com"));
});

test("logout invalida a sessão", async () => {
  const response = await student.request("/api/auth/logout", { method: "POST", body: {} });
  assert.equal(response.status, 200);
  assert.equal((await student.request("/api/student/overview")).status, 401);
});
