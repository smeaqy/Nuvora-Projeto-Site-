"use strict";

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

function removeDatabaseFiles(dbPath) {
  for (const file of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    try {
      fs.rmSync(file, { force: true });
    } catch {
      /* noop */
    }
  }
}

/**
 * Sobe uma instância isolada do servidor com banco temporário.
 * Retorna utilitários para encerrar e limpar os arquivos.
 */
async function startServer() {
  const port = 4300 + Math.floor(Math.random() * 500);
  const dbPath = path.join(ROOT, "data", `test-${process.pid}-${Date.now()}.db`);
  removeDatabaseFiles(dbPath);

  const child = spawn(process.execPath, ["server/server.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      APP_ENV: "development",
      PORT: String(port),
      APP_URL: `http://127.0.0.1:${port}`,
      DB_PATH: dbPath,
      DEMO_MODE: "1",
      COOKIE_SECURE: "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Servidor encerrou durante a inicialização:\n${output}`);
    }
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) {
        return {
          base,
          dbPath,
          child,
          output: () => output,
          async stop() {
            if (child.exitCode === null) {
              child.kill();
              await new Promise((resolve) => {
                const timer = setTimeout(resolve, 3000);
                child.once("exit", () => {
                  clearTimeout(timer);
                  resolve();
                });
              });
            }
            removeDatabaseFiles(dbPath);
          },
        };
      }
    } catch {
      /* servidor ainda inicializando */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  child.kill();
  throw new Error(`Tempo esgotado ao iniciar o servidor:\n${output}`);
}

/** Cliente HTTP com sessão por cookie e token CSRF. */
class Client {
  constructor(base) {
    this.base = base;
    this.cookies = new Map();
  }

  cookieHeader() {
    return [...this.cookies.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
  }

  storeCookies(response) {
    for (const header of response.headers.getSetCookie?.() || []) {
      const [pair] = header.split(";");
      const index = pair.indexOf("=");
      if (index > 0) this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
  }

  async request(pathname, { method = "GET", body, csrf = true } = {}) {
    const headers = { cookie: this.cookieHeader() };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (method !== "GET" && csrf) {
      headers["x-csrf-token"] = decodeURIComponent(this.cookies.get("bte_csrf") || "");
    }
    const response = await fetch(this.base + pathname, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
    this.storeCookies(response);
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: response.status, data, headers: response.headers };
  }

  async csrf() {
    return this.request("/api/auth/csrf");
  }

  async login(email, password) {
    await this.csrf();
    return this.request("/api/auth/login", { method: "POST", body: { email, password } });
  }

  async signup(data) {
    await this.csrf();
    return this.request("/api/auth/signup", {
      method: "POST",
      body: { acceptTerms: true, ...data },
    });
  }
}

const credentials = {
  admin: ["admin@brasiltec.demo", "Admin@2026"],
  instructor: ["instrutor@brasiltec.demo", "Instrutor@2026"],
  student: ["aluno@brasiltec.demo", "Aluno@2026"],
};

module.exports = { startServer, Client, credentials, ROOT };
