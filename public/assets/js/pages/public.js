/* BrasilTec Educação — páginas públicas institucionais */

import { api } from "../api.js";
import {
  esc,
  icon,
  courseCard,
  formatDate,
  toast,
  setBusy,
  clearErrors,
  fieldError,
} from "../ui.js";
import { pageHero, alertBox, certificateHtml, bindForm } from "./shared.js";

async function loadConfig() {
  return api.get("/api/public/config");
}

function paragraphs(text) {
  return String(text || "")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${esc(part).replaceAll("\n", "<br>")}</p>`)
    .join("");
}

function ctaBand({ title, text, primary = { href: "/cursos", label: "Ver cursos" }, secondary = { href: "/contato", label: "Falar com a equipe" } }) {
  return `
    <section class="section">
      <div class="container">
        <div class="cta-band">
          <div>
            <h2>${esc(title)}</h2>
            <p>${esc(text)}</p>
          </div>
          <div class="cta-band__actions">
            <a class="btn btn--white btn--lg" href="${esc(primary.href)}">${esc(primary.label)} ${icon("arrow-right", 18)}</a>
            <a class="btn btn--outline btn--lg" href="${esc(secondary.href)}" style="border-color:rgba(255,255,255,.35);color:#fff">${esc(secondary.label)}</a>
          </div>
        </div>
      </div>
    </section>`;
}

function faqList(faqs) {
  return `<div class="faq-list">${faqs
    .map(
      (faq, index) => `
      <details class="faq-item" ${index === 0 ? "open" : ""}>
        <summary>${esc(faq.question)}</summary>
        <div class="faq-item__body">${esc(faq.answer).replaceAll("\n", "<br>")}</div>
      </details>`
    )
    .join("")}</div>`;
}

function testimonialsSection(items) {
  if (items && items.length) {
    return `
      <div class="grid grid--3">
        ${items
          .map(
            (item) => `
            <article class="testimonial-card">
              <div>${icon("message", 22)}</div>
              <p>“${esc(item.quote)}”</p>
              <div class="testimonial-card__author">
                <span class="testimonial-card__avatar">${esc(
                  String(item.student_name || "A")
                    .split(/\s+/)
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()
                )}</span>
                <div><strong>${esc(item.student_name)}</strong><span>${esc(item.course_name || "Aluno BrasilTec")}</span></div>
              </div>
            </article>`
          )
          .join("")}
      </div>`;
  }
  return `
    <div class="testimonial-empty">
      <div class="testimonial-empty__quote" aria-hidden="true">“</div>
      <div>
        <h3>Depoimentos reais em breve</h3>
        <p>Este espaço será preenchido somente com depoimentos de alunos reais, publicados com autorização. Não utilizamos relatos fictícios nem indicadores inventados.</p>
      </div>
      <a class="btn btn--outline btn--sm" href="/contato">Quero compartilhar</a>
    </div>`;
}

/* --------------------------------- Início -------------------------------- */

export async function home() {
  const data = await loadConfig();
  const settings = data.settings || {};
  const courses = data.featuredCourses || [];
  const categories = (data.categories || []).slice(0, 6);
  const faqs = (data.faqs || []).slice(0, 5);

  return {
    title: "Início",
    documentTitle: `${settings.site_name || "BrasilTec Educação"} — ${settings.site_tagline || "Ensino a distância"}`,
    description: settings.hero_subtitle || "Cursos técnicos e profissionalizantes a distância.",
    html: `
      <section class="hero">
        <div class="hero-ring" aria-hidden="true"></div>
        <div class="container hero-grid">
          <div class="hero-copy">
            <span class="eyebrow">${esc(settings.hero_eyebrow || "Cursos técnicos e profissionalizantes • 100% EAD")}</span>
            <h1 class="hero-title">${esc(settings.hero_title || "Seu próximo passo começa com o conhecimento.")}</h1>
            <p class="lead">${esc(settings.hero_subtitle || "Aprenda no seu ritmo e amplie suas oportunidades.")}</p>
            <div class="hero-actions">
              <a class="btn btn--primary btn--lg" href="/cursos">${icon("book-open", 19)} Explorar cursos</a>
              <a class="btn btn--outline btn--lg" href="/como-funciona">Como funciona</a>
            </div>
            <div class="hero-points">
              <div class="hero-point">${icon("check-circle", 18)}<span>Estude 100% online, no seu ritmo</span></div>
              <div class="hero-point">${icon("check-circle", 18)}<span>Trilhas organizadas por módulos e aulas</span></div>
              <div class="hero-point">${icon("check-circle", 18)}<span>Acompanhe seu progresso na área do aluno</span></div>
            </div>
          </div>
          <div class="hero-visual">
            <div class="hero-photo">
              <img src="/assets/img/hero-study.jpg" alt="Estudante em ambiente de estudo a distância" width="720" height="820" fetchpriority="high">
            </div>
            <div class="hero-float hero-float--top">
              <span class="hero-float__icon">${icon("monitor", 18)}</span>
              <div><strong>100% online</strong><span>Estude de onde estiver</span></div>
            </div>
            <div class="hero-float hero-float--bottom">
              <span class="hero-float__icon hero-float__icon--green">${icon("award", 18)}</span>
              <div><strong>Certificado digital</strong><span>Com código de verificação</span></div>
            </div>
          </div>
        </div>
      </section>

      <section class="trust-band" aria-label="Diferenciais da plataforma">
        <div class="container">
          <div class="trust-band__inner">
            <div class="trust-item"><span class="trust-item__icon">${icon("monitor", 20)}</span><div><strong>Aulas online</strong><span>Conteúdo disponível na plataforma</span></div></div>
            <div class="trust-item"><span class="trust-item__icon">${icon("clock", 20)}</span><div><strong>Flexibilidade</strong><span>Organize seus estudos</span></div></div>
            <div class="trust-item"><span class="trust-item__icon">${icon("shield", 20)}</span><div><strong>Ambiente seguro</strong><span>Acesso individual e protegido</span></div></div>
            <div class="trust-item"><span class="trust-item__icon">${icon("certificate", 20)}</span><div><strong>Certificação</strong><span>Quando prevista no curso</span></div></div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="section-head">
            <div class="section-head__text">
              <span class="eyebrow">Áreas de estudo</span>
              <h2>Encontre a formação que combina com você</h2>
              <p>Navegue por categorias e conheça as trilhas disponíveis na plataforma.</p>
            </div>
            <a class="link-arrow" href="/cursos">Ver catálogo completo ${icon("arrow-right", 16)}</a>
          </div>
          <div class="category-grid">
            ${categories
              .map(
                (category) => `
                <a class="category-card" href="/cursos?category=${encodeURIComponent(category.slug)}">
                  <span class="category-card__icon">${icon(category.icon || "graduation", 22)}</span>
                  <strong>${esc(category.name)}</strong>
                  <span>${esc(category.description || "Conheça os cursos desta área")}</span>
                  <span class="link-arrow">Ver cursos ${icon("arrow-right", 14)}</span>
                </a>`
              )
              .join("")}
          </div>
        </div>
      </section>

      <section class="section section--soft">
        <div class="container">
          <div class="section-head">
            <div class="section-head__text">
              <span class="eyebrow">Cursos em destaque</span>
              <h2>Comece por uma das formações</h2>
              <p>Valores, cargas horárias e conteúdos exibidos são demonstrativos nesta versão.</p>
            </div>
            <a class="link-arrow" href="/cursos">Todos os cursos ${icon("arrow-right", 16)}</a>
          </div>
          <div class="course-grid">${courses.map(courseCard).join("")}</div>
        </div>
      </section>

      <section class="section">
        <div class="container split">
          <div class="split-media">
            <img src="/assets/img/about.jpg" alt="Equipe em ambiente de aprendizagem" width="720" height="560" loading="lazy">
            <span class="split-media__badge">${icon("graduation", 16)} Educação que aproxima</span>
          </div>
          <div class="split-copy">
            <span class="eyebrow">Sobre a BrasilTec</span>
            <h2>${esc(settings.about_title || "Conhecimento que transforma vidas e realiza sonhos.")}</h2>
            ${paragraphs(settings.about_text || "")}
            <div class="cluster">
              <a class="btn btn--primary" href="/sobre">Conhecer a instituição</a>
              <a class="btn btn--ghost" href="/contato">Falar com a equipe</a>
            </div>
          </div>
        </div>
      </section>

      <section class="section section--soft">
        <div class="container">
          <div class="section-head">
            <div class="section-head__text">
              <span class="eyebrow">Como funciona</span>
              <h2>Uma jornada simples, do cadastro ao certificado</h2>
            </div>
          </div>
          <div class="steps">
            <article class="step-card"><span class="step-card__num">1</span><h3>Escolha seu curso</h3><p>Explore o catálogo, leia os detalhes e confira os critérios de conclusão.</p></article>
            <article class="step-card"><span class="step-card__num">2</span><h3>Crie sua conta</h3><p>Cadastre-se com seus dados e acesse a área do aluno.</p></article>
            <article class="step-card"><span class="step-card__num">3</span><h3>Estude no seu ritmo</h3><p>Assista às aulas, consulte materiais e registre suas anotações.</p></article>
            <article class="step-card"><span class="step-card__num">4</span><h3>Conclua e certifique</h3><p>Cumpra os critérios do curso e emita o certificado, quando disponível.</p></article>
          </div>
          <div class="text-center" style="margin-top:28px">
            <a class="btn btn--outline" href="/como-funciona">Entender o passo a passo ${icon("arrow-right", 16)}</a>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="section-head">
            <div class="section-head__text">
              <span class="eyebrow">Depoimentos</span>
              <h2>Quem estuda com a BrasilTec</h2>
            </div>
          </div>
          ${testimonialsSection(data.testimonials)}
        </div>
      </section>

      <section class="section section--soft">
        <div class="container">
          <div class="section-head">
            <div class="section-head__text">
              <span class="eyebrow">Dúvidas frequentes</span>
              <h2>Informação clara antes de começar</h2>
            </div>
            <a class="link-arrow" href="/faq">Ver todas as perguntas ${icon("arrow-right", 16)}</a>
          </div>
          ${faqList(faqs)}
        </div>
      </section>

      ${ctaBand({
        title: "Pronto para dar o próximo passo?",
        text: "Conheça os cursos disponíveis e encontre uma formação alinhada aos seus objetivos.",
        primary: { href: "/cursos", label: "Explorar catálogo" },
        secondary: { href: "/contato", label: "Tirar dúvidas" },
      })}
    `,
  };
}

/* --------------------------------- Sobre --------------------------------- */

export async function about() {
  const data = await loadConfig();
  const settings = data.settings || {};
  return {
    title: "Sobre a BrasilTec",
    description: "Conheça a história, os valores e o compromisso da BrasilTec Educação com a educação a distância.",
    html: `
      ${pageHero({
        eyebrow: "Institucional",
        title: "Uma marca construída para transformar vidas por meio do conhecimento",
        text: settings.about_title || "Conhecimento que transforma vidas e realiza sonhos.",
      })}
      <section class="section">
        <div class="container split">
          <div class="split-copy">
            <span class="eyebrow">Nossa história</span>
            <h2>Educação com propósito</h2>
            ${paragraphs(settings.about_text || "")}
            <div class="notice notice--info">
              ${icon("info", 18)}
              <div>${esc(settings.institutional_note || "")}</div>
            </div>
          </div>
          <div class="split-media split--reverse">
            <img src="/assets/img/about.jpg" alt="Ambiente de estudo e colaboração" width="720" height="560" loading="lazy">
          </div>
        </div>
      </section>

      <section class="section section--soft">
        <div class="container">
          <div class="section-head">
            <div class="section-head__text">
              <span class="eyebrow">Nossos valores</span>
              <h2>O que orienta o nosso trabalho</h2>
            </div>
          </div>
          <div class="grid grid--3">
            <div class="feature-item"><span class="feature-item__icon">${icon("target", 22)}</span><h3>Clareza</h3><p>Informações objetivas sobre cursos, critérios de conclusão e certificação antes da matrícula.</p></div>
            <div class="feature-item"><span class="feature-item__icon">${icon("shield", 22)}</span><h3>Confiança</h3><p>Compromisso com a segurança dos dados e com a transparência em cada etapa da jornada.</p></div>
            <div class="feature-item"><span class="feature-item__icon">${icon("sparkles", 22)}</span><h3>Oportunidade</h3><p>Educação a distância como caminho para desenvolver habilidades e ampliar possibilidades profissionais.</p></div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="panel">
            <div class="panel__head">
              <div>
                <span class="eyebrow">Transparência</span>
                <h2>Informações institucionais</h2>
              </div>
            </div>
            <div class="panel__body stack">
              <p class="muted">A BrasilTec Educação divulga em seu perfil oficial que oferece cursos técnicos, formações profissionalizantes e pós-graduação. Nesta versão demonstrativa da plataforma, os cursos e valores apresentados são exemplos para validação do ambiente.</p>
              <p class="muted">${esc(settings.institutional_note || "")}</p>
              <p class="muted">${esc(settings.support_text || "")}</p>
            </div>
            <div class="panel__footer">
              <a class="btn btn--primary btn--sm" href="/cursos">Conhecer os cursos</a>
              <a class="btn btn--outline btn--sm" href="${esc(settings.contact_instagram || "https://www.instagram.com/brasilteceducacao/")}" target="_blank" rel="noopener noreferrer">${icon("instagram", 15)} Instagram oficial</a>
            </div>
          </div>
        </div>
      </section>

      ${ctaBand({
        title: "Venha conhecer a BrasilTec",
        text: "Explore as formações disponíveis e fale com a equipe para esclarecer suas dúvidas.",
      })}
    `,
  };
}

/* ------------------------------ Como funciona ----------------------------- */

export async function howItWorks() {
  const data = await loadConfig();
  const settings = data.settings || {};
  return {
    title: "Como funciona",
    description: "Entenda como estudar na plataforma da BrasilTec Educação: cadastro, cursos, aulas, avaliações e certificados.",
    html: `
      ${pageHero({
        eyebrow: "Passo a passo",
        title: "Como funciona a plataforma",
        text: "Uma experiência de aprendizagem organizada para você estudar com autonomia e acompanhar sua evolução.",
      })}
      <section class="section">
        <div class="container">
          <div class="steps">
            <article class="step-card"><span class="step-card__num">1</span><h3>Explore o catálogo</h3><p>Use a busca e os filtros para encontrar cursos por área, nível, modalidade e preço.</p></article>
            <article class="step-card"><span class="step-card__num">2</span><h3>Confira os detalhes</h3><p>Leia a descrição, os objetivos, a carga horária, o conteúdo programático e os critérios de conclusão.</p></article>
            <article class="step-card"><span class="step-card__num">3</span><h3>Crie sua conta</h3><p>O cadastro é gratuito. Você recebe acesso individual à área do aluno.</p></article>
            <article class="step-card"><span class="step-card__num">4</span><h3>Matricule-se</h3><p>Prossiga para a matrícula. Cursos gratuitos liberam o acesso imediatamente; cursos pagos seguem para o checkout.</p></article>
            <article class="step-card"><span class="step-card__num">5</span><h3>Estude e pratique</h3><p>Assista às aulas, baixe materiais, registre anotações e realize a avaliação quando prevista.</p></article>
            <article class="step-card"><span class="step-card__num">6</span><h3>Conclua</h3><p>Ao cumprir os critérios, o curso é concluído e o certificado pode ser emitido, se habilitado.</p></article>
          </div>
        </div>
      </section>

      <section class="section section--soft">
        <div class="container split">
          <div class="split-copy">
            <span class="eyebrow">Aprendizagem online</span>
            <h2>Você no controle do seu ritmo</h2>
            <p class="muted">As aulas ficam disponíveis na plataforma e o progresso é salvo automaticamente. Você pode retomar de onde parou, rever conteúdos e consultar seus materiais.</p>
            <div class="feature-list">
              <div class="feature-item"><span class="feature-item__icon">${icon("play", 20)}</span><div><strong>Aulas em vídeo</strong><p>Player integrado com navegação entre aulas e marcação de conclusão.</p></div></div>
              <div class="feature-item"><span class="feature-item__icon">${icon("file-text", 20)}</span><div><strong>Materiais de apoio</strong><p>Arquivos complementares anexados às aulas, quando disponíveis.</p></div></div>
              <div class="feature-item"><span class="feature-item__icon">${icon("edit", 20)}</span><div><strong>Anotações pessoais</strong><p>Espaço para registrar ideias e revisar o conteúdo depois.</p></div></div>
              <div class="feature-item"><span class="feature-item__icon">${icon("clipboard", 20)}</span><div><strong>Avaliações</strong><p>Questões de múltipla escolha ou verdadeiro/falso com feedback.</p></div></div>
            </div>
          </div>
          <div class="split-media">
            <img src="/assets/img/hero-study.jpg" alt="Pessoa estudando em um notebook" width="720" height="560" loading="lazy">
            <span class="split-media__badge">${icon("clock", 16)} Estude quando puder</span>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="section-head">
            <div class="section-head__text">
              <span class="eyebrow">Certificação</span>
              <h2>Certificado com verificação pública</h2>
              <p>Quando o curso prevê certificado, a emissão acontece após o cumprimento dos critérios definidos. Cada certificado recebe um código único que pode ser consultado na página de verificação.</p>
            </div>
          </div>
          <div class="grid grid--2">
            <div class="panel"><div class="panel__body">
              <h3>O que é verificado</h3>
              <ul class="verify-list">
                <li>Nome do aluno e do curso</li>
                <li>Carga horária registrada</li>
                <li>Data de emissão</li>
                <li>Código único do certificado</li>
              </ul>
            </div></div>
            <div class="panel"><div class="panel__body">
              <h3>Informação importante</h3>
              <p class="muted">${esc(settings.institutional_note || "")}</p>
              <a class="btn btn--outline btn--sm" href="/verificar-certificado">Verificar um certificado</a>
            </div></div>
          </div>
        </div>
      </section>

      ${ctaBand({
        title: "Comece agora",
        text: "Crie sua conta gratuitamente e escolha o primeiro curso da sua trilha.",
        primary: { href: "/cadastrar", label: "Criar conta" },
        secondary: { href: "/cursos", label: "Ver cursos" },
      })}
    `,
  };
}

/* --------------------------------- Contato -------------------------------- */

export async function contact() {
  const data = await loadConfig();
  const settings = data.settings || {};
  const instagram = settings.contact_instagram || "https://www.instagram.com/brasilteceducacao/";
  return {
    title: "Contato",
    description: "Fale com a BrasilTec Educação pelo Instagram oficial ou pelo formulário de contato.",
    html: `
      ${pageHero({
        eyebrow: "Fale com a gente",
        title: "Estamos por aqui para ajudar",
        text: "Envie sua dúvida sobre cursos, matrícula, acesso à plataforma ou certificados.",
      })}
      <section class="section">
        <div class="container contact-grid">
          <div class="contact-info">
            <h2>Canais de atendimento</h2>
            <p class="muted">${esc(settings.support_text || "")}</p>
            <div class="contact-item">
              <span class="contact-item__icon">${icon("instagram", 20)}</span>
              <div><strong>Instagram oficial</strong><a href="${esc(instagram)}" target="_blank" rel="noopener noreferrer">@brasilteceducacao</a></div>
            </div>
            ${
              settings.contact_email
                ? `<div class="contact-item"><span class="contact-item__icon">${icon("mail", 20)}</span><div><strong>E-mail</strong><a href="mailto:${esc(settings.contact_email)}">${esc(settings.contact_email)}</a></div></div>`
                : ""
            }
            ${
              settings.contact_phone
                ? `<div class="contact-item"><span class="contact-item__icon">${icon("phone", 20)}</span><div><strong>Telefone</strong><a href="tel:${esc(settings.contact_phone.replace(/[^\d+]/g, ""))}">${esc(settings.contact_phone)}</a></div></div>`
                : ""
            }
            <div class="contact-item">
              <span class="contact-item__icon">${icon("clock", 20)}</span>
              <div><strong>Horário</strong><span>${esc(settings.contact_hours || "Atendimento pelos canais oficiais.")}</span></div>
            </div>
            <div class="notice notice--info">
              ${icon("shield", 18)}
              <div>Seus dados são usados apenas para responder a esta solicitação. Consulte a <a href="/privacidade">Política de Privacidade</a>.</div>
            </div>
          </div>
          <div class="panel">
            <div class="panel__head">
              <div><h2>Envie uma mensagem</h2><p class="muted small">Preencha os campos abaixo. Responderemos pelos canais informados.</p></div>
            </div>
            <div class="panel__body">
              <form class="contact-form" id="contact-form" novalidate>
                <div data-form-feedback hidden></div>
                <div class="form-grid">
                  <div class="field">
                    <label class="field-label" for="contact-name">Seu nome *</label>
                    <input class="input" id="contact-name" name="name" required maxlength="120" autocomplete="name">
                  </div>
                  <div class="field">
                    <label class="field-label" for="contact-email">E-mail *</label>
                    <input class="input" id="contact-email" name="email" type="email" required maxlength="180" autocomplete="email">
                  </div>
                  <div class="field">
                    <label class="field-label" for="contact-phone">Telefone / WhatsApp</label>
                    <input class="input" id="contact-phone" name="phone" maxlength="40" autocomplete="tel">
                  </div>
                  <div class="field">
                    <label class="field-label" for="contact-subject">Assunto</label>
                    <input class="input" id="contact-subject" name="subject" maxlength="160">
                  </div>
                  <div class="field" style="grid-column:1/-1">
                    <label class="field-label" for="contact-message">Mensagem *</label>
                    <textarea class="textarea" id="contact-message" name="message" rows="6" required minlength="10" maxlength="4000"></textarea>
                    <p class="field-hint">Não envie dados sensíveis ou informações de cartão por este formulário.</p>
                  </div>
                </div>
                <div class="between" style="gap:16px;flex-wrap:wrap">
                  <label class="checkbox">
                    <input type="checkbox" name="acceptTerms" value="1" required>
                    <span>Li e concordo com a <a href="/privacidade">Política de Privacidade</a>.</span>
                  </label>
                  <button type="submit" class="btn btn--primary">${icon("send", 17)} Enviar mensagem</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>
    `,
    mount() {
      const form = document.getElementById("contact-form");
      bindForm(
        form,
        async (data) => api.post("/api/public/contact", data),
        {
          submitLabel: "Enviando…",
          onSuccess(result) {
            form.reset();
            clearErrors(form);
            toast(result.message || "Mensagem enviada.", "success");
            const feedback = form.querySelector("[data-form-feedback]");
            if (feedback) {
              feedback.innerHTML = alertBox(result.message || "Mensagem recebida.", "success");
              feedback.hidden = false;
            }
          },
        }
      );
      form?.addEventListener("input", (event) => {
        const field = event.target.closest(".field");
        if (field?.classList.contains("has-error")) {
          field.classList.remove("has-error");
          field.querySelector(".field-error")?.remove();
        }
      });
    },
  };
}

/* ----------------------------------- FAQ ---------------------------------- */

export async function faq() {
  const data = await loadConfig();
  return {
    title: "Perguntas frequentes",
    description: "Respostas para as dúvidas mais comuns sobre cursos, matrícula, acesso, avaliações e certificados.",
    html: `
      ${pageHero({
        eyebrow: "Central de ajuda",
        title: "Perguntas frequentes",
        text: "Reunimos as dúvidas mais comuns sobre a plataforma e os cursos.",
      })}
      <section class="section">
        <div class="container container--narrow">
          ${faqList(data.faqs || [])}
          <div class="notice notice--info" style="margin-top:24px">
            ${icon("help", 18)}
            <div>Não encontrou sua resposta? <a href="/contato">Fale com a equipe</a> ou envie uma mensagem pelo <a href="${esc(data.settings?.contact_instagram || "https://www.instagram.com/brasilteceducacao/")}" target="_blank" rel="noopener noreferrer">Instagram oficial</a>.</div>
          </div>
        </div>
      </section>
      <section class="section section--soft">
        <div class="container">
          <div class="cta-band">
            <div><h2>Ainda com dúvidas?</h2><p>Envie sua pergunta e receba orientação sobre o curso de interesse.</p></div>
            <div class="cta-band__actions">
              <a class="btn btn--white" href="/contato">${icon("message", 17)} Falar com a equipe</a>
              <a class="btn btn--outline" href="/cursos" style="border-color:rgba(255,255,255,.35);color:#fff">Ver cursos</a>
            </div>
          </div>
        </div>
      </section>
    `,
  };
}

/* --------------------------- Verificar certificado ----------------------- */

function verifyResult(certificate) {
  return `
    <div class="verify-result">
      <div class="verify-result__head">
        <span class="verify-result__icon">${icon("check-circle", 24)}</span>
        <div><h3>Certificado autêntico</h3><p class="small muted">Este código corresponde a um certificado emitido pela BrasilTec Educação.</p></div>
      </div>
      <div class="verify-list">
        <div><span>Aluno</span><strong>${esc(certificate.studentName)}</strong></div>
        <div><span>Curso</span><strong>${esc(certificate.courseName)}</strong></div>
        <div><span>Carga horária</span><strong>${esc(certificate.hours)} h</strong></div>
        <div><span>Emissão</span><strong>${esc(formatDate(certificate.issuedAt))}</strong></div>
        <div><span>Código</span><strong class="mono">${esc(certificate.code)}</strong></div>
      </div>
      <a class="btn btn--primary btn--sm" href="/certificado/${encodeURIComponent(certificate.code)}">${icon("certificate", 16)} Abrir certificado</a>
    </div>`;
}

export async function verify(ctx) {
  const code = (ctx.query.get("codigo") || "").trim();
  let resultHtml = "";
  let error = "";
  let certificate = null;
  if (code) {
    try {
      certificate = (await api.get(`/api/public/certificates/${encodeURIComponent(code)}`)).certificate;
      resultHtml = verifyResult(certificate);
    } catch (err) {
      error = err.message || "Certificado não encontrado.";
      resultHtml = `
        <div class="verify-result">
          <div class="verify-result__head">
            <span class="verify-result__icon verify-result__icon--error">${icon("x-circle", 24)}</span>
            <div><h3>Não foi possível verificar</h3><p class="small muted">${esc(error)}</p></div>
          </div>
          <p class="small muted">Confira se o código foi digitado corretamente. Ele costuma ter o formato <strong class="mono">BTE-AAAA-XXXXXX</strong>.</p>
        </div>`;
    }
  }
  return {
    title: "Verificar certificado",
    description: "Consulte a autenticidade de um certificado emitido pela plataforma BrasilTec Educação.",
    html: `
      ${pageHero({
        eyebrow: "Validação pública",
        title: "Verifique um certificado",
        text: "Digite o código impresso no certificado para confirmar a autenticidade dos dados.",
      })}
      <section class="section">
        <div class="container verify-grid">
          <div class="panel">
            <div class="panel__head"><div><h2>Consulta por código</h2></div></div>
            <div class="panel__body">
              <form class="verify-form" data-verify-form>
                <div class="field">
                  <label class="field-label" for="cert-code">Código do certificado</label>
                  <input class="input mono" id="cert-code" name="codigo" value="${esc(code)}" placeholder="BTE-AAAA-XXXXXX" required autocomplete="off" spellcheck="false">
                </div>
                <button type="submit" class="btn btn--primary">${icon("search", 17)} Verificar autenticidade</button>
              </form>
              <div class="notice notice--info" style="margin-top:18px">
                ${icon("shield", 18)}
                <div>A consulta é pública e não exige login. Nenhum dado além do necessário para a validação é exibido.</div>
              </div>
            </div>
          </div>
          <div>${resultHtml || `<div class="panel"><div class="panel__body"><div class="empty-state"><div class="empty-state__icon">${icon("certificate", 24)}</div><h3>Informe um código</h3><p>O resultado da verificação aparecerá aqui.</p></div></div></div>`}</div>
        </div>
      </section>
    `,
    mount() {
      document.querySelector("[data-verify-form]")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const value = event.target.querySelector('[name="codigo"]').value.trim();
        if (!value) {
          toast("Informe o código do certificado.", "warning");
          return;
        }
        const next = new URL(location.href);
        next.searchParams.set("codigo", value);
        location.assign(next.pathname + next.search);
      });
    },
  };
}

/* ------------------------------ Certificado ------------------------------ */

export async function certificate(ctx) {
  const code = String(ctx.params.code || "").trim();
  const certificate = (await api.get(`/api/public/certificates/${encodeURIComponent(code)}`)).certificate;
  return {
    title: `Certificado ${certificate.code}`,
    documentTitle: `Certificado de ${certificate.studentName} — BrasilTec Educação`,
    description: `Certificado de conclusão do curso ${certificate.courseName}.`,
    html: certificateHtml({
      ...certificate,
      verifyUrl: `/verificar-certificado?codigo=${encodeURIComponent(certificate.code)}`,
    }),
    mount() {
      document.querySelector("[data-print]")?.addEventListener("click", () => window.print());
    },
  };
}

/* ------------------------------ Privacidade ------------------------------ */

export async function privacy() {
  const data = await loadConfig();
  const settings = data.settings || {};
  const instagram = settings.contact_instagram || "https://www.instagram.com/brasilteceducacao/";
  return {
    title: "Política de privacidade",
    description: "Saiba como a plataforma BrasilTec Educação trata dados pessoais, cookies e direitos dos titulares.",
    html: `
      ${pageHero({
        eyebrow: "Privacidade e LGPD",
        title: "Política de privacidade",
        text: `Última atualização: ${settings.privacy_updated || "23 de outubro de 2026"}.`,
      })}
      <section class="section">
        <div class="container legal-layout">
          <nav class="legal-toc" aria-label="Índice da política">
            <strong>Nesta página</strong>
            <a href="#dados">Dados coletados</a>
            <a href="#finalidades">Finalidades</a>
            <a href="#bases">Bases legais</a>
            <a href="#compartilhamento">Compartilhamento</a>
            <a href="#retencao">Retenção</a>
            <a href="#direitos">Direitos do titular</a>
            <a href="#cookies">Cookies</a>
            <a href="#seguranca">Segurança</a>
            <a href="#contato-privacidade">Contato</a>
          </nav>
          <article class="prose">
            <div class="notice notice--warning">
              ${icon("alert", 18)}
              <div><strong>Ambiente demonstrativo.</strong> Esta política descreve o funcionamento da plataforma de demonstração. Antes de operar com dados reais, a instituição deve revisar este documento e designar um encarregado de dados.</div>
            </div>

            <h2 id="dados">1. Quais dados coletamos</h2>
            <p>Coletamos apenas os dados necessários para criar e manter sua conta, viabilizar matrículas e oferecer os recursos da plataforma:</p>
            <ul>
              <li><strong>Dados de cadastro:</strong> nome, e-mail e telefone (opcional).</li>
              <li><strong>Dados de autenticação:</strong> senha armazenada em formato criptografado e registros de sessão.</li>
              <li><strong>Dados de uso:</strong> cursos matriculados, aulas concluídas, anotações, tentativas de avaliação, certificados e pedidos.</li>
              <li><strong>Dados de contato:</strong> mensagens enviadas pelo formulário, incluindo nome, e-mail, telefone e conteúdo.</li>
              <li><strong>Dados técnicos:</strong> endereço IP, navegador e registros de acesso necessários para segurança e prevenção a fraudes.</li>
            </ul>
            <p>Não solicitamos nem armazenamos dados de cartão de crédito. Pagamentos online, quando configurados, são processados por gateway especializado.</p>

            <h2 id="finalidades">2. Para que usamos os dados</h2>
            <ul>
              <li>Criar e gerenciar sua conta e autenticar seu acesso.</li>
              <li>Registrar matrículas, progresso, avaliações e certificados.</li>
              <li>Processar pedidos e confirmar pagamentos por meio do gateway integrado.</li>
              <li>Responder solicitações de contato e prestar suporte.</li>
              <li>Enviar comunicações operacionais sobre a conta, a matrícula e a plataforma.</li>
              <li>Manter a segurança do ambiente, prevenir abusos e cumprir obrigações legais.</li>
            </ul>
            <p>Não utilizamos seus dados para finalidades incompatíveis com as descritas acima.</p>

            <h2 id="bases">3. Bases legais</h2>
            <p>O tratamento pode se apoiar nas seguintes bases previstas na Lei Geral de Proteção de Dados (Lei nº 13.709/2018):</p>
            <ul>
              <li><strong>Execução de contrato:</strong> para fornecer a conta, as matrículas e os serviços educacionais solicitados.</li>
              <li><strong>Legítimo interesse:</strong> para segurança, prevenção a fraudes e melhoria controlada da plataforma.</li>
              <li><strong>Cumprimento de obrigação legal ou regulatória:</strong> quando aplicável.</li>
              <li><strong>Consentimento:</strong> para comunicações opcionais ou tratamentos que exijam autorização específica.</li>
            </ul>

            <h2 id="compartilhamento">4. Compartilhamento</h2>
            <p>Seus dados podem ser processados por prestadores essenciais à operação, como serviços de hospedagem, envio de e-mail e gateway de pagamento, sempre limitados à finalidade contratada. Não vendemos dados pessoais.</p>
            <p>Informações acadêmicas poderão ser compartilhadas quando houver obrigação legal ou solicitação legítima de autoridade competente.</p>

            <h2 id="retencao">5. Retenção e eliminação</h2>
            <p>Mantemos os dados pelo tempo necessário ao funcionamento da conta e ao cumprimento de obrigações legais, fiscais e regulatórias. Registros acadêmicos e certificados podem ser preservados para fins de comprovação histórica.</p>
            <p>Após o prazo aplicável, os dados são eliminados ou anonimizados de forma segura, salvo hipóteses legais de conservação.</p>

            <h2 id="direitos">6. Direitos do titular</h2>
            <p>Você pode solicitar, conforme a LGPD:</p>
            <ul>
              <li>confirmação da existência de tratamento;</li>
              <li>acesso aos dados;</li>
              <li>correção de dados incompletos, inexatos ou desatualizados;</li>
              <li>anonimização, bloqueio ou eliminação de dados desnecessários;</li>
              <li>portabilidade, quando aplicável;</li>
              <li>informação sobre compartilhamentos;</li>
              <li>revogação do consentimento, quando essa for a base legal.</li>
            </ul>
            <p>Alunos autenticados podem exportar os próprios dados na área do aluno, em <strong>Perfil e dados</strong>.</p>

            <h2 id="cookies">7. Cookies e armazenamento local</h2>
            <p>Utilizamos cookies essenciais para manter a sessão autenticada e proteger as ações contra falsificações de requisição. O armazenamento local pode registrar apenas a sua preferência de aviso de cookies.</p>
            <p>Não utilizamos cookies de publicidade nesta versão da plataforma. Caso ferramentas de análise sejam adicionadas, esta política será atualizada.</p>

            <h2 id="seguranca">8. Segurança</h2>
            <p>Adotamos medidas técnicas e organizacionais para proteger os dados, como senhas com hash, sessões assinadas, controle de acesso por perfil, proteção CSRF, validação de origem e cabeçalhos de segurança.</p>
            <p>Nenhum sistema é totalmente imune a incidentes. Caso ocorra incidente relevante, adotaremos as medidas de contenção e comunicação previstas na legislação.</p>

            <h2 id="contato-privacidade">9. Como exercer seus direitos</h2>
            <p>Para solicitações relacionadas a dados pessoais, utilize o formulário de contato ou o canal oficial da instituição. Descreva sua solicitação e informe o e-mail vinculado à conta para que possamos localizar o cadastro.</p>
            <p><a class="btn btn--outline btn--sm" href="/contato">Solicitar atendimento</a> <a class="btn btn--ghost btn--sm" href="${esc(instagram)}" target="_blank" rel="noopener noreferrer">${icon("instagram", 15)} Instagram oficial</a></p>
          </article>
        </div>
      </section>
    `,
  };
}

/* --------------------------------- Termos -------------------------------- */

export async function terms() {
  return {
    title: "Termos de uso",
    description: "Condições de uso da plataforma educacional BrasilTec Educação.",
    html: `
      ${pageHero({
        eyebrow: "Condições de uso",
        title: "Termos de uso",
        text: "Leia as condições aplicáveis à utilização da plataforma demonstrativa.",
      })}
      <section class="section">
        <div class="container legal-layout">
          <nav class="legal-toc" aria-label="Índice dos termos">
            <strong>Nesta página</strong>
            <a href="#aceitacao">Aceitação</a>
            <a href="#conta">Conta e acesso</a>
            <a href="#cursos">Cursos e conteúdo</a>
            <a href="#pagamentos">Matrícula e pagamentos</a>
            <a href="#certificados">Certificados</a>
            <a href="#conduta">Conduta</a>
            <a href="#propriedade">Propriedade intelectual</a>
            <a href="#limitacao">Limitação</a>
            <a href="#contato-termos">Contato</a>
          </nav>
          <article class="prose">
            <div class="notice notice--warning">
              ${icon("alert", 18)}
              <div><strong>Documento demonstrativo.</strong> Estes termos descrevem o funcionamento desta versão de validação. A instituição deve revisá-los juridicamente antes de operar comercialmente.</div>
            </div>

            <h2 id="aceitacao">1. Aceitação</h2>
            <p>Ao criar uma conta ou utilizar a plataforma, você declara ter lido e aceitado estes Termos de Uso e a Política de Privacidade. Se não concordar, não utilize os serviços.</p>

            <h2 id="conta">2. Conta e acesso</h2>
            <p>Você é responsável pela veracidade dos dados informados e pela confidencialidade da sua senha. O acesso é pessoal e intransferível. Comunique imediatamente qualquer uso não autorizado.</p>
            <p>Podemos bloquear contas em caso de fraude, abuso, violação destes termos ou determinação legal.</p>

            <h2 id="cursos">3. Cursos e conteúdo</h2>
            <p>Os cursos, valores, cargas horárias e conteúdos exibidos nesta versão são demonstrativos e podem ser alterados. A descrição de cada curso apresenta objetivos, público, requisitos e critérios de conclusão.</p>
            <p>O conteúdo é disponibilizado para estudo individual. A instituição pode atualizar aulas e materiais para melhorar a experiência educacional.</p>

            <h2 id="pagamentos">4. Matrícula e pagamentos</h2>
            <p>Cursos gratuitos liberam o acesso imediatamente após a matrícula. Cursos pagos dependem da confirmação do pagamento ou de aprovação administrativa.</p>
            <p>Pagamentos online são processados por gateway especializado. Não armazenamos dados de cartão. A confirmação de acesso nunca depende apenas do redirecionamento do navegador: o status é validado no servidor.</p>
            <p>Cupons, quando oferecidos, possuem regras próprias de validade, limite de uso e eventual restrição. Condições de cancelamento e reembolso devem ser confirmadas diretamente com a instituição antes da compra.</p>

            <h2 id="certificados">5. Certificados</h2>
            <p>O certificado é emitido quando o curso prevê essa possibilidade e o aluno cumpre os critérios definidos, como percentual mínimo de aulas concluídas e aprovação em avaliação, quando exigida.</p>
            <p>Cada certificado recebe um código único e pode ser consultado na página pública de verificação. Reconhecimentos e exigências regulatórias devem ser confirmados diretamente com a BrasilTec Educação.</p>

            <h2 id="conduta">6. Conduta do usuário</h2>
            <p>É proibido compartilhar credenciais, copiar ou distribuir conteúdo sem autorização, tentar acessar áreas restritas, interferir na segurança da plataforma ou utilizar os serviços para fins ilícitos.</p>

            <h2 id="propriedade">7. Propriedade intelectual</h2>
            <p>Marca, identidade visual, textos, aulas, materiais e demais elementos da plataforma são protegidos pela legislação aplicável. O acesso não transfere direitos de propriedade intelectual ao usuário.</p>

            <h2 id="limitacao">8. Disponibilidade e limitação</h2>
            <p>Buscamos manter a plataforma disponível, mas podem ocorrer interrupções programadas ou falhas técnicas. Não nos responsabilizamos por indisponibilidades decorrentes de serviços de terceiros, conexão do usuário ou caso fortuito.</p>

            <h2 id="contato-termos">9. Contato</h2>
            <p>Dúvidas sobre estes termos devem ser encaminhadas pelos canais oficiais da instituição.</p>
            <p><a class="btn btn--outline btn--sm" href="/contato">Falar com a equipe</a></p>
          </article>
        </div>
      </section>
    `,
  };
}

/* --------------------------------- 404 ----------------------------------- */

export async function notFound() {
  return {
    title: "Página não encontrada",
    html: `
      <section class="section">
        <div class="container container--narrow">
          <div class="empty-state" style="padding:70px 24px">
            <div class="empty-state__icon">${icon("search", 26)}</div>
            <h2>Página não encontrada</h2>
            <p>O endereço acessado não existe ou foi movido. Você pode voltar ao início ou explorar o catálogo de cursos.</p>
            <div class="cluster" style="justify-content:center;margin-top:8px">
              <a class="btn btn--primary" href="/">Ir para o início</a>
              <a class="btn btn--outline" href="/cursos">Ver cursos</a>
            </div>
          </div>
        </div>
      </section>
    `,
  };
}
