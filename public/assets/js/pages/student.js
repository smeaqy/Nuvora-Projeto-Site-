/* BrasilTec Educação — área do aluno (painel, cursos, player, avaliações, certificados, pedidos e perfil) */

import { api, ApiError } from "../api.js";
import { state, navigate } from "../app.js";
import {
  esc,
  icon,
  toast,
  setBusy,
  clearErrors,
  fieldError,
  formatMoney,
  formatDate,
  formatDateTime,
  formatDuration,
  formatHours,
  statusLabel,
  statusBadge,
  plural,
  progressBar,
  progressWithLabel,
  openModal,
  confirmDialog,
  emptyState,
  imageUrl,
  taskItem,
  certificateCard,
  statCard,
  tableEmpty,
  firstName,
  safeExportFileName,
  renderMarkdown,
  validatePassword,
} from "../ui.js";
import {
  pageHead,
  alertBox,
  bindForm,
  field,
  textareaField,
  summaryList,
  emptyRow,
  money,
  tabs,
} from "./shared.js";

/* --------------------------------- Apoio --------------------------------- */

function courseLink(card) {
  if (!card) return "/aluno/cursos";
  if (card.lastLesson?.id) return `/aluno/curso/${card.course.id}/aula/${card.lastLesson.id}`;
  return `/aluno/curso/${card.course.id}`;
}

function myCourseCard(card) {
  const { course } = card;
  const completed = card.status === "completed";
  return `
    <article class="my-course-card">
      <div class="my-course-card__top">
        <a class="my-course-card__img" href="/aluno/curso/${course.id}" tabindex="-1" aria-hidden="true">
          <img src="${imageUrl(course.coverImage)}" alt="" width="208" height="156" loading="lazy">
        </a>
        <div class="my-course-card__body">
          <div class="cluster" style="gap:6px">
            ${statusBadge(card.status)}
            ${course.demo ? `<span class="badge badge--demo">Demonstração</span>` : ""}
          </div>
          <h3><a href="/aluno/curso/${course.id}">${esc(course.title)}</a></h3>
          <p>${esc(course.category?.name || "Formação")} • ${esc(formatHours(course.durationHours))}</p>
          ${progressWithLabel(card.progress)}
        </div>
      </div>
      <div class="my-course-card__bottom">
        <span class="tiny muted">${
          completed
            ? card.certificate
              ? `Certificado ${esc(card.certificate.code)}`
              : "Curso concluído"
            : card.progress > 0
              ? "Continue de onde parou"
              : "Pronto para começar"
        }</span>
        <a class="btn ${completed && card.certificate ? "btn--outline" : "btn--primary"} btn--xs" href="${
          completed && card.certificate ? `/certificado/${encodeURIComponent(card.certificate.code)}` : courseLink(card)
        }">
          ${completed && card.certificate ? `${icon("award", 14)} Certificado` : `${icon("play", 14)} ${card.progress > 0 ? "Continuar" : "Estudar"}`}
        </a>
      </div>
    </article>`;
}

function playerSidebar(modules, activeId, course) {
  const bar = progressBar(0);
  return `
    <aside class="player-curriculum">
      <div class="player-curriculum__head">
        <h2>${esc(course.title)}</h2>
        <div class="progress-with-label" data-player-progress>
          ${bar}
        </div>
      </div>
      <div class="player-curriculum__list">
        ${modules
          .map(
            (module, index) => `
            <details class="player-module" ${module.lessons.some((l) => l.id === activeId) || index === 0 ? "open" : ""}>
              <summary><span>${esc(module.title)}</span><em class="tiny muted" style="font-style:normal">${module.lessons.length}</em></summary>
              ${module.lessons
                .map(
                  (lesson) => `
                  <a class="player-lesson ${lesson.id === activeId ? "is-active" : ""} ${lesson.completed ? "is-done" : ""}" href="/aluno/curso/${course.id}/aula/${lesson.id}">
                    <span class="player-lesson__check">${icon("check", 11)}</span>
                    <span>${esc(lesson.title)}</span>
                    <em>${esc(formatDuration(lesson.durationMinutes))}</em>
                  </a>`
                )
                .join("")}
            </details>`
          )
          .join("")}
      </div>
    </aside>`;
}

function assessmentSummary(assessment) {
  if (!assessment) return "";
  const attempts = assessment.attempts || [];
  return `
    <div class="panel">
      <div class="panel__head">
        <div><h2>${icon("clipboard", 18)} Avaliação final</h2><p>${esc(assessment.title)}</p></div>
        ${assessment.passed ? `<span class="badge badge--free">Aprovado</span>` : `<span class="badge badge--warning">Pendente</span>`}
      </div>
      <div class="panel__body stack-sm">
        <p class="small muted">${esc(assessment.description || "Avaliação de conclusão do curso.")}</p>
        <div class="cluster small muted">
          <span>${icon("help", 14)} ${plural(assessment.questionCount, "questão", "questões")}</span>
          <span>${icon("target", 14)} Nota mínima ${assessment.passScore}%</span>
          <span>${icon("refresh", 14)} ${
            assessment.maxAttempts > 0 ? `${assessment.remainingAttempts} tentativa(s) restante(s)` : "Tentativas livres"
          }</span>
        </div>
        ${
          attempts.length
            ? `<div class="stack-sm" style="margin-top:6px">
                ${attempts
                  .slice(0, 3)
                  .map(
                    (a) =>
                      `<div class="between small"><span class="muted">${esc(formatDateTime(a.submittedAt))}</span><strong>${a.score}% ${a.passed ? "• aprovado" : ""}</strong></div>`
                  )
                  .join("")}
              </div>`
            : ""
        }
        <div style="margin-top:8px">
          <a class="btn btn--primary btn--sm" href="/aluno/curso/${assessment.courseId}/avaliacao">
            ${icon("clipboard", 15)} ${assessment.passed ? "Rever avaliação" : attempts.length ? "Tentar novamente" : "Iniciar avaliação"}
          </a>
        </div>
      </div>
    </div>`;
}

/* ------------------------------- Visão geral ------------------------------ */

