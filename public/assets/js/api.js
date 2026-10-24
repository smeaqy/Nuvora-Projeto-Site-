/* BrasilTec Educação — cliente HTTP da API */

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details || null;
  }
}

function readCookie(name) {
  const parts = document.cookie ? document.cookie.split("; ") : [];
  for (const part of parts) {
    const index = part.indexOf("=");
    if (index > 0 && part.slice(0, index) === name) {
      return decodeURIComponent(part.slice(index + 1));
    }
  }
  return "";
}

let csrfPromise = null;

async function getCsrf(force = false) {
  if (!force) {
    const fromCookie = readCookie("bte_csrf");
    if (fromCookie) return fromCookie;
  }
  if (!csrfPromise) {
    csrfPromise = fetch("/api/auth/csrf", {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        return data.csrfToken || readCookie("bte_csrf");
      })
      .finally(() => {
        csrfPromise = null;
      });
  }
  return csrfPromise;
}

async function request(path, { method = "GET", body, headers = {}, retry = true } = {}) {
  const options = {
    method,
    credentials: "same-origin",
    headers: { Accept: "application/json", ...headers },
  };
  const upper = method.toUpperCase();
  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(upper)) {
    options.headers["x-csrf-token"] = await getCsrf();
  }

  let response;
  try {
    response = await fetch(path, options);
  } catch {
    throw new ApiError("Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.", 0);
  }

  const type = response.headers.get("content-type") || "";
  let payload = null;
  if (type.includes("application/json")) {
    payload = await response.json().catch(() => null);
  } else {
    payload = { message: await response.text().catch(() => "") };
  }

  if (!response.ok) {
    if (response.status === 403 && /csrf|origem/i.test(payload?.message || "") && retry) {
      await getCsrf(true);
      return request(path, { method, body, headers, retry: false });
    }
    throw new ApiError(
      payload?.message || "Não foi possível concluir a solicitação.",
      response.status,
      payload?.details || null
    );
  }
  return payload;
}

export const api = {
  get: (path) => request(path),
  post: (path, body = {}) => request(path, { method: "POST", body }),
  put: (path, body = {}) => request(path, { method: "PUT", body }),
  patch: (path, body = {}) => request(path, { method: "PATCH", body }),
  delete: (path) => request(path, { method: "DELETE" }),
  request,
};

export function qs(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}
