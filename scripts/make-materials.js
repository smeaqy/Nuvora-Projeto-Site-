"use strict";

/**
 * Gera os materiais de apoio demonstrativos referenciados pelo seed.
 *
 * Os arquivos são PDFs reais, sem dependências externas, para que os botões
 * de download do player funcionem em qualquer ambiente. Em produção, a equipe
 * pedagógica deve substituir estes arquivos pelos materiais oficiais.
 *
 * Uso: npm run materials
 */

const fs = require("node:fs");
const path = require("node:path");

const OUTPUT_DIR = path.resolve(__dirname, "..", "public", "assets", "materials");

const COLORS = {
  navy: [0.016, 0.114, 0.263],
  blue: [0.043, 0.22, 0.53],
  ink: [0.05, 0.1, 0.2],
  muted: [0.36, 0.42, 0.53],
  line: [0.85, 0.89, 0.94],
  white: [1, 1, 1],
};

function escapeText(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r?\n/g, " ");
}

function textWidth(text, size, bold = false) {
  // Largura média conservadora para Helvetica, suficiente para quebra de linha.
  return String(text).length * size * (bold ? 0.54 : 0.5);
}

function wrap(text, size, maxWidth, bold = false) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate, size, bold) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

class Pdf {
  constructor({ title, subject }) {
    this.title = title;
    this.subject = subject;
    this.pages = [];
    this.current = null;
  }

  addPage() {
    this.current = { ops: [] };
    this.pages.push(this.current);
    return this;
  }

  op(command) {
    this.current.ops.push(command);
    return this;
  }

  rect(x, y, w, h, color) {
    const [r, g, b] = color;
    return this.op(`${r} ${g} ${b} rg ${x} ${y} ${w} ${h} re f`);
  }

  text(value, x, y, { size = 11, bold = false, color = COLORS.ink } = {}) {
    const [r, g, b] = color;
    return this.op(
      `BT ${r} ${g} ${b} rg /${bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${escapeText(value)}) Tj ET`
    );
  }

  paragraph(value, x, y, { size = 11, bold = false, color = COLORS.ink, maxWidth = 483, leading = 17 } = {}) {
    let cursor = y;
    for (const line of wrap(value, size, maxWidth, bold)) {
      this.text(line, x, cursor, { size, bold, color });
      cursor -= leading;
    }
    return cursor;
  }

  header() {
    this.rect(0, 782, 595, 60, COLORS.blue);
    this.text("BrasilTec Educação", 56, 812, { size: 17, bold: true, color: COLORS.white });
    this.text("ENSINO A DISTÂNCIA", 56, 795, { size: 8, bold: false, color: [0.78, 0.87, 1] });
    this.text(this.title, 56, 748, { size: 22, bold: true, color: COLORS.navy });
    this.text(this.subject, 56, 728, { size: 10, color: COLORS.muted });
    this.rect(56, 714, 483, 1, COLORS.line);
    return 690;
  }

  footer(pageNumber, total) {
    this.rect(56, 56, 483, 1, COLORS.line);
    this.text("Material demonstrativo — BrasilTec Educação", 56, 40, { size: 8, color: COLORS.muted });
  }

