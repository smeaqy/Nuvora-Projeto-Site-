/* BrasilTec Educação — aplicação SPA, rotas e estruturas de navegação */

import { api, ApiError } from "./api.js";
import {
  esc,
  icon,
  initials,
  firstName,
  toast,
  pageLoading,
  statusLabel,
} from "./ui.js";

import * as publicPages from "./pages/public.js";
import * as catalogPages from "./pages/catalog.js";
import * as coursePages from "./pages/course.js";
import * as authPages from "./pages/auth.js";
import * as studentPages from "./pages/student.js";
import * as adminPages from "./pages/admin.js";

export const state = {
  user: null,
  app: { demoMode: true, appName: "BrasilTec Educação", paymentsConfigured: false },
  settings: {},
  ready: false,
};

/* --------------------------------- Rotas --------------------------------- */

const routes = [
  { path: "/", page: publicPages.home, layout: "public", title: "Início" },
  { path: "/cursos", page: catalogPages.render, layout: "public", title: "Cursos" },
  { path: "/cursos/:slug", page: coursePages.render, layout: "public", title: "Curso" },
  { path: "/sobre", page: publicPages.about, layout: "public", title: "Sobre a BrasilTec" },
  { path: "/como-funciona", page: publicPages.howItWorks, layout: "public", title: "Como funciona" },
  { path: "/contato", page: publicPages.contact, layout: "public", title: "Contato" },
  { path: "/faq", page: publicPages.faq, layout: "public", title: "Perguntas frequentes" },
  { path: "/verificar-certificado", page: publicPages.verify, layout: "public", title: "Verificar certificado" },
  { path: "/certificado/:code", page: publicPages.certificate, layout: "bare", title: "Certificado" },
  { path: "/privacidade", page: publicPages.privacy, layout: "public", title: "Política de privacidade" },
  { path: "/termos", page: publicPages.terms, layout: "public", title: "Termos de uso" },

  { path: "/entrar", page: authPages.login, layout: "plain", guestOnly: true, title: "Entrar" },
  { path: "/cadastrar", page: authPages.signup, layout: "plain", guestOnly: true, title: "Criar conta" },
  { path: "/recuperar-senha", page: authPages.forgot, layout: "plain", guestOnly: true, title: "Recuperar senha" },
  { path: "/redefinir-senha", page: authPages.reset, layout: "plain", guestOnly: true, title: "Redefinir senha" },

  { path: "/checkout/:slug", page: studentPages.checkout, layout: "public", auth: true, title: "Checkout" },

  { path: "/aluno", page: studentPages.dashboard, layout: "student", role: "student", title: "Visão geral" },
  { path: "/aluno/cursos", page: studentPages.courses, layout: "student", role: "student", title: "Meus cursos" },
  { path: "/aluno/curso/:id", page: studentPages.course, layout: "student", role: "student", title: "Curso" },
  {
    path: "/aluno/curso/:id/aula/:lessonId",
    page: studentPages.player,
    layout: "bare",
    role: "student",
    title: "Aula",
  },
  {
    path: "/aluno/curso/:id/avaliacao",
    page: studentPages.assessment,
    layout: "student",
    role: "student",
    title: "Avaliação",
  },
  { path: "/aluno/avaliacoes", page: studentPages.attempts, layout: "student", role: "student", title: "Avaliações" },
  { path: "/aluno/certificados", page: studentPages.certificates, layout: "student", role: "student", title: "Certificados" },
  { path: "/aluno/pedidos", page: studentPages.orders, layout: "student", role: "student", title: "Pedidos" },
  { path: "/aluno/pedidos/:code", page: studentPages.orderDetail, layout: "student", role: "student", title: "Pedido" },
  { path: "/aluno/perfil", page: studentPages.profile, layout: "student", role: "student", title: "Perfil" },

  { path: "/admin", page: adminPages.dashboard, layout: "admin", role: "staff", title: "Visão geral" },
  { path: "/admin/cursos", page: adminPages.courses, layout: "admin", role: "staff", title: "Cursos" },
  { path: "/admin/cursos/novo", page: adminPages.courseEditor, layout: "admin", role: "staff", title: "Novo curso" },
  { path: "/admin/cursos/:id", page: adminPages.courseEditor, layout: "admin", role: "staff", title: "Editar curso" },
  { path: "/admin/alunos", page: adminPages.students, layout: "admin", role: "admin", title: "Alunos" },
  { path: "/admin/alunos/:id", page: adminPages.studentDetail, layout: "admin", role: "admin", title: "Aluno" },
  { path: "/admin/matriculas", page: adminPages.enrollments, layout: "admin", role: "admin", title: "Matrículas" },
  { path: "/admin/pedidos", page: adminPages.orders, layout: "admin", role: "admin", title: "Pedidos" },
  { path: "/admin/cupons", page: adminPages.coupons, layout: "admin", role: "admin", title: "Cupons" },
  { path: "/admin/conteudo", page: adminPages.content, layout: "admin", role: "admin", title: "Conteúdo" },
  { path: "/admin/configuracoes", page: adminPages.settings, layout: "admin", role: "admin", title: "Configurações" },
  { path: "/admin/atividade", page: adminPages.activity, layout: "admin", role: "admin", title: "Atividade" },
];

