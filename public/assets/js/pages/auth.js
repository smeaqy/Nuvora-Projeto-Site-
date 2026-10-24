/* BrasilTec Educação — autenticação (entrar, cadastrar, recuperar e redefinir senha) */

import { api } from "../api.js";
import { state, navigate } from "../app.js";
import {
  esc,
  icon,
  toast,
  setBusy,
  clearErrors,
  fieldError,
  validateEmail,
  validatePassword,
} from "../ui.js";
import { alertBox } from "./shared.js";

function safeNext(value) {
  const next = String(value || "").trim();
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/api/")) return "";
  return next;
}

function authShell({ title, subtitle, body, sideTitle, sideText = "", sideList = [], bottom = "" }) {
  return `
    <div class="auth-shell">
      <div class="auth-panel">
        <div class="auth-card">
          <a class="brand" href="/" aria-label="BrasilTec Educação — início">
            <img class="brand-mark" src="/assets/img/logo-mark.png" alt="" width="44" height="44">
            <span class="brand-text"><strong>BrasilTec</strong><span>ensino a distância</span></span>
          </a>
          <div class="auth-card__head">
            <h1>${esc(title)}</h1>
            ${subtitle ? `<p>${esc(subtitle)}</p>` : ""}
          </div>
          ${body}
          ${bottom}
          <p class="auth-switch"><a class="link-arrow" href="/">${icon("arrow-left", 14)} Voltar ao site</a></p>
        </div>
      </div>
      <div class="auth-side" aria-hidden="true">
        <img src="/assets/img/hero-study.jpg" alt="">
        <div class="auth-side__content">
          <span class="eyebrow eyebrow--light">BrasilTec Educação</span>
          <h2>${esc(sideTitle)}</h2>
          ${sideText ? `<p>${esc(sideText)}</p>` : ""}
          ${sideList.length ? `<ul class="auth-side__list">${sideList.map((item) => `<li>${icon("check-circle", 16)} ${esc(item)}</li>`).join("")}</ul>` : ""}
        </div>
      </div>
    </div>`;
}

function passwordInput(id, name, label, { autocomplete = "current-password", hint = "" } = {}) {
  return `
    <div class="field">
      <label class="field-label" for="${id}">${esc(label)}</label>
      <div class="input-group">
        <input class="input" id="${id}" name="${name}" type="password" required minlength="8" autocomplete="${autocomplete}">
        <button type="button" class="input-group__action" data-toggle-password aria-label="Mostrar senha">${icon("eye", 18)}</button>
      </div>
      ${hint ? `<p class="field-hint">${esc(hint)}</p>` : ""}
    </div>`;
}

function bindPasswordToggles(root) {
  root.querySelectorAll("[data-toggle-password]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = button.closest(".input-group")?.querySelector("input");
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      button.setAttribute("aria-label", show ? "Ocultar senha" : "Mostrar senha");
      button.innerHTML = icon(show ? "eye-off" : "eye", 18);
    });
  });
}

function inlineError(form, message) {
  let box = form.querySelector("[data-auth-error]");
  if (!box) {
    box = document.createElement("div");
    box.setAttribute("data-auth-error", "");
    form.prepend(box);
  }
  box.innerHTML = alertBox(message, "error");
}

/* --------------------------------- Entrar -------------------------------- */

