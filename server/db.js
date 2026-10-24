"use strict";

const fs = require("node:fs");
const path = require("node:path");
const config = require("./config");

let backend = null;
let initPromise = null;

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','instructor','admin')),
  phone TEXT,
  bio TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked')),
  must_change_password INTEGER NOT NULL DEFAULT 0,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS password_resets (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS instructors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  title TEXT,
  bio TEXT,
  specialties TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  objectives TEXT NOT NULL DEFAULT '[]',
  audience TEXT,
  requirements TEXT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  instructor_id INTEGER REFERENCES instructors(id) ON DELETE SET NULL,
  level TEXT NOT NULL DEFAULT 'iniciante' CHECK (level IN ('iniciante','intermediario','avancado')),
  modality TEXT NOT NULL DEFAULT 'online' CHECK (modality IN ('online','hibrido')),
  duration_hours INTEGER NOT NULL DEFAULT 0,
  price_cents INTEGER NOT NULL DEFAULT 0,
  is_featured INTEGER NOT NULL DEFAULT 0,
  certificate_enabled INTEGER NOT NULL DEFAULT 1,
  completion_percent INTEGER NOT NULL DEFAULT 100,
  require_assessment INTEGER NOT NULL DEFAULT 0,
  pass_score INTEGER NOT NULL DEFAULT 70,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  demo INTEGER NOT NULL DEFAULT 1,
  cover_image TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);
CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category_id);

CREATE TABLE IF NOT EXISTS modules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_modules_course ON modules(course_id);

CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  video_url TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  is_free_preview INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lessons_module ON lessons(module_id);

CREATE TABLE IF NOT EXISTS materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  size_label TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled','blocked')),
  source TEXT NOT NULL DEFAULT 'self',
  progress_percent INTEGER NOT NULL DEFAULT 0,
  last_lesson_id INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
  enrolled_at TEXT NOT NULL,
  completed_at TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, course_id)
);
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);

CREATE TABLE IF NOT EXISTS lesson_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed INTEGER NOT NULL DEFAULT 0,
  watched_seconds INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE (enrollment_id, lesson_id)
);
CREATE INDEX IF NOT EXISTS idx_progress_enrollment ON lesson_progress(enrollment_id);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL UNIQUE REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  pass_score INTEGER NOT NULL DEFAULT 70,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'multiple' CHECK (type IN ('multiple','boolean')),
  options TEXT NOT NULL,
  correct_index INTEGER NOT NULL,
  explanation TEXT,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_questions_assessment ON questions(assessment_id);

CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  answers TEXT NOT NULL DEFAULT '{}',
  score REAL,
  passed INTEGER,
  started_at TEXT NOT NULL,
  submitted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id, assessment_id);

