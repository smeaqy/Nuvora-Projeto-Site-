"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const dbPath = path.join(ROOT, "data", `test-vercel-${process.pid}-${Date.now()}.db`);

process.env.APP_ENV = "development";
process.env.DB_PATH = dbPath;
process.env.DEMO_MODE = "1";
process.env.COOKIE_SECURE = "0";
process.env.APP_URL = "http://127.0.0.1:4399";

const handler = require("../api/index.js");

let server = null;

function cleanup() {
  for (const file of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    try {
      fs.rmSync(file, { force: true });
    } catch {
      /* noop */
    }
  }
}

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await require("../server/db").closeDatabase();
  cleanup();
});

test("adapter da Vercel restaura a URL e serve site + API", async () => {
  server = http.createServer((req, res) => {
    // Simula o rewrite do vercel.json.
    const original = req.url || "/";
    const [pathname, query] = original.split("?");
    req.url = `/api/index?__path=${encodeURIComponent(pathname)}${query ? `&${query}` : ""}`;
    handler(req, res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).ok, true);

  const home = await fetch(`${base}/`);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /BrasilTec/);

  const catalog = await fetch(`${base}/cursos`);
  assert.equal(catalog.status, 200);
  assert.match(await catalog.text(), /catálogo|Cursos/i);

  const csrf = await fetch(`${base}/api/auth/csrf`);
  assert.equal(csrf.status, 200);
  assert.ok((await csrf.json()).csrfToken);

  const sitemap = await fetch(`${base}/sitemap.xml`);
  assert.equal(sitemap.status, 200);
  assert.match(await sitemap.text(), /<urlset/);

  const missing = await fetch(`${base}/api/rota-inexistente`);
  assert.equal(missing.status, 404);
});
