"use strict";

const config = require("./config");
const { hashPassword } = require("./security");

function isoDaysAgo(days, hour = 10) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

async function insert(db, table, data) {
  const keys = Object.keys(data);
  const cols = keys.map((k) => `"${k}"`).join(", ");
  const params = keys.map((k) => (typeof data[k] === "boolean" ? (data[k] ? 1 : 0) : data[k]));
  const placeholders = keys.map(() => "?").join(", ");
  const result = await db.run(`INSERT INTO ${table} (${cols}) VALUES (${placeholders})`, ...params);
  return Number(result.lastInsertRowid);
}

function lessonContent(title, courseTitle) {
  return [
    `## ${title}`,
    `Esta aula faz parte do curso **${courseTitle}** e integra o ambiente de demonstração da BrasilTec Educação. O vídeo exibido é um arquivo público de exemplo, usado apenas para validar a experiência do player.`,
    `### O que você vai aprender`,
    `- Os conceitos centrais relacionados a ${title.toLowerCase()}.`,
    "- Como aplicar o conteúdo em situações reais da sua rotina profissional.",
    "- Boas práticas, pontos de atenção e próximos passos para aprofundar o estudo.",
    `### Para estudar`,
    `Leia o material complementar desta aula, registre suas anotações no campo ao lado e avance quando se sentir seguro. O progresso é salvo automaticamente na sua conta.`,
    `> Conteúdo demonstrativo. O material definitivo será cadastrado pela equipe pedagógica da BrasilTec Educação.`,
  ].join("\n\n");
}

