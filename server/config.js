"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnv(path.join(ROOT, ".env"));

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function int(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

const vercelHost =
  process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "";
const defaultAppUrl = vercelHost ? `https://${vercelHost}` : "http://localhost:4173";
const appUrl = (process.env.APP_URL || defaultAppUrl).replace(/\/+$/, "");
const appEnv =
  process.env.APP_ENV || (process.env.VERCEL ? "production" : "development");
const isProduction = appEnv === "production";

const config = {
  root: ROOT,
  appName: process.env.APP_NAME || "BrasilTec Educação",
  appEnv,
  isProduction,
  port: int(process.env.PORT, 4173),
  appUrl,
  dbPath: path.resolve(ROOT, process.env.DB_PATH || "data/brasiltec.db"),
  allowLocalDb: bool(process.env.ALLOW_LOCAL_DB, false),
  turso: {
    url: process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL || "",
    token: process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN || "",
  },
  demoMode: bool(process.env.DEMO_MODE, !isProduction),
  cookieSecure: bool(process.env.COOKIE_SECURE, isProduction),
  admin: {
    name: process.env.ADMIN_NAME || "Administração BrasilTec",
    email: (process.env.ADMIN_EMAIL || "admin@brasiltec.demo").toLowerCase(),
    password: process.env.ADMIN_PASSWORD || "Admin@2026",
  },
  mail: {
    resendKey: process.env.RESEND_API_KEY || "",
    from: process.env.MAIL_FROM || "BrasilTec Educação <no-reply@brasilteceducacao.com.br>",
    support: process.env.SUPPORT_EMAIL || "",
  },
  payments: {
    mpAccessToken: process.env.MP_ACCESS_TOKEN || "",
    mpWebhookSecret: process.env.MP_WEBHOOK_SECRET || "",
    mpPublicKey: process.env.MP_PUBLIC_KEY || "",
  },
  security: {
    loginMaxAttempts: int(process.env.LOGIN_MAX_ATTEMPTS, 8),
    loginWindowMs: int(process.env.LOGIN_WINDOW_MINUTES, 15) * 60 * 1000,
    sessionDays: 30,
    passwordIterations: 310000,
  },
};

config.public = {
  appName: config.appName,
  appEnv: config.appEnv,
  demoMode: config.demoMode,
  appUrl: config.appUrl,
  paymentsConfigured: Boolean(config.payments.mpAccessToken),
  mailConfigured: Boolean(config.mail.resendKey),
};

module.exports = config;