export async function dashboard() {
  const data = await api.get("/api/student/overview");
  const { stats, continueLearning, recentCourses, tasks, certificates, recommended } = data;
  const user = state.user;

  return {
    title: "Visão geral",
    eyebrow: "Área do aluno",
    actions: `<a class="btn btn--outline btn--sm" href="/cursos">${icon("search", 15)} Explorar cursos</a>`,
    html: `
      <div class="stack-lg">
        ${pageHead({
          eyebrow: "Bem-vindo(a) de volta",
          title: `Olá, ${firstName(user?.name)}`,
          text: "Acompanhe seu progresso, retome seus estudos e consulte seus certificados.",
          actions: `<a class="btn btn--primary btn--sm" href="/aluno/cursos">${icon("book-open", 15)} Meus cursos</a>`,
        })}

        <div class="stat-grid">
          ${statCard({ label: "Cursos em andamento", value: stats.inProgress, iconName: "book-open", tone: "navy", hint: "Matrículas ativas" })}
          ${statCard({ label: "Cursos concluídos", value: stats.completed, iconName: "check-circle", tone: "green", hint: "Conclusões registradas" })}
          ${statCard({ label: "Certificados", value: stats.certificates, iconName: "award", tone: "gold", hint: "Documentos emitidos" })}
          ${statCard({ label: "Aulas concluídas", value: stats.lessonsCompleted, iconName: "play", hint: `${stats.studyMinutes} min de conteúdo` })}
        </div>

        ${
          continueLearning
            ? `<div class="continue-card">
                <div class="continue-card__img">
                  <img src="${imageUrl(continueLearning.course.coverImage)}" alt="" width="360" height="266" loading="lazy">
                </div>
                <div class="continue-card__body">
                  <span class="eyebrow">Continue aprendendo</span>
                  <h3>${esc(continueLearning.course.title)}</h3>
                  <p>${continueLearning.lastLesson ? `Última aula: ${esc(continueLearning.lastLesson.title)}` : "Seu próximo passo está esperando por você."}</p>
                  <div class="continue-card__progress">
                    ${progressBar(continueLearning.progress, { large: true })}
                    <strong class="small">${continueLearning.progress}%</strong>
                  </div>
                  <div>
                    <a class="btn btn--primary btn--sm" href="${courseLink(continueLearning)}">${icon("play", 15)} Continuar estudando</a>
                  </div>
                </div>
              </div>`
            : `<div class="panel"><div class="panel__body between">
                <div>
                  <h3>Comece seu próximo curso</h3>
                  <p class="small muted" style="margin-top:4px">Você ainda não possui um curso em andamento. Explore o catálogo e escolha uma formação.</p>
                </div>
                <a class="btn btn--primary btn--sm" href="/cursos">Ver cursos ${icon("arrow-right", 15)}</a>
              </div></div>`
        }

        <div class="dash-grid">
          <div class="panel">
            <div class="panel__head">
              <div><h2>Próximos passos</h2><p>Tarefas para avançar nos seus cursos</p></div>
              <a class="link-arrow tiny" href="/aluno/cursos">Meus cursos ${icon("arrow-right", 13)}</a>
            </div>
            ${
              tasks.length
                ? `<div class="task-list">${tasks.map(taskItem).join("")}</div>`
                : emptyState({ iconName: "check-circle", title: "Tudo em dia", text: "Você não tem tarefas pendentes no momento." })
            }
          </div>

          <div class="panel">
            <div class="panel__head">
              <div><h2>Certificados</h2><p>Documentos emitidos</p></div>
              <a class="link-arrow tiny" href="/aluno/certificados">Ver todos ${icon("arrow-right", 13)}</a>
            </div>
            ${
              certificates.length
                ? `<div class="stack-sm" style="padding:16px">${certificates
                    .map(
                      (cert) => `
                      <div class="between" style="gap:12px;padding:10px 0;border-bottom:1px solid var(--line)">
                        <div style="min-width:0">
                          <strong class="small" style="display:block">${esc(cert.courseName)}</strong>
                          <span class="tiny muted">${esc(formatDate(cert.issuedAt))}</span>
                        </div>
                        <a class="btn btn--outline btn--xs" href="/certificado/${encodeURIComponent(cert.code)}">Abrir</a>
                      </div>`
                    )
                    .join("")}</div>`
                : emptyState({
                    iconName: "award",
                    title: "Nenhum certificado ainda",
                    text: "Conclua um curso para emitir seu certificado digital.",
                  })
            }
          </div>
        </div>

        ${
          recentCourses.length
            ? `<section>
                <div class="section-head" style="margin-bottom:16px">
                  <div class="section-head__text"><span class="eyebrow">Sua biblioteca</span><h2 style="font-size:1.25rem">Meus cursos</h2></div>
                  <a class="link-arrow tiny" href="/aluno/cursos">Ver todos ${icon("arrow-right", 13)}</a>
                </div>
                <div class="my-course-grid">${recentCourses.map(myCourseCard).join("")}</div>
              </section>`
            : ""
        }

        ${
          recommended.length
            ? `<section>
                <div class="section-head" style="margin-bottom:16px">
                  <div class="section-head__text"><span class="eyebrow">Sugestões</span><h2 style="font-size:1.25rem">Continue explorando</h2></div>
                  <a class="link-arrow tiny" href="/cursos">Catálogo ${icon("arrow-right", 13)}</a>
                </div>
                <div class="grid grid--3">
                  ${recommended
                    .map(
                      (course) => `
                      <article class="panel">
                        <div class="panel__body">
                          <div class="course-kicker"><span>${esc(course.category?.name || "Formação")}</span><span class="dot"></span><span>${esc(statusLabel(course.level))}</span></div>
                          <h3 style="margin:6px 0 4px;font-size:1rem">${esc(course.title)}</h3>
                          <p class="tiny muted" style="margin-bottom:12px">${esc(course.subtitle || "")}</p>
                          <div class="between">
                            <span class="price ${course.isFree ? "price--free" : ""}">${esc(formatMoney(course.priceCents))}</span>
                            <a class="link-arrow tiny" href="/cursos/${esc(course.slug)}">Conhecer ${icon("arrow-right", 13)}</a>
                          </div>
                        </div>
                      </article>`
                    )
                    .join("")}
                </div>
              </section>`
            : ""
        }
      </div>`,
  };
}

/* ------------------------------- Meus cursos ------------------------------ */

export async function courses(ctx) {
  const filter = ctx.query.get("filter") || "all";
  const data = await api.get(`/api/student/courses?filter=${encodeURIComponent(filter)}`);
  const { items, summary } = data;
  const labels = [
    { id: "all", label: "Todos", count: summary.all },
    { id: "in_progress", label: "Em andamento", count: summary.inProgress },
    { id: "not_started", label: "Não iniciados", count: summary.notStarted },
    { id: "completed", label: "Concluídos", count: summary.completed },
  ];
  return {
    title: "Meus cursos",
    actions: `<a class="btn btn--outline btn--sm" href="/cursos">${icon("search", 15)} Encontrar novos cursos</a>`,
    html: `
      ${pageHead({ eyebrow: "Biblioteca do aluno", title: "Meus cursos", text: "Todos os cursos nos quais você está matriculado." })}
      ${tabs(labels, filter)}
      ${
        items.length
          ? `<div class="my-course-grid">${items.map(myCourseCard).join("")}</div>`
          : emptyState({
              iconName: "book-open",
              title: "Nenhum curso nesta categoria",
              text: filter === "all" ? "Você ainda não tem matrículas. Explore o catálogo para começar." : "Não encontramos cursos com este filtro.",
              action: `<a class="btn btn--primary btn--sm" href="/cursos">Explorar catálogo</a>`,
            })
      }`,
    mount() {
      document.querySelectorAll(".tab-bar [data-tab]").forEach((button) => {
        button.addEventListener("click", () => {
          const next = button.dataset.tab;
          navigate(next === "all" ? "/aluno/cursos" : `/aluno/cursos?filter=${encodeURIComponent(next)}`);
        });
      });
    },
  };
}

/* ------------------------------- Curso aluno ------------------------------ */

