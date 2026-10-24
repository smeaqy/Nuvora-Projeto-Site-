/* BrasilTec Educação — utilitários de interface */

export function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function cx(...values) {
  return values.filter(Boolean).join(" ");
}

export function attr(value) {
  return esc(value);
}

/* --------------------------------- Ícones -------------------------------- */

const ICONS = {
  "arrow-right": '<path d="M5 12h14M13 6l6 6-6 6"/>',
  "arrow-left": '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  "arrow-up-right": '<path d="M7 17 17 7M8 7h9v9"/>',
  "chevron-down": '<path d="m6 9 6 6 6-6"/>',
  "chevron-right": '<path d="m9 6 6 6-6 6"/>',
  "chevron-left": '<path d="m15 6-6 6 6 6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  "check-circle": '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  "x-circle": '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 21h16"/>',
  upload: '<path d="M12 21V9M7 14l5-5 5 5"/><path d="M4 3h16"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  "eye-off": '<path d="M3 3l18 18M10.6 10.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-4.6"/><path d="M6.2 6.2C3.7 7.9 2 12 2 12s3.5 7 10 7c2 0 3.7-.7 5.1-1.6M9.9 5.3A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3.3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M1.5 21c0-4 3.4-6 7.5-6s7.5 2 7.5 6"/><path d="M16 4a4 4 0 0 1 0 8M18 15c2.7.5 4.5 2.4 4.5 6"/>',
  "user-check": '<circle cx="9" cy="8" r="4"/><path d="M1.5 21c0-4 3.4-6 7.5-6 1.4 0 2.6.2 3.7.7"/><path d="m16 18 2 2 4-5"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  phone: '<path d="M6 3h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 4 5a2 2 0 0 1 2-2Z"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none"/>',
  graduation: '<path d="m2 9 10-5 10 5-10 5Z"/><path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5M22 9v6"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/>',
  award: '<circle cx="12" cy="9" r="6"/><path d="m8.5 14-2 8 5.5-3 5.5 3-2-8"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  shield: '<path d="M12 2 4 5v6c0 5.5 3.4 9.4 8 11 4.6-1.6 8-5.5 8-11V5Z"/><path d="m9 12 2 2 4-4"/>',
  book: '<path d="M4 4h6a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H4Z"/><path d="M20 4h-6a3 3 0 0 0-3 3v14a2 2 0 0 1 2-2h7Z"/>',
  "book-open": '<path d="M2 4h6a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H2Z"/><path d="M22 4h-6a3 3 0 0 0-3 3v14a2 2 0 0 1 2-2h7Z"/>',
  play: '<path d="m8 5 11 7-11 7Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  "credit-card": '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
  certificate: '<path d="M4 3h16v12H4Z"/><path d="M8 7h8M8 10h5"/><circle cx="17" cy="17" r="3"/><path d="m15.5 19.5-1 3 2.5-1.5 2.5 1.5-1-3"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 10h6M9 14h6M9 18h3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9A1.7 1.7 0 0 0 10 4.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  "log-in": '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17-5-5 5-5M5 12h12"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  "bar-chart": '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  "dollar-sign": '<path d="M12 2v20M17 6.5C17 4.6 15 3.5 12 3.5S7 4.8 7 7s2 3.2 5 3.8 5 1.6 5 3.7-2 3.5-5 3.5-5-1.1-5-3"/>',
  tag: '<path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.2 9a3 3 0 1 1 4.5 2.6c-.8.5-1.7 1-1.7 2.4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  alert: '<path d="M10.3 3.8 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  "check-square": '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m8 12 3 3 5-6"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>',
  "file-text": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  message: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H3l2-3.3A8.5 8.5 0 1 1 21 11.5Z"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8Z"/>',
  reply: '<path d="M9 17H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8l-5 4v-4"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1Z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7Z"/>',
  sparkles: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9Z"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6"/>',
  "more-horizontal": '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/>',
  printer: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  headphones: '<path d="M3 14v-2a9 9 0 0 1 18 0v2"/><rect x="2" y="14" width="4" height="7" rx="2"/><rect x="18" y="14" width="4" height="7" rx="2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/>',
  home: '<path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2Z"/>',
  "trending-up": '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
};

