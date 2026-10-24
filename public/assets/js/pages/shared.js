/* BrasilTec Educação — elementos compartilhados entre páginas */

import { ApiError } from "../api.js";
import {
  esc,
  icon,
  toast,
  setBusy,
  clearErrors,
  fieldError,
  formatDate,
  formatHours,
  statusLabel,
} from "../ui.js";

export { esc, icon, toast, setBusy, clearErrors, fieldError };

/** Cabeçalho de página interna (painéis e páginas institucionais). */
export function pageHead({ eyebrow = "", title, text = "", actions = "" }) {
  return `
    <div class="page-head">
      <div class="page-head__text">
        ${eyebrow ? `<span class="eyebrow">${esc(eyebrow)}</span>` : ""}
        <h1>${esc(title)}</h1>
        ${text ? `<p class="muted">${esc(text)}</p>` : ""}
      </div>
      ${actions ? `<div class="page-head__actions">${actions}</div>` : ""}
    </div>`;
}

/** Cabeçalho de página pública com fundo. */
export function pageHero({ eyebrow = "", title, text = "", actions = "" }) {
  return `
    <section class="page-hero">
      <div class="container page-hero__content">
        ${eyebrow ? `<span class="eyebrow">${esc(eyebrow)}</span>` : ""}
        <h1>${esc(title)}</h1>
        ${text ? `<p class="lead">${esc(text)}</p>` : ""}
        ${actions ? `<div class="hero-actions">${actions}</div>` : ""}
      </div>
    </section>`;
}

export function alertBox(message, type = "info") {
  if (!message) return "";
  const iconName = type === "error" ? "alert" : type === "success" ? "check-circle" : "info";
  return `<div class="notice notice--${type === "error" ? "danger" : type}" role="${type === "error" ? "alert" : "status"}">${icon(iconName, 18)}<div>${esc(message)}</div></div>`;
}

/**
 * Envia um formulário com estado de carregamento e exibição de erros.
 * `handler(data, form)` deve retornar uma promessa.
 */
export function bindForm(form, handler, { onSuccess, submitLabel = "Salvando…" } = {}) {
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    if (button?.disabled) return;
    clearErrors(form);
    const feedback = form.querySelector("[data-form-feedback]");
    if (feedback) {
      feedback.innerHTML = "";
      feedback.hidden = true;
    }
    const data = {};
    for (const [key, value] of new FormData(form).entries()) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        if (!Array.isArray(data[key])) data[key] = [data[key]];
        data[key].push(value);
      } else {
        data[key] = value;
      }
    }
    form.querySelectorAll('input[type="checkbox"][name]').forEach((input) => {
      if (!Object.prototype.hasOwnProperty.call(data, input.name)) data[input.name] = false;
    });
    setBusy(button, true, submitLabel);
    try {
      const result = await handler(data, form);
      await onSuccess?.(result, form);
    } catch (error) {
      if (error instanceof ApiError && error.details && typeof error.details === "object") {
        for (const [name, message] of Object.entries(error.details)) {
          if (typeof message === "string") fieldError(form, name, message);
        }
      }
      if (feedback) {
        feedback.innerHTML = alertBox(error.message || "Não foi possível concluir a ação.", "error");
        feedback.hidden = false;
      } else {
        toast(error.message || "Não foi possível concluir a ação.", "error");
      }
    } finally {
      setBusy(button, false);
    }
  });
}

/** Delega cliques de paginação dentro de um container. */
export function bindPagination(container, onChange) {
  if (!container) return;
  container.querySelectorAll(".pagination [data-page]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = Number(button.dataset.page);
      if (Number.isFinite(next) && next >= 1 && !button.disabled) onChange(next);
    });
  });
}

export function summaryList(items, { className = "stack-sm" } = {}) {
  return `<div class="${className}">${items
    .filter(Boolean)
    .map(
      (item) => `
      <div class="between" style="gap:16px;padding:8px 0;border-bottom:1px solid var(--line)">
        <span class="muted small">${esc(item.label)}</span>
        <strong class="small text-right">${item.value}</strong>
      </div>`
    )
    .join("")}</div>`;
}

export function factList(items) {
  return `<div class="course-buy__facts">${items
    .map(
      (item) => `
      <div class="course-buy__fact">
        ${icon(item.icon || "info", 17)}
        <div><span>${esc(item.label)}</span><strong>${item.value}</strong></div>
      </div>`
    )
    .join("")}</div>`;
}