export async function course(ctx) {
  const data = await api.get(`/api/student/courses/${encodeURIComponent(ctx.params.id)}`);
  const { course, enrollment, modules, nextLesson, assessment, certificate } = data;
  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const certificateBox = certificate
    ? `<div class="panel"><div class="panel__body stack-sm">
        <h3>${icon("award", 19)} Certificado disponível</h3>
        <p class="small muted">Código de verificação <strong class="mono">${esc(certificate.code)}</strong></p>
        <a class="btn btn--primary btn--sm" href="/certificado/${encodeURIComponent(certificate.code)}">${icon("award", 15)} Abrir certificado</a>
      </div></div>`
    : enrollment.status === "completed" && course.certificateEnabled
      ? `<div class="panel"><div class="panel__body stack-sm">
          <h3>${icon("award", 19)} Curso concluído</h3>
          <p class="small muted">Você atendeu aos critérios de conclusão. Verifique se o certificado está disponível.</p>
          <a class="btn btn--outline btn--sm" href="/aluno/certificados">Ir para certificados</a>
        </div></div>`
      : "";

  return {
    title: course.title,
    eyebrow: course.category?.name || "Meu curso",
    actions: `<a class="btn btn--ghost btn--sm" href="/aluno/cursos">${icon("arrow-left", 15)} Meus cursos</a>`,
    wide: true,
    html: `
      <div class="stack-lg">
        <div class="course-hero">
          <div class="course-hero__bg"><img src="${imageUrl(course.coverImage)}" alt="" width="1400" height="600"></div>
          <div class="course-hero__body">
            <div>
              <div class="cluster" style="gap:8px">
                <span class="badge badge--light">${esc(statusLabel(course.level))}</span>
                <span class="badge badge--light">${esc(statusLabel(course.modality))}</span>
                ${statusBadge(enrollment.status)}
                ${course.demo ? `<span class="badge badge--demo">Demonstração</span>` : ""}
              </div>
              <h1>${esc(course.title)}</h1>
              <p>${esc(course.subtitle || course.description?.slice(0, 180) || "")}</p>
              <div class="cluster" style="gap:18px;margin-top:14px;font-size:.8rem">
                <span>${icon("book-open", 15)} ${plural(totalLessons, "aula", "aulas")}</span>
                <span>${icon("clock", 15)} ${esc(formatHours(course.durationHours))}</span>
                <span>${icon("calendar", 15)} Matrícula em ${esc(formatDate(enrollment.enrolledAt))}</span>
              </div>
            </div>
            <div class="course-hero__progress">
              <div class="progress-ring" style="--value:${Math.max(0, Math.min(100, enrollment.progress))}" role="img" aria-label="Progresso: ${enrollment.progress}%"><strong>${enrollment.progress}%</strong></div>
              <span>concluído</span>
            </div>
          </div>
        </div>

        <div class="dash-grid">
          <div class="stack">
            <div class="panel">
              <div class="panel__head">
                <div><h2>Conteúdo do curso</h2><p>${plural(modules.length, "módulo", "módulos")} • ${plural(totalLessons, "aula", "aulas")}</p></div>
                ${
                  nextLesson
                    ? `<a class="btn btn--primary btn--sm" href="/aluno/curso/${course.id}/aula/${nextLesson.id}">${icon("play", 15)} Continuar</a>`
                    : `<span class="badge badge--free">Todas as aulas concluídas</span>`
                }
              </div>
              <div class="panel__body">
                ${
                  modules.length
                    ? `<div class="curriculum">${modules
                        .map(
                          (module, index) => `
                          <details class="curriculum-module" ${index === 0 ? "open" : ""}>
                            <summary>
                              <strong>${esc(module.title)}</strong>
                              <span>${plural(module.lessons.length, "aula", "aulas")}</span>
                            </summary>
                            ${module.lessons
                              .map(
                                (lesson) => `
                                <a class="curriculum-lesson ${lesson.completed ? "is-done" : ""} ${nextLesson?.id === lesson.id ? "is-current" : ""}" href="/aluno/curso/${course.id}/aula/${lesson.id}">
                                  <span class="curriculum-lesson__status">${icon("check", 12)}</span>
                                  <span>${esc(lesson.title)}${lesson.isFreePreview ? ` <span class="badge badge--free">Prévia</span>` : ""}</span>
                                  <em>${esc(formatDuration(lesson.durationMinutes))}</em>
                                </a>`
                              )
                              .join("")}
                          </details>`
                        )
                        .join("")}</div>`
                    : emptyState({ iconName: "book-open", title: "Conteúdo em preparação", text: "As aulas serão publicadas em breve." })
                }
              </div>
            </div>

            ${
              course.objectives?.length
                ? `<div class="panel"><div class="panel__body"><h3>O que você vai aprender</h3><div class="objectives" style="margin-top:12px">${course.objectives
                    .map((objective) => `<div class="objective">${icon("check-circle", 17)}<span>${esc(objective)}</span></div>`)
                    .join("")}</div></div></div>`
                : ""
            }
          </div>

          <div class="stack">
            <div class="panel">
              <div class="panel__head"><div><h2>Seu progresso</h2><p>${enrollment.status === "completed" ? "Curso concluído" : "Continue avançando"}</p></div></div>
              <div class="panel__body stack-sm">
                ${progressWithLabel(enrollment.progress)}
                <p class="tiny muted">${plural(
                  modules.flatMap((m) => m.lessons).filter((l) => l.completed).length,
                  "aula concluída",
                  "aulas concluídas"
                )} de ${totalLessons}.</p>
                ${
                  nextLesson
                    ? `<a class="btn btn--primary btn--sm btn--block" href="/aluno/curso/${course.id}/aula/${nextLesson.id}">${icon("play", 15)} ${enrollment.progress > 0 ? "Continuar aula" : "Começar curso"}</a>`
                    : `<a class="btn btn--outline btn--sm btn--block" href="/aluno/certificados">${icon("award", 15)} Meus certificados</a>`
                }
              </div>
            </div>
            ${assessmentSummary(assessment)}
            ${certificateBox}
            <div class="notice notice--info">${icon("info", 18)}<div>Seu progresso é salvo automaticamente. Marque cada aula como concluída ao terminar os estudos.</div></div>
          </div>
        </div>
      </div>`,
  };
}

/* --------------------------------- Player -------------------------------- */