function matchRoute(pathname) {
  const current = pathname.split("/").filter(Boolean);
  for (const route of routes) {
    const expected = route.path.split("/").filter(Boolean);
    if (expected.length !== current.length) continue;
    const params = {};
    let ok = true;
    for (let index = 0; index < expected.length; index++) {
      const part = expected[index];
      if (part.startsWith(":")) {
        params[part.slice(1)] = decodeURIComponent(current[index]);
      } else if (part !== current[index]) {
        ok = false;
        break;
      }
    }
    if (ok) return { route, params };
  }
  return null;
}

export function defaultRouteFor(user) {
  if (!user) return "/";
  if (user.role === "admin" || user.role === "instructor") return "/admin";
  return "/aluno";
}

/* ------------------------------- Navegação ------------------------------- */

const NAV = [
  { href: "/", label: "Início" },
  { href: "/cursos", label: "Cursos" },
  { href: "/como-funciona", label: "Como funciona" },
  { href: "/sobre", label: "Sobre" },
  { href: "/faq", label: "FAQ" },
  { href: "/contato", label: "Contato" },
];

function activePath() {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  return path;
}

function isActive(href) {
  const path = activePath();
  if (href === "/") return path === "/";
  return path === href || path.startsWith(`${href}/`);
}

export function navigate(path, { replace = false } = {}) {
  const url = new URL(path, location.origin);
  if (url.pathname === location.pathname && url.search === location.search && url.hash === location.hash) return;
  if (replace) history.replaceState({}, "", url.pathname + url.search + url.hash);
  else history.pushState({}, "", url.pathname + url.search + url.hash);
  renderRoute();
}

function interceptLinks() {
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const anchor = event.target.closest("a[href]");
    if (!anchor) return;
    if (anchor.target && anchor.target !== "_self") return;
    if (anchor.hasAttribute("download") || anchor.dataset.noSpa !== undefined) return;
    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    const url = new URL(anchor.href, location.origin);
    if (url.origin !== location.origin) return;
    if (!url.pathname.startsWith("/") || url.pathname.startsWith("/api/") || url.pathname.startsWith("/assets/")) return;
    event.preventDefault();
    navigate(url.pathname + url.search + url.hash);
  });
}

/* -------------------------------- Layouts -------------------------------- */

function brand(light = false) {
  return `
    <a class="brand ${light ? "brand--light" : ""}" href="/" aria-label="BrasilTec Educação — início">
      <img class="brand-mark" src="/assets/img/${light ? "logo-mark-white.png" : "logo-mark.png"}" alt="" width="44" height="44">
      <span class="brand-text">
        <strong>BrasilTec</strong>
        <span>ensino a distância</span>
      </span>
    </a>`;
}

