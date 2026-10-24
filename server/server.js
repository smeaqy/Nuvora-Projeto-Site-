"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const config = require("./config");
const { openDatabase, closeDatabase, get, run, all, nowIso } = require("./db");
const {
  ApiError,
} = require("./api/helpers");
const { createApiRouter } = require("./api");
const {
  parseCookies,
  cookieHeader,
  newCsrf,
  sha256,
} = require("./security");

const PUBLIC_DIR = path.join(config.root, "public");
const INDEX_FILE = path.join(config.root, "templates", "index.html");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function plain(value, max = 170) {
  return String(value || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function securityHeaders(nonce) {
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "connect-src 'self'",
    "frame-src https://www.youtube.com https://player.vimeo.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
  return {
    ...SECURITY_HEADERS,
    "Content-Security-Policy": csp,
    ...(config.isProduction
      ? { "Strict-Transport-Security": "max-age=31536000; includeSubDomains" }
      : {}),
  };
}

function parseQuery(searchParams) {
  const out = Object.create(null);
  for (const [key, value] of searchParams.entries()) out[key] = value;
  return out;
}

function readBody(req, limit = 1_500_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new ApiError(413, "Conteúdo enviado é muito grande."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function resolveMeta(pathname) {
  const base = config.appUrl;
  const defaults = {
    title: "BrasilTec Educação — Cursos técnicos, profissionalizantes e pós-graduação EAD",
    description:
      "Conheça os cursos da BrasilTec Educação: formação técnica e profissionalizante, 100% online, com plataforma de aprendizagem, avaliações e certificados.",
    canonical: base + pathname,
    image: `${base}/assets/img/hero.jpg`,
    robots: "index, follow",
    jsonld: null,
  };
  const staticPages = {
    "/cursos": [
      "Cursos EAD — catálogo completo",
      "Explore cursos técnicos, profissionalizantes, pós-graduação e tecnologia na plataforma EAD da BrasilTec Educação.",
    ],
    "/sobre": [
      "Sobre a BrasilTec Educação",
      "Conheça a história, a proposta e os compromissos da BrasilTec Educação com o ensino a distância.",
    ],
    "/como-funciona": [
      "Como funciona a plataforma EAD",
      "Entenda o passo a passo da matrícula, do acesso às aulas, das avaliações e da emissão de certificados.",
    ],
    "/contato": [
      "Fale com a BrasilTec Educação",
      "Canais oficiais de contato e formulário para dúvidas sobre cursos, matrículas e certificados.",
    ],
    "/faq": [
      "Perguntas frequentes",
      "Respostas sobre acesso, matrícula, pagamentos, avaliações, certificados e suporte na plataforma.",
    ],
    "/verificar-certificado": [
      "Verificar certificado — BrasilTec Educação",
      "Consulte a autenticidade de um certificado emitido pela BrasilTec Educação usando o código de verificação.",
    ],
    "/privacidade": [
      "Política de privacidade e LGPD",
      "Como a BrasilTec Educação trata dados pessoais na plataforma de ensino a distância.",
    ],
    "/termos": [
      "Termos de uso",
      "Condições de uso da plataforma, matrículas, conteúdos, avaliações e certificados da BrasilTec Educação.",
    ],
  };
  if (staticPages[pathname]) {
    defaults.title = `${staticPages[pathname][0]} — BrasilTec Educação`;
    defaults.description = staticPages[pathname][1];
  }
  const courseMatch = pathname.match(/^\/cursos\/([^/]+)\/?$/);
  if (courseMatch) {
    const slug = decodeURIComponent(courseMatch[1]);
    const course = await get(
      "SELECT title, subtitle, description, cover_image, duration_hours, price_cents, demo FROM courses WHERE slug = ? AND status = 'published'",
      slug
    );
    if (course) {
      defaults.title = `${course.title} — BrasilTec Educação`;
      defaults.description = plain(course.subtitle || course.description, 165);
      defaults.canonical = `${base}/cursos/${encodeURIComponent(slug)}`;
      if (course.cover_image) {
        defaults.image = course.cover_image.startsWith("http")
          ? course.cover_image
          : `${base}/assets/img/${course.cover_image.replace(/^\/assets\/img\//, "")}`;
      }
      defaults.jsonld = {
        "@context": "https://schema.org",
        "@type": "Course",
        name: course.title,
        description: plain(course.description, 400),
        provider: {
          "@type": "EducationalOrganization",
          name: "BrasilTec Educação",
          sameAs: "https://www.instagram.com/brasilteceducacao/",
        },
        offers: {
          "@type": "Offer",
          category: "Paid",
          price: (Number(course.price_cents) / 100).toFixed(2),
          priceCurrency: "BRL",
          availability: "https://schema.org/InStock",
        },
        hasCourseInstance: {
          "@type": "CourseInstance",
          courseMode: "online",
          courseWorkload: `PT${Number(course.duration_hours) || 0}H`,
        },
      };
    }
  }
  for (const privatePath of ["/aluno", "/admin", "/checkout", "/entrar", "/cadastrar", "/recuperar-senha", "/redefinir-senha"]) {
    if (pathname === privatePath || pathname.startsWith(privatePath + "/")) {
      defaults.robots = "noindex, nofollow";
    }
  }
  return defaults;
}

function renderIndex(meta, nonce) {
  const template = fs.readFileSync(INDEX_FILE, "utf8");
  const jsonld = meta.jsonld
    ? `<script type="application/ld+json" nonce="${nonce}">${JSON.stringify(meta.jsonld).replace(/</g, "\\u003c")}</script>`
    : "";
  return template
    .replaceAll("__TITLE__", escapeHtml(meta.title))
    .replaceAll("__DESCRIPTION__", escapeHtml(meta.description))
    .replaceAll("__CANONICAL__", escapeHtml(meta.canonical))
    .replaceAll("__OG_IMAGE__", escapeHtml(meta.image))
    .replaceAll("__ROBOTS__", escapeHtml(meta.robots))
    .replaceAll("__NONCE__", nonce)
    .replaceAll("__JSONLD__", jsonld);
}

async function sitemap() {
  const staticRoutes = [
    "/",
    "/cursos",
    "/sobre",
    "/como-funciona",
    "/contato",
    "/faq",
    "/verificar-certificado",
    "/privacidade",
    "/termos",
  ];
  const courses = await all(
    "SELECT slug, updated_at FROM courses WHERE status = 'published' ORDER BY is_featured DESC, title"
  );
  const urls = [
    ...staticRoutes.map((route) => ({ loc: config.appUrl + route, lastmod: null })),
    ...courses.map((course) => ({
      loc: `${config.appUrl}/cursos/${encodeURIComponent(course.slug)}`,
      lastmod: String(course.updated_at || "").slice(0, 10) || null,
    })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${escapeHtml(u.loc)}</loc>${u.lastmod ? `\n    <lastmod>${escapeHtml(u.lastmod)}</lastmod>` : ""}
  </url>`
  )
  .join("\n")}
</urlset>`;
}

function sendJson(res, status, payload, cookies, download) {
  const body = Buffer.from(JSON.stringify(payload ?? {}), "utf8");
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Length", body.length);
  if (download) {
    const type = download.type || "application/octet-stream";
    res.setHeader("Content-Type", type);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${String(download.filename || "download").replace(/["\\]/g, "")}"`
    );
  }
  if (cookies.length) res.setHeader("Set-Cookie", cookies);
  res.end(res.req.method === "HEAD" ? undefined : body);
}

function sendError(res, error, cookies) {
  const status = error instanceof ApiError ? error.status : 500;
  if (status >= 500) console.error("[api]", error);
  const payload = {
    error: true,
    message:
      error instanceof ApiError
        ? error.message
        : "Ocorreu um erro inesperado. Tente novamente em instantes.",
  };
  if (error instanceof ApiError && error.details) payload.details = error.details;
  sendJson(res, status, payload, cookies);
}

async function resolveSession(cookies) {
  const token = cookies.bte_session;
  if (!token) return { user: null, session: null };
  const hash = sha256(token);
  const row = await get(
    `SELECT s.id AS session_id, s.csrf, s.expires_at,
            u.id, u.name, u.email, u.role, u.phone, u.bio, u.status,
            u.must_change_password, u.last_login_at, u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ?`,
    hash
  );
  if (!row) return { user: null, session: null };
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await run("DELETE FROM sessions WHERE id = ?", row.session_id);
    return { user: null, session: null };
  }
  if (row.status !== "active") {
    await run("DELETE FROM sessions WHERE id = ?", row.session_id);
    return { user: null, session: null };
  }
  const { session_id, csrf, expires_at, ...user } = row;
  return { user, session: { id: session_id, csrf, expiresAt: expires_at } };
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(config.appUrl).host;
  } catch {
    return false;
  }
}

async function handleApi(req, res, router, pathname, searchParams) {
  const cookies = parseCookies(req.headers.cookie);
  const existingCsrf = cookies.bte_csrf;
  const csrf = existingCsrf || newCsrf();
  const responseCookies = [];
  if (!existingCsrf) {
    responseCookies.push(
      cookieHeader("bte_csrf", csrf, {
        httpOnly: false,
        secure: config.cookieSecure,
        sameSite: "Lax",
        maxAge: config.security.sessionDays * 24 * 60 * 60,
      })
    );
  }

  const ctx = {
    req,
    res,
    method: req.method,
    pathname,
    query: parseQuery(searchParams),
    params: {},
    headers: req.headers,
    ip: req.socket.remoteAddress || "unknown",
    body: {},
    user: null,
    session: null,
    csrf,
    setCookie(name, value, options) {
      responseCookies.push(cookieHeader(name, value, options));
    },
    clearCookie(name, options = {}) {
      responseCookies.push(
        cookieHeader(name, "", { ...options, maxAge: 0, expires: new Date(0) })
      );
    },
  };

  const matched = router.match(req.method, pathname);
  if (!matched) {
    if (pathname === "/api/health") {
      return sendJson(res, 200, { ok: true, time: nowIso() }, responseCookies);
    }
    return sendJson(res, 404, { error: true, message: "Recurso não encontrado." }, responseCookies);
  }
  ctx.params = matched.params;

  const session = await resolveSession(cookies);
  ctx.user = session.user;
  ctx.session = session.session;

  const mutating = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  const isWebhook = pathname === "/api/payments/mercadopago/webhook";

  if (mutating) {
    if (!sameOrigin(req)) {
      return sendJson(
        res,
        403,
        { error: true, message: "Origem da requisição não autorizada." },
        responseCookies
      );
    }
    if (!isWebhook) {
      const headerToken = String(req.headers["x-csrf-token"] || "");
      if (!headerToken || headerToken !== csrf) {
        return sendJson(
          res,
          403,
          {
            error: true,
            message: "Sessão expirada ou token de segurança inválido. Recarregue a página e tente novamente.",
          },
          responseCookies
        );
      }
    }
    try {
      const raw = await readBody(req);
      if (raw.length) {
        const type = String(req.headers["content-type"] || "");
        if (!type.includes("application/json")) {
          return sendJson(
            res,
            415,
            { error: true, message: "Envie os dados em JSON." },
            responseCookies
          );
        }
        try {
          ctx.body = JSON.parse(raw.toString("utf8"));
        } catch {
          return sendJson(
            res,
            400,
            { error: true, message: "JSON inválido." },
            responseCookies
          );
        }
      }
    } catch (error) {
      return sendError(res, error, responseCookies);
    }
  }

  try {
    const result = (await matched.route.handler(ctx)) || {};
    const status = result.status || 200;
    if (result.raw) {
      if (responseCookies.length) res.setHeader("Set-Cookie", responseCookies);
      return result.raw(res);
    }
    if (result.body === undefined && status === 204) {
      if (responseCookies.length) res.setHeader("Set-Cookie", responseCookies);
      res.statusCode = 204;
      return res.end();
    }
    return sendJson(res, status, result.body, responseCookies, result.download);
  } catch (error) {
    return sendError(res, error, responseCookies);
  }
}

function safeStaticPath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const normalized = path.normalize(decoded).replace(/^([/\\])+/, "");
  const file = path.resolve(PUBLIC_DIR, normalized);
  if (!file.startsWith(PUBLIC_DIR + path.sep) && file !== PUBLIC_DIR) return null;
  return file;
}

function serveFile(req, res, file, { cache = "public, max-age=3600" } = {}) {
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    return false;
  }
  if (!stat.isFile()) return false;
  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  const etag = `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;

  res.setHeader("Content-Type", type);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", ext === ".html" ? "no-cache" : cache);
  res.setHeader("ETag", etag);
  res.setHeader("Last-Modified", stat.mtime.toUTCString());

  if (req.headers["if-none-match"] === etag) {
    res.statusCode = 304;
    return res.end();
  }

  const range = req.headers.range;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match) {
      let start = match[1] ? Number.parseInt(match[1], 10) : null;
      let end = match[2] ? Number.parseInt(match[2], 10) : null;
      if (start === null && end !== null) {
        start = Math.max(0, stat.size - end);
        end = stat.size - 1;
      } else {
        if (start === null) start = 0;
        if (end === null) end = stat.size - 1;
      }
      if (start > end || start >= stat.size) {
        res.statusCode = 416;
        res.setHeader("Content-Range", `bytes */${stat.size}`);
        return res.end();
      }
      end = Math.min(end, stat.size - 1);
      res.statusCode = 206;
      res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
      res.setHeader("Content-Length", end - start + 1);
      if (req.method === "HEAD") return res.end();
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
  }

  res.statusCode = 200;
  res.setHeader("Content-Length", stat.size);
  if (req.method === "HEAD") return res.end();
  return fs.createReadStream(file).pipe(res);
}

async function handleStatic(req, res, pathname, nonce) {
  if (pathname === "/sitemap.xml") {
    const xml = await sitemap();
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Length", Buffer.byteLength(xml));
    return res.end(xml);
  }
  if (pathname === "/robots.txt") {
    const body = [
      "User-agent: *",
      "Allow: /",
      "Disallow: /aluno",
      "Disallow: /admin",
      "Disallow: /checkout",
      "Disallow: /api/",
      "",
      `Sitemap: ${config.appUrl}/sitemap.xml`,
      "",
    ].join("\n");
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.end(body);
  }

  const file = safeStaticPath(pathname);
  const isAsset =
    pathname.startsWith("/assets/") ||
    /\.[a-z0-9]{2,6}$/i.test(pathname);

  if (file && isAsset) {
    const ext = path.extname(file).toLowerCase();
    const cache = config.isProduction
      ? ext === ".mp4"
        ? "public, max-age=86400"
        : "public, max-age=3600"
      : "no-cache";
    if (serveFile(req, res, file, { cache })) return;
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.end("Arquivo não encontrado.");
  }

  const meta = await resolveMeta(pathname);
  let html;
  try {
    html = renderIndex(meta, nonce);
  } catch (error) {
    console.error("[static] Não foi possível renderizar index.html:", error.message);
    res.statusCode = 500;
    return res.end("Erro interno.");
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Content-Length", Buffer.byteLength(html));
  return res.end(req.method === "HEAD" ? undefined : html);
}

openDatabase().catch((error) => {
  console.error("[db] Falha ao inicializar o banco de dados:", error);
});

const router = createApiRouter();

async function handleRequest(req, res) {
  const nonce = crypto.randomBytes(16).toString("base64");
  for (const [key, value] of Object.entries(securityHeaders(nonce))) {
    res.setHeader(key, value);
  }
  res.setHeader("X-Request-Id", crypto.randomBytes(8).toString("hex"));

  let parsed;
  try {
    parsed = new URL(req.url, config.appUrl);
  } catch {
    res.statusCode = 400;
    return res.end("Requisição inválida.");
  }
  const pathname = parsed.pathname.replace(/\/{2,}/g, "/");

  if (pathname.startsWith("/api/")) {
    try {
      return await handleApi(req, res, router, pathname, parsed.searchParams);
    } catch (error) {
      console.error("[server] Erro não tratado:", error);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
      }
      return res.end(JSON.stringify({ error: true, message: "Erro interno." }));
    }
  }

  if (!["GET", "HEAD"].includes(req.method)) {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    return res.end("Método não permitido.");
  }

  return await handleStatic(req, res, pathname, nonce);
}

const server = http.createServer(handleRequest);

if (require.main === module) {
  server.listen(config.port, () => {
    console.info(
    `[BrasilTec] ${config.appName} em ${config.appUrl} (porta ${config.port}) — ambiente ${config.appEnv}${config.demoMode ? " — modo demonstração" : ""}`
    );
  });

  function shutdown(signal) {
    console.info(`[BrasilTec] Encerrando (${signal})...`);
    server.close(async () => {
      try {
        await closeDatabase();
      } catch {
        /* noop */
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

module.exports = { server, handleRequest };
