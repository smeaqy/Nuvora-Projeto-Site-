/* BrasilTec Educação — página pública de detalhe do curso */

import { api, ApiError } from "../api.js";
import {
  esc,
  icon,
  courseCard,
  formatMoney,
  formatHours,
  formatDuration,
  statusLabel,
  plural,
  openModal,
  toast,
  setBusy,
  imageUrl,
  breadcrumb,
} from "../ui.js";
import { factList } from "./shared.js";

function curriculum(outline, enrolled) {
  if (!outline.length) {
    return `<div class="empty-state"><div class="empty-state__icon">${icon("book-open", 24)}</div><h3>Conteúdo em preparação</h3><p>Os módulos serão publicados em breve.</p></div>`;
  }
  return `<div class="outline">${outline
    .map(
      (module, index) => `
      <details class="outline-module" ${index === 0 ? "open" : ""}>
        <summary>
          <span class="outline-module__num">${String(index + 1).padStart(2, "0")}</span>
          <span class="outline-module__title"><strong>${esc(module.title)}</strong><small>${plural(module.lessons.length, "aula", "aulas")}</small></span>
          ${icon("chevron-down", 18)}
        </summary>
        <div class="outline-lessons">
          ${module.lessons
            .map(
              (lesson) => `
              <div class="outline-lesson">
                <span class="outline-lesson__icon">${icon(enrolled ? "play" : lesson.isFreePreview ? "play" : "lock", 15)}</span>
                <span class="outline-lesson__title">${esc(lesson.title)}</span>
                ${lesson.isFreePreview && !enrolled ? `<button type="button" class="badge badge--free" data-preview-lesson="${lesson.id}">Prévia gratuita</button>` : ""}
                <span class="outline-lesson__duration">${esc(formatDuration(lesson.durationMinutes))}</span>
              </div>`
            )
            .join("")}
        </div>
      </details>`
    )
    .join("")}</div>`;
}

function buyCard(data, user) {
  const { course, enrollment } = data;
  const enrolled = enrollment && ["active", "completed"].includes(enrollment.status);
  let action;
  if (enrolled) {
    action = `<a class="btn btn--primary btn--block btn--lg" href="/aluno/curso/${course.id}">${icon("play", 18)} Acessar o curso</a>`;
  } else if (!user) {
    action = `<a class="btn btn--primary btn--block btn--lg" href="/entrar?next=${encodeURIComponent(`/cursos/${course.slug}`)}">Entrar para se matricular</a>
      <a class="btn btn--outline btn--block btn--sm" href="/cadastrar?next=${encodeURIComponent(`/cursos/${course.slug}`)}">Criar conta gratuita</a>`;
  } else if (user.role !== "student") {
    action = `<a class="btn btn--outline btn--block" href="/admin">Acessar o painel administrativo</a>`;
  } else if (course.priceCents === 0) {
    action = `<button type="button" class="btn btn--primary btn--block btn--lg" data-enroll>${icon("check-circle", 18)} Matricular gratuitamente</button>`;
  } else {
    action = `<a class="btn btn--primary btn--block btn--lg" href="/checkout/${encodeURIComponent(course.slug)}">${icon("credit-card", 18)} Ir para o checkout</a>`;
  }

  return `
    <aside class="course-buy">
      <div class="course-buy__cover">
        <img src="${imageUrl(course.coverImage)}" alt="" width="640" height="400">
      </div>
      <div class="course-buy__body">
        <div class="course-buy__price">
          <strong>${esc(formatMoney(course.priceCents))}</strong>
          ${course.priceCents > 0 ? `<span>à vista, conforme condições</span>` : `<span>acesso gratuito ao curso</span>`}
        </div>
        ${action}
        <div class="cluster" style="justify-content:center;gap:6px">
          <span class="tiny muted">${icon("shield", 13)} Compra segura</span>
          <span class="tiny muted">•</span>
          <span class="tiny muted">${course.demo ? "Conteúdo demonstrativo" : "Conteúdo oficial"}</span>
        </div>
        ${factList([
          { label: "Carga horária", value: `${esc(formatHours(course.durationHours))}`, icon: "clock" },
          { label: "Aulas", value: `${plural(data.lessonCount, "aula", "aulas")}`, icon: "play" },
          { label: "Nível", value: esc(statusLabel(course.level)), icon: "bar-chart" },
          { label: "Modalidade", value: esc(statusLabel(course.modality)), icon: "monitor" },
          {
            label: "Certificado",
            value: course.certificateEnabled ? "Disponível após critérios" : "Não previsto",
            icon: "award",
          },
        ])}
        <div class="tiny muted" style="line-height:1.6">
          ${icon("info", 13)} Critério de conclusão: ${course.completionPercent}% das aulas${course.requireAssessment ? ` e nota mínima de ${course.passScore}% na avaliação` : ""}.
        </div>
      </div>
    </aside>`;
}