export async function login(ctx) {
  const next = safeNext(ctx.query.get("next"));
  return {
    title: "Entrar",
    documentTitle: "Entrar — BrasilTec Educação",
    html: authShell({
      title: "Acesse sua conta",
      subtitle: "Entre para continuar seus estudos ou gerenciar a plataforma.",
      sideTitle: "Seu aprendizado continua de onde parou.",
      sideText: "Acesse suas aulas, acompanhe o progresso e consulte seus certificados.",
      sideList: ["Aulas e materiais em um só lugar", "Progresso salvo automaticamente", "Certificados com verificação pública"],
      body: `
        <form class="auth-form" id="login-form" novalidate>
          <div data-form-feedback hidden></div>
          <div class="field">
            <label class="field-label" for="login-email">E-mail</label>
            <input class="input" id="login-email" name="email" type="email" required autocomplete="email" placeholder="voce@exemplo.com">
          </div>
          ${passwordInput("login-password", "password", "Senha")}
          <div class="auth-row">
            <label class="checkbox"><input type="checkbox" name="remember" value="1" checked><span>Manter conectado</span></label>
            <a class="link-arrow" href="/recuperar-senha">Esqueci minha senha</a>
          </div>
          <button type="submit" class="btn btn--primary btn--block btn--lg">${icon("log-in", 18)} Entrar</button>
        </form>
        <div class="auth-divider">Ainda não tem conta?</div>
        <a class="btn btn--outline btn--block" href="/cadastrar${next ? `?next=${encodeURIComponent(next)}` : ""}">Criar conta gratuita</a>
      `,
    }),
    mount() {
      bindPasswordToggles(document);
      const form = document.getElementById("login-form");
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearErrors(form);
        const button = form.querySelector('[type="submit"]');
        const data = new FormData(form);
        const email = String(data.get("email") || "").trim();
        const password = String(data.get("password") || "");
        let valid = true;
        if (!validateEmail(email)) {
          fieldError(form, "email", "Informe um e-mail válido.");
          valid = false;
        }
        if (!password) {
          fieldError(form, "password", "Informe sua senha.");
          valid = false;
        }
        if (!valid) return;
        setBusy(button, true, "Entrando…");
        try {
          const result = await api.post("/api/auth/login", { email, password });
          state.user = result.user;
          toast("Bem-vindo(a) de volta!", "success");
          const destination = next || (result.user.role === "student" ? "/aluno" : "/admin");
          navigate(destination, { replace: true });
        } catch (error) {
          inlineError(form, error.message || "Não foi possível entrar.");
          setBusy(button, false);
        }
      });
      form.addEventListener("input", (event) => {
        event.target.closest(".field")?.classList.remove("has-error");
      });
      document.getElementById("login-email")?.focus();
    },
  };
}

/* -------------------------------- Cadastro ------------------------------- */