function courseData() {
  return [
    {
      slug: "tecnico-em-transacoes-imobiliarias",
      title: "Técnico em Transações Imobiliárias",
      subtitle:
        "Desenvolva competências para atuar no mercado imobiliário, da prospecção de clientes à conclusão da negociação.",
      category: "Técnicos",
      instructor: "Núcleo de Negócios Imobiliários",
      level: "intermediario",
      duration: 1200,
      price: 189000,
      featured: 1,
      cover: "course-tti.jpg",
      requireAssessment: 1,
      description:
        "O curso Técnico em Transações Imobiliárias prepara você para compreender o funcionamento do mercado imobiliário, a documentação dos imóveis, as etapas de uma negociação e as responsabilidades profissionais da área.\n\nA formação combina fundamentos de legislação, análise documental, atendimento ao cliente e prática de negociação, com uma trilha organizada para quem deseja ampliar suas oportunidades no setor.\n\nTodo o conteúdo desta versão é demonstrativo e será substituído pelo material pedagógico oficial da instituição.",
      objectives: [
        "Entender a estrutura do mercado imobiliário brasileiro.",
        "Identificar documentos e certidões essenciais em uma transação.",
        "Conduzir atendimentos e negociações com ética e clareza.",
        "Organizar o processo de compra e venda com segurança.",
        "Reconhecer as atribuições e os limites da atuação profissional.",
      ],
      audience:
        "Pessoas interessadas em ingressar ou se atualizar no mercado imobiliário, profissionais de atendimento e quem deseja compreender melhor o processo de compra e venda de imóveis.",
      requirements:
        "Ensino médio em andamento ou concluído. Requisitos formais de registro profissional devem ser confirmados diretamente com a instituição.",
      modules: [
        {
          title: "Mercado imobiliário e legislação",
          lessons: [
            ["Boas-vindas ao curso", 12, 1],
            ["Panorama do mercado imobiliário", 24, 0],
            ["Legislação aplicada à compra e venda", 32, 0],
          ],
        },
        {
          title: "Documentação e análise de risco",
          lessons: [
            ["Documentos essenciais do imóvel", 26, 0],
            ["Certidões e due diligence", 29, 0],
          ],
        },
        {
          title: "Negociação e relacionamento",
          lessons: [
            ["Perfil do cliente e escuta ativa", 21, 0],
            ["Técnicas de negociação imobiliária", 28, 0],
          ],
        },
        {
          title: "Prática profissional",
          lessons: [
            ["Rotina do corretor e ética profissional", 25, 0],
            ["Preparação para o mercado", 18, 0],
          ],
        },
      ],
    },
    {
      slug: "tecnico-em-administracao",
      title: "Técnico em Administração",
      subtitle:
        "Organize rotinas, documentos e processos com uma base sólida de gestão para apoiar empresas de diferentes portes.",
      category: "Técnicos",
      instructor: "Núcleo de Gestão e Negócios",
      level: "iniciante",
      duration: 1200,
      price: 169000,
      featured: 1,
      cover: "course-admin.jpg",
      description:
        "A formação técnica em Administração apresenta os fundamentos da gestão, as rotinas administrativas, a organização de documentos e a relação entre pessoas, processos e resultados.\n\nAs aulas foram organizadas para quem precisa compreender o dia a dia de uma empresa e desenvolver uma postura profissional organizada, ética e orientada a resultados.\n\nConteúdo demonstrativo sujeito à substituição pelo material oficial da BrasilTec Educação.",
      objectives: [
        "Compreender as funções clássicas da administração.",
        "Organizar rotinas, arquivos e documentos corporativos.",
        "Apoiar processos de pessoas e de atendimento.",
        "Utilizar indicadores simples para acompanhar resultados.",
        "Comunicar-se com clareza em ambiente profissional.",
      ],
      audience:
        "Quem está iniciando na área administrativa, busca recolocação profissional ou deseja organizar melhor os processos do próprio negócio.",
      requirements: "Ensino médio em andamento ou concluído. Conhecimentos básicos de informática ajudam no aproveitamento.",
      modules: [
        {
          title: "Fundamentos da administração",
          lessons: [
            ["O papel da administração nas organizações", 20, 1],
            ["Planejamento, organização e controle", 26, 0],
            ["Ética e postura profissional", 18, 0],
          ],
        },
        {
          title: "Rotinas administrativas",
          lessons: [
            ["Gestão de documentos e arquivos", 24, 0],
            ["Rotinas de compras e suprimentos", 22, 0],
            ["Atendimento e comunicação interna", 20, 0],
          ],
        },
        {
          title: "Pessoas, processos e resultados",
          lessons: [
            ["Indicadores e metas", 25, 0],
            ["Organização de reuniões e follow-ups", 19, 0],
          ],
        },
      ],
    },
    {
      slug: "tecnico-em-seguranca-do-trabalho",
      title: "Técnico em Segurança do Trabalho",
      subtitle:
        "Aprenda a identificar riscos, apoiar programas de prevenção e fortalecer a cultura de segurança nas organizações.",
      category: "Saúde e Segurança",
      instructor: "Núcleo de Saúde e Segurança",
      level: "intermediario",
      duration: 1200,
      price: 199000,
      featured: 1,
      cover: "course-safety.jpg",
      description:
        "O curso apresenta os princípios da segurança e saúde no trabalho, o papel das normas regulamentadoras e as práticas de prevenção de acidentes.\n\nA trilha aborda inspeções, identificação de riscos, documentação e mobilização de equipes, sempre com foco na proteção das pessoas e na melhoria contínua dos ambientes de trabalho.\n\nVersão demonstrativa: os conteúdos oficiais e as exigências regulatórias devem ser confirmados com a instituição.",
      objectives: [
        "Reconhecer os principais riscos ocupacionais.",
        "Compreender a lógica das normas regulamentadoras.",
        "Apoiar inspeções e programas de prevenção.",
        "Participar da construção de uma cultura de segurança.",
        "Organizar registros e evidências de ações preventivas.",
      ],
      audience:
        "Profissionais que atuam ou desejam atuar em segurança do trabalho, lideranças operacionais e equipes de prevenção.",
      requirements:
        "Ensino médio em andamento ou concluído. Requisitos regulatórios e de registro devem ser verificados diretamente com a instituição.",
      modules: [
        {
          title: "Introdução à segurança e saúde no trabalho",
          lessons: [
            ["Por que segurança do trabalho importa", 18, 1],
            ["Conceitos de perigo, risco e dano", 23, 0],
            ["Cultura de prevenção", 21, 0],
          ],
        },
        {
          title: "Normas e procedimentos",
          lessons: [
            ["Panorama das normas regulamentadoras", 30, 0],
            ["Documentação de segurança", 26, 0],
            ["Inspeções e checklists", 25, 0],
          ],
        },
        {
          title: "Prevenção na prática",
          lessons: [
            ["Identificação de riscos no ambiente", 28, 0],
            ["Plano de ação e acompanhamento", 24, 0],
          ],
        },
      ],
    },
    {
      slug: "tecnico-em-recursos-humanos",
      title: "Técnico em Recursos Humanos",
      subtitle:
        "Atue nos processos de recrutamento, desenvolvimento e cuidado com as pessoas dentro das organizações.",
      category: "Técnicos",
      instructor: "Núcleo de Gestão de Pessoas",
      level: "iniciante",
      duration: 1200,
      price: 159000,
      featured: 0,
      cover: "course-rh.jpg",
      description:
        "A formação em Recursos Humanos conecta as rotinas de pessoal à experiência das pessoas na organização. Você verá recrutamento, integração, desenvolvimento, indicadores e comunicação.\n\nO curso foi pensado para quem deseja iniciar na área ou organizar melhor os processos de gestão de pessoas no próprio negócio.\n\nOs perfis e conteúdos apresentados são demonstrativos.",
      objectives: [
        "Compreender o ciclo de vida do colaborador.",
        "Apoiar processos de recrutamento e seleção.",
        "Planejar integração e desenvolvimento de equipes.",
        "Organizar indicadores de pessoas.",
        "Cuidar da comunicação e do clima organizacional.",
      ],
      audience: "Pessoas em início de carreira em RH, lideranças e profissionais que apoiam a gestão de equipes.",
      requirements: "Ensino médio em andamento ou concluído. Habilidades de comunicação e organização são diferenciais.",
      modules: [
        {
          title: "Gestão de pessoas na prática",
          lessons: [
            ["O papel estratégico do RH", 22, 1],
            ["Ciclo de vida do colaborador", 24, 0],
            ["Ética e confidencialidade", 18, 0],
          ],
        },
        {
          title: "Recrutamento e seleção",
          lessons: [
            ["Definição de perfil e divulgação da vaga", 26, 0],
            ["Entrevistas e avaliação de competências", 30, 0],
            ["Integração e onboarding", 21, 0],
          ],
        },
        {
          title: "Desenvolvimento e resultados",
          lessons: [
            ["Plano de desenvolvimento individual", 25, 0],
            ["Indicadores de pessoas", 23, 0],
          ],
        },
      ],
    },
    {
      slug: "assistente-administrativo",
      title: "Assistente Administrativo",
      subtitle:
        "Formação por competência para quem quer dominar as rotinas essenciais de um escritório moderno.",
      category: "Profissionalizantes",
      instructor: "Núcleo de Gestão e Negócios",
      level: "iniciante",
      duration: 160,
      price: 49000,
      featured: 1,
      cover: "course-finance.jpg",
      description:
        "Uma trilha objetiva para desenvolver as competências mais solicitadas em vagas administrativas: organização, comunicação, documentos, planilhas e atendimento.\n\nCom aulas curtas e atividades práticas, o curso ajuda você a construir uma rotina de trabalho mais eficiente e a se preparar para os desafios do dia a dia.\n\nCurso demonstrativo criado para apresentar a experiência da plataforma.",
      objectives: [
        "Organizar demandas e prioridades com método.",
        "Redigir e arquivar documentos profissionais.",
        "Comunicar-se com clareza por diferentes canais.",
        "Utilizar ferramentas digitais de produtividade.",
        "Aplicar boas práticas de atendimento e follow-up.",
      ],
      audience: "Pessoas que buscam a primeira oportunidade administrativa ou desejam atualizar rotinas e ferramentas.",
      requirements: "Ensino fundamental completo. Acesso a um computador e internet para as aulas práticas.",
      modules: [
        {
          title: "Organização e rotina",
          lessons: [
            ["Boas-vindas e mapa do curso", 8, 1],
            ["Prioridades, agenda e checklist", 18, 0],
            ["Arquivos digitais e nomenclatura", 16, 0],
          ],
        },
        {
          title: "Comunicação profissional",
          lessons: [
            ["E-mails e mensagens objetivas", 17, 0],
            ["Atendimento presencial e remoto", 19, 0],
          ],
        },
        {
          title: "Ferramentas digitais",
          lessons: [
            ["Planilhas para o dia a dia", 22, 0],
            ["Documentos compartilhados e versionamento", 18, 0],
            ["Reuniões e follow-up", 15, 0],
          ],
        },
      ],
    },
    {
      slug: "excelencia-no-atendimento-ao-cliente",
      title: "Excelência no Atendimento ao Cliente",
      subtitle:
        "Construa experiências de atendimento que geram confiança, fidelização e resultados para o negócio.",
      category: "Profissionalizantes",
      instructor: "Núcleo de Experiência do Cliente",
      level: "iniciante",
      duration: 40,
      price: 0,
      featured: 1,
      cover: "course-service.jpg",
      requireAssessment: 1,
      description:
        "Um curso gratuito e introdutório sobre o que realmente faz diferença no atendimento: escuta, clareza, empatia e consistência.\n\nVocê vai conhecer a jornada do cliente, formas de lidar com reclamações e práticas de comunicação que aproximam a empresa de quem ela atende.\n\nCurso demonstrativo gratuito para explorar todos os recursos do ambiente virtual de aprendizagem.",
      objectives: [
        "Entender a jornada e as expectativas do cliente.",
        "Praticar escuta ativa e comunicação empática.",
        "Conduzir conversas difíceis com equilíbrio.",
        "Registrar e acompanhar solicitações.",
        "Contribuir para uma experiência consistente.",
      ],
      audience: "Profissionais de atendimento, vendas, suporte e qualquer pessoa que se comunique com clientes.",
      requirements: "Não há pré-requisitos. Basta ter acesso à internet.",
      modules: [
        {
          title: "A experiência do cliente",
          lessons: [
            ["O que é uma boa experiência", 10, 1],
            ["Jornada e pontos de contato", 14, 0],
            ["Expectativas e promessas", 12, 0],
          ],
        },
        {
          title: "Comunicação que gera confiança",
          lessons: [
            ["Escuta ativa na prática", 15, 0],
            ["Como conduzir reclamações", 16, 0],
            ["Registro, follow-up e melhoria", 13, 0],
          ],
        },
      ],
    },
    {
      slug: "lideranca-e-gestao-de-equipes",
      title: "Liderança e Gestão de Equipes",
      subtitle:
        "Pós-graduação EAD para líderes que precisam transformar times em resultados sustentáveis.",
      category: "Pós-graduação",
      instructor: "Núcleo de Liderança e Desenvolvimento",
      level: "avancado",
      duration: 480,
      price: 289000,
      featured: 0,
      cover: "course-leadership.jpg",
      description:
        "Uma formação para quem lidera pessoas e precisa equilibrar direção, desenvolvimento e resultados. O percurso aborda fundamentos da liderança, times de alta performance e gestão de mudanças.\n\nAs aulas propõem reflexões e ferramentas aplicáveis ao cotidiano, com espaço para registrar planos de ação e acompanhar a própria evolução.\n\nConteúdo demonstrativo. A oferta, a carga horária e as condições da pós-graduação devem ser confirmadas com a instituição.",
      objectives: [
        "Diferenciar gestão e liderança na prática.",
        "Desenvolver confiança e autonomia no time.",
        "Conduzir conversas de feedback com clareza.",
        "Acompanhar desempenho com indicadores úteis.",
        "Liderar mudanças com menos ruído e mais adesão.",
      ],
      audience: "Lideranças em diferentes níveis, gestores de equipes e profissionais preparados para assumir posições de liderança.",
      requirements: "Profissionais com experiência em equipes ou em posições de coordenação. Requisitos formais da pós-graduação sob consulta.",
      modules: [
        {
          title: "Fundamentos da liderança",
          lessons: [
            ["O líder que as pessoas seguem", 28, 1],
            ["Estilos de liderança e contexto", 32, 0],
            ["Confiança e segurança psicológica", 30, 0],
          ],
        },
        {
          title: "Times de alta performance",
          lessons: [
            ["Objetivos, papéis e combinados", 29, 0],
            ["Feedback e desenvolvimento", 31, 0],
            ["Reuniões que destravam o trabalho", 26, 0],
          ],
        },
        {
          title: "Gestão de mudanças",
          lessons: [
            ["Como as mudanças acontecem", 27, 0],
            ["Plano de comunicação e engajamento", 25, 0],
          ],
        },
      ],
    },
    {
      slug: "logistica-e-supply-chain",
      title: "Logística e Supply Chain",
      subtitle:
        "Compreenda o fluxo de produtos, informações e recursos que sustenta a operação das empresas.",
      category: "Técnicos",
      instructor: "Núcleo de Operações",
      level: "intermediario",
      duration: 1200,
      price: 179000,
      featured: 0,
      cover: "course-logistics.jpg",
      description:
        "O curso apresenta a cadeia de suprimentos, os processos de estoque e armazenagem e a distribuição de produtos. A proposta é formar uma visão integrada da operação.\n\nAs aulas combinam conceitos e situações práticas para apoiar decisões mais eficientes e sustentáveis.\n\nConteúdo demonstrativo sujeito à atualização pela equipe pedagógica.",
      objectives: [
        "Entender a lógica da cadeia de suprimentos.",
        "Organizar estoques e movimentações.",
        "Acompanhar indicadores operacionais.",
        "Reconhecer riscos e pontos de melhoria.",
        "Integrar compras, armazenagem e distribuição.",
      ],
      audience: "Profissionais de operações, logística, compras e atendimento que desejam ampliar a visão de processo.",
      requirements: "Ensino médio em andamento ou concluído. Conhecimentos básicos de planilhas são recomendados.",
      modules: [
        {
          title: "Cadeia de suprimentos",
          lessons: [
            ["Visão geral de supply chain", 22, 1],
            ["Compras e relacionamento com fornecedores", 25, 0],
            ["Fluxo de informações", 20, 0],
          ],
        },
        {
          title: "Estoque e armazenagem",
          lessons: [
            ["Controle de estoque", 27, 0],
            ["Layout e movimentação", 23, 0],
            ["Inventário e acuracidade", 21, 0],
          ],
        },
        {
          title: "Transporte e distribuição",
          lessons: [
            ["Modalidades de transporte", 24, 0],
            ["Rastreamento e indicadores", 22, 0],
          ],
        },
      ],
    },
    {
      slug: "informatica-e-transformacao-digital",
      title: "Informática e Transformação Digital",
      subtitle:
        "Ganhe produtividade com ferramentas digitais, dados e uma postura segura no ambiente online.",
      category: "Tecnologia",
      instructor: "Núcleo de Tecnologia",
      level: "iniciante",
      duration: 120,
      price: 39000,
      featured: 0,
      cover: "course-tech.jpg",
      description:
        "Uma formação prática para usar a tecnologia a favor da sua rotina. Você vai explorar ferramentas de produtividade, organização de arquivos, colaboração e segurança digital.\n\nO curso parte do essencial e avança para conceitos de dados e transformação digital, sempre com exemplos aplicáveis.\n\nCurso demonstrativo para validação da experiência de aprendizagem.",
      objectives: [
        "Organizar arquivos e informações com eficiência.",
        "Usar ferramentas de colaboração e produtividade.",
        "Aplicar cuidados básicos de segurança digital.",
        "Compreender o papel dos dados nas decisões.",
        "Identificar oportunidades de melhoria digital.",
      ],
      audience: "Pessoas que desejam desenvolver confiança no uso da tecnologia e melhorar a produtividade no trabalho.",
      requirements: "Acesso a computador e internet. Não é necessário conhecimento técnico prévio.",
      modules: [
        {
          title: "Produtividade digital",
          lessons: [
            ["Organização de arquivos e nuvem", 16, 1],
            ["Ferramentas de colaboração", 18, 0],
            ["Rotinas automatizadas", 15, 0],
          ],
        },
        {
          title: "Dados e segurança",
          lessons: [
            ["Como usar dados no dia a dia", 20, 0],
            ["Senhas, golpes e privacidade", 19, 0],
            ["Backup e continuidade", 14, 0],
          ],
        },
        {
          title: "Transformação digital",
          lessons: [
            ["Do processo manual ao digital", 18, 0],
            ["Como propor melhorias", 16, 0],
          ],
        },
      ],
    },
  ];
}

