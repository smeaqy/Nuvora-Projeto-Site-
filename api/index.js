"use strict";

/**
 * Entrypoint serverless da Vercel (Node.js runtime).
 *
 * Todas as rotas são reescritas para esta função (ver vercel.json) e o
 * servidor HTTP original responde exatamente como em `node server/server.js`.
 * Os arquivos de `public/` são servidos pelo CDN da Vercel antes do rewrite;
 * o que sobrar (rotas da SPA, SEO, sitemap e /api) chega aqui.
 */

const { handleRequest } = require("../server/server");

/**
 * O rewrite acrescenta `__path` à URL para que o caminho original chegue
 * intacto à função, independentemente de como a Vercel entrega `req.url`.
 */
function restoreUrl(req) {
  const raw = req.url || "/";
  const index = raw.indexOf("?");
  const search = index >= 0 ? raw.slice(index + 1) : "";
  if (!search) return;
  const params = new URLSearchParams(search);
  const captured = params.get("__path");
  if (captured === null) return;
  params.delete("__path");
  const query = params.toString();
  req.url = captured + (query ? `?${query}` : "");
}

module.exports = async function vercelHandler(req, res) {
  try {
    restoreUrl(req);
    await handleRequest(req, res);
  } catch (error) {
    console.error("[vercel] Erro fatal na função:", error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    res.end(JSON.stringify({ error: true, message: "Erro interno." }));
  }
};
