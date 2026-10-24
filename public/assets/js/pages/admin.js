/* BrasilTec Educação — painel administrativo */
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
  statusLabel,
  statusBadge,
  statusDot,
  plural,
  progressBar,
  progressWithLabel,
  openModal,
  confirmDialog,
  emptyState,
  imageUrl,
  statCard,
  pagination,
  renderMarkdown,
  validatePassword,
  initials,
  firstName,
} from "../ui.js";
import {
  pageHead,
  alertBox,
  bindForm,
  bindPagination,
  field,
  textareaField,
  selectField,
  checkboxField,
  summaryList,
  emptyRow,
  money,
  tabs,
  optionList,
  statusOptions,
} from "./shared.js";

function demoPill() {
  return state.app?.demoMode ? `<span class="demo-pill">${icon("info", 12)} Demonstração</span>` : "";
}

/* ------------------------------- Visão geral ------------------------------ */
export async function dashboard() {
  const data = await api.get("/api/admin/overview");
  const d = data.dashboard || {};
  const isInstructor = state.user?.role === "instructor";

  const stats = [
    statCard({ label: "Alunos", value: d.studentCount ?? 0, iconName: "users", tone: "navy" }),
    statCard({ label: "Cursos publicados", value: d.courseCount ?? 0, iconName: "book-open" }),
    statCard({ label: "Matrículas ativas", value: d.activeEnrollments ?? 0, iconName: "user-check", tone: "green" }),
    statCard({ label: "Concluídos", value: d.completedEnrollments ?? 0, iconName: "check-circle", tone: "gold", hint: `Taxa de conclusão: ${d.completionRate ?? 0}%` }),
  ];

  const revenue = formatMoney(d.revenueCents || 0);
  const pending = d.pendingOrders ?? 0;

  return {
    title: "Visão geral",
    eyebrow: isInstructor ? "Painel do instrutor" : "Administração",
    actions: `<a class="btn btn--outline btn--sm" href="/admin/cursos">${icon("book-open", 15)} Cursos</a>${!isInstructor ? `<a class="btn btn--primary btn--sm" href="/admin/cursos/novo">${icon("plus", 15)} Novo curso</a>` : ""}`,
    html: `
      <div class="stack-lg">
        ${pageHead({
          eyebrow: isInstructor ? "Painel do instrutor" : "Administração",
          title: isInstructor ? "Meus cursos" : "Visão geral da plataforma",
          text: isInstructor ? "Acompanhe suas turmas, matrículas e desempenho." : "Acompanhe alunos, matrículas, pedidos e desempenho da BrasilTec Educação.",
          actions: `${demoPill()}`,
        })}
        <div class="stat-grid">${stats.join("")}</div>
        <div class="dash-grid">
          <div class="panel">
            <div class="panel__head">
              <div><h2>Top cursos</h2><p>Mais matrículas</p></div>
              <a class="link-arrow tiny" href="/admin/cursos">Ver todos ${icon("arrow-right", 13)}</a>
            </div>
            <div class="panel__body panel__body--flush">
              ${
                (d.topCourses || []).length
                  ? `<div class="table-wrap"><table class="table">
                      <thead><tr><th>Curso</th><th>Matrículas</th><th>Progresso médio</th></tr></thead>
                      <tbody>${(d.topCourses || [])
                        .map(
                          (c) => `
                        <tr>
                          <td><div class="cell-main"><strong>${esc(c.title)}</strong><span>${esc(c.slug)}</span></div></td>
                          <td>${c.enrollments || 0}</td>
                          <td><div class="cell-progress">${progressWithLabel(c.avgProgress || 0)}</div></td>
                        </tr>`
                        )
                        .join("")}</tbody>
                    </table></div>`
                  : `<div style="padding:18px">${emptyState({ iconName: "book-open", title: "Sem dados ainda", text: "Assim que houver matrículas, os cursos mais procurados aparecerão aqui." })}</div>`
              }
            </div>
          </div>
          <div class="stack">
            <div class="panel">
              <div class="panel__head"><div><h2>Faturamento</h2><p>Pedidos aprovados</p></div></div>
              <div class="panel__body">
                <div class="between"><span class="muted">Receita total</span><strong style="font-size:1.2rem">${revenue}</strong></div>
                <div class="between" style="margin-top:10px"><span class="muted">Pedidos pendentes</span><span>${pending}</span></div>
              </div>
            </div>
            <div class="panel">
              <div class="panel__head">
                <div><h2>Atividade recente</h2><p>Últimas ações</p></div>
                ${!isInstructor ? `<a class="link-arrow tiny" href="/admin/atividade">Ver tudo ${icon("arrow-right", 13)}</a>` : ""}
              </div>
              <div class="panel__body">
                ${(d.recentActivity || []).length
                  ? `<div class="activity-list">${(d.recentActivity || [])
                      .slice(0, 8)
                      .map(
                        (a) => `
                      <div class="activity-item">
                        <span class="activity-item__dot"></span>
                        <div class="activity-item__body">
                          <div><strong>${esc(a.action.replace(/\./g, " "))}</strong>${a.detail ? ` • ${esc(a.detail)}` : ""}</div>
                          <span>${esc(a.user_name || "Sistema")} • ${esc(formatDateTime(a.created_at))}</span>
                        </div>
                      </div>`
                      )
                      .join("")}</div>`
                  : `<p class="muted small">Sem atividade recente.</p>`}
              </div>
            </div>
          </div>
        </div>
      </div>`,
  };
}