async function seedIfEmpty(db) {
  const count = await db.get("SELECT COUNT(*) AS total FROM users");
  if (Number(count.total) > 0) return false;

  return db.transaction(async (tx) => {
    const recheck = await tx.get("SELECT COUNT(*) AS total FROM users");
    if (Number(recheck.total) > 0) return false;

    const now = new Date().toISOString();
    const pass = {
      admin: hashPassword(config.admin.password),
      student: hashPassword("Aluno@2026"),
      instructor: hashPassword("Instrutor@2026"),
    };

    if (config.isProduction && config.admin.password === "Admin@2026") {
      console.warn(
        "[BrasilTec] ADMIN_PASSWORD não definido: a conta administrativa foi criada com a senha padrão. " +
          "Defina ADMIN_EMAIL e ADMIN_PASSWORD antes do primeiro deploy (ou altere a senha no painel)."
      );
    }

    const adminId = await insert(tx, "users", {
      name: config.admin.name,
      email: config.admin.email,
      password_hash: pass.admin,
      role: "admin",
      status: "active",
      created_at: isoDaysAgo(180),
      updated_at: now,
    });

    const instructorUserId = await insert(tx, "users", {
      name: "Equipe Pedagógica BrasilTec",
      email: "instrutor@brasiltec.demo",
      password_hash: pass.instructor,
      role: "instructor",
      status: "active",
      created_at: isoDaysAgo(160),
      updated_at: now,
    });

    const studentSeeds = [
      ["Ana Souza", "aluno@brasiltec.demo", "student", 92, "active"],
      ["Bruno Carvalho", "bruno@brasiltec.demo", "student", 78, "active"],
      ["Carla Mendes", "carla@brasiltec.demo", "student", 64, "active"],
      ["Diego Nascimento", "diego@brasiltec.demo", "student", 45, "active"],
      ["Elisa Rocha", "elisa@brasiltec.demo", "student", 33, "active"],
      ["Felipe Araújo", "felipe@brasiltec.demo", "student", 21, "active"],
      ["Gabriela Lima", "gabriela@brasiltec.demo", "student", 12, "blocked"],
      ["Henrique Dias", "henrique@brasiltec.demo", "student", 5, "active"],
    ];

    const students = {};
    for (const [name, email, role, days, status] of studentSeeds) {
      students[email] = await insert(tx, "users", {
        name,
        email,
        password_hash: pass.student,
        role,
        status,
        created_at: isoDaysAgo(days),
        updated_at: now,
      });
    }

    const categories = {};
    for (const [name, slug, icon, position] of [
      ["Técnicos", "tecnicos", "graduation", 0],
      ["Profissionalizantes", "profissionalizantes", "briefcase", 1],
      ["Pós-graduação", "pos-graduacao", "award", 2],
      ["Tecnologia", "tecnologia", "monitor", 3],
      ["Saúde e Segurança", "saude-e-seguranca", "shield", 4],
    ]) {
      categories[name] = await insert(tx, "categories", {
        name,
        slug,
        icon,
        position,
        active: 1,
      });
    }

    const instructorIds = {};
    for (const [name, title, bio] of [
      [
        "Núcleo de Negócios Imobiliários",
        "Mercado imobiliário e transações",
        "Conteúdo demonstrativo produzido para apresentar as trilhas da BrasilTec Educação.",
      ],
      [
        "Núcleo de Gestão e Negócios",
        "Administração, rotinas e processos",
        "Conteúdo demonstrativo produzido para apresentar as trilhas da BrasilTec Educação.",
      ],
      [
        "Núcleo de Saúde e Segurança",
        "Segurança do trabalho e prevenção",
        "Conteúdo demonstrativo produzido para apresentar as trilhas da BrasilTec Educação.",
      ],
      [
        "Núcleo de Gestão de Pessoas",
        "Recursos humanos e desenvolvimento",
        "Conteúdo demonstrativo produzido para apresentar as trilhas da BrasilTec Educação.",
      ],
      [
        "Núcleo de Experiência do Cliente",
        "Atendimento e relacionamento",
        "Conteúdo demonstrativo produzido para apresentar as trilhas da BrasilTec Educação.",
      ],
      [
        "Núcleo de Liderança e Desenvolvimento",
        "Liderança, times e mudança",
        "Conteúdo demonstrativo produzido para apresentar as trilhas da BrasilTec Educação.",
      ],
      [
        "Núcleo de Operações",
        "Logística e cadeia de suprimentos",
        "Conteúdo demonstrativo produzido para apresentar as trilhas da BrasilTec Educação.",
      ],
      [
        "Núcleo de Tecnologia",
        "Produtividade digital e dados",
        "Conteúdo demonstrativo produzido para apresentar as trilhas da BrasilTec Educação.",
      ],
    ]) {
      instructorIds[name] = await insert(tx, "instructors", {
        user_id: name === "Núcleo de Gestão e Negócios" ? instructorUserId : null,
        name,
        title,
        bio,
        specialties: title,
        status: "active",
        created_at: isoDaysAgo(150),
      });
    }

    const courseIndex = {};
    const courseRecords = courseData();
    for (const c of courseRecords) {
      const courseId = await insert(tx, "courses", {
        slug: c.slug,
        title: c.title,
        subtitle: c.subtitle,
        description: c.description,
        objectives: JSON.stringify(c.objectives),
        audience: c.audience,
        requirements: c.requirements,
        category_id: categories[c.category],
        instructor_id: instructorIds[c.instructor],
        level: c.level,
        modality: "online",
        duration_hours: c.duration,
        price_cents: c.price,
        is_featured: c.featured,
        certificate_enabled: 1,
        completion_percent: 100,
        require_assessment: c.requireAssessment ? 1 : 0,
        pass_score: 70,
        status: "published",
        demo: 1,
        cover_image: c.cover,
        created_by: adminId,
        created_at: isoDaysAgo(120),
        updated_at: now,
      });
      courseIndex[c.slug] = { id: courseId, lessons: [], modules: [], title: c.title };
      let modulePos = 0;
      for (const mod of c.modules) {
        const moduleId = await insert(tx, "modules", {
          course_id: courseId,
          title: mod.title,
          description: `Módulo demonstrativo do curso ${c.title}.`,
          position: modulePos++,
          created_at: isoDaysAgo(120),
        });
        courseIndex[c.slug].modules.push(moduleId);
        let lessonPos = 0;
        for (const [title, duration, preview] of mod.lessons) {
          const lessonId = await insert(tx, "lessons", {
            module_id: moduleId,
            title,
            description: `Aula demonstrativa: ${title}.`,
            content: lessonContent(title, c.title),
            video_url: "/assets/video/aula-demonstracao.mp4",
            duration_minutes: duration,
            position: lessonPos++,
            is_free_preview: preview,
            created_at: isoDaysAgo(120),
          });
          courseIndex[c.slug].lessons.push(lessonId);
          if (lessonPos === 1) {
            const files = [
              ["Guia de estudos da aula", "/assets/materials/guia-de-estudos.pdf", "PDF", "PDF • 2 páginas"],
              ["Checklist prático", "/assets/materials/checklist.pdf", "PDF", "PDF • 1 página"],
            ];
            for (const [mt, url, type, size] of files) {
              await insert(tx, "materials", {
                lesson_id: lessonId,
                title: mt,
                file_url: url,
                file_type: type,
                size_label: size,
                created_at: isoDaysAgo(120),
              });
            }
          }
        }
      }
    }

    const assessmentData = {
      "tecnico-em-transacoes-imobiliarias": {
        title: "Avaliação final — Transações Imobiliárias",
        description:
          "Avaliação demonstrativa com questões de múltipla escolha sobre os principais conceitos do curso.",
        questions: [
          {
            text: "Qual documento é a principal evidência da propriedade de um imóvel urbano?",
            options: ["Contrato de locação", "Matrícula do imóvel", "Comprovante de IPTU", "Anúncio de venda"],
            correct: 1,
            explanation: "A matrícula, registrada no cartório de registro de imóveis, identifica a propriedade e os ônus que recaem sobre o imóvel.",
          },
          {
            text: "O que significa due diligence em uma transação imobiliária?",
            options: [
              "Divulgar o imóvel nas redes sociais",
              "Negociar o valor sem análise documental",
              "Verificar documentos, riscos e pendências antes da compra",
              "Assinar o contrato imediatamente",
            ],
            correct: 2,
            explanation: "A due diligence reúne a análise documental e jurídica necessária para reduzir riscos antes da conclusão da negociação.",
          },
          {
            text: "Uma escuta ativa no atendimento ao cliente envolve:",
            options: [
              "Interromper para apresentar logo uma solução",
              "Prestar atenção, confirmar o entendimento e registrar o pedido",
              "Encaminhar o cliente sem contexto",
              "Evitar perguntas para agilizar a conversa",
            ],
            correct: 1,
            explanation: "Escutar de forma ativa significa compreender a necessidade, validar o entendimento e registrar informações relevantes.",
          },
          {
            text: "Qual comportamento fortalece a ética profissional na intermediação imobiliária?",
            options: [
              "Prometer resultados garantidos para fechar o negócio",
              "Omitir pendências para proteger o vendedor",
              "Informar com transparência os limites da atuação",
              "Compartilhar dados do cliente sem autorização",
            ],
            correct: 2,
            explanation: "Transparência sobre atribuições, riscos e limites é essencial para uma relação profissional confiável.",
          },
          {
            text: "Antes de divulgar um imóvel, é recomendável:",
            options: [
              "Confirmar dados, valor, condições e autorização do proprietário",
              "Publicar apenas com uma foto",
              "Definir o preço sem ouvir o proprietário",
              "Ignorar a documentação",
            ],
            correct: 0,
            explanation: "A divulgação responsável depende de informações conferidas e autorização de quem representa o imóvel.",
          },
        ],
      },
      "excelencia-no-atendimento-ao-cliente": {
        title: "Avaliação final — Atendimento ao Cliente",
        description: "Verifique o que você aprendeu sobre escuta, comunicação e condução de reclamações.",
        questions: [
          {
            text: "Empatia no atendimento significa:",
            options: [
              "Concordar com tudo que o cliente diz",
              "Buscar compreender a perspectiva e o impacto da situação",
              "Resolver apenas o que está no script",
              "Transferir o atendimento rapidamente",
            ],
            correct: 1,
            explanation: "Empatia é compreender a experiência do outro sem necessariamente concordar com todas as suas conclusões.",
          },
          {
            text: "Diante de uma reclamação, a primeira ação recomendada é:",
            options: [
              "Justificar imediatamente o erro da empresa",
              "Pedir que o cliente envie tudo novamente",
              "Ouvir com atenção, confirmar os fatos e registrar o caso",
              "Encerrar a conversa",
            ],
            correct: 2,
            explanation: "Ouvir e confirmar os fatos evita respostas precipitadas e permite encaminhar a solução correta.",
          },
          {
            text: "Um follow-up eficaz deve:",
            options: [
              "Ser feito apenas quando o cliente cobrar",
              "Informar prazo, responsável e próximo passo combinado",
              "Ser enviado sem contexto",
              "Depender de memória, sem registro",
            ],
            correct: 1,
            explanation: "Combinar prazo, responsável e próximo passo torna o acompanhamento previsível e confiável.",
          },
          {
            text: "Qual prática contribui para uma experiência consistente?",
            options: [
              "Registrar as informações relevantes do atendimento",
              "Usar respostas diferentes para cada canal",
              "Evitar confirmar o entendimento",
              "Prometer prazos sem checar a operação",
            ],
            correct: 0,
            explanation: "Registros permitem continuidade, análise de recorrências e melhoria do atendimento.",
          },
        ],
      },
    };

    const assessmentIds = {};
    for (const [slug, data] of Object.entries(assessmentData)) {
      const course = courseIndex[slug];
      const assessmentId = await insert(tx, "assessments", {
        course_id: course.id,
        title: data.title,
        description: data.description,
        pass_score: 70,
        max_attempts: 3,
        is_published: 1,
        created_at: isoDaysAgo(110),
      });
      assessmentIds[slug] = assessmentId;
      let pos = 0;
      for (const q of data.questions) {
        await insert(tx, "questions", {
          assessment_id: assessmentId,
          text: q.text,
          type: "multiple",
          options: JSON.stringify(q.options),
          correct_index: q.correct,
          explanation: q.explanation,
          position: pos++,
        });
      }
    }

    async function enroll(email, slug, completedCount, lastLesson, status = "active", days = 20) {
      const userId = students[email];
      const course = courseIndex[slug];
      const completed = course.lessons.slice(0, completedCount);
      const progress = Math.round((completed.length / course.lessons.length) * 100);
      const isComplete = completedCount >= course.lessons.length && !courseRecords.find((c) => c.slug === slug).requireAssessment;
      const enrollmentId = await insert(tx, "enrollments", {
        user_id: userId,
        course_id: course.id,
        status: isComplete ? "completed" : status,
        source: "demo",
        progress_percent: progress,
        last_lesson_id: lastLesson ? course.lessons[lastLesson - 1] : null,
        enrolled_at: isoDaysAgo(days),
        completed_at: isComplete ? isoDaysAgo(Math.max(1, days - 12)) : null,
        updated_at: isoDaysAgo(Math.max(0, days - 15)),
      });
      for (const lessonId of completed) {
        await insert(tx, "lesson_progress", {
          enrollment_id: enrollmentId,
          lesson_id: lessonId,
          completed: 1,
          watched_seconds: 600,
          completed_at: isoDaysAgo(Math.max(0, days - 2)),
          updated_at: isoDaysAgo(Math.max(0, days - 2)),
        });
      }
      if (lastLesson && !completed.includes(course.lessons[lastLesson - 1])) {
        await insert(tx, "lesson_progress", {
          enrollment_id: enrollmentId,
          lesson_id: course.lessons[lastLesson - 1],
          completed: 0,
          watched_seconds: 180,
          updated_at: isoDaysAgo(1),
        });
      }
      return { enrollmentId, progress, isComplete, course };
    }

    const anaTTI = await enroll("aluno@brasiltec.demo", "tecnico-em-transacoes-imobiliarias", 4, 5, "active", 38);
    const anaAtendimento = await enroll("aluno@brasiltec.demo", "excelencia-no-atendimento-ao-cliente", 2, 3, "active", 12);
    const anaAssistente = await enroll("aluno@brasiltec.demo", "assistente-administrativo", 8, null, "active", 75);

    const brunoTTI = await enroll("bruno@brasiltec.demo", "tecnico-em-transacoes-imobiliarias", 2, 3, "active", 25);
    await enroll("bruno@brasiltec.demo", "tecnico-em-seguranca-do-trabalho", 0, 1, "active", 8);

    const carlaAssistente = await enroll("carla@brasiltec.demo", "assistente-administrativo", 8, null, "active", 88);
    const carlaAtendimento = await enroll("carla@brasiltec.demo", "excelencia-no-atendimento-ao-cliente", 6, null, "active", 50);
    const elisaLogistica = await enroll("elisa@brasiltec.demo", "logistica-e-supply-chain", 5, 6, "active", 30);
    await enroll("elisa@brasiltec.demo", "lideranca-e-gestao-de-equipes", 1, 2, "active", 6);
    await enroll("felipe@brasiltec.demo", "tecnico-em-administracao", 3, 4, "active", 15);
    await enroll("henrique@brasiltec.demo", "informatica-e-transformacao-digital", 1, 2, "active", 3);
    await enroll("gabriela@brasiltec.demo", "tecnico-em-recursos-humanos", 0, 1, "blocked", 9);

    // Conclui e certifica os cursos elegíveis do seed.
    async function completeAndCertify(email, slug, enrollment, days) {
      const courseRecord = courseRecords.find((c) => c.slug === slug);
      if (courseRecord.requireAssessment) {
        const assessmentId = assessmentIds[slug];
        await insert(tx, "attempts", {
          assessment_id: assessmentId,
          user_id: students[email],
          enrollment_id: enrollment.enrollmentId,
          answers: "{}",
          score: 100,
          passed: 1,
          started_at: isoDaysAgo(days + 1),
          submitted_at: isoDaysAgo(days),
        });
      }
      await tx.run(
        "UPDATE enrollments SET status = 'completed', progress_percent = 100, completed_at = ?, updated_at = ? WHERE id = ?",
        isoDaysAgo(days),
        isoDaysAgo(days),
        enrollment.enrollmentId
      );
      const code =
        email === "aluno@brasiltec.demo"
          ? "BTE-2026-4F7K2M"
          : email === "carla@brasiltec.demo"
            ? "BTE-2026-8N3P5Q"
            : "BTE-2026-DEMO00";
      await insert(tx, "certificates", {
        code,
        user_id: students[email],
        course_id: enrollment.course.id,
        enrollment_id: enrollment.enrollmentId,
        student_name: email === "aluno@brasiltec.demo" ? "Ana Souza" : "Carla Mendes",
        course_name: enrollment.course.title,
        hours: courseRecord.duration,
        issued_at: isoDaysAgo(days),
      });
      return code;
    }

    await completeAndCertify("aluno@brasiltec.demo", "assistente-administrativo", anaAssistente, 28);
    await completeAndCertify("carla@brasiltec.demo", "excelencia-no-atendimento-ao-cliente", carlaAtendimento, 18);

    // Tentativa parcial da Ana na avaliação de atendimento.
    await insert(tx, "attempts", {
      assessment_id: assessmentIds["excelencia-no-atendimento-ao-cliente"],
      user_id: students["aluno@brasiltec.demo"],
      enrollment_id: anaAtendimento.enrollmentId,
      answers: "{}",
      score: 75,
      passed: 1,
      started_at: isoDaysAgo(3),
      submitted_at: isoDaysAgo(3),
    });

    // Pedidos e pagamentos de demonstração.
    const orderRows = [
      ["Ana Souza", "aluno@brasiltec.demo", "tecnico-em-transacoes-imobiliarias", "approved", 189000, 0, 22, "pix", "BTE-DEMO-001"],
      ["Bruno Carvalho", "bruno@brasiltec.demo", "tecnico-em-transacoes-imobiliarias", "approved", 189000, 0, 18, "credit_card", "BTE-DEMO-002"],
      ["Carla Mendes", "carla@brasiltec.demo", "assistente-administrativo", "approved", 49000, 0, 60, "pix", "BTE-DEMO-003"],
      ["Diego Nascimento", "diego@brasiltec.demo", "tecnico-em-transacoes-imobiliarias", "pending", 189000, 0, 2, null, "BTE-DEMO-004"],
      ["Felipe Araújo", "felipe@brasiltec.demo", "tecnico-em-seguranca-do-trabalho", "refunded", 199000, 0, 35, "credit_card", "BTE-DEMO-005"],
    ];
    let orderSeq = 1;
    for (const [name, email, slug, status, amount, discount, days, method, ref] of orderRows) {
      const course = courseIndex[slug];
      const orderId = await insert(tx, "orders", {
        code: `PED-DEMO-${String(orderSeq++).padStart(3, "0")}`,
        user_id: students[email],
        course_id: course.id,
        status,
        amount_cents: amount,
        discount_cents: discount,
        total_cents: amount - discount,
        payment_method: method,
        provider: "demo",
        provider_ref: ref,
        created_at: isoDaysAgo(days),
        updated_at: isoDaysAgo(days),
        paid_at: status === "approved" ? isoDaysAgo(days) : null,
      });
      await insert(tx, "payments", {
        order_id: orderId,
        status: status === "approved" ? "approved" : status === "refunded" ? "refunded" : "pending",
        method: method || "pix",
        amount_cents: amount - discount,
        provider: "demo",
        provider_ref: ref,
        created_at: isoDaysAgo(days),
      });
    }

    // FAQ institucional
    const faqs = [
      ["Como funciona o acesso aos cursos?", "Após criar sua conta e concluir a matrícula, os cursos liberados aparecem em “Meus cursos”, na área do aluno. As aulas podem ser assistidas pelo navegador, no computador ou no celular."],
      ["Os cursos são 100% online?", "As trilhas demonstrativas desta plataforma são 100% online. A modalidade, a carga horária e eventuais encontros ao vivo de cada curso oficial devem ser confirmados com a BrasilTec Educação."],
      ["Qual é a duração dos cursos?", "A carga horária aparece na página de cada curso. O ritmo de conclusão depende da sua disponibilidade e dos critérios definidos para a formação."],
      ["Como faço minha matrícula?", "Escolha um curso, clique em “Quero me matricular” e siga o fluxo. Cursos gratuitos liberam o acesso imediatamente. Cursos pagos dependem da confirmação do pagamento ou de aprovação administrativa."],
      ["Quais são as formas de pagamento?", "A plataforma está preparada para pagamentos online via Mercado Pago. Enquanto o gateway não estiver configurado, o pedido fica pendente e a equipe pode orientar o atendimento. Nunca solicitamos dados completos de cartão por aqui."],
      ["Como funciona o certificado?", "A emissão depende dos critérios de conclusão do curso: aulas concluídas, percentual mínimo e, quando houver, aprovação na avaliação. O certificado traz um código público de verificação."],
      ["O certificado é reconhecido?", "A disponibilidade e eventuais reconhecimentos variam conforme o curso e a regulamentação aplicável. Consulte a BrasilTec Educação nos canais oficiais antes de se matricular. A plataforma não substitui essa confirmação."],
      ["Terei suporte durante o curso?", "Você pode enviar dúvidas pelo formulário de contato e acompanhar seus pedidos na área do aluno. Os canais oficiais de atendimento estão disponíveis no rodapé."],
      ["Como funcionam as avaliações?", "Quando o curso possui avaliação, você verá o número de tentativas permitidas e a nota mínima. O resultado e o feedback de cada questão ficam disponíveis no histórico."],
      ["Posso estudar pelo celular?", "Sim. O site, o player e o painel do aluno foram construídos para funcionar em computadores, tablets e celulares, respeitando boas práticas de acessibilidade."],
    ];
    let faqPos = 0;
    for (const [question, answer] of faqs) {
      await insert(tx, "faqs", { question, answer, position: faqPos++, published: 1 });
    }

    // Configurações editáveis pelo painel.
    const settings = {
      site_name: "BrasilTec Educação",
      site_tagline: "Ensino a distância",
      hero_eyebrow: "Cursos técnicos e profissionalizantes • 100% EAD",
      hero_title: "Seu próximo passo começa com o conhecimento.",
      hero_subtitle:
        "Aprenda no seu ritmo, desenvolva novas habilidades e amplie suas oportunidades com os cursos da BrasilTec Educação.",
      about_title: "Conhecimento que transforma vidas e realiza sonhos.",
      about_text:
        "A BrasilTec Educação nasceu do sonho de empreender e transformar vidas por meio do conhecimento. Com 4 anos de experiência no setor educacional, nossa fundadora idealizou uma marca comprometida com a qualidade, a confiança e a criação de novas oportunidades profissionais.\n\nAcreditamos que a educação transforma vidas e abre portas para um futuro melhor. Por isso, reunimos cursos técnicos, formações profissionalizantes e pós-graduação em uma experiência de aprendizagem digital simples, organizada e próxima.",
      institutional_note:
        "Diplomas reconhecidos pelo SISTEC/MEC, válidos em todo o Brasil — informação divulgada pela instituição em seu perfil oficial. A disponibilidade, o reconhecimento e as exigências de cada formação devem ser confirmados diretamente com a BrasilTec Educação antes da matrícula.",
      contact_instagram: "https://www.instagram.com/brasilteceducacao/",
      contact_email: "",
      contact_phone: "",
      contact_hours: "Atendimento pelos canais oficiais da BrasilTec Educação.",
      support_text: "Fale com a BrasilTec Educação pelo Instagram oficial ou envie uma mensagem pelo formulário de contato.",
      demo_notice:
        "Ambiente demonstrativo: cursos, valores, perfis e indicadores exibidos são exemplos para validar a plataforma até o cadastro do conteúdo real.",
      privacy_updated: "23 de outubro de 2026",
    };
    for (const [key, value] of Object.entries(settings)) {
      await insert(tx, "settings", { key, value });
    }

    // Cupons de demonstração.
    await insert(tx, "coupons", {
      code: "BRASILTEC10",
      description: "10% de desconto em cursos pagos (demonstração).",
      percent_off: 10,
      amount_off_cents: 0,
      max_uses: 100,
      used_count: 0,
      valid_until: null,
      active: 1,
      created_at: isoDaysAgo(20),
    });
    await insert(tx, "coupons", {
      code: "BEMVINDO50",
      description: "R$ 50 de desconto no primeiro curso (demonstração).",
      percent_off: 0,
      amount_off_cents: 5000,
      max_uses: 50,
      used_count: 1,
      valid_until: null,
      active: 1,
      created_at: isoDaysAgo(20),
    });

    // Nenhum depoimento é publicado sem autorização expressa.
    // A seção pública exibe um estado preparado até que depoimentos reais sejam cadastrados.

    await insert(tx, "leads", {
      name: "Contato de demonstração",
      email: "contato.demo@example.com",
      phone: "",
      subject: "Informações sobre cursos técnicos",
      message:
        "Mensagem de exemplo criada automaticamente para demonstrar a caixa de contatos do painel administrativo.",
      status: "new",
      created_at: isoDaysAgo(1, 14),
    });

    const activity = [
      [students["aluno@brasiltec.demo"], "lesson.completed", "lesson", anaTTI.course.lessons[3], "Concluiu uma aula do curso Técnico em Transações Imobiliárias."],
      [students["carla@brasiltec.demo"], "certificate.issued", "course", carlaAtendimento.course.id, "Certificado emitido para o curso Excelência no Atendimento ao Cliente."],
      [students["aluno@brasiltec.demo"], "enrollment.created", "course", anaAssistente.course.id, "Concluiu o curso Assistente Administrativo."],
      [adminId, "course.published", "course", courseIndex["tecnico-em-transacoes-imobiliarias"].id, "Curso publicado no catálogo."],
      [students["bruno@brasiltec.demo"], "lesson.completed", "lesson", brunoTTI.course.lessons[1], "Assistiu à aula Panorama do mercado imobiliário."],
    ];
    let activityDays = 1;
    for (const [userId, action, entity, entityId, detail] of activity) {
      await insert(tx, "activity_log", {
        user_id: userId,
        action,
        entity,
        entity_id: String(entityId),
        detail,
        created_at: isoDaysAgo(activityDays++, 15),
      });
    }

    return true;
  });
}

module.exports = { seedIfEmpty };
