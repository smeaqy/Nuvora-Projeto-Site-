"use strict";

const config = require("../config");
const { get, all, run, nowIso, logActivity } = require("../db");
const {
  hashPassword,
  verifyPassword,
  newSession,
  sha256,
  randomToken,
  rateLimit,
  clearRateLimit,
  passwordProblem,
  validEmail,
} = require("../security");
const { publicUser, bad, text, email, requireUser } = require("./helpers");
const { sendMail } = require("../email");
const { currentUser } = require("../services");

const DUMMY_HASH = hashPassword("dummy-password-for-timing");

function sessionCookie(ctx, token, expiresAt) {
  const maxAge = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
  ctx.setCookie("bte_session", token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: "Lax",
    maxAge,
  });
}

async function createSession(ctx, userId) {
  const { token, hash } = newSession();
  const expires = new Date(Date.now() + config.security.sessionDays * 24 * 60 * 60 * 1000);
  await run(
    "INSERT INTO sessions (id, user_id, csrf, ip, user_agent, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    hash,
    userId,
    ctx.csrf,
    ctx.ip,
    String(ctx.headers["user-agent"] || "").slice(0, 300),
    expires.toISOString(),
    nowIso()
  );
  sessionCookie(ctx, token, expires.toISOString());
  return token;
}