export async function player(ctx) {
  const data = await api.get(`/api/student/lessons/${encodeURIComponent(ctx.params.lessonId)}`);
  const { lesson, course, enrollment, previousLesson, nextLesson, note, modules } = data;
  const initialBar = progressBar(enrollment.progress, { large: true });
  const lessonMaterials = lesson.materials || [];

  const navButtons = `
    <div class="lesson-actions">
      <div class="cluster">
        ${
          previousLesson
            ? `<a class="btn btn--outline btn--sm" href="/aluno/curso/${course.id}/aula/${previousLesson.id}">${icon("arrow-left", 15)} Aula anterior</a>`
            : ""
        }
        ${nextLesson ? `<a class="btn btn--outline btn--sm" href="/aluno/curso/${course.id}/aula/${nextLesson.id}">Próxima aula ${icon("arrow-right", 15)}</a>` : ""}
      </div>
      <div class="cluster">
        <a class="btn btn--ghost btn--sm" href="/aluno/curso/${course.id}">${icon("book-open", 15)} Visão do curso</a>
        ${
          nextLesson
            ? `<button type="button" class="btn btn--primary btn--sm" data-complete-next>${icon("check-circle", 15)} Concluir e avançar</button>`
            : `<button type="button" class="btn btn--primary btn--sm" data-complete-next>${icon("check-circle", 15)} Concluir aula</button>`
        }
      </div>
    </div>`;

  return {
    title: lesson.title,
    layout: "bare",
    documentTitle: `${lesson.title} — ${course.title}`,
    html: `
      <div class="player-shell">
        <div class="player-main">
          <header class="player-topbar">
            <a class="icon-btn" href="/aluno/curso/${course.id}" aria-label="Voltar para o curso" title="Voltar para o curso">${icon("arrow-left", 20)}</a>
            <div class="player-topbar__title">
              <span>${esc(lesson.moduleTitle)}</span>
              <strong>${esc(lesson.title)}</strong>
            </div>
            <div class="cluster" style="gap:8px">
              ${progressWithLabel(enrollment.progress)}
              ${
                lesson.completed
                  ? `<span class="badge badge--free">${icon("check", 12)} Concluída</span>`
                  : `<span class="badge badge--muted">Em andamento</span>`
              }
            </div>
          </header>

          ${
            lesson.videoUrl
              ? `<div class="video-wrap"><video controls preload="metadata" src="${esc(lesson.videoUrl)}" aria-label="Vídeo da aula ${esc(lesson.title)}"></video></div>`
              : `<div class="video-wrap" style="display:grid;place-items:center;background:var(--navy-900);color:rgba(255,255,255,.7)"><div class="text-center">${icon("monitor", 36)}<p class="small" style="margin-top:10px">Esta aula não possui vídeo. Consulte o conteúdo abaixo.</p></div></div>`
          }

          <div class="lesson-content">
            <span class="eyebrow">${esc(lesson.moduleTitle)}</span>
            <h1>${esc(lesson.title)}</h1>
            <div class="lesson-content__meta">
              <span>${icon("clock", 14)} ${esc(formatDuration(lesson.durationMinutes))}</span>
              <span>${icon("book-open", 14)} ${esc(course.title)}</span>
              <span>${icon("info", 14)} Progresso: ${enrollment.completedLessons}/${enrollment.totalLessons} aulas</span>
            </div>

            <div class="lesson-tabs" role="tablist" aria-label="Seções da aula">
              <button type="button" class="is-active" role="tab" aria-selected="true" data-lesson-tab="content">Conteúdo</button>
              <button type="button" role="tab" aria-selected="false" data-lesson-tab="notes">Anotações</button>
              <button type="button" role="tab" aria-selected="false" data-lesson-tab="materials">Materiais ${lessonMaterials.length ? `<span class="tiny">(${lessonMaterials.length})</span>` : ""}</button>
            </div>

            <div data-lesson-pane="content">
              <div class="lesson-prose">
                ${lesson.content ? renderMarkdown(lesson.content) : `<p class="muted">O conteúdo textual desta aula será disponibilizado em breve. Assista ao vídeo e consulte os materiais.</p>`}
              </div>
              ${navButtons}
            </div>

            <div data-lesson-pane="notes" hidden>
              <div class="note-editor">
                <label class="field-label" for="lesson-note">Suas anotações desta aula</label>
                <textarea class="textarea" id="lesson-note" maxlength="10000" placeholder="Escreva aqui suas anotações, dúvidas e insights…">${esc(note?.content || "")}</textarea>
                <div class="note-editor__footer">
                  <span data-note-status>${note ? `Última atualização em ${esc(formatDateTime(note.updatedAt))}` : "Suas anotações ficam salvas na sua conta."}</span>
                  <span class="cluster" style="gap:8px">
                    <span class="tiny muted" data-note-count></span>
                    <button type="button" class="btn btn--primary btn--sm" data-save-note>${icon("check", 15)} Salvar anotações</button>
                  </span>
                </div>
              </div>
            </div>

            <div data-lesson-pane="materials" hidden>
              ${
                lessonMaterials.length
                  ? `<div class="material-list">${lessonMaterials
                      .map(
                        (material) => `
                        <div class="material-item">
                          <span class="material-item__icon">${icon("file-text", 19)}</span>
                          <div class="material-item__body">
                            <strong>${esc(material.title)}</strong>
                            <span>${esc(material.fileType || "Arquivo")}${material.sizeLabel ? ` • ${esc(material.sizeLabel)}` : ""}</span>
                          </div>
                          <a class="btn btn--outline btn--xs" href="${esc(material.fileUrl)}" target="_blank" rel="noopener noreferrer" download>${icon("download", 14)} Baixar</a>
                        </div>`
                      )
                      .join("")}</div>`
                  : emptyState({ iconName: "file-text", title: "Sem materiais nesta aula", text: "Os arquivos de apoio aparecerão aqui quando forem adicionados." })
              }
              ${navButtons}
            </div>
          </div>
        </div>

        ${playerSidebar(modules.map((m) => ({ ...m, lessons: m.lessons.map((l) => ({ ...l, completed: l.completed })) })), lesson.id, course)}
      </div>`,
    mount() {
      const progressText = document.querySelector("[data-player-progress]");
      const setProgressUI = (percent) => {
        if (!progressText) return;
        progressText.innerHTML = `${progressBar(percent, { large: true })}<strong>${percent}%</strong>`;
      };
      setProgressUI(enrollment.progress);

      document.querySelectorAll("[data-lesson-tab]").forEach((button) => {
        button.addEventListener("click", () => {
          document.querySelectorAll("[data-lesson-tab]").forEach((item) => {
            item.classList.toggle("is-active", item === button);
            item.setAttribute("aria-selected", String(item === button));
          });
          document.querySelectorAll("[data-lesson-pane]").forEach((pane) => {
            pane.hidden = pane.dataset.lessonPane !== button.dataset.lessonTab;
          });
        });
      });

      const noteInput = document.getElementById("lesson-note");
      const noteCount = document.querySelector("[data-note-count]");
      const updateCount = () => {
        if (noteCount && noteInput) noteCount.textContent = `${noteInput.value.length}/10000`;
      };
      updateCount();
      noteInput?.addEventListener("input", updateCount);

      document.querySelector("[data-save-note]")?.addEventListener("click", async (event) => {
        const button = event.currentTarget;
        setBusy(button, true, "Salvando…");
        try {
          const result = await api.put(`/api/student/lessons/${lesson.id}/note`, { content: noteInput.value });
          document.querySelector("[data-note-status]").textContent = `Salvo em ${formatDateTime(result.updatedAt)}`;
          toast("Anotações salvas.", "success");
        } catch (error) {
          toast(error.message || "Não foi possível salvar as anotações.", "error");
        } finally {
          setBusy(button, false);
        }
      });

      const markComplete = async (completed) => {
        const result = await api.post(`/api/student/lessons/${lesson.id}/complete`, { completed });
        setProgressUI(result.enrollment?.progress ?? enrollment.progress);
        toast(result.message || "Progresso atualizado.", "success");
        return result;
      };

      document.querySelectorAll("[data-complete-next]").forEach((button) => {
        button.addEventListener("click", async () => {
          setBusy(button, true, "Salvando…");
          try {
            await markComplete(true);
            if (nextLesson) navigate(`/aluno/curso/${course.id}/aula/${nextLesson.id}`);
            else navigate(`/aluno/curso/${course.id}`);
          } catch (error) {
            toast(error.message || "Não foi possível atualizar o progresso.", "error");
            setBusy(button, false);
          }
        });
      });

      const completeToggle = document.createElement("button");
      completeToggle.type = "button";
      completeToggle.className = `btn ${lesson.completed ? "btn--outline" : "btn--success"} btn--sm btn--block`;
      completeToggle.style.marginTop = "10px";
      completeToggle.innerHTML = lesson.completed
        ? `${icon("refresh", 15)} Marcar aula como não concluída`
        : `${icon("check-circle", 15)} Marcar aula como concluída`;
      completeToggle.addEventListener("click", async () => {
        setBusy(completeToggle, true, "Atualizando…");
        try {
          await markComplete(!lesson.completed);
          navigate(`/aluno/curso/${course.id}/aula/${lesson.id}?r=${Date.now()}`);
        } catch (error) {
          toast(error.message || "Não foi possível atualizar o progresso.", "error");
          setBusy(completeToggle, false);
        }
      });
      document.querySelector("[data-lesson-pane='content'] .lesson-actions .cluster:last-child")?.prepend(completeToggle);
    },
  };
}

/* -------------------------------- Avaliação ------------------------------- */

function quizHtml(assessment, attemptId) {
  return `
    <form id="quiz-form" novalidate>
      <div class="question-progress">
        <span>Responda todas as ${plural(assessment.questions.length, "questão", "questões")}</span>
        <strong data-answered>0 de ${assessment.questions.length} respondidas</strong>
      </div>
      <div class="stack-lg">
        ${assessment.questions
          .map(
            (question, index) => `
            <section class="question-card" id="question-${question.id}" data-question="${question.id}">
              <span class="eyebrow">Questão ${index + 1} de ${assessment.questions.length}</span>
              <h2>${esc(question.text)}</h2>
              <div class="option-list">
                ${question.options
                  .map(
                    (option, optionIndex) => `
                    <label class="option">
                      <input type="radio" name="q-${question.id}" value="${optionIndex}">
                      <span class="option__letter">${String.fromCharCode(65 + optionIndex)}</span>
                      <span>${esc(option)}</span>
                    </label>`
                  )
                  .join("")}
              </div>
            </section>`
          )
          .join("")}
      </div>
      <div class="question-nav">
        <a class="btn btn--ghost btn--sm" href="/aluno/curso/${assessment.courseId}">${icon("arrow-left", 15)} Sair</a>
        <div class="cluster" style="margin-left:auto">
          <span class="tiny muted" data-quiz-warning></span>
          <button type="submit" class="btn btn--primary" data-submit-quiz>${icon("send", 16)} Enviar respostas</button>
        </div>
      </div>
    </form>`;
}

function resultHtml(result, courseId, remaining) {
  const passed = Boolean(result.passed);
  return `
    <div class="stack-lg">
      <div class="result-score">
        <div class="result-score__circle" style="--value:${result.score};--ring-color:${passed ? "var(--success)" : "var(--gold)"}">
          <strong>${result.score}%</strong>
        </div>
        <span class="badge ${passed ? "badge--free" : "badge--warning"}">${passed ? "Aprovado" : "Abaixo da nota mínima"}</span>
        <h2>${passed ? "Parabéns! Você foi aprovado." : "Quase lá! Continue estudando."}</h2>
        <p>${esc(result.message || "")} Você acertou ${result.correct} de ${result.total} questões. Nota mínima: ${result.passScore}%.</p>
      </div>
      <div class="cluster" style="justify-content:center">
        <a class="btn btn--outline btn--sm" href="/aluno/curso/${courseId}">${icon("book-open", 15)} Voltar ao curso</a>
        ${
          passed
            ? `<a class="btn btn--primary btn--sm" href="/aluno/certificados">${icon("award", 15)} Certificados</a>`
            : remaining > 0
              ? `<button type="button" class="btn btn--primary btn--sm" data-retry>${icon("refresh", 15)} Tentar novamente</button>`
              : `<a class="btn btn--primary btn--sm" href="/aluno/curso/${courseId}">${icon("arrow-right", 15)} Revisar conteúdo</a>`
        }
      </div>
      <div>
        <h2 style="font-size:1.1rem;margin-bottom:12px">Feedback das questões</h2>
        <div class="feedback-list">
          ${result.feedback
            .map(
              (item, index) => `
              <div class="feedback-item ${item.correct ? "is-correct" : "is-wrong"}">
                <div class="feedback-item__head">
                  ${icon(item.correct ? "check-circle" : "x-circle", 18)}
                  <strong>${index + 1}. ${esc(item.text)}</strong>
                  <span class="badge ${item.correct ? "badge--free" : "badge--danger"}">${item.correct ? "Correta" : "Incorreta"}</span>
                </div>
                <div class="feedback-item__answers">
                  ${
                    item.selected === null || item.selected === undefined
                      ? `<span>Você não respondeu esta questão.</span>`
                      : `<span>Sua resposta: <b>${esc(item.options[item.selected] || "—")}</b></span>`
                  }
                  ${!item.correct ? `<span>Resposta correta: <b>${esc(item.options[item.correctIndex] || "—")}</b></span>` : ""}
                </div>
                ${item.explanation ? `<div class="feedback-item__explanation">${esc(item.explanation)}</div>` : ""}
              </div>`
            )
            .join("")}
        </div>
      </div>
    </div>`;
}