/* ------------------------------- Cursos ------------------------------ */
export async function courses(ctx) {
  const data = await api.get("/api/admin/courses");
  const items = data.items || [];
  const categories = data.categories || [];
  const instructors = data.instructors || [];
  const isInstructor = state.user?.role === "instructor";

  return {
    title: "Cursos",
    eyebrow: isInstructor ? "Painel do instrutor" : "Administração",
    actions: `<a class="btn btn--primary btn--sm" href="/admin/cursos/novo">${icon("plus", 15)} Novo curso</a>`,
    html: `
      <div class="stack-lg">
        ${pageHead({ eyebrow: "Catálogo", title: "Cursos", text: "Gerencie módulos, aulas, materiais, avaliação e publicação." })}
        <div class="panel">
          <div class="panel__head">
            <div><h2>Lista de cursos</h2><p>${items.length} curso(s)</p></div>
          </div>
          <div class="panel__body panel__body--flush">
            ${
              items.length
                ? `<div class="table-wrap"><table class="table">
                    <thead><tr><th>Curso</th><th>Categoria</th><th>Instrutor</th><th>Status</th><th>Preço</th><th>Matrículas</th><th>Aulas</th><th></th></tr></thead>
                    <tbody>${items
                      .map(
                        (c) => `
                      <tr>
                        <td><div class="cell-main"><strong>${esc(c.title)}</strong><span>${esc(c.slug)}</span></div></td>
                        <td>${esc(c.category?.name || "—")}</td>
                        <td>${esc(c.instructor?.name || "—")}</td>
                        <td>${statusBadge(c.status)}</td>
                        <td>${c.isFree ? `<span class="badge badge--free">Gratuito</span>` : esc(formatMoney(c.priceCents))}</td>
                        <td>${c.enrollmentCount || 0}</td>
                        <td>${c.lessonCount || 0}</td>
                        <td><div class="cell-actions"><a class="btn btn--outline btn--xs" href="/admin/cursos/${c.id}">${icon("edit", 13)} Editar</a></div></td>
                      </tr>`
                      )
                      .join("")}</tbody>
                  </table></div>`
                : `<div style="padding:18px">${emptyState({ iconName: "book-open", title: "Nenhum curso", text: "Crie o primeiro curso para começar a organizar o catálogo.", action: `<a class="btn btn--primary btn--sm" href="/admin/cursos/novo">Criar curso</a>` })}</div>`
            }
          </div>
        </div>
      </div>`,
  };
}

