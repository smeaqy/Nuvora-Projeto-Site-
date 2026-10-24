/* BrasilTec Educação — catálogo público de cursos */

import { api, qs } from "../api.js";
import {
  esc,
  icon,
  courseCard,
  pagination,
  debounce,
  statusLabel,
  toast,
} from "../ui.js";
import { pageHero, bindPagination } from "./shared.js";

const state = {
  q: "",
  category: "",
  level: "",
  modality: "",
  price: "",
  sort: "",
  page: 1,
  filters: { categories: [], levels: [], modalities: [] },
};

function readFromQuery(query) {
  state.q = query.get("q") || "";
  state.category = query.get("category") || "";
  state.level = query.get("level") || "";
  state.modality = query.get("modality") || "";
  state.price = query.get("price") || "";
  state.sort = query.get("sort") || "";
  state.page = Math.max(1, Number(query.get("page")) || 1);
}

function syncUrl() {
  const params = {
    q: state.q,
    category: state.category,
    level: state.level,
    modality: state.modality,
    price: state.price,
    sort: state.sort,
    page: state.page > 1 ? state.page : "",
  };
  const url = `/cursos${qs(params)}`;
  history.replaceState({}, "", url);
}

function activeFilters() {
  const chips = [];
  const cat = state.filters.categories.find((c) => c.slug === state.category);
  if (cat) chips.push({ key: "category", label: cat.name });
  if (state.level) chips.push({ key: "level", label: statusLabel(state.level) });
  if (state.modality) chips.push({ key: "modality", label: statusLabel(state.modality) });
  if (state.price === "free") chips.push({ key: "price", label: "Gratuitos" });
  if (state.price === "paid") chips.push({ key: "price", label: "Pagos" });
  if (!chips.length && !state.q) return "";
  return `
    <div class="active-filters">
      <span class="tiny muted">Filtros ativos:</span>
      ${state.q ? `<button type="button" class="filter-chip" data-clear="q">${icon("search", 13)} “${esc(state.q)}” ${icon("x", 12)}</button>` : ""}
      ${chips.map((chip) => `<button type="button" class="filter-chip" data-clear="${chip.key}">${esc(chip.label)} ${icon("x", 12)}</button>`).join("")}
      <button type="button" class="link-arrow" data-clear-all>Limpar tudo</button>
    </div>`;
}

function filterPanel() {
  const categories = state.filters.categories || [];
  return `
    <aside class="filter-panel" data-filter-panel aria-label="Filtros do catálogo">
      <div class="filter-panel__head">
        <h2>${icon("filter", 17)} Filtros</h2>
        <button type="button" class="icon-btn filter-panel__close" data-close-filters aria-label="Fechar filtros">${icon("x", 20)}</button>
      </div>
      <div class="filter-group">
        <h3 class="filter-group__title">Categoria</h3>
        <label class="filter-option"><input type="radio" name="category" value="" ${!state.category ? "checked" : ""}> Todas</label>
        ${categories
          .map(
            (category) =>
              `<label class="filter-option"><input type="radio" name="category" value="${esc(category.slug)}" ${state.category === category.slug ? "checked" : ""}> ${esc(category.name)}</label>`
          )
          .join("")}
      </div>
      <div class="filter-group">
        <h3 class="filter-group__title">Nível</h3>
        <label class="filter-option"><input type="radio" name="level" value="" ${!state.level ? "checked" : ""}> Todos</label>
        ${(state.filters.levels || [])
          .map(
            (level) =>
              `<label class="filter-option"><input type="radio" name="level" value="${esc(level.value)}" ${state.level === level.value ? "checked" : ""}> ${esc(level.label)}</label>`
          )
          .join("")}
      </div>
      <div class="filter-group">
        <h3 class="filter-group__title">Modalidade</h3>
        <label class="filter-option"><input type="radio" name="modality" value="" ${!state.modality ? "checked" : ""}> Todas</label>
        ${(state.filters.modalities || [])
          .map(
            (modality) =>
              `<label class="filter-option"><input type="radio" name="modality" value="${esc(modality.value)}" ${state.modality === modality.value ? "checked" : ""}> ${esc(modality.label)}</label>`
          )
          .join("")}
      </div>
      <div class="filter-group">
        <h3 class="filter-group__title">Preço</h3>
        <label class="filter-option"><input type="radio" name="price" value="" ${!state.price ? "checked" : ""}> Todos</label>
        <label class="filter-option"><input type="radio" name="price" value="free" ${state.price === "free" ? "checked" : ""}> Gratuitos</label>
        <label class="filter-option"><input type="radio" name="price" value="paid" ${state.price === "paid" ? "checked" : ""}> Pagos</label>
      </div>
      <button type="button" class="btn btn--outline btn--block btn--sm" data-clear-all>${icon("refresh", 15)} Limpar filtros</button>
    </aside>
    <div class="filter-backdrop" data-filter-backdrop></div>`;
}