function demoStrip() {
  if (!state.app.demoMode) return "";
  const text = state.settings.demo_notice || "Ambiente demonstrativo: os dados exibidos são exemplos.";
  return `
    <div class="demo-strip">
      <div class="container">
        ${icon("info", 13)}
        <span><strong>Demonstração.</strong> ${esc(text)}</span>
      </div>
    </div>`;
}

function publicHeader() {
  const user = state.user;
  const links = NAV.map(
    (item) => `<a class="nav-link ${isActive(item.href) ? "is-active" : ""}" href="${item.href}" ${isActive(item.href) ? 'aria-current="page"' : ""}>${esc(item.label)}</a>`
  ).join("");
  const actions = user
    ? `
      <a class="btn btn--primary btn--sm" href="${defaultRouteFor(user)}">${icon("grid", 16)} Meu painel</a>`
    : `
      <a class="btn btn--ghost btn--sm" href="/entrar">Entrar</a>
      <a class="btn btn--primary btn--sm" href="/cadastrar">Criar conta</a>`;
  return `
    <header class="site-header" data-header>
      <div class="container header-inner">
        ${brand()}
        <nav class="site-nav" data-site-nav aria-label="Menu principal">
          ${links}
          <div class="nav-mobile-actions">
            ${user ? `<a class="btn btn--primary btn--block" href="${defaultRouteFor(user)}">Meu painel</a>` : `<a class="btn btn--outline btn--block" href="/entrar">Entrar</a><a class="btn btn--primary btn--block" href="/cadastrar">Criar conta</a>`}
          </div>
        </nav>
        <div class="header-actions">
          ${actions}
          <button type="button" class="icon-btn nav-toggle" data-nav-toggle aria-label="Abrir menu" aria-expanded="false" aria-controls="site-nav">
            ${icon("menu", 22)}
          </button>
        </div>
      </div>
    </header>`;
}

function publicFooter() {
  const year = new Date().getFullYear();
  const instagram = state.settings.contact_instagram || "https://www.instagram.com/brasilteceducacao/";
  return `
    <footer class="site-footer">
      <div class="container">
        <div class="footer-grid">
          <div class="footer-brand">
            ${brand(true)}
            <p>${esc(state.settings.site_tagline || "Ensino a distância")} com foco em qualidade, confiança e novas oportunidades profissionais.</p>
            <a class="footer-social" href="${esc(instagram)}" target="_blank" rel="noopener noreferrer">
              ${icon("instagram", 16)} @brasilteceducacao
            </a>
          </div>
          <div class="footer-col">
            <h4>Institucional</h4>
            <ul>
              <li><a href="/sobre">Sobre a BrasilTec</a></li>
              <li><a href="/como-funciona">Como funciona</a></li>
              <li><a href="/contato">Contato</a></li>
              <li><a href="/faq">Perguntas frequentes</a></li>
            </ul>
          </div>
          <div class="footer-col">
            <h4>Estudar</h4>
            <ul>
              <li><a href="/cursos">Todos os cursos</a></li>
              <li><a href="/cursos?price=free">Cursos gratuitos</a></li>
              <li><a href="/entrar">Área do aluno</a></li>
              <li><a href="/verificar-certificado">Verificar certificado</a></li>
            </ul>
          </div>
          <div class="footer-col">
            <h4>Portal</h4>
            <ul>
              <li><a href="/privacidade">Política de privacidade</a></li>
              <li><a href="/termos">Termos de uso</a></li>
              <li><a href="/contato">Fale com a equipe</a></li>
            </ul>
            <div class="footer-note" style="margin-top:16px">
              <strong>Ambiente demonstrativo.</strong> Cursos, valores e indicadores são exemplos para validação da plataforma.
              Reconhecimentos e condições oficiais devem ser confirmados diretamente com a BrasilTec Educação.
            </div>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© ${year} BrasilTec Educação. Todos os direitos reservados.</span>
          <div class="footer-bottom-links">
            <a href="/privacidade">Privacidade</a>
            <a href="/termos">Termos</a>
            <a href="${esc(instagram)}" target="_blank" rel="noopener noreferrer">Instagram oficial</a>
          </div>
        </div>
      </div>
    </footer>`;
}

