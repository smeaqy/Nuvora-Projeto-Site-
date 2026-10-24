"use strict";

const { get, getSetting } = require("../db");
const { cleanText, normalizeEmail, validEmail } = require("../security");

class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details || null;
  }
}

function bad(message, status = 400, details = null) {
  throw new ApiError(status, message, details);
}

function createRouter() {
  const routes = [];
  function add(method, pattern, handler, opts = {}) {
    const segments = pattern.split("/").filter(Boolean);
    routes.push({ method, segments, handler, opts });
  }
  function match(method, pathname) {
    const segments = pathname.split("/").filter(Boolean);
    for (const route of routes) {
      if (route.method !== method) continue;
      if (route.segments.length !== segments.length) continue;
      const params = {};
      let ok = true;
      for (let i = 0; i < route.segments.length; i++) {
        const expected = route.segments[i];
        const actual = segments[i];
        if (expected.startsWith(":")) {
          params[expected.slice(1)] = decodeURIComponent(actual);
        } else if (expected !== actual) {
          ok = false;
          break;
        }
      }
      if (ok) return { route, params };
    }
    return null;
  }
  return { add, match, routes };
}

function requireUser(ctx) {
  if (!ctx.user) bad("Faça login para continuar.", 401);
  return ctx.user;
}

function requireRole(ctx, roles) {
  const user = requireUser(ctx);
  if (!roles.includes(user.role)) bad("Você não tem permissão para esta ação.", 403);
  return user;
}

function requireStudent(ctx) {
  return requireRole(ctx, ["student"]);
}

function requireAdmin(ctx) {
  return requireRole(ctx, ["admin"]);
}

function requireStaff(ctx) {
  return requireRole(ctx, ["admin", "instructor"]);
}

async function currentInstructorId(user) {
  if (!user || user.role !== "instructor") return null;
  const row = await get("SELECT id FROM instructors WHERE user_id = ?", user.id);
  return row ? row.id : null;
}

async function assertCourseAccess(ctx, courseId) {
  const user = requireStaff(ctx);
  const course = await get("SELECT * FROM courses WHERE id = ?", Number(courseId));
  if (!course) bad("Curso não encontrado.", 404);
  if (user.role === "instructor") {
    const instructorId = await currentInstructorId(user);
    if (!instructorId || course.instructor_id !== instructorId) {
      bad("Você só pode gerenciar os cursos vinculados ao seu perfil.", 403);
    }
  }
  return course;
}

function publicUser(row) {
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
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

function slugify(value) {
  return cleanText(value, 180)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function parsePage(query, { defaultLimit = 12, maxLimit = 60 } = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

function text(value, field, { min = 1, max = 500, required = true } = {}) {
  const clean = cleanText(value, max);
  if (required && clean.length < min) bad(`Informe ${field}.`, 422);
  if (clean.length > max) bad(`${field} deve ter no máximo ${max} caracteres.`, 422);
  return clean;
}

function email(value, field = "e-mail") {
  const normalized = normalizeEmail(value);
  if (!validEmail(normalized)) bad(`Informe um ${field} válido.`, 422);
  return normalized;
}

function intField(value, field, { min = 0, max = 99999999, fallback = 0 } = {}) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < min || n > max) bad(`${field} inválido.`, 422);
  return n;
}

function boolField(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return ["1", "true", "on", "yes"].includes(String(value).toLowerCase());
}

async function ensureUniqueSlug(base, ignoreId = null) {
  let slug = base || `curso-${Date.now().toString(36)}`;
  let i = 1;
  const check = ignoreId
    ? async (s) => await get("SELECT id FROM courses WHERE slug = ? AND id != ?", s, ignoreId)
    : async (s) => await get("SELECT id FROM courses WHERE slug = ?", s);
  while (await check(slug)) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

async function setting(key) {
  return await getSetting(key, "");
}

module.exports = {
  ApiError,
  bad,
  createRouter,
  requireUser,
  requireRole,
  requireStudent,
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
  setting,
};