export async function render(ctx) {
  let data;
  try {
    data = await api.get(`/api/public/courses/${encodeURIComponent(ctx.params.slug)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return {
        title: "Curso não encontrado",
        documentTitle: "Curso não encontrado — BrasilTec Educação",
        html: `
          <section class="section"><div class="container container--narrow">
            <div class="empty-state">
              <div class="empty-state__icon">${icon("search", 24)}</div>
              <h2>Curso não encontrado</h2>
              <p>Este curso pode ter sido removido ou o endereço está incorreto.</p>
              <a class="btn btn--primary" href="/cursos">Ver catálogo</a>
            </div>
          </div></section>`,
      };
    }
    throw error;
  }

  const { course, outline, assessment, related, enrollment } = data;
  const enrolled = Boolean(enrollment && ["active", "completed"].includes(enrollment.status));
  const assessmentInfo = assessment
    ? `<div class="notice notice--info">${icon("clipboard", 18)}<div><strong>Avaliação final:</strong> ${esc(assessment.title)} • ${plural(assessment.questionCount, "questão", "questões")} • nota mínima ${assessment.passScore}%${assessment.maxAttempts > 0 ? ` • até ${plural(assessment.maxAttempts, "tentativa", "tentativas")}` : ""}.</div></div>`
    : "";

  return {
    title: course.title,
    documentTitle: `${course.title} — BrasilTec Educação`,
    description: course.subtitle || course.description?.slice(0, 160),
    wide: true,
    html: `
      <section class="page-hero" style="padding-bottom:0">
        <div class="container">
          ${breadcrumb([{ label: "Início", href: "/" }, { label: "Cursos", href: "/cursos" }, { label: course.title }])}
        </div>
      </section>
      <section class="course-detail">
        <div class="container">
          <div class="course-detail__head">
            <div class="course-detail__main">
              <div class="course-kicker">
                <span>${esc(course.category?.name || "Formação")}</span><span class="dot"></span>
                <span>${esc(statusLabel(course.level))}</span><span class="dot"></span>
                <span>${esc(statusLabel(course.modality))}</span>
                ${course.demo ? `<span class="badge badge--demo">Demonstração</span>` : ""}
              </div>
              <h1 class="course-detail__title">${esc(course.title)}</h1>
              <p class="lead">${esc(course.subtitle || "")}</p>
              <div class="course-detail__meta">
                <span>${icon("clock", 16)} ${esc(formatHours(course.durationHours))}</span>
                <span>${icon("book-open", 16)} ${plural(data.lessonCount, "aula", "aulas")}</span>
                <span>${icon("graduation", 16)} ${esc(course.certificateEnabled ? "Certificado disponível" : "Sem certificado")}</span>
                ${course.instructor ? `<span>${icon("user", 16)} ${esc(course.instructor.name)}</span>` : ""}
              </div>
            </div>
          </div>

          <div class="course-detail__grid">
            <div class="course-detail__main stack-lg">
              <div class="panel">
                <div class="panel__body lesson-prose">
                  <h2>Sobre o curso</h2>
                  ${String(course.description || "")
                    .split(/\n{2,}/)
                    .filter(Boolean)
                    .map((p) => `<p>${esc(p).replaceAll("\n", "<br>")}</p>`)
                    .join("")}
                </div>
              </div>

              ${
                (course.objectives || []).length
                  ? `<div class="panel"><div class="panel__head"><div><h2>O que você vai aprender</h2></div></div><div class="panel__body"><div class="objectives">${course.objectives
                      .map(
                        (objective) =>
                          `<div class="objective">${icon("check-circle", 18)}<span>${esc(objective)}</span></div>`
                      )
                      .join("")}</div></div></div>`
                  : ""
              }

              <div class="panel">
                <div class="panel__head">
                  <div><h2>Conteúdo programático</h2><p class="small muted">${plural(outline.length, "módulo", "módulos")} • ${plural(data.lessonCount, "aula", "aulas")}</p></div>
                </div>
                <div class="panel__body panel__body--flush" style="padding:0 20px 20px">${curriculum(outline, enrolled)}</div>
              </div>

              ${
                course.audience || course.requirements
                  ? `<div class="grid grid--2">
                      ${
                        course.audience
                          ? `<div class="panel"><div class="panel__body"><h3>Para quem é</h3><p class="muted">${esc(course.audience)}</p></div></div>`
                          : ""
                      }
                      ${
                        course.requirements
                          ? `<div class="panel"><div class="panel__body"><h3>Requisitos</h3><p class="muted">${esc(course.requirements)}</p></div></div>`
                          : ""
                      }
                    </div>`
                  : ""
              }

              ${
                course.instructor
                  ? `<div class="panel"><div class="panel__body"><div class="instructor-card">
                      <span class="instructor-card__avatar">${icon("user", 22)}</span>
                      <div><span class="eyebrow">Instrutor(a)</span><h3>${esc(course.instructor.name)}</h3><p class="muted small">${esc(course.instructor.title || "")}</p></div>
                    </div></div></div>`
                  : ""
              }

              ${
                course.certificateEnabled
                  ? `<div class="panel"><div class="panel__body">
                      <h3>${icon("award", 20)} Certificado</h3>
                      <p class="muted">Ao concluir ${course.completionPercent}% das aulas${course.requireAssessment ? ` e atingir a nota mínima de ${course.passScore}% na avaliação` : ""}, você poderá emitir o certificado digital. Cada certificado possui um código público de verificação.</p>
                      <a class="link-arrow" href="/verificar-certificado">Como funciona a verificação ${icon("arrow-right", 14)}</a>
                    </div></div>`
                  : ""
              }
            </div>

            <div class="course-detail__aside">
              ${buyCard(data, ctx.user)}
              ${
                enrolled
                  ? `<div class="notice notice--success">${icon("check-circle", 18)}<div>Você já está matriculado. <a href="/aluno/curso/${course.id}">Continuar estudando</a>.</div></div>`
                  : ""
              }
              ${assessmentInfo}
            </div>
          </div>
        </div>
      </section>

      ${
        related.length
          ? `<section class="section section--soft"><div class="container">
              <div class="section-head"><div class="section-head__text"><span class="eyebrow">Continue explorando</span><h2>Cursos relacionados</h2></div><a class="link-arrow" href="/cursos">Ver todos ${icon("arrow-right", 16)}</a></div>
              <div class="course-grid">${related.map(courseCard).join("")}</div>
            </div></section>`
          : ""
      }
    `,
    mount() {
      const enrollButton = document.querySelector("[data-enroll]");
      enrollButton?.addEventListener("click", async () => {
        setBusy(enrollButton, true, "Matriculando…");
        try {
          const result = await api.post(`/api/student/courses/${course.id}/enroll`, {});
          toast(result.message || "Matrícula realizada.", "success");
          if (result.enrolled) {
            location.assign(`/aluno/curso/${course.id}`);
          } else if (result.order) {
            location.assign(`/aluno/pedidos/${encodeURIComponent(result.order.code)}`);
          }
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            location.assign(`/entrar?next=${encodeURIComponent(`/cursos/${course.slug}`)}`);
            return;
          }
          toast(error.message || "Não foi possível concluir a matrícula.", "error");
          setBusy(enrollButton, false);
        }
      });

      document.querySelectorAll("[data-preview-lesson]").forEach((button) => {
        button.addEventListener("click", () => {
          const lessonId = Number(button.dataset.previewLesson);
          const lesson = outline.flatMap((m) => m.lessons).find((l) => l.id === lessonId);
          if (!lesson) return;
          openModal({
            title: lesson.title,
            subtitle: "Prévia gratuita da aula",
            size: "lg",
            body: lesson.videoUrl
              ? `<div class="video-wrap"><video controls preload="metadata" src="${esc(lesson.videoUrl)}" style="width:100%;border-radius:12px"></video></div>`
              : `<div class="empty-state"><div class="empty-state__icon">${icon("lock", 22)}</div><h3>Prévia indisponível</h3><p>Esta aula não possui vídeo de demonstração.</p></div>`,
            footer: `<a class="btn btn--outline btn--sm" href="/cursos">Voltar ao catálogo</a><a class="btn btn--primary btn--sm" href="/entrar?next=${encodeURIComponent(`/cursos/${course.slug}`)}">Quero me matricular</a>`,
          });
        });
      });
    },
  };
}