CREATE TABLE IF NOT EXISTS certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  enrollment_id INTEGER NOT NULL UNIQUE REFERENCES enrollments(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  course_name TEXT NOT NULL,
  hours INTEGER NOT NULL,
  issued_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  percent_off INTEGER NOT NULL DEFAULT 0,
  amount_off_cents INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER NOT NULL DEFAULT 0,
  used_count INTEGER NOT NULL DEFAULT 0,
  valid_until TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','refused','refunded','cancelled')),
  amount_cents INTEGER NOT NULL,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  coupon_id INTEGER REFERENCES coupons(id) ON DELETE SET NULL,
  payment_method TEXT,
  provider TEXT,
  provider_ref TEXT,
  checkout_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  paid_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  method TEXT,
  amount_cents INTEGER NOT NULL,
  provider TEXT,
  provider_ref TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

CREATE TABLE IF NOT EXISTS testimonials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_name TEXT NOT NULL,
  course_name TEXT,
  quote TEXT NOT NULL,
  photo_url TEXT,
  authorized INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS faqs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','archived')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

/* Trava de seed: garante que apenas uma instância popule um banco vazio. */
CREATE TABLE IF NOT EXISTS seed_lock (
  id INTEGER PRIMARY KEY CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  detail TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);
`;

function nowIso() {
  return new Date().toISOString();
}

/* O schema é o mesmo para os dois drivers; só os PRAGMAs são exclusivos do arquivo local. */
const SCHEMA_BODY = SCHEMA.replace(/^PRAGMA[^;]+;\s*/gm, "").trim();

function normalizeParams(params) {
  return params.map((value) => {
    if (value === undefined) return null;
    if (typeof value === "boolean") return value ? 1 : 0;
    if (value instanceof Date) return value.toISOString();
    return value;
  });
}

/* ----------------------------- Driver local ------------------------------ */
/* node:sqlite — usado em desenvolvimento, testes e CLI. Síncrono por baixo,
   mas exposto com a mesma interface assíncrona do driver remoto.            */
function createLocalBackend() {
  const { DatabaseSync } = require("node:sqlite");
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  const database = new DatabaseSync(config.dbPath);
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec("PRAGMA busy_timeout = 5000;");

  const api = {
    kind: "local",
    async all(sql, ...params) {
      return database.prepare(sql).all(...normalizeParams(params));
    },
    async get(sql, ...params) {
      return database.prepare(sql).get(...normalizeParams(params));
    },
    async run(sql, ...params) {
      const result = database.prepare(sql).run(...normalizeParams(params));
      return {
        changes: Number(result.changes || 0),
        lastInsertRowid: Number(result.lastInsertRowid || 0),
      };
    },
    async exec(sql) {
      database.exec(sql);
    },
    async transaction(fn) {
      database.exec("BEGIN IMMEDIATE");
      try {
        const result = await fn(api);
        database.exec("COMMIT");
        return result;
      } catch (error) {
        try {
          database.exec("ROLLBACK");
        } catch {
          /* noop */
        }
        throw error;
      }
    },
    async close() {
      database.close();
    },
  };
  return api;
}

/* ----------------------------- Driver remoto ----------------------------- */
/* @libsql/client/web — HTTP puro, sem módulo nativo, ideal para serverless.
   Funciona com Turso e qualquer endpoint libSQL compatível.                 */
function createRemoteBackend() {
  const { createClient } = require("@libsql/client/web");
  const client = createClient({
    url: config.turso.url,
    authToken: config.turso.token || undefined,
    intMode: "number",
  });

  const execute = async (sql, params, target) => {
    const result = await target.execute({ sql, args: normalizeParams(params) });
    return result;
  };

  const api = {
    kind: "remote",
    async all(sql, ...params) {
      const result = await execute(sql, params, client);
      return result.rows;
    },
    async get(sql, ...params) {
      const result = await execute(sql, params, client);
      return result.rows[0];
    },
    async run(sql, ...params) {
      const result = await execute(sql, params, client);
      return {
        changes: Number(result.rowsAffected || 0),
        lastInsertRowid: Number(result.lastInsertRowid || 0),
      };
    },
    async exec(sql) {
      await client.executeMultiple(sql);
    },
    async transaction(fn) {
      const tx = await client.transaction("write");
      const txApi = {
        async all(sql, ...params) {
          const result = await execute(sql, params, tx);
          return result.rows;
        },
        async get(sql, ...params) {
          const result = await execute(sql, params, tx);
          return result.rows[0];
        },
        async run(sql, ...params) {
          const result = await execute(sql, params, tx);
          return {
            changes: Number(result.rowsAffected || 0),
            lastInsertRowid: Number(result.lastInsertRowid || 0),
          };
        },
      };
      try {
        const result = await fn(txApi);
        await tx.commit();
        return result;
      } catch (error) {
        try {
          await tx.rollback();
        } catch {
          /* noop */
        }
        throw error;
      }
    },
    async close() {
      client.close();
    },
  };
  return api;
}

/* Seed estático para o driver remoto.
   O seed em JS faz centenas de idas e voltas HTTP e não cabe no tempo de
   execução de uma função serverless. O arquivo templates/seed.sql é gerado
   a partir do SQLite local e aplicado em uma única chamada. */
async function seedRemoteIfEmpty(backend) {
  const count = await backend.get("SELECT COUNT(*) AS total FROM users");
  if (Number(count.total) > 0) return false;

  const claim = await backend.run("INSERT OR IGNORE INTO seed_lock (id) VALUES (1)");
  if (Number(claim.changes) === 0) {
    // Outra instância está semeando: aguarda alguns segundos para não
    // devolver um catálogo vazio na primeira visita.
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const current = await backend.get("SELECT COUNT(*) AS total FROM users");
      if (Number(current.total) > 0) return false;
    }
    return false;
  }

  try {
    const seedFile = path.join(config.root, "templates", "seed.sql");
    const sql = fs.readFileSync(seedFile, "utf8");
    await backend.exec(sql);
    return true;
  } catch (error) {
    try {
      await backend.run("DELETE FROM seed_lock WHERE id = 1");
    } catch {
      /* noop */
    }
    throw error;
  }
}

async function openDatabase() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (!config.turso.url && config.isProduction && !config.allowLocalDb) {
      throw new Error(
        "TURSO_DATABASE_URL não configurado. Em produção (Vercel) o SQLite local é efêmero. " +
          "Crie um banco no Turso e defina TURSO_DATABASE_URL e TURSO_AUTH_TOKEN, " +
          "ou defina ALLOW_LOCAL_DB=1 para aceitar dados temporários."
      );
    }
    backend = config.turso.url ? createRemoteBackend() : createLocalBackend();
    await backend.exec(SCHEMA_BODY);
    if (config.turso.url) {
      await seedRemoteIfEmpty(backend);
    } else {
      const seed = require("./seed");
      await seed.seedIfEmpty(backend);
    }
    return backend;
  })().catch((error) => {
    initPromise = null;
    throw error;
  });
  return initPromise;
}

async function getDb() {
  await openDatabase();
  return backend;
}

async function closeDatabase() {
  if (backend) {
    const current = backend;
    backend = null;
    initPromise = null;
    await current.close();
  }
}

async function all(sql, ...params) {
  return (await getDb()).all(sql, ...params);
}

async function get(sql, ...params) {
  return (await getDb()).get(sql, ...params);
}

async function run(sql, ...params) {
  return (await getDb()).run(sql, ...params);
}

async function exec(sql) {
  return (await getDb()).exec(sql);
}

async function transaction(fn) {
  return (await getDb()).transaction(fn);
}

async function logActivity(userId, action, entity, entityId, detail) {
  try {
    await run(
      "INSERT INTO activity_log (user_id, action, entity, entity_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      userId || null,
      action,
      entity || null,
      entityId === undefined || entityId === null ? null : String(entityId),
      detail || null,
      nowIso()
    );
  } catch {
    /* auditoria nunca deve quebrar a ação principal */
  }
}

async function getSetting(key, fallback = "") {
  const row = await get("SELECT value FROM settings WHERE key = ?", key);
  return row ? row.value : fallback;
}

async function setSetting(key, value) {
  await run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    key,
    String(value ?? "")
  );
}

module.exports = {
  openDatabase,
  getDb,
  closeDatabase,
  all,
  get,
  run,
  exec,
  transaction,
  nowIso,
  logActivity,
  getSetting,
  setSetting,
};