export async function signup(ctx) {
  const next = safeNext(ctx.query.get("next"));
  return {
    title: "Criar conta",
    documentTitle: "Criar conta — BrasilTec Educação",
    html: authShell({
      title: "Crie sua conta gratuita",
      subtitle: "Leva menos de um minuto. Você só precisa de nome, e-mail e senha.",
      sideTitle: "Comece a estudar hoje.",
      sideText: "Uma conta gratuita dá acesso à área do aluno, matrículas e certificados.",
      sideList: ["Matrícula em cursos gratuitos", "Acompanhamento de progresso", "Materiais e anotações"],
      body: `
        <form class="auth-form" id="signup-form" novalidate>
          <div data-form-feedback hidden></div>
          <div class="field">
            <label class="field-label" for="signup-name">Nome completo</label>
            <input class="input" id="signup-name" name="name" required minlength="2" maxlength="120" autocomplete="name">
          </div>
          <div class="field">
            <label class="field-label" for="signup-email">E-mail</label>
            <input class="input" id="signup-email" name="email" type="email" required maxlength="180" autocomplete="email" placeholder="voce@exemplo.com">
          </div>
          <div class="field">
            <label class="field-label" for="signup-phone">Telefone / WhatsApp <span class="tiny muted">(opcional)</span></label>
            <input class="input" id="signup-phone" name="phone" maxlength="40" autocomplete="tel">
          </div>
          <div class="form-grid">
            <div class="field">
              <label class="field-label" for="signup-password">Senha</label>
              <div class="input-group">
                <input class="input" id="signup-password" name="password" type="password" required minlength="8" autocomplete="new-password">
                <button type="button" class="input-group__action" data-toggle-password aria-label="Mostrar senha">${icon("eye", 18)}</button>
              </div>
              <p class="field-hint">Mínimo de 8 caracteres, com letras e números.</p>
            </div>
            <div class="field">
              <label class="field-label" for="signup-confirm">Confirmar senha</label>
              <div class="input-group">
                <input class="input" id="signup-confirm" name="confirm" type="password" required minlength="8" autocomplete="new-password">
                <button type="button" class="input-group__action" data-toggle-password aria-label="Mostrar senha">${icon("eye", 18)}</button>
              </div>
            </div>
          </div>
          <label class="checkbox">
            <input type="checkbox" name="acceptTerms" value="1" required>
            <span>Li e aceito os <a href="/termos" target="_blank" rel="noopener">Termos de uso</a> e a <a href="/privacidade" target="_blank" rel="noopener">Política de privacidade</a>.</span>
          </label>
          <button type="submit" class="btn btn--primary btn--block btn--lg">${icon("user-check", 18)} Criar minha conta</button>
        </form>
        <div class="auth-divider">Já tem uma conta?</div>
        <a class="btn btn--outline btn--block" href="/entrar${next ? `?next=${encodeURIComponent(next)}` : ""}">Entrar</a>
      `,
    }),
    mount() {
      bindPasswordToggles(document);
      const form = document.getElementById("signup-form");
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearErrors(form);
        const data = new FormData(form);
        const name = String(data.get("name") || "").trim();
        const email = String(data.get("email") || "").trim();
        const phone = String(data.get("phone") || "").trim();
        const password = String(data.get("password") || "");
        const confirm = String(data.get("confirm") || "");
        const acceptTerms = Boolean(data.get("acceptTerms"));
        let valid = true;
        if (name.length < 2) {
          fieldError(form, "name", "Informe seu nome completo.");
          valid = false;
        }
        if (!validateEmail(email)) {
          fieldError(form, "email", "Informe um e-mail válido.");
          valid = false;
        }
        const passwordProblem = validatePassword(password);
        if (passwordProblem) {
          fieldError(form, "password", passwordProblem);
          valid = false;
        }
        if (confirm !== password) {
          fieldError(form, "confirm", "As senhas não conferem.");
          valid = false;
        }
        if (!acceptTerms) {
          inlineError(form, "É necessário aceitar os Termos de uso e a Política de privacidade.");
          valid = false;
        }
        if (!valid) return;
        const button = form.querySelector('[type="submit"]');
        setBusy(button, true, "Criando conta…");
        try {
          const result = await api.post("/api/auth/signup", { name, email, phone, password, acceptTerms });
          state.user = result.user;
          toast("Conta criada com sucesso. Bom estudo!", "success");
          navigate(next || "/aluno", { replace: true });
        } catch (error) {
          inlineError(form, error.message || "Não foi possível criar a conta.");
          setBusy(button, false);
        }
      });
      form.addEventListener("input", (event) => {
        event.target.closest(".field")?.classList.remove("has-error");
      });
    },
  };
}

/* ----------------------------- Recuperar senha --------------------------- */

export async function forgot() {
  return {
    title: "Recuperar senha",
    documentTitle: "Recuperar senha — BrasilTec Educação",
    html: authShell({
      title: "Recuperar acesso",
      subtitle: "Informe o e-mail da sua conta. Enviaremos as instruções para redefinir a senha.",
      sideTitle: "Sem complicação.",
      sideText: "O link de redefinição é válido por 1 hora. Se não receber a mensagem, confira também a pasta de spam.",
      sideList: ["Envio para o e-mail cadastrado", "Link de uso único", "Sessões encerradas após a troca"],
      body: `
        <form class="auth-form" id="forgot-form" novalidate>
          <div data-form-feedback hidden></div>
          <div class="field">
            <label class="field-label" for="forgot-email">E-mail da conta</label>
            <input class="input" id="forgot-email" name="email" type="email" required autocomplete="email" placeholder="voce@exemplo.com">
          </div>
          <button type="submit" class="btn btn--primary btn--block btn--lg">${icon("mail", 18)} Enviar instruções</button>
        </form>
        <div id="forgot-result" hidden></div>
        <a class="btn btn--ghost btn--block" href="/entrar">${icon("arrow-left", 16)} Voltar para o login</a>
      `,
    }),
    mount() {
      const form = document.getElementById("forgot-form");
      const resultBox = document.getElementById("forgot-result");
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearErrors(form);
        const email = String(new FormData(form).get("email") || "").trim();
        if (!validateEmail(email)) {
          fieldError(form, "email", "Informe um e-mail válido.");
          return;
        }
        const button = form.querySelector('[type="submit"]');
        setBusy(button, true, "Enviando…");
        try {
          const result = await api.post("/api/auth/forgot-password", { email });
          form.querySelector("[data-form-feedback]").hidden = true;
          resultBox.hidden = false;
          resultBox.innerHTML = `
            ${alertBox(result.message, "success")}
            ${
              result.demoResetUrl
                ? `<div class="auth-demo" style="margin-top:12px">
                    <strong>Ambiente demonstrativo.</strong> O envio de e-mail não está configurado. Use o link abaixo para simular a redefinição:
                    <div style="margin-top:10px"><a class="btn btn--outline btn--sm" href="${esc(result.demoResetUrl)}">Abrir link de redefinição</a></div>
                  </div>`
                : ""
            }`;
          setBusy(button, false);
        } catch (error) {
          inlineError(form, error.message || "Não foi possível enviar as instruções.");
          setBusy(button, false);
        }
      });
    },
  };
}