export async function assessment(ctx) {
  const courseId = Number(ctx.params.id);
  let data;
  try {
    data = await api.get(`/api/student/assessments/${courseId}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      return { redirect: `/aluno/curso/${courseId}` };
    }
    throw error;
  }
  const { assessment, course } = data;
  const attempts = assessment.attempts || [];
  const canStart =
    !assessment.passed &&
    (assessment.maxAttempts === 0 || assessment.remainingAttempts > 0) &&
    assessment.questions.length > 0;
  const inProgress = Boolean(assessment.inProgressAttemptId);

  return {
    title: assessment.title,
    eyebrow: course.title,
    actions: `<a class="btn btn--ghost btn--sm" href="/aluno/curso/${course.id}">${icon("arrow-left", 15)} Voltar ao curso</a>`,
    html: `
      <div class="assessment-shell">
        <div class="assessment-card">
          <div class="assessment-head">
            <span class="eyebrow eyebrow--light">Avaliação final</span>
            <h1>${esc(assessment.title)}</h1>
            <p>${esc(assessment.description || "Responda com atenção. Você pode consultar o conteúdo do curso antes de enviar.")}</p>
          </div>
          <div class="assessment-meta-grid">
            <div class="assessment-meta"><strong>${assessment.questionCount}</strong><span>Questões</span></div>
            <div class="assessment-meta"><strong>${assessment.passScore}%</strong><span>Nota mínima</span></div>
            <div class="assessment-meta"><strong>${assessment.maxAttempts > 0 ? assessment.maxAttempts : "∞"}</strong><span>Tentativas</span></div>
          </div>
          <div class="assessment-body" id="assessment-body">
            ${
              inProgress
                ? quizHtml(assessment, assessment.inProgressAttemptId)
                : `${
                    assessment.passed
                      ? alertBox("Você já foi aprovado nesta avaliação. Consulte o resultado abaixo ou emita seu certificado.", "success")
                      : attempts.length && (assessment.maxAttempts === 0 || assessment.remainingAttempts > 0)
                        ? alertBox("Você já realizou tentativas. A melhor nota é considerada para aprovação.", "info")
                        : ""
                  }
                  <div class="assessment-intro" style="margin-top:16px">
                    <h2 style="font-size:1.05rem">Antes de começar</h2>
                    <ul class="assessment-rules" style="list-style:none">
                      <li>${icon("check-circle", 17)} A avaliação é individual e deve ser respondida por você.</li>
                      <li>${icon("check-circle", 17)} As questões são de múltipla escolha ou verdadeiro/falso.</li>
                      <li>${icon("check-circle", 17)} A aprovação exige nota igual ou superior a ${assessment.passScore}%.</li>
                      <li>${icon("check-circle", 17)} ${
                        assessment.maxAttempts > 0
                          ? `Você possui ${assessment.remainingAttempts} tentativa(s) disponível(is).`
                          : "Não há limite de tentativas configurado para esta avaliação."
                      }</li>
                      <li>${icon("check-circle", 17)} O feedback detalhado é exibido após o envio das respostas.</li>
                    </ul>
                    ${
                      assessment.passed
                        ? `<div class="cluster"><a class="btn btn--primary btn--sm" href="/aluno/certificados">${icon("award", 15)} Ir para certificados</a><a class="btn btn--outline btn--sm" href="/aluno/curso/${course.id}">Voltar ao curso</a></div>`
                        : canStart
                          ? `<div class="cluster"><button type="button" class="btn btn--primary btn--lg" data-start-assessment>${icon("play", 17)} ${attempts.length ? "Iniciar nova tentativa" : "Iniciar avaliação"}</button><span class="tiny muted">O tempo começa ao iniciar.</span></div>`
                          : assessment.questions.length === 0
                            ? alertBox("Esta avaliação ainda não possui questões publicadas.", "warning")
                            : alertBox("Você atingiu o limite de tentativas desta avaliação. Fale com o suporte se precisar de orientação.", "warning")
                    }`
            }

            ${
              attempts.length && !inProgress
                ? `<div style="margin-top:26px;padding-top:20px;border-top:1px solid var(--line)">
                    <div class="between" style="margin-bottom:10px"><h2 style="font-size:1rem">Suas tentativas</h2><span class="tiny muted">Melhor nota: ${assessment.bestScore ?? "—"}%</span></div>
                    <div class="table-wrap"><table class="table">
                      <thead><tr><th>Tentativa</th><th>Nota</th><th>Resultado</th><th>Data</th></tr></thead>
                      <tbody>
                        ${attempts
                          .map(
                            (attempt, index) => `
                            <tr>
                              <td>${attempts.length - index}ª</td>
                              <td><strong>${attempt.score}%</strong></td>
                              <td>${attempt.passed ? `<span class="badge badge--free">Aprovado</span>` : `<span class="badge badge--danger">Não atingiu</span>`}</td>
                              <td class="tiny muted">${esc(formatDateTime(attempt.submittedAt))}</td>
                            </tr>`
                          )
                          .join("")}
                      </tbody>
                    </table></div>
                  </div>`
                : ""
            }
          </div>
        </div>
      </div>`,
    mount() {
      const body = document.getElementById("assessment-body");
      if (!body) return;

      const bindQuiz = () => {
        const form = document.getElementById("quiz-form");
        if (!form) return;
        const answeredNode = form.querySelector("[data-answered]");
        const updateAnswered = () => {
          const answered = form.querySelectorAll("input[type='radio']:checked").length;
          if (answeredNode) answeredNode.textContent = `${answered} de ${assessment.questions.length} respondidas`;
        };
        form.addEventListener("change", (event) => {
          const option = event.target.closest(".option");
          if (!option) return;
          option.closest(".option-list")
            ?.querySelectorAll(".option")
            .forEach((item) => item.classList.toggle("is-selected", item === option));
          updateAnswered();
          form.querySelector("[data-quiz-warning]").textContent = "";
        });
        updateAnswered();

        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const answers = {};
          for (const question of assessment.questions) {
            const selected = form.querySelector(`input[name="q-${question.id}"]:checked`);
            if (!selected) {
              form.querySelector("[data-quiz-warning]").textContent = "Responda todas as questões antes de enviar.";
              form.querySelector(`#question-${question.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
              toast("Responda todas as questões antes de enviar.", "warning");
              return;
            }
            answers[String(question.id)] = Number(selected.value);
          }
          const button = form.querySelector("[data-submit-quiz]");
          setBusy(button, true, "Corrigindo…");
          try {
            const result = await api.post(`/api/student/attempts/${assessment.inProgressAttemptId}/submit`, { answers });
            const remaining =
              assessment.maxAttempts > 0
                ? Math.max(0, assessment.maxAttempts - (attempts.length + 1))
                : 0;
            body.innerHTML = resultHtml(result, course.id, remaining);
            bindRetry();
            window.scrollTo({ top: 0, behavior: "smooth" });
          } catch (error) {
            toast(error.message || "Não foi possível enviar a avaliação.", "error");
            setBusy(button, false);
          }
        });
      };

      const bindRetry = () => {
        body.querySelector("[data-retry]")?.addEventListener("click", () => {
          navigate(`/aluno/curso/${course.id}/avaliacao?r=${Date.now()}`);
        });
      };

      body.querySelector("[data-start-assessment]")?.addEventListener("click", async (event) => {
        const button = event.currentTarget;
        setBusy(button, true, "Preparando…");
        try {
          const result = await api.post(`/api/student/assessments/${course.id}/attempts`, {});
          navigate(`/aluno/curso/${course.id}/avaliacao?attempt=${result.attemptId}`);
        } catch (error) {
          toast(error.message || "Não foi possível iniciar a avaliação.", "error");
          setBusy(button, false);
        }
      });

      if (inProgress) {
        bindQuiz();
      } else {
        bindRetry();
      }
    },
  };
}