function register(router) {
  router.add("GET", "/api/auth/csrf", (ctx) => ({
    body: { csrfToken: ctx.csrf },
  }));

  router.add("GET", "/api/auth/session", (ctx) => ({
    body: { user: ctx.user ? publicUser(ctx.user) : null },
  }));

  router.add("POST", "/api/auth/signup", async (ctx) => {
    const limit = rateLimit(`signup:${ctx.ip}`, 5, 60 * 60 * 1000);
    if (!limit.allowed) bad("Muitas tentativas de cadastro. Aguarde alguns minutos.", 429);
    const name = text(ctx.body.name, "seu nome", { min: 2, max: 120 });
    const mail = email(ctx.body.email);
    const phone = text(ctx.body.phone, "telefone", { required: false, max: 40 });
    const password = String(ctx.body.password || "");
    const problem = passwordProblem(password);
    if (problem) bad(problem, 422);
    if (!ctx.body.acceptTerms) bad("É necessário aceitar os termos de uso e a política de privacidade.", 422);
    if (await get("SELECT id FROM users WHERE email = ?", mail)) {
      bad("Já existe uma conta com este e-mail. Tente entrar ou recuperar sua senha.", 409);
    }
    const result = await run(
      `INSERT INTO users (name, email, password_hash, role, phone, status, created_at, updated_at)
       VALUES (?, ?, ?, 'student', ?, 'active', ?, ?)`,
      name,
      mail,
      hashPassword(password),
      phone,
      nowIso(),
      nowIso()
    );
    const userId = Number(result.lastInsertRowid);
    await createSession(ctx, userId);
    await run("UPDATE users SET last_login_at = ? WHERE id = ?", nowIso(), userId);
    await logActivity(userId, "auth.signup", "user", userId, "Nova conta de aluno criada.");
    sendMail({
      to: mail,
      subject: "Bem-vindo(a) à BrasilTec Educação",
      text: `Olá, ${name}!\n\nSua conta na plataforma da BrasilTec Educação foi criada.\nAcesse ${config.appUrl}/entrar para começar.\n\nSe você não fez este cadastro, ignore esta mensagem.`,
    }).catch(() => {});
    return {
      status: 201,
      body: {
        user: publicUser(await get("SELECT * FROM users WHERE id = ?", userId)),
        message: "Conta criada com sucesso.",
      },
    };
  });

  router.add("POST", "/api/auth/login", async (ctx) => {
    const mail = email(ctx.body.email);
    const password = String(ctx.body.password || "");
    const key = `login:${ctx.ip}:${mail}`;
    const limit = rateLimit(key, config.security.loginMaxAttempts, config.security.loginWindowMs);
    if (!limit.allowed) {
      bad("Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.", 429);
    }
    const user = await get("SELECT * FROM users WHERE email = ?", mail);
    const ok = verifyPassword(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) {
      await logActivity(user?.id || null, "auth.login_failed", "user", user?.id || null, "Tentativa de login malsucedida.");
      bad("E-mail ou senha incorretos.", 401);
    }
    if (user.status !== "active") {
      bad("Este acesso está bloqueado. Fale com o suporte da BrasilTec Educação.", 403);
    }
    clearRateLimit(key);
    await createSession(ctx, user.id);
    await run("UPDATE users SET last_login_at = ? WHERE id = ?", nowIso(), user.id);
    await logActivity(user.id, "auth.login", "user", user.id, "Login realizado.");
    return {
      body: {
        user: publicUser(user),
        redirect: user.role === "admin" || user.role === "instructor" ? "/admin" : "/aluno",
      },
    };
  });

  router.add("POST", "/api/auth/logout", async (ctx) => {
    if (ctx.session) {
      await run("DELETE FROM sessions WHERE id = ?", ctx.session.id);
    }
    ctx.clearCookie("bte_session", { path: "/" });
    return { body: { message: "Sessão encerrada." } };
  });

  router.add("POST", "/api/auth/forgot-password", async (ctx) => {
    const limit = rateLimit(`forgot:${ctx.ip}`, 5, 60 * 60 * 1000);
    if (!limit.allowed) bad("Muitas solicitações. Aguarde alguns minutos.", 429);
    const mail = email(ctx.body.email);
    const user = await get("SELECT * FROM users WHERE email = ?", mail);
    let demoResetUrl = null;
    if (user) {
      const token = randomToken(32);
      const expires = new Date(Date.now() + 60 * 60 * 1000);
      await run("DELETE FROM password_resets WHERE user_id = ? OR expires_at < ?", user.id, nowIso());
      await run(
        "INSERT INTO password_resets (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
        sha256(token),
        user.id,
        expires.toISOString(),
        nowIso()
      );
      const resetUrl = `${config.appUrl}/redefinir-senha?token=${encodeURIComponent(token)}`;
      const result = await sendMail({
        to: mail,
        subject: "Redefinição de senha — BrasilTec Educação",
        text: `Olá, ${user.name}!\n\nRecebemos uma solicitação para redefinir sua senha.\nAcesse: ${resetUrl}\n\nO link expira em 1 hora. Se não foi você, ignore esta mensagem.`,
      });
      if (config.demoMode && !result.sent) demoResetUrl = resetUrl;
    }
    return {
      body: {
        message:
          "Se houver uma conta com este e-mail, enviaremos as instruções para redefinir a senha.",
        ...(demoResetUrl ? { demoResetUrl } : {}),
      },
    };
  });

  router.add("POST", "/api/auth/reset-password", async (ctx) => {
    const token = text(ctx.body.token, "o token", { min: 20, max: 300 });
    const password = String(ctx.body.password || "");
    const problem = passwordProblem(password);
    if (problem) bad(problem, 422);
    const row = await get("SELECT * FROM password_resets WHERE id = ?", sha256(token));
    if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
      bad("Este link de redefinição expirou ou já foi utilizado. Solicite um novo.", 410);
    }
    const user = await get("SELECT * FROM users WHERE id = ?", row.user_id);
    if (!user) bad("Conta não encontrada.", 404);
    await run("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", hashPassword(password), nowIso(), user.id);
    await run("UPDATE password_resets SET used_at = ? WHERE id = ?", nowIso(), row.id);
    await run("DELETE FROM sessions WHERE user_id = ?", user.id);
    await logActivity(user.id, "auth.password_reset", "user", user.id, "Senha redefinida por link de recuperação.");
    return { body: { message: "Senha redefinida. Você já pode entrar com a nova senha." } };
  });

  router.add(
    "POST",
    "/api/auth/change-password",
    async (ctx) => {
      const user = requireUser(ctx);
      const current = String(ctx.body.currentPassword || "");
      const next = String(ctx.body.newPassword || "");
      const problem = passwordProblem(next);
      if (problem) bad(problem, 422);
      const row = await get("SELECT password_hash FROM users WHERE id = ?", user.id);
      if (!verifyPassword(current, row.password_hash)) bad("A senha atual está incorreta.", 422);
      if (current === next) bad("A nova senha deve ser diferente da senha atual.", 422);
      await run("UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?", hashPassword(next), nowIso(), user.id);
      await run("DELETE FROM sessions WHERE user_id = ? AND id != ?", user.id, ctx.session?.id || "");
      await logActivity(user.id, "auth.password_changed", "user", user.id, "Senha alterada pelo próprio usuário.");
      return { body: { message: "Senha alterada com sucesso." } };
    },
    { auth: true }
  );

  router.add(
    "PATCH",
    "/api/student/profile",
    async (ctx) => {
      const user = requireUser(ctx);
      if (user.role !== "student") bad("Este perfil é exclusivo de alunos.", 403);
      const name = text(ctx.body.name, "seu nome", { min: 2, max: 120 });
      const phone = text(ctx.body.phone, "telefone", { required: false, max: 40 });
      await run("UPDATE users SET name = ?, phone = ?, updated_at = ? WHERE id = ?", name, phone, nowIso(), user.id);
      await logActivity(user.id, "profile.updated", "user", user.id, "Dados de perfil atualizados.");
      return { body: { user: await currentUser(user.id), message: "Perfil atualizado." } };
    },
    { auth: true }
  );

  router.add(
    "GET",
    "/api/student/export",
    async (ctx) => {
      const user = requireUser(ctx);
      if (user.role !== "student") bad("Exportação disponível apenas para alunos.", 403);
      const profile = await currentUser(user.id);
      const enrollments = await all(
        `SELECT e.id, e.status, e.progress_percent, e.enrolled_at, e.completed_at,
                c.title AS course_title, c.duration_hours
           FROM enrollments e JOIN courses c ON c.id = e.course_id
          WHERE e.user_id = ?`,
        user.id
      );
      const progress = await all(
        `SELECT lp.lesson_id, lp.completed, lp.completed_at, l.title AS lesson_title, c.title AS course_title
           FROM lesson_progress lp
           JOIN lessons l ON l.id = lp.lesson_id
           JOIN modules m ON m.id = l.module_id
           JOIN courses c ON c.id = m.course_id
           JOIN enrollments e ON e.id = lp.enrollment_id
          WHERE e.user_id = ?`,
        user.id
      );
      const notes = await all(
        `SELECT n.content, n.updated_at, l.title AS lesson_title
           FROM notes n JOIN lessons l ON l.id = n.lesson_id
          WHERE n.user_id = ?`,
        user.id
      );
      const attempts = await all(
        `SELECT a.score, a.passed, a.submitted_at, c.title AS course_title
           FROM attempts a
           JOIN assessments s ON s.id = a.assessment_id
           JOIN courses c ON c.id = s.course_id
          WHERE a.user_id = ? AND a.submitted_at IS NOT NULL`,
        user.id
      );
      const certificates = await all(
        "SELECT code, course_name, hours, issued_at FROM certificates WHERE user_id = ?",
        user.id
      );
      const orders = await all(
        `SELECT o.code, o.status, o.total_cents, o.created_at, c.title AS course_title
           FROM orders o JOIN courses c ON c.id = o.course_id
          WHERE o.user_id = ?`,
        user.id
      );
      return {
        body: {
          exportedAt: nowIso(),
          profile,
          enrollments,
          progress,
          notes,
          attempts,
          certificates,
          orders,
        },
        download: {
          filename: `meus-dados-brasiltec-${new Date().toISOString().slice(0, 10)}.json`,
          type: "application/json; charset=utf-8",
        },
      };
    },
    { auth: true }
  );
}

module.exports = { register, createSession };