/** Layout de impressão do certificado. */
export function certificateHtml(certificate) {
  return `
    <div class="certificate-page">
      <div class="certificate-actions">
        <a class="btn btn--ghost btn--sm" href="/verificar-certificado">${icon("arrow-left", 16)} Verificar outro certificado</a>
        <div class="cluster">
          <a class="btn btn--outline btn--sm" href="${esc(certificate.verifyUrl || `/verificar-certificado?codigo=${encodeURIComponent(certificate.code)}`)}">${icon("shield", 16)} Página de verificação</a>
          <button type="button" class="btn btn--primary btn--sm" data-print>${icon("printer", 16)} Imprimir / salvar PDF</button>
        </div>
      </div>
      <article class="certificate" aria-label="Certificado de ${esc(certificate.studentName)}">
        <div class="certificate__brand">
          <img src="/assets/img/logo-mark.png" alt="" width="56" height="56">
          <div>
            <strong>BrasilTec</strong>
            <span>ensino a distância</span>
          </div>
        </div>
        <div class="certificate__seal">${icon("award", 30)}</div>
        <span class="certificate__eyebrow">Certificado de conclusão</span>
        <h1 class="certificate__student">${esc(certificate.studentName)}</h1>
        <p class="certificate__text">concluiu com aproveitamento o curso <strong>${esc(certificate.courseName)}</strong>, com carga horária de <strong>${esc(formatHours(certificate.hours))}</strong>, promovido pela BrasilTec Educação.</p>
        <div class="certificate__meta">
          <div><span>Código de verificação</span><strong class="mono">${esc(certificate.code)}</strong></div>
          <div><span>Data de emissão</span><strong>${esc(formatDate(certificate.issuedAt))}</strong></div>
        </div>
        <div class="certificate__signatures">
          <div class="certificate__signature"><span></span><strong>BrasilTec Educação</strong><small>Coordenação pedagógica</small></div>
          <div class="certificate__signature"><span></span><strong>Secretaria acadêmica</strong><small>Emissão digital</small></div>
        </div>
        <div class="certificate__footer">
          <span>Verifique a autenticidade em ${esc(location.origin)}/verificar-certificado</span>
          <span>${esc(certificate.code)}</span>
        </div>
      </article>
    </div>`;
}

/** Linha de tabela vazia. */
export function emptyRow(colspan, text) {
  return `<tr class="empty-row"><td colspan="${colspan}">${esc(text)}</td></tr>`;
}

export function statusOptions(selected, options) {
  return options
    .map(
      (value) =>
        `<option value="${esc(value)}" ${value === selected ? "selected" : ""}>${esc(statusLabel(value))}</option>`
    )
    .join("");
}

/** Cria uma turma de opções para selects. */
export function optionList(items, selected, { valueKey = "value", labelKey = "label", placeholder = "" } = {}) {
  return `${placeholder ? `<option value="">${esc(placeholder)}</option>` : ""}${items
    .map((item) => {
      const value = typeof item === "string" ? item : item[valueKey];
      const label = typeof item === "string" ? item : item[labelKey];
      return `<option value="${esc(value)}" ${String(value) === String(selected ?? "") ? "selected" : ""}>${esc(label)}</option>`;
    })
    .join("")}`;
}

export function field({ label, name, value = "", type = "text", required = false, hint = "", placeholder = "", attrs = "" }) {
  return `
    <div class="field">
      <label class="field-label" for="field-${esc(name)}">${esc(label)}${required ? " *" : ""}</label>
      <input class="input" id="field-${esc(name)}" name="${esc(name)}" type="${esc(type)}" value="${esc(value)}" ${required ? "required" : ""} ${placeholder ? `placeholder="${esc(placeholder)}"` : ""} ${attrs}>
      ${hint ? `<p class="field-hint">${esc(hint)}</p>` : ""}
    </div>`;
}

export function textareaField({ label, name, value = "", required = false, hint = "", rows = 4, attrs = "" }) {
  return `
    <div class="field">
      <label class="field-label" for="field-${esc(name)}">${esc(label)}${required ? " *" : ""}</label>
      <textarea class="textarea" id="field-${esc(name)}" name="${esc(name)}" rows="${rows}" ${required ? "required" : ""} ${attrs}>${esc(value)}</textarea>
      ${hint ? `<p class="field-hint">${esc(hint)}</p>` : ""}
    </div>`;
}

export function selectField({ label, name, options, value = "", required = false, hint = "", attrs = "" }) {
  return `
    <div class="field">
      <label class="field-label" for="field-${esc(name)}">${esc(label)}${required ? " *" : ""}</label>
      <select class="select" id="field-${esc(name)}" name="${esc(name)}" ${required ? "required" : ""} ${attrs}>${options}</select>
      ${hint ? `<p class="field-hint">${esc(hint)}</p>` : ""}
    </div>`;
}

export function checkboxField({ label, name, checked = false, hint = "" }) {
  return `
    <div class="field">
      <label class="checkbox" for="field-${esc(name)}">
        <input type="checkbox" id="field-${esc(name)}" name="${esc(name)}" value="1" ${checked ? "checked" : ""}>
        <span>${esc(label)}</span>
      </label>
      ${hint ? `<p class="field-hint">${esc(hint)}</p>` : ""}
    </div>`;
}

export function tabs(items, active) {
  return `<div class="tab-bar" role="tablist">${items
    .map(
      (item) =>
        `<button type="button" role="tab" class="${item.id === active ? "is-active" : ""}" aria-selected="${item.id === active}" data-tab="${esc(item.id)}">${esc(item.label)}${item.count !== undefined ? ` <span class="tiny muted">${item.count}</span>` : ""}</button>`
    )
    .join("")}</div>`;
}

export function money(cents) {
  return (Number(cents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