/* -------------------------------- Avaliações ------------------------------ */

export async function attempts() {
  const data = await api.get("/api/student/attempts");
  const items = data.items || [];
  return {
    title: "Avaliações",
    actions: `<a class="btn btn--outline btn--sm" href="/aluno/cursos">${icon("book-open", 15)} Meus cursos</a>`,
    html: `
      ${pageHead({ eyebrow: "Histórico", title: "Minhas avaliações", text: "Resultados de todas as tentativas enviadas." })}
      <div class="panel">
        <div class="panel__body panel__body--flush">
          ${
            items.length
              ? `<div class="table-wrap"><table class="table">
                  <thead><tr><th>Avaliação</th><th>Curso</th><th>Nota</th><th>Resultado</th><th>Enviada em</th><th></th></tr></thead>
                  <tbody>${items
                    .map(
                      (item) => `
                      <tr>
                        <td><strong>${esc(item.assessmentTitle)}</strong></td>
                        <td class="small muted">${esc(item.courseTitle)}</td>
                        <td><strong>${item.score}%</strong></td>
                        <td>${item.passed ? `<span class="badge badge--free">Aprovado</span>` : `<span class="badge badge--danger">Não atingiu</span>`}</td>
                        <td class="tiny muted nowrap">${esc(formatDateTime(item.submittedAt))}</td>
                        <td><div class="cell-actions"><a class="btn btn--outline btn--xs" href="/aluno/curso/${Number(item.courseId) || ""}/avaliacao">${icon("clipboard", 14)} Abrir</a></div></td>
                      </tr>`
                    )
                    .join("")}</tbody>
                </table></div>`
              : emptyState({ iconName: "clipboard", title: "Nenhuma avaliação realizada", text: "Ao concluir as aulas de um curso com avaliação, você poderá realizá-la na página do curso.", action: `<a class="btn btn--primary btn--sm" href="/aluno/cursos">Ir para meus cursos</a>` })
          }
        </div>
      </div>`,
  };
}

/* ------------------------------- Certificados ----------------------------- */

export async function certificates() {
  const data = await api.get("/api/student/certificates");
  const { issued, eligible } = data;
  return {
    title: "Certificados",
    actions: `<a class="btn btn--outline btn--sm" href="/verificar-certificado">${icon("shield", 15)} Verificar certificado</a>`,
    html: `
      ${pageHead({
        eyebrow: "Documentos digitais",
        title: "Meus certificados",
        text: "Emita e consulte seus certificados. Cada documento possui um código público de verificação.",
      })}
      ${
        eligible.length
          ? `<div class="panel" style="margin-bottom:24px">
              <div class="panel__head"><div><h2>Certificados disponíveis para emissão</h2><p>Você atendeu aos critérios de conclusão</p></div></div>
              <div class="panel__body stack-sm">
                ${eligible
                  .map(
                    (item) => `
                    <div class="between" style="gap:14px;padding:12px 0;border-bottom:1px solid var(--line)">
                      <div style="min-width:0">
                        <strong class="small" style="display:block">${esc(item.courseTitle)}</strong>
                        <span class="tiny muted">${esc(formatHours(item.hours))} • progresso ${item.progress}%</span>
                      </div>
                      <button type="button" class="btn btn--primary btn--sm" data-issue-certificate="${item.courseId}">${icon("award", 15)} Emitir certificado</button>
                    </div>`
                  )
                  .join("")}
              </div>
            </div>`
          : ""
      }
      ${
        issued.length
          ? `<div class="cert-grid">${issued.map((cert) => certificateCard(cert, { studentView: true })).join("")}</div>`
          : emptyState({
              iconName: "award",
              title: "Nenhum certificado emitido",
              text: "Conclua 100% das aulas (e a avaliação, quando exigida) para liberar seu certificado.",
              action: `<a class="btn btn--primary btn--sm" href="/aluno/cursos">Ver meus cursos</a>`,
            })
      }
      <div class="notice notice--info" style="margin-top:24px">
        ${icon("shield", 18)}
        <div>Certificados emitidos digitalmente podem ser validados por qualquer pessoa em <a href="/verificar-certificado">/verificar-certificado</a> usando o código do documento.</div>
      </div>`,
    mount() {
      document.querySelectorAll("[data-issue-certificate]").forEach((button) => {
        button.addEventListener("click", async () => {
          const courseId = button.dataset.issueCertificate;
          setBusy(button, true, "Emitindo…");
          try {
            const result = await api.post(`/api/student/courses/${courseId}/certificate`, {});
            const code = result.certificate?.code;
            toast(result.message || "Certificado emitido.", "success");
            if (code) navigate(`/certificado/${encodeURIComponent(code)}`);
            else navigate("/aluno/certificados?r=" + Date.now());
          } catch (error) {
            toast(error.message || "Não foi possível emitir o certificado.", "error");
            setBusy(button, false);
          }
        });
      });
    },
  };
}

/* --------------------------------- Pedidos -------------------------------- */

function orderStatusBadge(status) {
  return statusBadge(status);
}

export async function orders() {
  const data = await api.get("/api/student/orders");
  const items = data.items || [];
  return {
    title: "Pedidos",
    actions: `<a class="btn btn--outline btn--sm" href="/cursos">${icon("search", 15)} Explorar cursos</a>`,
    html: `
      ${pageHead({ eyebrow: "Financeiro", title: "Meus pedidos", text: "Acompanhe matrículas pagas, pagamentos pendentes e reembolsos." })}
      ${
        !data.paymentsConfigured
          ? alertBox(
              "O pagamento online ainda não está configurado neste ambiente. Pedidos pendentes podem ser aprovados manualmente pela equipe administrativa.",
              "info"
            )
          : ""
      }
      <div class="panel" style="margin-top:16px">
        <div class="panel__body panel__body--flush">
          ${
            items.length
              ? `<div class="table-wrap"><table class="table">
                  <thead><tr><th>Pedido</th><th>Curso</th><th>Valor</th><th>Status</th><th>Criado em</th><th></th></tr></thead>
                  <tbody>${items
                    .map(
                      (order) => `
                      <tr>
                        <td><strong class="mono tiny">${esc(order.code)}</strong></td>
                        <td><div class="cell-main"><strong>${esc(order.course?.title || "Curso")}</strong><span>${esc(order.paymentMethod ? statusLabel(order.paymentMethod) : "—")}</span></div></td>
                        <td><strong>${money(order.totalCents)}</strong>${order.discountCents ? `<span class="tiny muted" style="display:block">desconto ${money(order.discountCents)}</span>` : ""}</td>
                        <td>${orderStatusBadge(order.status)}</td>
                        <td class="tiny muted nowrap">${esc(formatDate(order.createdAt))}</td>
                        <td><div class="cell-actions"><a class="btn btn--outline btn--xs" href="/aluno/pedidos/${encodeURIComponent(order.code)}">Detalhes</a></div></td>
                      </tr>`
                    )
                    .join("")}</tbody>
                </table></div>`
              : emptyState({ iconName: "credit-card", title: "Nenhum pedido", text: "Você ainda não realizou pedidos. Cursos gratuitos não geram cobrança.", action: `<a class="btn btn--primary btn--sm" href="/cursos">Ver cursos</a>` })
          }
        </div>
      </div>`,
  };
}