  build() {
    const total = this.pages.length;
    this.pages.forEach((page, index) => {
      page.ops.push(
        `BT 0.36 0.42 0.53 rg /F1 8 Tf 1 0 0 1 470 40 Tm (Página ${index + 1} de ${total}) Tj ET`
      );
    });

    const objects = [];
    const add = (content) => {
      objects.push(content);
      return objects.length;
    };

    const catalogId = add("<< /Type /Catalog /Pages 2 0 R >>");
    const pagesId = add("__PAGES__");
    const fontRegular = add(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
    );
    const fontBold = add(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"
    );

    const pageIds = [];
    for (const page of this.pages) {
      const stream = page.ops.join("\n");
      const contentId = add(
        `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`
      );
      const pageId = add(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentId} 0 R >>`
      );
      pageIds.push(pageId);
    }
    objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

    const chunks = [];
    const offsets = [0];
    let position = 0;
    const push = (value) => {
      const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value, "latin1");
      chunks.push(buffer);
      position += buffer.length;
    };

    push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
    objects.forEach((object, index) => {
      offsets.push(position);
      push(`${index + 1} 0 obj\n${object}\nendobj\n`);
    });
    const xrefStart = position;
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objects.length; i++) {
      xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    }
    push(xref);
    push(
      `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info << /Title (${escapeText(this.title)}) /Author (BrasilTec Educação) /Subject (${escapeText(this.subject)}) >> >>\nstartxref\n${xrefStart}\n%%EOF\n`
    );
    return Buffer.concat(chunks);
  }
}

function buildGuide() {
  const pdf = new Pdf({
    title: "Guia de estudos da aula",
    subject: "Material de apoio demonstrativo para acompanhar as aulas na plataforma.",
  });

  pdf.addPage();
  let y = pdf.header();
  y = pdf.paragraph(
    "Este guia reúne uma sugestão de rotina de estudos para ajudar você a aproveitar melhor as aulas da BrasilTec Educação. O conteúdo é demonstrativo e será substituído pelo material oficial de cada curso.",
    56,
    y,
    { maxWidth: 483, leading: 18 }
  );

  y -= 14;
  pdf.text("1. Antes da aula", 56, y, { size: 14, bold: true, color: COLORS.navy });
  y -= 24;
  for (const item of [
    "Reserve um horário fixo na semana e um ambiente tranquilo para estudar.",
    "Verifique sua conexão e o volume do dispositivo antes de iniciar o vídeo.",
    "Leia o título e a descrição da aula para saber o que esperar.",
  ]) {
    pdf.rect(58, y + 4, 4, 4, COLORS.blue);
    y = pdf.paragraph(item, 70, y, { maxWidth: 460, leading: 17 }) - 4;
  }

  y -= 10;
  pdf.text("2. Durante a aula", 56, y, { size: 14, bold: true, color: COLORS.navy });
  y -= 24;
  for (const item of [
    "Assista ao vídeo uma vez sem pausas para compreender o contexto geral.",
    "Na segunda vez, pause nos pontos importantes e registre anotações na aba “Anotações”.",
    "Anote dúvidas específicas para revisar depois ou levar ao suporte.",
  ]) {
    pdf.rect(58, y + 4, 4, 4, COLORS.blue);
    y = pdf.paragraph(item, 70, y, { maxWidth: 460, leading: 17 }) - 4;
  }

  y -= 10;
  pdf.text("3. Depois da aula", 56, y, { size: 14, bold: true, color: COLORS.navy });
  y -= 24;
  for (const item of [
    "Baixe os materiais complementares disponíveis na aba “Materiais”.",
    "Marque a aula como concluída somente após assistir e revisar o conteúdo.",
    "Avance para a próxima aula mantendo o ritmo que funciona para você.",
  ]) {
    pdf.rect(58, y + 4, 4, 4, COLORS.blue);
    y = pdf.paragraph(item, 70, y, { maxWidth: 460, leading: 17 }) - 4;
  }

  y -= 20;
  pdf.rect(56, y - 56, 483, 72, [0.945, 0.969, 1]);
  pdf.text("Lembrete", 70, y - 2, { size: 11, bold: true, color: COLORS.blue });
  pdf.paragraph(
    "O progresso é salvo na sua conta. Você pode retomar os estudos de onde parou em qualquer dispositivo.",
    70,
    y - 20,
    { size: 10, color: COLORS.ink, maxWidth: 450, leading: 15 }
  );
  pdf.footer(1, 2);

  pdf.addPage();
  y = pdf.header();
  y = pdf.paragraph(
    "Use este espaço para organizar suas metas de estudo. A plataforma registra automaticamente as aulas concluídas e o percentual de progresso de cada curso.",
    56,
    y,
    { maxWidth: 483, leading: 18 }
  );

  y -= 18;
  pdf.text("Minha rotina de estudos", 56, y, { size: 14, bold: true, color: COLORS.navy });
  y -= 30;
  for (const label of ["Dias e horários reservados", "Curso e módulo atual", "Meta para esta semana", "Dúvidas para revisar"]) {
    pdf.text(label, 56, y, { size: 10, bold: true, color: COLORS.ink });
    pdf.rect(56, y - 26, 483, 0.8, COLORS.line);
    pdf.rect(56, y - 50, 483, 0.8, COLORS.line);
    y -= 72;
  }

  y -= 6;
  pdf.text("Checklist da semana", 56, y, { size: 14, bold: true, color: COLORS.navy });
  y -= 26;
  for (let i = 0; i < 6; i++) {
    pdf.rect(58, y - 1, 9, 9, COLORS.white);
    pdf.op(`0.85 0.89 0.94 RG 0.8 w 58 ${y - 1} 9 9 re S`);
    pdf.rect(70, y + 4, 430, 0.6, COLORS.line);
    y -= 24;
  }

  pdf.footer(2, 2);
  return pdf.build();
}

function buildChecklist() {
  const pdf = new Pdf({
    title: "Checklist prático",
    subject: "Lista de verificação para acompanhar sua jornada de aprendizagem.",
  });
  pdf.addPage();
  let y = pdf.header();
  y = pdf.paragraph(
    "Marque cada item concluído e mantenha o foco no seu objetivo. Este checklist é um apoio demonstrativo e pode ser adaptado à sua rotina.",
    56,
    y,
    { maxWidth: 483, leading: 18 }
  );
  y -= 16;

  const groups = [
    ["Antes de começar", ["Conta criada e e-mail confirmado", "Curso escolhido e matrícula concluída", "Materiais da primeira aula baixados"]],
    ["Durante o curso", ["Assistir às aulas do módulo atual", "Registrar anotações das aulas", "Concluir as atividades propostas"]],
    ["Antes de finalizar", ["Revisar os conteúdos principais", "Realizar a avaliação, quando houver", "Conferir o percentual de progresso"]],
  ];

  for (const [title, items] of groups) {
    pdf.text(title, 56, y, { size: 13, bold: true, color: COLORS.navy });
    y -= 24;
    for (const item of items) {
      pdf.rect(58, y - 1, 9, 9, COLORS.white);
      pdf.op(`0.85 0.89 0.94 RG 0.8 w 58 ${y - 1} 9 9 re S`);
      y = pdf.paragraph(item, 78, y, { maxWidth: 455, leading: 16 }) - 6;
    }
    y -= 14;
  }

  y -= 6;
  pdf.rect(56, y - 44, 483, 56, [0.945, 0.969, 1]);
  pdf.text("Próximo passo", 70, y - 2, { size: 11, bold: true, color: COLORS.blue });
  pdf.paragraph(
    "Ao concluir os critérios do curso, verifique a área de certificados da sua conta.",
    70,
    y - 20,
    { size: 10, maxWidth: 450, leading: 15 }
  );
  pdf.footer(1, 1);
  return pdf.build();
}

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const files = [
    ["guia-de-estudos.pdf", buildGuide()],
    ["checklist.pdf", buildChecklist()],
  ];
  for (const [name, buffer] of files) {
    const target = path.join(OUTPUT_DIR, name);
    fs.writeFileSync(target, buffer);
    console.log(`[materiais] ${name} — ${(buffer.length / 1024).toFixed(1)} KB`);
  }
}

if (require.main === module) main();

module.exports = { main };