function studentNav() {
  const items = [
    { href: "/aluno", label: "Visão geral", iconName: "grid" },
    { href: "/aluno/cursos", label: "Meus cursos", iconName: "book-open" },
    { href: "/aluno/avaliacoes", label: "Avaliações", iconName: "clipboard" },
    { href: "/aluno/certificados", label: "Certificados", iconName: "award" },
    { href: "/aluno/pedidos", label: "Pedidos", iconName: "credit-card" },
    { href: "/aluno/perfil", label: "Perfil e dados", iconName: "user" },
  ];
  return items
    .map(
      (item) =>
        `<a class="sidebar-link ${isActive(item.href) ? "is-active" : ""}" href="${item.href}" ${isActive(item.href) ? 'aria-current="page"' : ""}>${icon(item.iconName, 18)} ${esc(item.label)}</a>`
    )
    .join("");
}

function adminNav() {
  const isInstructor = state.user?.role === "instructor";
  const items = [
    { href: "/admin", label: "Visão geral", iconName: "grid" },
    { href: "/admin/cursos", label: "Cursos", iconName: "book-open" },
    ...(!isInstructor
      ? [
          { href: "/admin/alunos", label: "Alunos", iconName: "users" },
          { href: "/admin/matriculas", label: "Matrículas", iconName: "user-check" },
          { href: "/admin/pedidos", label: "Pedidos", iconName: "credit-card" },
          { href: "/admin/cupons", label: "Cupons", iconName: "tag" },
          { href: "/admin/conteudo", label: "Conteúdo", iconName: "file-text" },
          { href: "/admin/configuracoes", label: "Configurações", iconName: "settings" },
          { href: "/admin/atividade", label: "Atividade", iconName: "list" },
        ]
      : []),
  ];
  return items
    .map(
      (item) =>
        `<a class="sidebar-link ${isActive(item.href) ? "is-active" : ""}" href="${item.href}" ${isActive(item.href) ? 'aria-current="page"' : ""}>${icon(item.iconName, 18)} ${esc(item.label)}</a>`
    )
    .join("");
}

function appShell(page, variant) {
  const user = state.user;
  const nav = variant === "admin" ? adminNav() : studentNav();
  const areaLabel = variant === "admin" ? (user.role === "instructor" ? "Painel do instrutor" : "Administração") : "Área do aluno";
  const actions = page.actions || "";
  return `
    <div class="dash-shell">
      <aside class="dash-sidebar" data-sidebar aria-label="Navegação do painel">
        ${brand(true)}
        <div class="sidebar-eyebrow">${esc(areaLabel)}</div>
        <nav class="sidebar-nav">${nav}</nav>
        <div class="sidebar-footer">
          <a class="sidebar-back" href="/">${icon("globe", 16)} Ir para o site</a>
          <div class="sidebar-user">
            <span class="sidebar-user__avatar">${esc(initials(user?.name))}</span>
            <div style="min-width:0">
              <strong>${esc(user?.name || "Usuário")}</strong>
              <span>${esc(user?.email || "")}</span>
            </div>
          </div>
          <button type="button" class="sidebar-link" data-logout>${icon("logout", 18)} Sair da conta</button>
        </div>
      </aside>
      <div class="sidebar-backdrop" data-sidebar-backdrop></div>
      <div class="dash-content">
        <header class="dash-header">
          <button type="button" class="icon-btn sidebar-toggle" data-sidebar-toggle aria-label="Abrir menu do painel" aria-expanded="false">
            ${icon("menu", 22)}
          </button>
          <div class="dash-header__title">
            <span>${esc(page.eyebrow || areaLabel)}</span>
            <strong>${esc(page.title || "")}</strong>
          </div>
          <div class="dash-header__actions">
            ${state.app.demoMode ? `<span class="demo-pill">${icon("info", 12)} Demonstração</span>` : ""}
            ${actions}
          </div>
        </header>
        <main class="dash-main ${page.wide ? "dash-main--wide" : ""}" id="view">${page.html || ""}</main>
      </div>
    </div>`;
}