function resultsHtml(data) {
  if (!data.items.length) {
    return `
      <div class="empty-state">
        <div class="empty-state__icon">${icon("search", 24)}</div>
        <h3>Nenhum curso encontrado</h3>
        <p>Tente ajustar a busca ou remover alguns filtros.</p>
        <button type="button" class="btn btn--primary btn--sm" data-clear-all>Limpar filtros</button>
      </div>`;
  }
  return `
    <div class="course-grid" style="grid-template-columns:repeat(auto-fill,minmax(270px,1fr))">${data.items.map(courseCard).join("")}</div>
    <div class="between" style="margin-top:26px;flex-wrap:wrap;gap:16px">
      <span class="small muted">${data.total} ${data.total === 1 ? "curso encontrado" : "cursos encontrados"}</span>
      ${pagination({ page: data.page, pages: data.pages })}
    </div>`;
}

function summaryText(data) {
  if (!data.total) return "Nenhum resultado";
  return `${data.total} ${data.total === 1 ? "curso" : "cursos"}`;
}

export async function render(ctx) {
  readFromQuery(ctx.query);
  const first = await api.get(`/api/public/courses${qs({
    q: state.q,
    category: state.category,
    level: state.level,
    modality: state.modality,
    price: state.price,
    sort: state.sort,
    page: state.page,
    limit: 12,
  })}`);
  state.filters = first.filters;

  return {
    title: "Cursos",
    description: "Catálogo de cursos técnicos, profissionalizantes e formações online da BrasilTec Educação.",
    html: `
      ${pageHero({
        eyebrow: "Catálogo",
        title: "Encontre seu próximo curso",
        text: "Busque por área de interesse e compare carga horária, modalidade e investimento.",
      })}
      <section class="section">
        <div class="container">
          <div class="catalog-topbar">
            <form class="catalog-search" data-search-form role="search">
              <span aria-hidden="true">${icon("search", 18)}</span>
              <input class="input" type="search" name="q" value="${esc(state.q)}" placeholder="Buscar por curso, área ou instrutor" aria-label="Buscar cursos" autocomplete="off">
              <button class="btn btn--primary btn--sm" type="submit">Buscar</button>
            </form>
            <div class="cluster">
              <button type="button" class="btn btn--outline btn--sm filter-toggle" data-open-filters>${icon("filter", 16)} Filtros</button>
              <label class="sr-only" for="catalog-sort">Ordenar por</label>
              <select class="select" id="catalog-sort" data-sort style="width:auto;min-width:190px">
                <option value="" ${!state.sort ? "selected" : ""}>Ordenar: relevância</option>
                <option value="recent" ${state.sort === "recent" ? "selected" : ""}>Mais recentes</option>
                <option value="title" ${state.sort === "title" ? "selected" : ""}>Título (A–Z)</option>
                <option value="price_asc" ${state.sort === "price_asc" ? "selected" : ""}>Menor preço</option>
                <option value="price_desc" ${state.sort === "price_desc" ? "selected" : ""}>Maior preço</option>
                <option value="duration" ${state.sort === "duration" ? "selected" : ""}>Menor carga horária</option>
              </select>
            </div>
          </div>

          <div class="catalog-layout">
            ${filterPanel()}
            <div>
              <div class="between" style="margin-bottom:16px;flex-wrap:wrap;gap:12px">
                <span class="catalog-count" data-count>${summaryText(first)}</span>
              </div>
              <div data-active-filters>${activeFilters()}</div>
              <div data-results aria-live="polite">${resultsHtml(first)}</div>
            </div>
          </div>
        </div>
      </section>
    `,
    mount() {
      const results = document.querySelector("[data-results]");
      const count = document.querySelector("[data-count]");
      const chips = document.querySelector("[data-active-filters]");
      const panel = document.querySelector("[data-filter-panel]");
      const backdrop = document.querySelector("[data-filter-backdrop]");

      const setFiltersOpen = (open) => {
        panel?.classList.toggle("is-open", open);
        backdrop?.classList.toggle("is-open", open);
        document.body.classList.toggle("has-drawer", open);
      };
      document.querySelector("[data-open-filters]")?.addEventListener("click", () => setFiltersOpen(true));
      document.querySelector("[data-close-filters]")?.addEventListener("click", () => setFiltersOpen(false));
      backdrop?.addEventListener("click", () => setFiltersOpen(false));

      const load = async () => {
        results?.classList.add("is-loading");
        try {
          const data = await api.get(`/api/public/courses${qs({
            q: state.q,
            category: state.category,
            level: state.level,
            modality: state.modality,
            price: state.price,
            sort: state.sort,
            page: state.page,
            limit: 12,
          })}`);
          state.filters = data.filters;
          results.innerHTML = resultsHtml(data);
          count.textContent = summaryText(data);
          chips.innerHTML = activeFilters();
          syncUrl();
          bindPagination(results, (page) => {
            state.page = page;
            load();
            document.querySelector(".catalog-layout")?.scrollIntoView({ behavior: "smooth", block: "start" });
          });
          bindClearActions();
        } catch (error) {
          results.innerHTML = `
            <div class="empty-state">
              <div class="empty-state__icon">${icon("alert", 24)}</div>
              <h3>Não foi possível carregar</h3>
              <p>${esc(error.message || "Tente novamente.")}</p>
              <button type="button" class="btn btn--outline btn--sm" data-retry>Recarregar</button>
            </div>`;
          results.querySelector("[data-retry]")?.addEventListener("click", load);
        } finally {
          results?.classList.remove("is-loading");
        }
      };

      const bindClearActions = () => {
        document.querySelectorAll("[data-clear]").forEach((button) => {
          button.addEventListener("click", () => {
            const key = button.dataset.clear;
            state[key] = "";
            state.page = 1;
            const input = document.querySelector(`[data-filter-panel] [name="${key}"]`);
            if (input) input.checked = true;
            if (key === "q") {
              const search = document.querySelector('[data-search-form] [name="q"]');
              if (search) search.value = "";
            }
            load();
          });
        });
        document.querySelectorAll("[data-clear-all]").forEach((button) => {
          button.addEventListener("click", () => {
            state.q = "";
            state.category = "";
            state.level = "";
            state.modality = "";
            state.price = "";
            state.page = 1;
            const form = document.querySelector("[data-search-form]");
            if (form) form.reset();
            document.querySelectorAll("[data-filter-panel] input[type=radio]").forEach((input) => {
              if (!input.value) input.checked = true;
            });
            load();
          });
        });
      };

      const searchForm = document.querySelector("[data-search-form]");
      const searchInput = searchForm?.querySelector('input[name="q"]');
      searchForm?.addEventListener("submit", (event) => {
        event.preventDefault();
        state.q = searchInput.value.trim();
        state.page = 1;
        load();
      });
      const debouncedSearch = debounce(() => {
        const value = searchInput.value.trim();
        if (value === state.q) return;
        state.q = value;
        state.page = 1;
        load();
      }, 420);
      searchInput?.addEventListener("input", debouncedSearch);

      panel?.querySelectorAll("input[type=radio]").forEach((input) => {
        input.addEventListener("change", () => {
          state[input.name] = input.value;
          state.page = 1;
          setFiltersOpen(false);
          load();
        });
      });

      document.querySelector("[data-sort]")?.addEventListener("change", (event) => {
        state.sort = event.target.value;
        state.page = 1;
        load();
      });

      bindPagination(results, (page) => {
        state.page = page;
        load();
      });
      bindClearActions();
    },
  };
}