/* ------------------------------- Editor de curso ------------------------------ */
export async function courseEditor(ctx) {
  const id = ctx.params.id;
  const isNew = !id || id === "novo";
  let data = { categories: [], instructors: [], course: null, modules: [], assessment: null, stats: {} };
  if (!isNew) {
    try {
      data = await api.get(`/api/admin/courses/${id}`);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
        return { redirect: "/admin/cursos" };
      }
      throw error;
    }
  } else {
    const list = await api.get("/api/admin/courses").catch(() => ({}));
    data.categories = list.categories || [];
    data.instructors = list.instructors || [];
  }

  const course = data.course || {};
  const modules = data.modules || [];
  const assessment = data.assessment;
  const categories = data.categories || [];
  const instructors = data.instructors || [];

  const catOpts = optionList(categories.map((c) => ({ value: c.id, label: c.name })), course.category?.id, { placeholder: "Selecione" });
  const instOpts = optionList(instructors.map((i) => ({ value: i.id, label: i.name })), course.instructor?.id, { placeholder: "Selecione" });
  const levelOpts = optionList([["iniciante", "Iniciante"], ["intermediario", "Intermediário"], ["avancado", "Avançado"]].map(([v, l]) => ({ value: v, label: l })), course.level);
  const modOpts = optionList([["online", "100% online"], ["hibrido", "Híbrido"]].map(([v, l]) => ({ value: v, label: l })), course.modality);
  const statusOpts = optionList([["draft", "Rascunho"], ["published", "Publicado"], ["archived", "Arquivado"]].map(([v, l]) => ({ value: v, label: l })), course.status || "draft");

  const objectives = Array.isArray(course.objectives) ? course.objectives.join("\n") : "";

  return {
    title: isNew ? "Novo curso" : "Editar curso",
    eyebrow: "Catálogo",
    actions: `<a class="btn btn--ghost btn--sm" href="/admin/cursos">${icon("arrow-left", 15)} Voltar</a>`,
    html: `
      <div class="stack-lg">
        ${pageHead({ eyebrow: "Gerenciamento", title: isNew ? "Criar curso" : esc(course.title || "Curso"), text: isNew ? "Preencha os dados principais e salve para adicionar módulos e aulas." : "Edite informações, estrutura, materiais e avaliação." })}
        <div class="editor-layout">
          <div class="panel">
            <div class="editor-tabs">
              <button type="button" class="is-active" data-tab="geral">Geral</button>
              <button type="button" data-tab="conteudo">Conteúdo</button>
              <button type="button" data-tab="avaliacao">Avaliação</button>
            </div>
            <div class="editor-pane" data-pane="geral">
              <h2>Dados principais</h2>
              <p>Informações exibidas no catálogo e na página do curso.</p>
              <form id="course-form" class="form-grid">
                <div class="span-2">${field({ label: "Título", name: "title", value: course.title || "", required: true, placeholder: "Ex.: Assistente Administrativo" })}</div>
                <div class="span-2">${field({ label: "Subtítulo", name: "subtitle", value: course.subtitle || "", placeholder: "Breve descrição para o card do curso" })}</div>
                <div class="span-2">${textareaField({ label: "Descrição", name: "description", value: course.description || "", rows: 6 })}</div>
                <div class="span-2">${textareaField({ label: "Objetivos (um por linha)", name: "objectives", value: objectives, rows: 5 })}</div>
                <div>${selectField({ label: "Categoria", name: "categoryId", options: catOpts })}</div>
                <div>${selectField({ label: "Instrutor", name: "instructorId", options: instOpts })}</div>
                <div>${selectField({ label: "Nível", name: "level", options: levelOpts })}</div>
                <div>${selectField({ label: "Modalidade", name: "modality", options: modOpts })}</div>
                <div>${field({ label: "Carga horária (h)", name: "durationHours", type: "number", value: course.durationHours ?? 0 })}</div>
                <div>${field({ label: "Preço (centavos)", name: "priceCents", type: "number", value: course.priceCents ?? 0, hint: "0 para curso gratuito" })}</div>
                <div>${selectField({ label: "Status", name: "status", options: statusOpts })}</div>
                <div>${field({ label: "URL da capa", name: "coverImage", value: course.coverImage || "", placeholder: "/assets/img/course-tech.jpg" })}</div>
                <div>${checkboxField({ label: "Destacar no site", name: "featured", checked: Boolean(course.featured) })}</div>
                <div>${checkboxField({ label: "Habilitar certificado", name: "certificateEnabled", checked: course.certificateEnabled !== false })}</div>
                <div>${checkboxField({ label: "Exigir avaliação para certificado", name: "requireAssessment", checked: Boolean(course.requireAssessment) })}</div>
                <div>${field({ label: "Nota mínima (%)", name: "passScore", type: "number", value: course.passScore ?? 70 })}</div>
                <div class="span-2"><div class="cluster"><button class="btn btn--primary" type="submit">${icon("save", 16)} ${isNew ? "Criar curso" : "Salvar alterações"}</button>${!isNew ? `<button class="btn btn--ghost" type="button" data-archive>${icon("archive", 16)} Arquivar</button>` : ""}</div></div>
                <div class="span-2"><div data-form-feedback hidden></div></div>
              </form>
            </div>
            <div class="editor-pane" data-pane="conteudo" hidden>
              <div class="between" style="margin-bottom:14px"><div><h2>Módulos e aulas</h2><p>Organize a trilha do curso</p></div><button class="btn btn--primary btn--sm" type="button" data-add-module>${icon("plus", 15)} Adicionar módulo</button></div>
              <div class="editor-list" data-modules>
                ${
                  modules.length
                    ? modules
                        .map(
                          (m) => `
                    <article class="editor-item" data-module-id="${m.id}">
                      <header class="editor-item__head">
                        <strong>${esc(m.title)}</strong>
                        <span>${(m.lessons || []).length} aula(s)</span>
                        <div class="cell-actions">
                          <button class="icon-btn" type="button" data-add-lesson title="Adicionar aula">${icon("plus", 16)}</button>
                          <button class="icon-btn" type="button" data-edit-module title="Editar módulo">${icon("edit", 16)}</button>
                          <button class="icon-btn" type="button" data-delete-module title="Remover módulo">${icon("trash", 16)}</button>
                        </div>
                      </header>
                      <div class="editor-item__body">
                        ${(m.lessons || [])
                          .map(
                            (l) => `
                        <div class="editor-lesson" data-lesson-id="${l.id}">
                          <span>${esc(l.title)}${l.isFreePreview ? ` <span class="badge badge--free">Prévia</span>` : ""}</span>
                          <em>${l.durationMinutes || 0} min</em>
                          <button class="icon-btn" type="button" data-edit-lesson title="Editar aula">${icon("edit", 14)}</button>
                        </div>`
                          )
                          .join("")}
                      </div>
                    </article>`
                        )
                        .join("")
                    : `<p class="muted small">Nenhum módulo cadastrado ainda.</p>`
                }
              </div>
            </div>
            <div class="editor-pane" data-pane="avaliacao" hidden>
              <div class="between" style="margin-bottom:14px"><div><h2>Avaliação final</h2><p>Configure aprovação e questões</p></div><button class="btn btn--primary btn--sm" type="button" data-save-assessment>${icon("save", 15)} Salvar avaliação</button></div>
              <div class="form-grid">
                <div class="span-2">${field({ label: "Título da avaliação", name: "assTitle", value: assessment?.title || "Avaliação final" })}</div>
                <div class="span-2">${textareaField({ label: "Descrição", name: "assDesc", value: assessment?.description || "", rows: 3 })}</div>
                <div>${field({ label: "Nota mínima (%)", name: "passScoreA", type: "number", value: assessment?.passScore ?? 70 })}</div>
                <div>${field({ label: "Tentativas máximas (0 = ilimitadas)", name: "maxAttempts", type: "number", value: assessment?.maxAttempts ?? 3 })}</div>
                <div>${checkboxField({ label: "Publicada", name: "assPublished", checked: assessment?.isPublished !== false })}</div>
              </div>
              <div class="panel" style="margin-top:16px">
                <div class="panel__head"><div><h3>Questões</h3><p>${assessment?.questionCount || 0} questão(ões)</p></div><button class="btn btn--outline btn--sm" type="button" data-add-question>${icon("plus", 14)} Adicionar questão</button></div>
                <div class="panel__body">
                  ${(assessment?.questions || []).length
                    ? (assessment.questions || [])
                        .map(
                          (q, idx) => `
                    <div class="question-item" style="margin-bottom:10px" data-question-id="${q.id}">
                      <strong>${idx + 1}. ${esc(q.text)}</strong>
                      <ol>${(q.options || []).map((opt, i) => `<li class="${q.correctIndex === i ? "is-correct" : ""}">${String.fromCharCode(65 + i)}) ${esc(opt)}</li>`).join("")}</ol>
                      ${q.explanation ? `<p class="tiny muted" style="margin-top:6px">${esc(q.explanation)}</p>` : ""}
                      <div class="question-item__foot"><span class="tiny muted">${statusLabel(q.type)}</span><button class="btn btn--ghost btn--xs" type="button" data-delete-question>${icon("trash", 13)} Remover</button></div>
                    </div>`
                        )
                        .join("")
                    : `<p class="muted small">Nenhuma questão cadastrada.</p>`}
                </div>
              </div>
            </div>
          </div>
          <aside class="stack">
            <div class="panel">
              <div class="panel__head"><div><h3>Resumo</h3></div></div>
              <div class="panel__body">
                ${summaryList([
                  { label: "Status", value: statusBadge(course.status || "draft") },
                  { label: "Gratuito", value: course.isFree ? "Sim" : "Não" },
                  { label: "Matrículas", value: data.stats?.enrollments ?? 0 },
                  { label: "Ativos/Concluídos", value: `${data.stats?.active ?? 0} / ${data.stats?.completed ?? 0}` },
                  { label: "Progresso médio", value: `${data.stats?.avgProgress ?? 0}%` },
                ])}
              </div>
            </div>
          </aside>
        </div>
      </div>`,
    mount() {
      const root = document.getElementById("view");
      if (!root) return;
      // Tabs
      root.querySelectorAll(".editor-tabs button").forEach((btn) => {
        btn.addEventListener("click", () => {
          root.querySelectorAll(".editor-tabs button").forEach((b) => b.classList.toggle("is-active", b === btn));
          root.querySelectorAll(".editor-pane").forEach((pane) => {
            pane.hidden = pane.dataset.pane !== btn.dataset.tab;
          });
        });
      });
      // Course form
      const form = root.querySelector("#course-form");
      if (form) {
        bindForm(form, async (data) => {
          const payload = {
            title: data.title,
            subtitle: data.subtitle,
            description: data.description,
            objectives: data.objectives,
            categoryId: data.categoryId || null,
            instructorId: data.instructorId || null,
            level: data.level,
            modality: data.modality,
            durationHours: Number(data.durationHours || 0),
            priceCents: Number(data.priceCents || 0),
            status: data.status,
            coverImage: data.coverImage,
            featured: Boolean(data.featured),
            certificateEnabled: data.certificateEnabled !== false,
            requireAssessment: Boolean(data.requireAssessment),
            passScore: Number(data.passScore || 70),
          };
          if (isNew) {
            const res = await api.post("/api/admin/courses", payload);
            toast("Curso criado.", "success");
            navigate(`/admin/cursos/${res.id}`);
            return res;
          } else {
            await api.patch(`/api/admin/courses/${id}`, payload);
            toast("Curso atualizado.", "success");
            return {};
          }
        });
      }
      // Archive
      root.querySelector("[data-archive]")?.addEventListener("click", async () => {
        if (!id) return;
        const ok = await confirmDialog({ title: "Arquivar curso", message: "O curso será arquivado. As matrículas existentes serão preservadas.", confirmLabel: "Arquivar", danger: true });
        if (!ok) return;
        try {
          await api.delete(`/api/admin/courses/${id}`);
          toast("Curso arquivado.", "success");
          navigate("/admin/cursos");
        } catch (e) {
          toast(e.message || "Erro ao arquivar.", "error");
        }
      });
      // Assessment save
      root.querySelector("[data-save-assessment]")?.addEventListener("click", async () => {
        if (isNew) {
          toast("Salve o curso primeiro.", "warning");
          return;
        }
        const payload = {
          title: root.querySelector('[name="assTitle"]').value,
          description: root.querySelector('[name="assDesc"]').value,
          passScore: Number(root.querySelector('[name="passScoreA"]').value || 70),
          maxAttempts: Number(root.querySelector('[name="maxAttempts"]').value || 0),
          isPublished: root.querySelector('[name="assPublished"]').checked,
        };
        try {
          await api.put(`/api/admin/courses/${id}/assessment`, payload);
          toast("Avaliação atualizada.", "success");
          navigate(`/admin/cursos/${id}`, { replace: true });
        } catch (e) {
          toast(e.message || "Erro ao salvar avaliação.", "error");
        }
      });
      // Add question (simple prompt-based for now)
      root.querySelector("[data-add-question]")?.addEventListener("click", async () => {
        if (isNew) return toast("Salve o curso primeiro.", "warning");
        const text = prompt("Enunciado da questão");
        if (!text) return;
        const a = prompt("Alternativa A");
        const b = prompt("Alternativa B");
        const c = prompt("Alternativa C (opcional)");
        const d = prompt("Alternativa D (opcional)");
        const opts = [a, b, c, d].filter(Boolean);
        if (opts.length < 2) return toast("Informe pelo menos duas alternativas.", "warning");
        const correct = prompt("Índice da correta (0 = A, 1 = B, ...)");
        try {
          await api.post(`/api/admin/courses/${id}/questions`, { text, options: opts, correctIndex: Number(correct || 0), type: "multiple" });
          toast("Questão adicionada.", "success");
          navigate(`/admin/cursos/${id}`, { replace: true });
        } catch (e) {
          toast(e.message || "Erro ao adicionar questão.", "error");
        }
      });
      // Delete question
      root.querySelectorAll("[data-delete-question]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const item = btn.closest("[data-question-id]");
          const qid = item?.dataset.questionId;
          if (!qid) return;
          const ok = await confirmDialog({ title: "Remover questão", message: "Esta ação não pode ser desfeita.", confirmLabel: "Remover", danger: true });
          if (!ok) return;
          try {
            await api.delete(`/api/admin/questions/${qid}`);
            toast("Questão removida.", "success");
            navigate(`/admin/cursos/${id}`, { replace: true });
          } catch (e) {
            toast(e.message || "Erro ao remover.", "error");
          }
        });
      });
      // Add module/lesson (basic)
      root.querySelector("[data-add-module]")?.addEventListener("click", async () => {
        if (isNew) return toast("Salve o curso primeiro.", "warning");
        const title = prompt("Título do módulo");
        if (!title) return;
        try {
          await api.post(`/api/admin/courses/${id}/modules`, { title });
          toast("Módulo criado.", "success");
          navigate(`/admin/cursos/${id}`, { replace: true });
        } catch (e) {
          toast(e.message || "Erro ao criar módulo.", "error");
        }
      });
      root.querySelectorAll("[data-add-lesson]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const mod = btn.closest("[data-module-id]");
          const mid = mod?.dataset.moduleId;
          if (!mid) return;
          const title = prompt("Título da aula");
          if (!title) return;
          try {
            await api.post(`/api/admin/modules/${mid}/lessons`, { title, videoUrl: "/assets/video/aula-demonstracao.mp4" });
            toast("Aula criada.", "success");
            navigate(`/admin/cursos/${id}`, { replace: true });
          } catch (e) {
            toast(e.message || "Erro ao criar aula.", "error");
          }
        });
      });
      root.querySelectorAll("[data-delete-module]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const mod = btn.closest("[data-module-id]");
          const mid = mod?.dataset.moduleId;
          if (!mid) return;
          const ok = await confirmDialog({ title: "Remover módulo", message: "Todas as aulas deste módulo serão removidas.", confirmLabel: "Remover", danger: true });
          if (!ok) return;
          try {
            await api.delete(`/api/admin/modules/${mid}`);
            toast("Módulo removido.", "success");
            navigate(`/admin/cursos/${id}`, { replace: true });
          } catch (e) {
            toast(e.message || "Erro ao remover.", "error");
          }
        });
      });
    },
  };
}

