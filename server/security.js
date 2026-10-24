"use strict";

const crypto = require("node:crypto");
const config = require("./config");

const SCRYPT_ITERATIONS = config.security.passwordIterations;

/**
 * Hash de senha com PBKDF2-SHA512 + salt aleatório.
 * Formato: pbkdf2$iterações$salt$hash (base64url).
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(24);
  const hash = crypto.pbkdf2Sync(String(password), salt, SCRYPT_ITERATIONS, 64, "sha512");
  return `pbkdf2$${SCRYPT_ITERATIONS}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

function verifyPassword(password, stored) {
  if (typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(iterations) || iterations < 10000) return false;
  let salt;
  let expected;
  try {
    salt = Buffer.from(parts[2], "base64url");
    expected = Buffer.from(parts[3], "base64url");
  } catch {
    return false;
  }
  if (salt.length < 8 || expected.length < 32) return false;
  const actual = crypto.pbkdf2Sync(String(password), salt, iterations, expected.length, "sha512");
  return crypto.timingSafeEqual(actual, expected);
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function newSession() {
  const token = randomToken(32);
  return { token, hash: sha256(token) };
}

function newCsrf() {
  return randomToken(24);
}

function newCertificateCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return `BTE-${new Date().getFullYear()}-${code}`;
}

function newOrderCode() {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `PED-${stamp}-${suffix}`;
}

/* ----------------------------- Rate limiting ----------------------------- */

const buckets = new Map();

function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1, resetAt: now + windowMs };
  }
  bucket.count += 1;
  if (bucket.count > max) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }
  return { allowed: true, remaining: max - bucket.count, resetAt: bucket.resetAt };
}

function clearRateLimit(key) {
  buckets.delete(key);
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 60_000).unref();

/* ------------------------------- Cookies --------------------------------- */

function parseCookies(header) {
  const out = Object.create(null);
  if (!header) return out;
  for (const part of String(header).split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(part.slice(idx + 1).trim());
    } catch {
      out[key] = part.slice(idx + 1).trim();
    }
  }
  return out;
}

function cookieHeader(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || "/"}`);
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  parts.push(`SameSite=${options.sameSite || "Lax"}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  return parts.join("; ");
}

/* ------------------------------ Validation ------------------------------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function cleanText(value, max = 500) {
  if (value === undefined || value === null) return "";
  return String(value).replace(/\u0000/g, "").trim().slice(0, max);
}

function normalizeEmail(value) {
  return cleanText(value, 254).toLowerCase();
}

function validEmail(value) {
  return EMAIL_RE.test(normalizeEmail(value));
}

function passwordProblem(password) {
  if (typeof password !== "string" || password.length < 8) {
    return "A senha deve ter pelo menos 8 caracteres.";
  }
  if (password.length > 128) return "A senha deve ter no máximo 128 caracteres.";
  if (!/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) {
    return "A senha deve combinar letras e números.";
  }
  return null;
}

module.exports = {
  hashPassword,
  verifyPassword,
  randomToken,
  sha256,
  newSession,
  newCsrf,
  newCertificateCode,
  newOrderCode,
  rateLimit,
  clearRateLimit,
  parseCookies,
  cookieHeader,
  cleanText,
  normalizeEmail,
  validEmail,
  passwordProblem,
};