export async function orderDetail(ctx) {
  const data = await api.get(`/api/student/orders/${encodeURIComponent(ctx.params.code)}`);
  const { order, payments, enrollment } = data;
  const status = order.status;
  const isPending = status === "pending";
  const isApproved = status === "approved";
  let statusPanel;
  if (isApproved) {
    statusPanel = `<div class="checkout-status">
      <div class="checkout-status__icon">${icon("check-circle", 24)}</div>
      <div><h2>Pagamento aprovado</h2><p>Seu acesso ao curso foi liberado. Bom estudo!</p>
      ${enrollment ? `<a class="btn btn--primary btn--sm" style="margin-top:10px" href="/aluno/curso/${order.course.id}">${icon("play", 15)} Acessar curso</a>` : ""}</div>
    </div>`;
  } else if (isPending) {
    statusPanel = `<div class="checkout-status">
      <div class="checkout-status__icon">${icon("clock", 24)}</div>
      <div><h2>Aguardando pagamento</h2><p>${
        order.checkoutUrl
          ? "Conclua o pagamento na plataforma segura para liberar o acesso. O status é atualizado automaticamente."
          : data.paymentsConfigured
            ? "Estamos aguardando a confirmação do pagamento. Isso pode levar alguns instantes."
            : "O pagamento online não está configurado neste ambiente. A equipe administrativa pode aprovar o pedido manualmente."
      }</p>
      ${
        order.checkoutUrl
          ? `<a class="btn btn--primary btn--sm" style="margin-top:10px" href="${esc(order.checkoutUrl)}" rel="noopener noreferrer">${icon("credit-card", 15)} Continuar pagamento</a>`
          : ""
      }
      <a class="btn btn--ghost btn--sm" style="margin-top:10px" href="/contato">${icon("message", 15)} Falar com o suporte</a></div>
    </div>`;
  } else {
    statusPanel = `<div class="checkout-status">
      <div class="checkout-status__icon">${icon(status === "refunded" ? "refresh" : "x-circle", 24)}</div>
      <div><h2>${esc(statusLabel(status))}</h2><p>${
        status === "cancelled"
          ? "Este pedido foi cancelado. Se você acredita que houve um engano, fale com o suporte."
          : status === "refunded"
            ? "O valor foi reembolsado conforme as condições aplicáveis. O acesso ao curso foi encerrado."
            : "O pagamento não foi aprovado. Você pode tentar novamente ou escolher outro curso."
      }</p>
      <div class="cluster" style="margin-top:10px"><a class="btn btn--outline btn--sm" href="/aluno/pedidos">Meus pedidos</a><a class="btn btn--ghost btn--sm" href="/contato">Suporte</a></div></div>
    </div>`;
  }

  return {
    title: `Pedido ${order.code}`,
    eyebrow: "Detalhes do pedido",
    actions: `<a class="btn btn--ghost btn--sm" href="/aluno/pedidos">${icon("arrow-left", 15)} Meus pedidos</a>`,
    html: `
      <div class="checkout-grid">
        <div class="stack">
          ${statusPanel}
          <div class="panel">
            <div class="panel__head"><div><h2>Resumo do pedido</h2><p>Código <span class="mono">${esc(order.code)}</span></p></div></div>
            <div class="panel__body stack-sm">
              <div class="checkout-line"><span>Curso</span><strong>${esc(order.course?.title || "Curso")}</strong></div>
              <div class="checkout-line"><span>Valor do curso</span><strong>${money(order.amountCents)}</strong></div>
              ${order.discountCents ? `<div class="checkout-line"><span>Desconto</span><strong>− ${money(order.discountCents)}</strong></div>` : ""}
              <div class="checkout-line checkout-line--total"><span>Total</span><strong class="price">${money(order.totalCents)}</strong></div>
              <div class="checkout-line"><span>Criado em</span><strong>${esc(formatDateTime(order.createdAt))}</strong></div>
              ${order.paidAt ? `<div class="checkout-line"><span>Pago em</span><strong>${esc(formatDateTime(order.paidAt))}</strong></div>` : ""}
            </div>
          </div>
          <div class="panel">
            <div class="panel__head"><div><h2>Histórico de pagamentos</h2><p>Registros do provedor de pagamento</p></div></div>
            <div class="panel__body panel__body--flush">
              ${
                payments.length
                  ? `<div class="table-wrap"><table class="table"><thead><tr><th>Status</th><th>Método</th><th>Valor</th><th>Data</th></tr></thead><tbody>${payments
                      .map(
                        (payment) => `
                        <tr>
                          <td>${statusBadge(payment.status)}</td>
                          <td>${esc(statusLabel(payment.method))}</td>
                          <td><strong>${money(payment.amount_cents)}</strong></td>
                          <td class="tiny muted">${esc(formatDateTime(payment.created_at))}</td>
                        </tr>`
                      )
                      .join("")}</tbody></table></div>`
                  : `<div class="panel__body"><p class="small muted">Nenhum pagamento registrado até o momento.</p></div>`
              }
            </div>
          </div>
        </div>
        <div class="stack">
          <div class="panel">
            <div class="panel__body">
              <h3>Precisa de ajuda?</h3>
              <p class="small muted" style="margin:8px 0 14px">Em caso de dúvidas sobre pagamento, acesso ou reembolso, fale com a equipe da BrasilTec Educação.</p>
              <a class="btn btn--outline btn--sm btn--block" href="/contato">${icon("message", 15)} Abrir atendimento</a>
            </div>
          </div>
          <div class="notice notice--info">${icon("shield", 18)}<div>Não armazenamos dados sensíveis de cartão. Pagamentos são processados pelo gateway integrado.</div></div>
        </div>
      </div>`,
  };
}

/* --------------------------------- Perfil --------------------------------- */

export async function profile() {
  const user = state.user || {};
  return {
    title: "Perfil e dados",
    actions: `<a class="btn btn--outline btn--sm" href="/aluno">${icon("arrow-left", 15)} Visão geral</a>`,
    html: `
      ${pageHead({ eyebrow: "Conta", title: "Perfil e dados", text: "Atualize seus dados de contato e gerencie a segurança da conta." })}
      <div class="dash-grid">
        <div class="stack">
          <div class="panel">
            <div class="panel__head"><div><h2>Dados pessoais</h2><p>Informações usadas para identificação e contato</p></div></div>
            <div class="panel__body">
              <form class="auth-form" id="profile-form" novalidate>
                <div data-form-feedback hidden></div>
                ${field({ label: "Nome completo", name: "name", value: user.name || "", required: true, attrs: 'maxlength="120" autocomplete="name"' })}
                <div class="field">
                  <label class="field-label" for="profile-email">E-mail</label>
                  <input class="input" id="profile-email" type="email" value="${esc(user.email || "")}" disabled>
                  <p class="field-hint">O e-mail de acesso não pode ser alterado por aqui. Fale com o suporte se necessário.</p>
                </div>
                ${field({ label: "Telefone / WhatsApp", name: "phone", value: user.phone || "", hint: "Opcional. Usado apenas para contato sobre seus estudos.", attrs: 'maxlength="40" autocomplete="tel"' })}
                <div class="cluster">
                  <button type="submit" class="btn btn--primary btn--sm">${icon("check", 15)} Salvar dados</button>
                </div>
              </form>
            </div>
          </div>

          <div class="panel">
            <div class="panel__head"><div><h2>Segurança</h2><p>Altere sua senha periodicamente</p></div></div>
            <div class="panel__body">
              <form class="auth-form" id="password-form" novalidate>
                <div data-form-feedback hidden></div>
                <div class="form-grid">
                  ${field({ label: "Senha atual", name: "currentPassword", type: "password", required: true, attrs: 'autocomplete="current-password"' })}
                  ${field({ label: "Nova senha", name: "newPassword", type: "password", required: true, hint: "Mínimo de 8 caracteres, com letras e números.", attrs: 'autocomplete="new-password"' })}
                </div>
                ${field({ label: "Confirmar nova senha", name: "confirmPassword", type: "password", required: true, attrs: 'autocomplete="new-password"' })}
                <div class="cluster">
                  <button type="submit" class="btn btn--primary btn--sm">${icon("lock", 15)} Alterar senha</button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <div class="stack">
          <div class="panel">
            <div class="panel__head"><div><h2>Privacidade e LGPD</h2><p>Controle dos seus dados pessoais</p></div></div>
            <div class="panel__body stack-sm">
              <p class="small muted">Você pode exportar uma cópia dos dados armazenados sobre sua conta, matrículas, progresso, anotações, avaliações, certificados e pedidos.</p>
              <a class="btn btn--outline btn--sm btn--block" href="/api/student/export" download>${icon("download", 15)} Exportar meus dados (JSON)</a>
              <a class="btn btn--ghost btn--sm btn--block" href="/privacidade">${icon("shield", 15)} Política de privacidade</a>
              <p class="tiny muted">Para solicitações de exclusão ou correção, entre em contato pela página de atendimento.</p>
            </div>
          </div>
          <div class="panel">
            <div class="panel__body">
              <h3>Informações da conta</h3>
              ${summaryList([
                { label: "Perfil", value: esc(user.role === "student" ? "Aluno" : user.role || "—") },
                { label: "Conta criada em", value: esc(formatDate(user.createdAt)) },
                { label: "Último acesso", value: esc(user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "—") },
                { label: "Status", value: user.status === "active" ? "Ativo" : esc(statusLabel(user.status)) },
              ])}
            </div>
          </div>
          <div class="notice notice--info">${icon("info", 18)}<div>Ao alterar sua senha, as demais sessões ativas serão encerradas por segurança.</div></div>
        </div>
      </div>`,
    mount() {
      const profileForm = document.getElementById("profile-form");
      bindForm(
        profileForm,
        async (data) => api.patch("/api/student/profile", { name: data.name, phone: data.phone }),
        {
          submitLabel: "Salvando…",
          onSuccess(result) {
            state.user = { ...state.user, ...result.user };
            toast(result.message || "Perfil atualizado.", "success");
          },
        }
      );

      const passwordForm = document.getElementById("password-form");
      passwordForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearErrors(passwordForm);
        const data = new FormData(passwordForm);
        const currentPassword = String(data.get("currentPassword") || "");
        const newPassword = String(data.get("newPassword") || "");
        const confirmPassword = String(data.get("confirmPassword") || "");
        let valid = true;
        if (!currentPassword) {
          fieldError(passwordForm, "currentPassword", "Informe sua senha atual.");
          valid = false;
        }
        const problem = validatePassword(newPassword);
        if (problem) {
          fieldError(passwordForm, "newPassword", problem);
          valid = false;
        }
        if (newPassword !== confirmPassword) {
          fieldError(passwordForm, "confirmPassword", "As senhas não conferem.");
          valid = false;
        }
        if (!valid) return;
        const button = passwordForm.querySelector('[type="submit"]');
        setBusy(button, true, "Alterando…");
        try {
          const result = await api.post("/api/auth/change-password", { currentPassword, newPassword });
          passwordForm.reset();
          toast(result.message || "Senha alterada.", "success");
        } catch (error) {
          if (error.details && typeof error.details === "object") {
            for (const [name, message] of Object.entries(error.details)) fieldError(passwordForm, name, message);
          }
          const feedback = passwordForm.querySelector("[data-form-feedback]");
          feedback.innerHTML = alertBox(error.message || "Não foi possível alterar a senha.", "error");
          feedback.hidden = false;
        } finally {
          setBusy(button, false);
        }
      });
    },
  };
}