/* ------------------------------- Alunos ------------------------------ */
export async function students(ctx) {
  const q = ctx.query.get("q") || "";
  const page = Number(ctx.query.get("page")) || 1;
  const data = await api.get("/api/admin/students" + (q ? `?q=${encodeURIComponent(q)}` : `?page=${page}`));
  const items = data.items || [];
  const total = data.total || items.length;
  const pages = data.pages || 1;

  return {
    title: "Alunos",
    eyebrow: "Administração",
    actions: "",
    html: `
      <div class="stack-lg">
        ${pageHead({ eyebrow: "Usuários", title: "Alunos", text: "Gerencie cadastros, status e matrículas." })}
        <div class="panel">
          <div class="panel__head">
            <div><h2>Lista de alunos</h2><p>${total} aluno(s)</p></div>
            <form class="input-group" style="max-width:280px" action="/admin/alunos" method="get">
              <span>${icon("search", 16)}</span>
              <input class="input" name="q" placeholder="Buscar por nome ou e-mail" value="${esc(q)}">
            </form>
          </div>
          <div class="panel__body panel__body--flush">
            ${
              items.length
                ? `<div class="table-wrap"><table class="table">
                    <thead><tr><th>Aluno</th><th>Contato</th><th>Matrículas</th><th>Certificados</th><th>Progresso médio</th><th>Status</th><th></th></tr></thead>
                    <tbody>${items
                      .map(
                        (s) => `
                      <tr>
                        <td><div class="cell-main"><strong>${esc(s.name)}</strong><span>Cadastrado em ${esc(formatDate(s.createdAt))}</span></div></td>
                        <td class="small">${esc(s.email)}${s.phone ? `<br><span class="muted">${esc(s.phone)}</span>` : ""}</td>
                        <td>${s.enrollmentCount || 0}</td>
                        <td>${s.certificateCount || 0}</td>
                        <td>${s.avgProgress || 0}%</td>
                        <td>${statusBadge(s.status)}</td>
                        <td><div class="cell-actions"><a class="btn btn--outline btn--xs" href="/admin/alunos/${s.id}">${icon("eye", 13)} Ver</a></div></td>
                      </tr>`
                      )
                      .join("")}</tbody>
                  </table></div>`
                : `<div style="padding:18px">${emptyState({ iconName: "users", title: "Nenhum aluno encontrado", text: "Tente ajustar os filtros de busca." })}</div>`
            }
          </div>
          ${pages > 1 ? `<div class="panel__footer">${pagination({ page, pages })}</div>` : ""}
        </div>
      </div>`,
    mount() {
      bindPagination(document.getElementById("view"), (p) => {
        const url = new URL(location.href);
        url.searchParams.set("page", String(p));
        navigate(url.pathname + url.search);
      });
    },
  };
}