function shellFor(page, layout) {
  if (layout === "bare") return `<main id="view" class="animate-in">${page.html || ""}</main>`;
  if (layout === "plain") {
    return `<main id="view" class="animate-in">${page.html || ""}</main>`;
  }
  if (layout === "student" || layout === "admin") return appShell(page, layout);
  return `${demoStrip()}${publicHeader()}<main id="view" class="animate-in">${page.html || ""}</main>${publicFooter()}${cookieBanner()}`;
}

function cookieBanner() {
  return `
    <div class="cookie-banner" data-cookie-banner hidden>
      <p>Usamos apenas cookies essenciais para manter sua sessão e proteger a plataforma. Ao continuar, você concorda com a <a href="/privacidade">Política de Privacidade</a>.</p>
      <div class="cookie-banner__actions">
        <button type="button" class="btn btn--primary btn--sm" data-cookie-accept>Entendi</button>
      </div>
    </div>`;
}

/* ------------------------------ Comportamentos --------------------------- */

function bindHeader() {
  const header = document.querySelector("[data-header]");
  if (header) {
    const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  const nav = document.querySelector("[data-site-nav]");
  const toggle = document.querySelector("[data-nav-toggle]");
  if (nav && toggle) {
    let backdrop = document.querySelector(".mobile-nav-backdrop");
    const setOpen = (open) => {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("has-drawer", open);
      if (open && !backdrop) {
        backdrop = document.createElement("div");
        backdrop.className = "mobile-nav-backdrop";
        document.body.appendChild(backdrop);
        backdrop.addEventListener("click", () => setOpen(false));
      }
      if (!open && backdrop) {
        backdrop.remove();
        backdrop = null;
      }
    };
    toggle.addEventListener("click", () => setOpen(!nav.classList.contains("is-open")));
    nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setOpen(false)));
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && nav.classList.contains("is-open")) setOpen(false);
    });
  }

  const banner = document.querySelector("[data-cookie-banner]");
  if (banner) {
    if (!localStorage.getItem("bte_cookie_consent")) banner.hidden = false;
    banner.querySelector("[data-cookie-accept]")?.addEventListener("click", () => {
      localStorage.setItem("bte_cookie_consent", "essential");
      banner.hidden = true;
    });
  }
}

function bindShell() {
  const sidebar = document.querySelector("[data-sidebar]");
  const toggle = document.querySelector("[data-sidebar-toggle]");
  const backdrop = document.querySelector("[data-sidebar-backdrop]");
  if (sidebar && toggle) {
    const setOpen = (open) => {
      sidebar.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      backdrop?.classList.toggle("is-open", open);
      document.body.classList.toggle("has-drawer", open);
    };
    toggle.addEventListener("click", () => setOpen(!sidebar.classList.contains("is-open")));
    backdrop?.addEventListener("click", () => setOpen(false));
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setOpen(false);
    });
  }
  document.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await api.post("/api/auth/logout");
      } catch {
        /* a sessão será descartada de qualquer forma */
      }
      state.user = null;
      toast("Sessão encerrada.", "success");
      navigate("/", { replace: true });
    });
  });
}

/* --------------------------------- Roteador ------------------------------ */

let routeToken = 0;