/* -------------------------------- Checkout -------------------------------- */

export async function checkout(ctx) {
  const data = await api.get(`/api/public/courses/${encodeURIComponent(ctx.params.slug)}`);
  const { course, enrollment } = data;
  if (enrollment && ["active", "completed"].includes(enrollment.status)) {
    return { redirect: `/aluno/curso/${course.id}` };
  }
  if (course.priceCents === 0) {
    return { redirect: `/cursos/${course.slug}` };
  }
  if (ctx.user.role !== "student") {
    return {
      title: "Checkout",
      html: `<section class="section"><div class="container container--narrow">
        ${alertBox("A compra de cursos é exclusiva para contas de aluno.", "info")}
        <a class="btn btn--primary" href="/admin">Ir para o painel</a>
      </div></section>`,
    };
  }

  return {
    title: "Checkout",
    documentTitle: `Checkout — ${course.title}`,
    description: `Finalize sua matrícula no curso ${course.title}.`,
    html: `
      <section class="section">
        <div class="container">
          <div class="section-head" style="margin-bottom:26px">
            <div class="section-head__text">
              <span class="eyebrow">Checkout seguro</span>
              <h1 style="font-size:clamp(1.6rem,3vw,2.2rem)">Finalize sua matrícula</h1>
              <p class="lead">Confira os dados do curso e aplique um cupom, se tiver.</p>
            </div>
            <a class="link-arrow" href="/cursos/${esc(course.slug)}">${icon("arrow-left", 15)} Voltar ao curso</a>
          </div>

          <div class="checkout-grid">
            <div class="checkout-card">
              <h2 style="font-size:1.1rem;margin-bottom:16px">${icon("credit-card", 19)} Pagamento</h2>
              <form id="checkout-form" novalidate>
                <div data-form-feedback hidden></div>
                <div class="field">
                  <label class="field-label" for="checkout-coupon">Cupom de desconto <span class="tiny muted">(opcional)</span></label>
                  <div class="input-group">
                    <input class="input" id="checkout-coupon" name="coupon" maxlength="40" placeholder="Digite o código do cupom" autocomplete="off">
                    <button type="button" class="input-group__action" data-apply-coupon aria-label="Aplicar cupom">${icon("tag", 18)}</button>
                  </div>
                  <p class="field-hint" data-coupon-feedback>O desconto será calculado ao criar o pedido.</p>
                </div>
                <div class="notice notice--info" style="margin:16px 0">
                  ${icon("shield", 18)}
                  <div><strong>Pagamento seguro.</strong> Não armazenamos dados de cartão. A cobrança é processada por gateway de pagamento integrado. A liberação do acesso só ocorre após a confirmação do pagamento no servidor.</div>
                </div>
                ${
                  ctx.app.paymentsConfigured
                    ? `<p class="small muted">Você será direcionado ao ambiente seguro do provedor de pagamento. Após a confirmação, retorne à plataforma.</p>`
                    : `<div class="notice notice--warning">${icon("info", 18)}<div>O pagamento online ainda não está configurado neste ambiente. O pedido será registrado como <strong>pendente</strong> e poderá ser aprovado manualmente pela equipe administrativa.</div></div>`
                }
                <button type="submit" class="btn btn--primary btn--lg btn--block" style="margin-top:16px">
                  ${icon("credit-card", 17)} ${ctx.app.paymentsConfigured ? "Ir para o pagamento" : "Criar pedido"}
                </button>
                <p class="tiny muted text-center" style="margin-top:12px">Ao continuar, você concorda com os <a href="/termos">Termos de uso</a> e a <a href="/privacidade">Política de privacidade</a>.</p>
              </form>
            </div>

            <aside class="checkout-card checkout-summary">
              <div class="course-buy__cover" style="border-radius:12px;overflow:hidden">
                <img src="${imageUrl(course.coverImage)}" alt="" width="640" height="400">
              </div>
              <div>
                <span class="eyebrow">${esc(course.category?.name || "Formação")}</span>
                <h2 style="font-size:1.05rem;margin:4px 0 6px">${esc(course.title)}</h2>
                <p class="small muted">${esc(course.subtitle || "")}</p>
              </div>
              <div class="cluster tiny muted" style="gap:14px">
                <span>${icon("clock", 14)} ${esc(formatHours(course.durationHours))}</span>
                <span>${icon("award", 14)} ${course.certificateEnabled ? "Certificado" : "Sem certificado"}</span>
                <span>${icon("monitor", 14)} ${esc(statusLabel(course.modality))}</span>
              </div>
              <div class="divider"></div>
              <div class="checkout-line"><span>Valor do curso</span><strong>${money(course.priceCents)}</strong></div>
              <div class="checkout-line checkout-line--total"><span>Total</span><strong class="price">${money(course.priceCents)}</strong></div>
              <p class="tiny muted">O valor final pode variar caso um cupom válido seja aplicado.</p>
              <a class="btn btn--ghost btn--sm btn--block" href="/cursos/${esc(course.slug)}">${icon("arrow-left", 15)} Rever detalhes do curso</a>
            </aside>
          </div>
        </div>
      </section>`,
    mount() {
      const form = document.getElementById("checkout-form");
      const couponFeedback = form.querySelector("[data-coupon-feedback]");
      form.querySelector("[data-apply-coupon]")?.addEventListener("click", () => {
        const value = form.querySelector("[name='coupon']").value.trim();
        couponFeedback.textContent = value
          ? "O cupom será validado ao criar o pedido."
          : "Informe um código de cupom para aplicar.";
      });

      bindForm(
        form,
        async (data) => {
          return api.post(`/api/student/courses/${course.id}/enroll`, { coupon: data.coupon });
        },
        {
          submitLabel: "Criando pedido…",
          onSuccess(result) {
            toast(result.message || "Pedido criado.", "success");
            if (result.enrolled) {
              navigate(`/aluno/curso/${course.id}`);
            } else if (result.checkoutUrl) {
              window.location.assign(result.checkoutUrl);
            } else if (result.order?.code) {
              navigate(`/aluno/pedidos/${encodeURIComponent(result.order.code)}`);
            } else {
              navigate("/aluno/pedidos");
            }
          },
        }
      );
    },
  };
}

/* Mantém o helper de exportação de nome acessível no módulo. */
export { safeExportFileName };