/* ------------------------------- Detalhe aluno ------------------------------ */
export async function studentDetail(ctx) {
  const id = ctx.params.id;
  let data;
  try {
    data = await api.get(`/api/admin/students/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return { redirect: "/admin/alunos" };
    throw error;
  }
  const student = data.student || {};
  const enrollments = data.enrollments || [];
  const orders = data.orders || [];
  const certificates = data.certificates || [];

  return {
    title: student.name || "Aluno",
    eyebrow: "Alunos",
    actions: `<a class="btn btn--ghost btn--sm" href="/admin/alunos">${icon("arrow-left", 15)} Voltar</a>`,
    html: `
      <div class="stack-lg">
        ${pageHead({ eyebrow: "Ficha do aluno", title: esc(student.name), text: esc(student.email) })}
        <div class="dash-grid">
          <div class="panel">
            <div class="panel__head"><div><h2>Matrículas</h2></div></div>
            <div class="panel__body panel__body--flush">
              ${
                enrollments.length
                  ? `<div class="table-wrap"><table class="table">
                      <thead><tr><th>Curso</th><th>Status</th><th>Progresso</th><th>Matriculado em</th></tr></thead>
                      <tbody>${enrollments
                        .map(
                          (e) => `
                      <tr>
                        <td><div class="cell-main"><strong>${esc(e.courseTitle)}</strong></div></td>
                        <td>${statusBadge(e.status)}</td>
                        <td>${e.progress || 0}%</td>
                        <td class="tiny muted">${esc(formatDate(e.enrolledAt))}</td>
                      </tr>`
                        )
                        .join("")}</tbody>
                    </table></div>`
                  : `<div style="padding:18px">${emptyState({ iconName: "book-open", title: "Sem matrículas", text: "Este aluno ainda não possui matrículas." })}</div>`
              }
            </div>
          </div>
          <div class="stack">
            <div class="panel">
              <div class="panel__head"><div><h2>Pedidos</h2></div></div>
              <div class="panel__body">
                ${(orders || []).length
                  ? (orders || [])
                      .map(
                        (o) => `
                  <div class="between" style="padding:8px 0;border-bottom:1px solid var(--line)">
                    <div><strong class="small">${esc(o.code)}</strong><div class="tiny muted">${esc(o.courseTitle)} • ${esc(formatMoney(o.totalCents))}</div></div>
                    ${statusBadge(o.status)}
                  </div>`
                      )
                      .join("")
                  : `<p class="muted small">Sem pedidos.</p>`}
              </div>
            </div>
            <div class="panel">
              <div class="panel__head"><div><h2>Certificados</h2></div></div>
              <div class="panel__body">
                ${(certificates || []).length
                  ? (certificates || [])
                      .map(
                        (c) => `
                  <div class="between" style="padding:8px 0;border-bottom:1px solid var(--line)">
                    <div><strong class="small">${esc(c.course_name)}</strong><div class="tiny muted">${esc(c.code)} • ${esc(formatDate(c.issued_at))}</div></div>
                    <a class="btn btn--outline btn--xs" href="/certificado/${encodeURIComponent(c.code)}">Abrir</a>
                  </div>`
                      )
                      .join("")
                  : `<p class="muted small">Sem certificados.</p>`}
              </div>
            </div>
          </div>
        </div>
      </div>`,
    mount() {
      // Status toggle (if admin wants to block/reactivate)
    },
  };
}

/* ------------------------------- Matrículas ------------------------------ */
export async function enrollments(ctx) {
  const data = await api.get("/api/admin/enrollments");
  const items = data.items || [];
  return {
    title: "Matrículas",
    eyebrow: "Administração",
    actions: `<button class="btn btn--primary btn--sm" type="button" data-add-enroll>${icon("plus", 15)} Atribuir matrícula</button>`,
    html: `
      <div class="stack-lg">
        ${pageHead({ eyebrow: "Vendas & acesso", title: "Matrículas", text: "Acompanhe e gerencie matrículas manuais." })}
        <div class="panel">
          <div class="panel__head"><div><h2>Lista</h2><p>${items.length} registro(s)</p></div></div>
          <div class="panel__body panel__body--flush">
            ${
              items.length
                ? `<div class="table-wrap"><table class="table">
                    <thead><tr><th>Aluno</th><th>Curso</th><th>Status</th><th>Progresso</th><th>Matriculado em</th></tr></thead>
                    <tbody>${items
                      .map(
                        (e) => `
                      <tr>
                        <td><div class="cell-main"><strong>${esc(e.studentName)}</strong><span>${esc(e.studentEmail)}</span></div></td>
                        <td>${esc(e.courseTitle)}</td>
                        <td>${statusBadge(e.status)}</td>
                        <td>${e.progress || 0}%</td>
                        <td class="tiny muted">${esc(formatDate(e.enrolledAt))}</td>
                      </tr>`
                      )
                      .join("")}</tbody>
                  </table></div>`
                : `<div style="padding:18px">${emptyState({ iconName: "user-check", title: "Sem matrículas", text: "Utilize 'Atribuir matrícula' para liberar acesso manualmente." })}</div>`
            }
          </div>
        </div>
      </div>`,
    mount() {
      document.querySelector("[data-add-enroll]")?.addEventListener("click", async () => {
        const userId = prompt("ID do aluno (users.id)");
        const courseId = prompt("ID do curso (courses.id)");
        if (!userId || !courseId) return;
        try {
          await api.post("/api/admin/enrollments", { userId: Number(userId), courseId: Number(courseId) });
          toast("Matrícula atribuída.", "success");
          navigate("/admin/matriculas", { replace: true });
        } catch (e) {
          toast(e.message || "Erro ao atribuir.", "error");
        }
      });
    },
  };
}

/* ------------------------------- Pedidos ------------------------------ */
export async function orders(ctx) {
  const data = await api.get("/api/admin/orders");
  const items = data.items || [];
  const summary = data.summary || {};
  return {
    title: "Pedidos",
    eyebrow: "Administração",
    actions: "",
    html: `
      <div class="stack-lg">
        ${pageHead({ eyebrow: "Financeiro", title: "Pedidos", text: "Acompanhe pagamentos, aprovação manual e reembolsos." })}
        <div class="stat-grid">
          ${statCard({ label: "Receita aprovada", value: formatMoney(summary.revenueCents || 0), iconName: "dollar-sign", tone: "green" })}
          ${statCard({ label: "Aprovados", value: summary.approved || 0, iconName: "check-circle" })}
          ${statCard({ label: "Pendentes", value: summary.pending || 0, iconName: "clock", tone: "gold" })}
        </div>
        <div class="panel">
          <div class="panel__head"><div><h2>Lista de pedidos</h2><p>${items.length} pedido(s)</p></div></div>
          <div class="panel__body panel__body--flush">
            ${
              items.length
                ? `<div class="table-wrap"><table class="table">
                    <thead><tr><th>Código</th><th>Aluno</th><th>Curso</th><th>Valor</th><th>Status</th><th>Data</th><th></th></tr></thead>
                    <tbody>${items
                      .map(
                        (o) => `
                      <tr>
                        <td><strong>${esc(o.code)}</strong></td>
                        <td><div class="cell-main"><strong>${esc(o.studentName)}</strong><span>${esc(o.studentEmail)}</span></div></td>
                        <td>${esc(o.courseTitle)}</td>
                        <td>${formatMoney(o.totalCents || o.amountCents || 0)}</td>
                        <td>${statusBadge(o.status)}</td>
                        <td class="tiny muted">${esc(formatDateTime(o.createdAt))}</td>
                        <td><div class="cell-actions">${o.status === "pending" ? `<button class="btn btn--primary btn--xs" type="button" data-approve="${o.id}">${icon("check", 12)} Aprovar</button>` : ""}</div></td>
                      </tr>`
                      )
                      .join("")}</tbody>
                  </table></div>`
                : `<div style="padding:18px">${emptyState({ iconName: "credit-card", title: "Nenhum pedido", text: "Os pedidos aparecerão aqui conforme forem gerados." })}</div>`
            }
          </div>
        </div>
      </div>`,
    mount() {
      document.querySelectorAll("[data-approve]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.dataset.approve;
          const ok = await confirmDialog({ title: "Aprovar pedido", message: "Aprovar manualmente este pedido e liberar o acesso ao curso?", confirmLabel: "Aprovar e liberar" });
          if (!ok) return;
          try {
            await api.patch(`/api/admin/orders/${id}`, { status: "approved", paymentMethod: "manual" });
            toast("Pedido aprovado.", "success");
            navigate("/admin/pedidos", { replace: true });
          } catch (e) {
            toast(e.message || "Erro ao aprovar.", "error");
          }
        });
      });
    },
  };
}

/* ------------------------------- Cupons ------------------------------ */
export async function coupons(ctx) {
  const data = await api.get("/api/admin/coupons");
  const items = data.items || [];
  return {
    title: "Cupons",
    eyebrow: "Administração",
    actions: `<button class="btn btn--primary btn--sm" type="button" data-new-coupon>${icon("plus", 15)} Novo cupom</button>`,
    html: `
      <div class="stack-lg">
        ${pageHead({ eyebrow: "Promoções", title: "Cupons de desconto", text: "Crie e gerencie cupons para compras de cursos." })}
        <div class="panel">
          <div class="panel__head"><div><h2>Lista</h2><p>${items.length} cupom(s)</p></div></div>
          <div class="panel__body panel__body--flush">
            ${
              items.length
                ? `<div class="table-wrap"><table class="table">
                    <thead><tr><th>Código</th><th>Desconto</th><th>Usos</th><th>Validade</th><th>Status</th></tr></thead>
                    <tbody>${items
                      .map(
                        (c) => `
                      <tr>
                        <td><strong>${esc(c.code)}</strong>${c.description ? `<div class="tiny muted">${esc(c.description)}</div>` : ""}</td>
                        <td>${c.percentOff ? `${c.percentOff}%` : c.amountOffCents ? formatMoney(c.amountOffCents) : "—"}</td>
                        <td>${c.usedCount || 0}/${c.maxUses || "∞"}</td>
                        <td class="tiny muted">${c.validUntil ? esc(formatDate(c.validUntil)) : "Sem validade"}</td>
                        <td>${c.active ? `<span class="badge badge--free">Ativo</span>` : `<span class="badge badge--muted">Inativo</span>`}</td>
                      </tr>`
                      )
                      .join("")}</tbody>
                  </table></div>`
                : `<div style="padding:18px">${emptyState({ iconName: "tag", title: "Nenhum cupom", text: "Crie cupons para campanhas promocionais." })}</div>`
            }
          </div>
        </div>
      </div>`,
    mount() {
      document.querySelector("[data-new-coupon]")?.addEventListener("click", async () => {
        const code = prompt("Código do cupom (ex.: BEMVINDO10)");
        if (!code) return;
        const percent = prompt("Desconto percentual (%) - deixe vazio se for valor fixo");
        const amount = prompt("Desconto em centavos (ex.: 1000 = R$ 10) - deixe vazio se for percentual");
        try {
          await api.post("/api/admin/coupons", { code, percentOff: percent ? Number(percent) : 0, amountOffCents: amount ? Number(amount) : 0 });
          toast("Cupom criado.", "success");
          navigate("/admin/cupons", { replace: true });
        } catch (e) {
          toast(e.message || "Erro ao criar cupom.", "error");
        }
      });
    },
  };
}

/* ------------------------------- Conteúdo ------------------------------ */
export async function content(ctx) {
  const [faqs, testimonials, cats] = await Promise.all([
    api.get("/api/admin/faqs").catch(() => ({ items: [] })),
    api.get("/api/admin/testimonials").catch(() => ({ items: [] })),
    api.get("/api/admin/categories").catch(() => ({ items: [] })),
  ]);
  return {
    title: "Conteúdo",
    eyebrow: "Administração",
    actions: "",
    html: `
      <div class="stack-lg">
        ${pageHead({ eyebrow: "Site institucional", title: "Conteúdo", text: "Gerencie FAQs, depoimentos e categorias." })}
        <div class="panel">
          <div class="panel__head"><div><h2>Perguntas frequentes</h2><p>${(faqs.items || []).length} pergunta(s)</p></div></div>
          <div class="panel__body">
            ${(faqs.items || []).length
              ? (faqs.items || []).map((f) => `<div style="padding:10px 0;border-bottom:1px solid var(--line)"><strong>${esc(f.question)}</strong><p class="small muted" style="margin-top:4px">${esc(f.answer)}</p></div>`).join("")
              : `<p class="muted small">Nenhuma FAQ cadastrada.</p>`}
          </div>
        </div>
        <div class="panel">
          <div class="panel__head"><div><h2>Depoimentos</h2><p>${(testimonials.items || []).length} depoimento(s)</p></div></div>
          <div class="panel__body">
            ${(testimonials.items || []).length
              ? (testimonials.items || [])
                  .map(
                    (t) => `
              <div style="padding:10px 0;border-bottom:1px solid var(--line)">
                <div class="between"><strong>${esc(t.student_name)}</strong>${t.published ? `<span class="badge badge--free">Publicado</span>` : `<span class="badge badge--muted">Não publicado</span>`}</div>
                <p class="small" style="margin-top:6px">“${esc(t.quote)}”</p>
                <p class="tiny muted">${t.authorized ? "Autorizado" : "Sem autorização"}</p>
              </div>`
                  )
                  .join("")
              : `<p class="muted small">Nenhum depoimento cadastrado. Depoimentos reais só devem ser publicados com autorização.</p>`}
          </div>
        </div>
        <div class="panel">
          <div class="panel__head"><div><h2>Categorias</h2></div></div>
          <div class="panel__body panel__body--flush">
            <div class="table-wrap"><table class="table">
              <thead><tr><th>Nome</th><th>Slug</th><th>Status</th></tr></thead>
              <tbody>${(cats.items || [])
                .map(
                  (c) => `
                <tr><td><strong>${esc(c.name)}</strong></td><td>${esc(c.slug)}</td><td>${c.active ? `<span class="badge badge--free">Ativa</span>` : `<span class="badge badge--muted">Inativa</span>`}</td></tr>`
                )
                .join("")}</tbody>
            </table></div>
          </div>
        </div>
      </div>`,
  };
}

/* ------------------------------- Configurações ------------------------------ */
export async function settings(ctx) {
  const data = await api.get("/api/admin/settings");
  const s = data.settings || {};
  return {
    title: "Configurações",
    eyebrow: "Administração",
    actions: "",
    html: `
      <div class="stack-lg">
        ${pageHead({ eyebrow: "Institucional", title: "Configurações", text: "Dados institucionais, contato e mensagens do site." })}
        <div class="panel">
          <div class="panel__head"><div><h2>Site</h2></div></div>
          <div class="panel__body">
            <form id="settings-form" class="form-grid">
              <div class="span-2">${field({ label: "Nome do site", name: "site_name", value: s.site_name || "BrasilTec Educação" })}</div>
              <div class="span-2">${field({ label: "Tagline", name: "site_tagline", value: s.site_tagline || "Conhecimento que transforma vidas e realiza sonhos." })}</div>
              <div class="span-2">${field({ label: "Instagram (URL)", name: "contact_instagram", value: s.contact_instagram || "https://www.instagram.com/brasilteceducacao/" })}</div>
              <div>${field({ label: "E-mail de contato", name: "contact_email", value: s.contact_email || "" })}</div>
              <div>${field({ label: "Telefone", name: "contact_phone", value: s.contact_phone || "" })}</div>
              <div class="span-2">${textareaField({ label: "Nota institucional", name: "institutional_note", value: s.institutional_note || "", rows: 4 })}</div>
              <div class="span-2"><button class="btn btn--primary" type="submit">${icon("save", 16)} Salvar configurações</button></div>
              <div class="span-2"><div data-form-feedback hidden></div></div>
            </form>
          </div>
        </div>
      </div>`,
    mount() {
      const form = document.getElementById("settings-form");
      if (form) {
        bindForm(form, async (data) => {
          await api.put("/api/admin/settings", { settings: data });
          toast("Configurações salvas.", "success");
          return {};
        });
      }
    },
  };
}

/* ------------------------------- Atividade ------------------------------ */
export async function activity(ctx) {
  const data = await api.get("/api/admin/activity");
  const items = data.items || [];
  return {
    title: "Atividade",
    eyebrow: "Administração",
    actions: "",
    html: `
      <div class="stack-lg">
        ${pageHead({ eyebrow: "Auditoria", title: "Log de atividade", text: "Registro das ações realizadas no painel." })}
        <div class="panel">
          <div class="panel__body panel__body--flush">
            <div class="table-wrap"><table class="table">
              <thead><tr><th>Usuário</th><th>Ação</th><th>Entidade</th><th>Detalhe</th><th>Data/Hora</th></tr></thead>
              <tbody>${items.length
                ? items
                    .map(
                      (a) => `
                <tr>
                  <td>${esc(a.user_name || "Sistema")}</td>
                  <td>${esc(a.action)}</td>
                  <td>${esc(a.entity || "—")}${a.entity_id ? ` #${a.entity_id}` : ""}</td>
                  <td class="small">${esc(a.detail || "—")}</td>
                  <td class="tiny muted nowrap">${esc(formatDateTime(a.created_at))}</td>
                </tr>`
                    )
                    .join("")
                : `<tr><td colspan="5">${emptyRow(5, "Sem registros de atividade.")}</td></tr>`}</tbody>
            </table></div>
          </div>
        </div>
      </div>`,
  };
}