async function renderRoute() {
  const token = ++routeToken;
  const path = activePath();
  const matched = matchRoute(path);
  const app = document.getElementById("app");

  if (!matched) {
    const page = await publicPages.notFound({ query: new URLSearchParams(location.search) });
    app.innerHTML = shellFor(page, "public");
    document.title = "Página não encontrada — BrasilTec Educação";
    bindHeader();
    page.mount?.();
    window.scrollTo(0, 0);
    return;
  }

  const { route, params } = matched;
  const user = state.user;

  if (route.guestOnly && user) {
    navigate(defaultRouteFor(user), { replace: true });
    return;
  }
  if (route.auth && !user) {
    const next = encodeURIComponent(location.pathname + location.search);
    navigate(`/entrar?next=${next}`, { replace: true });
    return;
  }
  if (route.role) {
    const allowed =
      route.role === "student"
        ? user?.role === "student"
        : route.role === "staff"
          ? ["admin", "instructor"].includes(user?.role)
          : user?.role === route.role;
    if (!allowed) {
      if (user) {
        toast("Você não tem permissão para acessar esta área.", "error");
        navigate(defaultRouteFor(user), { replace: true });
      } else {
        navigate(`/entrar?next=${encodeURIComponent(location.pathname)}`, { replace: true });
      }
      return;
    }
  }

  const ctx = {
    params,
    query: new URLSearchParams(location.search),
    user,
    app: state.app,
    settings: state.settings,
    path,
  };

  if (document.getElementById("app")?.classList.contains("app-boot")) {
    app.innerHTML = shellFor({ html: pageLoading() }, route.layout === "bare" ? "bare" : route.layout);
  }

  let page;
  try {
    page = await route.page(ctx);
  } catch (error) {
    if (token !== routeToken) return;
    if (error instanceof ApiError && error.status === 401) {
      state.user = null;
      toast("Sua sessão expirou. Entre novamente.", "error");
      navigate(`/entrar?next=${encodeURIComponent(location.pathname + location.search)}`, { replace: true });
      return;
    }
    console.error(error);
    const detail =
      error instanceof ApiError && error.status === 403
        ? "Você não tem permissão para acessar este conteúdo."
        : error?.message || "Não foi possível carregar esta página.";
    page = {
      title: "Não foi possível carregar",
      html: `
        <div class="container section">
          <div class="empty-state">
            <div class="empty-state__icon">${icon("alert", 24)}</div>
            <h3>Algo deu errado</h3>
            <p>${esc(detail)}</p>
            <button type="button" class="btn btn--primary btn--sm" onclick="location.reload()">Tentar novamente</button>
          </div>
        </div>`,
    };
  }
  if (token !== routeToken) return;

  if (page.redirect) {
    navigate(page.redirect, { replace: true });
    return;
  }

  const layout = page.layout || route.layout;
  app.classList.remove("app-boot");
  app.innerHTML = shellFor(page, layout);
  bindHeader();
  bindShell();

  document.title = page.documentTitle || `${page.title || route.title || "BrasilTec Educação"} — BrasilTec Educação`;
  const description = document.querySelector('meta[name="description"]');
  if (description && page.description) description.setAttribute("content", page.description);
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute("href", location.origin + location.pathname);

  page.mount?.();

  if (location.hash) {
    const target = document.querySelector(location.hash);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
  }
  window.scrollTo({ top: 0, behavior: "auto" });
}

/* ---------------------------------- Boot --------------------------------- */

async function boot() {
  const app = document.getElementById("app");
  try {
    const [session, config] = await Promise.all([
      api.get("/api/auth/session").catch(() => ({ user: null })),
      api.get("/api/public/config").catch(() => null),
    ]);
    state.user = session?.user || null;
    if (config) {
      state.app = { ...state.app, ...config.app };
      state.settings = config.settings || {};
    }
  } catch (error) {
    console.error("[boot]", error);
  }
  state.ready = true;
  if (app) app.classList.remove("app-boot");
  renderRoute();
}

window.addEventListener("popstate", renderRoute);
window.addEventListener("unhandledrejection", (event) => {
  const error = event.reason;
  if (error instanceof ApiError && error.status === 401) {
    event.preventDefault();
    state.user = null;
    navigate("/entrar", { replace: true });
  }
});

interceptLinks();
boot();