/* ------------------------------ Redefinir senha -------------------------- */

export async function reset(ctx) {
  const token = String(ctx.query.get("token") || "").trim();
  return {
    title: "Redefinir senha",
    documentTitle: "Redefinir senha — BrasilTec Educação",
    html: authShell({
      title: "Defina uma nova senha",
      subtitle: "Escolha uma senha forte e diferente da anterior. Todas as sessões serão encerradas.",
      sideTitle: "Segurança em primeiro lugar.",
      sideText: "Após a troca, você precisará entrar novamente com a nova senha.",
      sideList: ["Mínimo de 8 caracteres", "Use letras e números", "Não compartilhe sua senha"],
      body: token
        ? `
          <form class="auth-form" id="reset-form" novalidate>
            <div data-form-feedback hidden></div>
            <div class="field">
              <label class="field-label" for="reset-password">Nova senha</label>
              <div class="input-group">
                <input class="input" id="reset-password" name="password" type="password" required minlength="8" autocomplete="new-password">
                <button type="button" class="input-group__action" data-toggle-password aria-label="Mostrar senha">${icon("eye", 18)}</button>
              </div>
              <p class="field-hint">Mínimo de 8 caracteres, com letras e números.</p>
            </div>
            <div class="field">
              <label class="field-label" for="reset-confirm">Confirmar nova senha</label>
              <div class="input-group">
                <input class="input" id="reset-confirm" name="confirm" type="password" required minlength="8" autocomplete="new-password">
                <button type="button" class="input-group__action" data-toggle-password aria-label="Mostrar senha">${icon("eye", 18)}</button>
              </div>
            </div>
            <button type="submit" class="btn btn--primary btn--block btn--lg">${icon("lock", 18)} Redefinir senha</button>
          </form>`
        : `<div class="notice notice--danger">${icon("alert", 18)}<div>Link inválido. Solicite uma nova recuperação de senha.</div></div>
           <a class="btn btn--primary btn--block" href="/recuperar-senha">Solicitar novo link</a>`,
    }),
    mount() {
      if (!token) return;
      bindPasswordToggles(document);
      const form = document.getElementById("reset-form");
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearErrors(form);
        const data = new FormData(form);
        const password = String(data.get("password") || "");
        const confirm = String(data.get("confirm") || "");
        let valid = true;
        const problem = validatePassword(password);
        if (problem) {
          fieldError(form, "password", problem);
          valid = false;
        }
        if (password !== confirm) {
          fieldError(form, "confirm", "As senhas não conferem.");
          valid = false;
        }
        if (!valid) return;
        const button = form.querySelector('[type="submit"]');
        setBusy(button, true, "Redefinindo…");
        try {
          const result = await api.post("/api/auth/reset-password", { token, password });
          toast(result.message || "Senha redefinida.", "success");
          navigate("/entrar", { replace: true });
        } catch (error) {
          inlineError(form, error.message || "Não foi possível redefinir a senha.");
          setBusy(button, false);
        }
      });
    },
  };
}