export function icon(name, size = 18, className = "") {
  const body = ICONS[name] || ICONS.info;
  return `<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

/* ------------------------------- Formatação ------------------------------ */

export function formatMoney(cents, { free = "Gratuito" } = {}) {
  const value = Number(cents || 0);
  if (value === 0) return free;
  return (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatPriceFrom(cents) {
  const value = Number(cents || 0);
  if (value === 0) return "Gratuito";
  return `${(value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;
}

export function parseMoneyInput(text) {
  if (text === null || text === undefined || text === "") return 0;
  const normalized = String(text).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

export function formatDate(value, { short = false } = {}) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  if (short) {
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  }
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relativeDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `há ${days} d`;
  return formatDate(date);
}

export function formatDuration(minutes) {
  const total = Number(minutes || 0);
  if (!total) return "—";
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function formatHours(hours) {
  const total = Number(hours || 0);
  if (!total) return "—";
  return `${total} h`;
}

export function initials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "BT";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function firstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "Aluno";
}

export function plural(count, singular, pluralForm) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/* --------------------------------- Status -------------------------------- */

const STATUS_LABELS = {
  active: "Ativo",
  completed: "Concluído",
  cancelled: "Cancelado",
  blocked: "Bloqueado",
  pending: "Pendente",
  approved: "Aprovado",
  refused: "Recusado",
  refunded: "Reembolsado",
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
  new: "Novo",
  contacted: "Contatado",
  inactive: "Inativo",
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
  online: "100% online",
  hibrido: "Híbrido",
  multiple: "Múltipla escolha",
  boolean: "Verdadeiro ou falso",
  pix: "Pix",
  manual: "Manual",
  demo: "Demonstração",
  card: "Cartão",
};

export function statusLabel(status) {
  return STATUS_LABELS[status] || status || "—";
}

export function statusDot(status, label) {
  return `<span class="status-dot status-dot--${esc(status)}">${esc(label || statusLabel(status))}</span>`;
}

export function statusBadge(status) {
  const map = {
    active: "badge--free",
    approved: "badge--free",
    completed: "badge--free",
    published: "badge--free",
    pending: "badge--warning",
    draft: "badge--muted",
    archived: "badge--muted",
    blocked: "badge--danger",
    cancelled: "badge--danger",
    refused: "badge--danger",
    refunded: "badge--muted",
  };
  return `<span class="badge ${map[status] || "badge--muted"}">${esc(statusLabel(status))}</span>`;
}

/* ------------------------------ Markdown leve ---------------------------- */

export function renderMarkdown(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const output = [];
  let list = null;
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      output.push(`<p>${paragraph.join(" ")}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      output.push(`<${list.tag}>${list.items.map((item) => `<li>${item}</li>`).join("")}</${list.tag}>`);
      list = null;
    }
  };

  const inline = (value) =>
    esc(value)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, "<code>$1</code>");

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = Math.min(4, heading[1].length + 1);
      output.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      flushList();
      output.push(`<blockquote>${inline(quote[1])}</blockquote>`);
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.*)$/);
    const ordered = line.match(/^\d+\.\s+(.*)$/);
    if (bullet || ordered) {
      flushParagraph();
      const tag = bullet ? "ul" : "ol";
      if (!list || list.tag !== tag) {
        flushList();
        list = { tag, items: [] };
      }
      list.items.push(inline((bullet || ordered)[1]));
      continue;
    }
    flushList();
    paragraph.push(inline(line));
  }
  flushParagraph();
  flushList();
  return output.join("\n");
}

/* --------------------------------- Imagens -------------------------------- */

export function imageUrl(value, fallback = "/assets/img/hero-study.jpg") {
  const src = String(value || "").trim();
  if (!src) return fallback;
  if (/^(https?:)?\/\//i.test(src) || src.startsWith("/") || src.startsWith("data:")) return src;
  if (src.startsWith("assets/")) return `/${src}`;
  if (src.includes("/")) return `/${src.replace(/^\.?\//, "")}`;
  return `/assets/img/${src}`;
}

/* --------------------------------- Toasts -------------------------------- */

export function toast(message, type = "info", timeout = 5200) {
  const root = document.getElementById("toast-root");
  if (!root) return;
  const icons = { success: "check-circle", error: "alert", info: "info", warning: "alert" };
  const item = document.createElement("div");
  item.className = `toast toast--${type}`;
  item.setAttribute("role", type === "error" ? "alert" : "status");
  item.innerHTML = `${icon(icons[type] || "info", 18)}<span>${esc(message)}</span>`;
  root.appendChild(item);
  const remove = () => {
    item.classList.add("is-leaving");
    setTimeout(() => item.remove(), 220);
  };
  const timer = setTimeout(remove, timeout);
  item.addEventListener("click", () => {
    clearTimeout(timer);
    remove();
  });
}

/* ---------------------------------- Modal -------------------------------- */

let activeModal = null;

export function closeModal() {
  if (!activeModal) return;
  const { backdrop, previousFocus, onClose } = activeModal;
  activeModal = null;
  document.body.classList.remove("has-modal");
  document.removeEventListener("keydown", onEsc);
  backdrop.remove();
  if (previousFocus && typeof previousFocus.focus === "function") {
    previousFocus.focus({ preventScroll: true });
  }
  if (typeof onClose === "function") onClose();
}

function onEsc(event) {
  if (event.key === "Escape") closeModal();
}

export function openModal({
  title,
  subtitle = "",
  body = "",
  footer = "",
  size = "",
  onMount,
  onClose,
  dismissible = true,
}) {
  closeModal();
  const root = document.getElementById("modal-root");
  const previousFocus = document.activeElement;
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal ${size ? `modal--${size}` : ""}" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1">
      <div class="modal__head">
        <div style="flex:1">
          <h2 id="modal-title">${esc(title)}</h2>
          ${subtitle ? `<p>${esc(subtitle)}</p>` : ""}
        </div>
        ${
          dismissible
            ? `<button type="button" class="icon-btn" data-modal-close aria-label="Fechar">${icon("x", 20)}</button>`
            : ""
        }
      </div>
      <div class="modal__body">${body}</div>
      ${footer ? `<div class="modal__foot">${footer}</div>` : ""}
    </div>`;
  root.appendChild(backdrop);
  document.body.classList.add("has-modal");
  activeModal = { backdrop, previousFocus, onClose };

  backdrop.querySelectorAll("[data-modal-close]").forEach((button) => {
    button.addEventListener("click", closeModal);
  });
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop && dismissible) closeModal();
  });
  document.addEventListener("keydown", onEsc);

  const modal = backdrop.querySelector(".modal");
  const focusTarget = modal.querySelector("input, select, textarea, button:not([data-modal-close]), a[href]");
  setTimeout(() => (focusTarget || modal).focus({ preventScroll: true }), 30);

  if (typeof onMount === "function") onMount(modal, closeModal);
  return closeModal;
}

export function confirmDialog({
  title = "Confirmar ação",
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = false,
  onConfirm,
}) {
  return new Promise((resolve) => {
    openModal({
      title,
      size: "sm",
      body: `<p style="font-size:.9rem;color:var(--muted);line-height:1.65">${esc(message)}</p>`,
      footer: `
        <button type="button" class="btn btn--ghost btn--sm" data-modal-close>${esc(cancelLabel)}</button>
        <button type="button" class="btn ${danger ? "btn--danger" : "btn--primary"} btn--sm" data-confirm>${esc(confirmLabel)}</button>`,
      onMount(modal, close) {
        modal.querySelector("[data-confirm]").addEventListener("click", async () => {
          const button = modal.querySelector("[data-confirm]");
          setBusy(button, true);
          try {
            const result = await onConfirm?.();
            close();
            resolve(result ?? true);
          } catch (error) {
            setBusy(button, false);
            toast(error.message || "Não foi possível concluir a ação.", "error");
          }
        });
      },
      onClose() {
        resolve(false);
      },
    });
  });
}

/* -------------------------------- Formulário ----------------------------- */

export function setBusy(button, busy, label) {
  if (!button) return;
  if (busy) {
    button.dataset.originalLabel = button.innerHTML;
    button.disabled = true;
    button.classList.add("is-loading");
    if (label) button.innerHTML = esc(label);
  } else {
    button.disabled = false;
    button.classList.remove("is-loading");
    if (button.dataset.originalLabel) {
      button.innerHTML = button.dataset.originalLabel;
      delete button.dataset.originalLabel;
    }
  }
}

export function formData(form) {
  const data = {};
  for (const [key, value] of new FormData(form).entries()) {
    if (data[key] !== undefined) {
      if (!Array.isArray(data[key])) data[key] = [data[key]];
      data[key].push(value);
    } else {
      data[key] = value;
    }
  }
  return data;
}

export function fieldError(form, name, message) {
  const field = form.querySelector(`[name="${name}"]`)?.closest(".field");
  if (!field) return;
  field.classList.toggle("has-error", Boolean(message));
  let node = field.querySelector(".field-error");
  if (message) {
    if (!node) {
      node = document.createElement("p");
      node.className = "field-error";
      field.appendChild(node);
    }
    node.textContent = message;
  } else if (node) {
    node.remove();
  }
}

export function clearErrors(form) {
  form.querySelectorAll(".field.has-error").forEach((field) => field.classList.remove("has-error"));
  form.querySelectorAll(".field-error").forEach((node) => node.remove());
}

export function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || "").trim());
}

export function validatePassword(value) {
  const text = String(value || "");
  if (text.length < 8) return "A senha deve ter pelo menos 8 caracteres.";
  if (!/[A-Za-z]/.test(text) || !/\d/.test(text)) return "Use ao menos uma letra e um número.";
  return "";
}

/* ------------------------------ Blocos visuais --------------------------- */

export function pageLoading(label = "Carregando…") {
  return `<div class="page-loading"><span class="spinner" aria-hidden="true"></span><span>${esc(label)}</span></div>`;
}

export function skeletonCards(count = 3) {
  return `<div class="course-grid">${Array.from({ length: count })
    .map(
      () => `
      <div class="course-card" aria-hidden="true">
        <div class="skeleton" style="aspect-ratio:16/10"></div>
        <div class="course-body">
          <div class="skeleton" style="height:12px;width:45%"></div>
          <div class="skeleton" style="height:22px;width:85%"></div>
          <div class="skeleton" style="height:14px;width:100%"></div>
          <div class="skeleton" style="height:36px;width:100%;margin-top:8px"></div>
        </div>
      </div>`
    )
    .join("")}</div>`;
}

export function emptyState({ iconName = "info", title, text, action = "" }) {
  return `
    <div class="empty-state">
      <div class="empty-state__icon">${icon(iconName, 24)}</div>
      <h3>${esc(title)}</h3>
      <p>${esc(text)}</p>
      ${action}
    </div>`;
}

export function progressBar(value, { large = false, success = false } = {}) {
  const percent = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  return `<div class="progress ${large ? "progress--lg" : ""} ${success ? "progress--success" : ""}" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100" aria-label="Progresso: ${percent}%"><span class="progress__bar" style="width:${percent}%"></span></div>`;
}

export function progressWithLabel(value) {
  const percent = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  return `<div class="progress-with-label">${progressBar(percent)}<strong>${percent}%</strong></div>`;
}

export function badge(text, variant = "") {
  return `<span class="badge ${variant ? `badge--${variant}` : ""}">${esc(text)}</span>`;
}

export function notice(text, type = "info", iconName = "info") {
  return `<div class="notice notice--${type}">${icon(iconName, 18)}<div>${text}</div></div>`;
}

export function breadcrumb(items) {
  return `<nav class="breadcrumb" aria-label="Navegação estrutural">${items
    .map((item, index) => {
      const separator = index > 0 ? icon("chevron-right", 12) : "";
      return item.href
        ? `${separator}<a href="${esc(item.href)}">${esc(item.label)}</a>`
        : `${separator}<span aria-current="page">${esc(item.label)}</span>`;
    })
    .join("")}</nav>`;
}

export function debounce(fn, delay = 320) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function courseCard(course) {
  const badgeHtml = course.isFree
    ? `<span class="badge badge--free">Gratuito</span>`
    : course.featured
      ? `<span class="badge">Destaque</span>`
      : "";
  return `
    <article class="course-card">
      <a class="course-thumb" href="/cursos/${esc(course.slug)}" aria-label="Ver curso ${esc(course.title)}">
        <img src="${imageUrl(course.coverImage)}" alt="" width="640" height="400" loading="lazy">
        ${badgeHtml}
        ${course.demo ? `<span class="badge badge--demo">Demonstração</span>` : ""}
        <span class="course-thumb__meta">${icon("clock", 14)} ${esc(formatHours(course.durationHours))}</span>
      </a>
      <div class="course-body">
        <div class="course-kicker">
          <span>${esc(course.category?.name || "Formação")}</span>
          <span class="dot"></span>
          <span>${esc(statusLabel(course.level))}</span>
        </div>
        <h3><a href="/cursos/${esc(course.slug)}">${esc(course.title)}</a></h3>
        <p class="course-sub">${esc(course.subtitle || course.description || "")}</p>
        <div class="course-meta">
          <span>${icon("book-open", 14)} ${plural(course.lessonCount || 0, "aula", "aulas")}</span>
          <span>${icon("monitor", 14)} ${esc(statusLabel(course.modality))}</span>
        </div>
        <div class="course-foot">
          <span class="price ${course.isFree ? "price--free" : ""}">${esc(formatMoney(course.priceCents))}</span>
          <a class="link-arrow" href="/cursos/${esc(course.slug)}">Ver curso ${icon("arrow-right", 15)}</a>
        </div>
      </div>
    </article>`;
}

export function miniCourse(course) {
  return `
    <div class="mini-course">
      <div class="mini-course__img"><img src="${imageUrl(course.coverImage)}" alt="" loading="lazy"></div>
      <div class="mini-course__body">
        <strong>${esc(course.title)}</strong>
        <span>${esc(formatMoney(course.priceCents))} • ${plural(course.lessonCount || 0, "aula", "aulas")}</span>
      </div>
      <a class="icon-btn" href="/cursos/${esc(course.slug)}" aria-label="Abrir ${esc(course.title)}">${icon("arrow-right", 17)}</a>
    </div>`;
}

export function taskItem(task) {
  const isAssessment = task.type === "assessment";
  return `
    <div class="task-item">
      <div class="task-item__icon">${icon(isAssessment ? "clipboard" : "play", 17)}</div>
      <div class="task-item__text">
        <strong>${esc(isAssessment ? task.title : "Continuar " + task.courseTitle)}</strong>
        <span>${esc(task.courseTitle)}${isAssessment ? ` • ${plural(task.questionCount, "questão", "questões")}` : ` • ${task.progress}% concluído`}</span>
      </div>
      <a href="${isAssessment ? `/aluno/curso/${task.courseId}/avaliacao` : `/aluno/curso/${task.courseId}`}">${isAssessment ? "Avaliar" : "Estudar"}</a>
    </div>`;
}

export function certificateCard(cert, { studentView = false } = {}) {
  return `
    <article class="cert-card">
      <div class="cert-card__head">
        <div class="cert-card__seal">${icon("award", 25)}</div>
        <div class="cert-card__body">
          <h3>${esc(cert.courseName)}</h3>
          <p>${esc(formatHours(cert.hours))} • emitido em ${esc(formatDate(cert.issuedAt))}</p>
          <span class="cert-code">${icon("certificate", 12)} ${esc(cert.code)}</span>
        </div>
      </div>
      <div class="cert-card__foot">
        <span class="tiny muted">${studentView ? "Certificado digital" : "Verificação pública"}</span>
        <div class="cluster">
          <a class="btn btn--outline btn--xs" href="/verificar-certificado?codigo=${encodeURIComponent(cert.code)}">Verificar</a>
          <a class="btn btn--primary btn--xs" href="/certificado/${encodeURIComponent(cert.code)}">Abrir</a>
        </div>
      </div>
    </article>`;
}

export function statCard({ label, value, hint = "", iconName = "trending-up", tone = "" }) {
  return `
    <div class="stat-card">
      <div class="stat-card__head">
        <span>${esc(label)}</span>
        <span class="stat-card__icon ${tone ? `stat-card__icon--${tone}` : ""}">${icon(iconName, 17)}</span>
      </div>
      <strong>${value}</strong>
      ${hint ? `<small>${esc(hint)}</small>` : ""}
    </div>`;
}

export function tableEmpty(colspan, text) {
  return `<tr class="empty-row"><td colspan="${colspan}">${esc(text)}</td></tr>`;
}

export function pagination({ page, pages }) {
  if (!pages || pages <= 1) return "";
  const current = Math.max(1, Number(page) || 1);
  const parts = [];
  parts.push(`<button type="button" data-page="${current - 1}" ${current <= 1 ? "disabled" : ""} aria-label="Página anterior">${icon("chevron-left", 16)}</button>`);
  const start = Math.max(1, Math.min(current - 2, pages - 4));
  const end = Math.min(pages, start + 4);
  for (let index = start; index <= end; index++) {
    parts.push(`<button type="button" data-page="${index}" class="${index === current ? "is-active" : ""}" aria-label="Página ${index}" ${index === current ? 'aria-current="page"' : ""}>${index}</button>`);
  }
  parts.push(`<button type="button" data-page="${current + 1}" ${current >= pages ? "disabled" : ""} aria-label="Próxima página">${icon("chevron-right", 16)}</button>`);
  return `<div class="pagination">${parts.join("")}</div>`;
}

export function bindPagination(root, onChange) {
  if (!root) return;
  root.querySelectorAll(".pagination [data-page]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = Number(button.dataset.page);
      if (Number.isFinite(next) && next >= 1 && !button.disabled) onChange(next);
    });
  });
}

export function initialsAvatar(name, className = "avatar") {
  return `<span class="${className}" aria-hidden="true">${esc(initials(name))}</span>`;
}

export function safeExportFileName(name) {
  return String(name || "arquivo").replace(/[^\w.-]+/g, "-").toLowerCase();
}
