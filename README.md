# BrasilTec Educação — Plataforma EAD

Plataforma completa de ensino a distância: site institucional, catálogo de cursos, área do aluno (AVA), avaliações, certificados verificáveis, painel administrativo e pedidos com confirmação de pagamento no servidor.

O projeto roda **sem etapa de build**: front-end em ES Modules puros, back-end em `node:http` e banco relacional SQLite. Localmente usa `node:sqlite`; na Vercel usa **Turso/libSQL** (HTTP), mantendo a mesma sintaxe SQL.

> **Conteúdo demonstrativo.** Cursos, depoimentos, números, textos institucionais e imagens de exemplo foram criados para demonstrar a plataforma. Substitua-os por conteúdo real antes de publicar. A faixa “ambiente demonstrativo” aparece enquanto `DEMO_MODE=1`.

---

## Requisitos

- **Node.js 24 ou superior** (usa `node:sqlite` no desenvolvimento).
- `npm install` para instalar o driver `@libsql/client`, usado na Vercel/Turso.
- Na Vercel, um banco **Turso** gratuito — veja [Deploy na Vercel](#deploy-na-vercel).

Verifique:

```bash
node --version   # precisa ser >= 24 (recomendado 24 LTS)
```

## Como rodar

```bash
# 1. (opcional) criar o arquivo de ambiente
cp .env.example .env

# 2. iniciar
npm start          # ou: node server/server.js
```

Acesse <http://localhost:4173>.

Na primeira execução o banco é criado em `data/brasiltec.db` e populado com o conteúdo demonstrativo.

### Acessos de demonstração

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Aluno | `aluno@brasiltec.demo` | `Aluno@2026` |
| Instrutor | `instrutor@brasiltec.demo` | `Instrutor@2026` |
| Administrador | `admin@brasiltec.demo` | `Admin@2026` |

> Troque essas credenciais e desative `DEMO_MODE` antes de qualquer uso real.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm start` | Sobe o servidor HTTP (site + API). |
| `npm run dev` | Sobe com `--watch` (reinicia ao alterar o servidor). |
| `npm test` | Executa a suíte de integração em banco temporário isolado. |
| `npm run db:reset` | Apaga o banco local e recria com o conteúdo demonstrativo. |
| `npm run materials` | Gera os PDFs de materiais demonstrativos que faltarem. |

Sem `npm` disponível? Use `node server/server.js`, `node --test tests/api.test.js`, `node scripts/reset-db.js` e `node scripts/make-materials.js`.

## O que está implementado

### Site público
- Home, catálogo com busca e filtros (categoria, nível, preço, modalidade), detalhe do curso, sobre, como funciona, FAQ, contato, privacidade e termos.
- Verificação pública de certificado por código (`/verificar-certificado`).
- SEO: títulos/descrições por rota, Open Graph, `sitemap.xml`, `robots.txt`, `noindex` nas áreas privadas.
- Acessibilidade: foco visível, navegação por teclado, rótulos em formulários, contraste e textos alternativos.
- Layout responsivo (mobile, tablet e desktop) com a identidade visual da marca.

### Conta e segurança
- Cadastro, login, recuperação e redefinição de senha.
- Sessão em cookie `HttpOnly` + `SameSite=Lax`; token CSRF em cookie separado e cabeçalho `x-csrf-token`.
- Senhas com `scrypt` (salt por usuário), limite de tentativas de login e cadastro.
- Papéis `student`, `instructor` e `admin`, verificados **no servidor** em cada rota.
- Rotas privadas protegidas no cliente e na API; áreas privadas com `noindex, nofollow`.

### Área do aluno
- Painel com progresso, próximas aulas, avaliações e certificados.
- Player de aula com materiais, anotações persistentes e conclusão de aula.
- Progresso salvo no banco; conclusão do curso conforme regra do curso (percentual e/ou avaliação).
- Avaliações com tentativas, nota, aprovação e gabarito nunca exposto ao aluno.
- Certificados com código único `BTE-AAAA-XXXXXX` e página pública de verificação.
- Pedidos: gratuito libera na hora; pago fica **pendente** até confirmação do servidor.

### Painel administrativo
- KPIs reais calculados do banco (alunos, matrículas, receita aprovada, cursos).
- CRUD de cursos, módulos, aulas, materiais, avaliações e questões.
- Alunos, instrutores, matrículas, pedidos, cupons, leads, depoimentos, FAQ e categorias.
- Aprovação/reembolso de pedidos, com liberação ou bloqueio de acesso.
- Configurações da plataforma e registro de atividade (auditoria).
- Instrutor acessa apenas seus cursos; administrador acessa tudo.

### Pagamentos
- Checkout gratuito e checkout pago (Mercado Pago Checkout Pro, opcional).
- O retorno do navegador **nunca** confirma pagamento: o status é consultado na API do provedor pelo servidor, ou aprovado manualmente por um administrador.
- Nenhum dado de cartão passa ou é armazenado pela aplicação.
- Webhook com validação de assinatura quando `MP_WEBHOOK_SECRET` está definido.

## Estrutura do projeto

```
brasiltec-ead/
├── public/                 # front-end (HTML único + SPA em ES Modules)
│   ├── index.html
│   └── assets/
│       ├── css/            # base, layout e componentes
│       ├── js/             # app, api, ui e páginas
│       ├── img/            # imagens e marca
│       ├── video/          # vídeo demonstrativo de aula
│       └── materials/      # PDFs demonstrativos
├── server/
│   ├── server.js           # HTTP, rotas SPA, SEO, estáticos, segurança
│   ├── config.js           # leitura de ambiente
│   ├── db.js               # schema e helpers SQLite
│   ├── seed.js             # conteúdo demonstrativo
│   ├── security.js         # hash, sessão, CSRF, rate limit
│   ├── payments.js         # Mercado Pago e aprovação de pedidos
│   ├── email.js            # e-mail transacional (Resend, opcional)
│   ├── services.js         # regras de negócio compartilhadas
│   └── api/                # rotas públicas, auth, aluno, admin
├── scripts/                # reset de banco e geração de materiais
├── tests/                  # suíte de integração (banco temporário)
├── docs/                   # arquitetura, administração, LGPD e deploy
├── brand/                  # referências visuais originais
├── data/                   # banco SQLite (gerado, não versionar)
└── .env.example
```

## Configuração

Todas as variáveis estão documentadas em [`.env.example`](.env.example). As principais:

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `APP_ENV` | `development` | `production` ativa cookies seguros e desativa demo por padrão. |
| `PORT` | `4173` | Porta HTTP. |
| `APP_URL` | `http://localhost:4173` | URL pública usada em links, e-mails e retorno de pagamento. |
| `DB_PATH` | `data/brasiltec.db` | Caminho do banco SQLite. |
| `DEMO_MODE` | `1` em dev | Exibe faixa de demonstração e acessos rápidos. |
| `COOKIE_SECURE` | `1` em produção | Exige HTTPS para os cookies. |
| `ADMIN_*` | credenciais demo | Conta criada no primeiro start, somente com banco vazio. |
| `RESEND_API_KEY` | vazio | Sem chave, e-mails não são enviados. |
| `MP_ACCESS_TOKEN` | vazio | Sem token, pedidos pagos ficam para aprovação manual. |
| `MP_WEBHOOK_SECRET` | vazio | Valida a assinatura do webhook. |

## Testes

```bash
npm test
```

A suíte sobe uma instância própria do servidor em porta aleatória, com banco temporário, e cobre:

1. páginas públicas, SEO, catálogo e `robots`/`sitemap`;
2. validação de cadastro e criação de sessão;
3. autenticação, papéis e CSRF;
4. matrícula gratuita, progresso, anotações e bloqueio de certificado;
5. avaliação, conclusão e emissão/verificação de certificado;
6. pedido pago pendente e liberação somente após aprovação;
7. criação, publicação e arquivamento de curso no admin;
8. contato gerando lead visível no admin;
9. logout invalidando a sessão.

O banco de teste é removido ao final; o banco de desenvolvimento não é tocado.

## Deploy na Vercel

O projeto está adaptado ao modelo serverless da Vercel:

- `api/index.js` é a única função: recebe todas as rotas e delega ao servidor HTTP original.
- `public/` é servido pelo CDN da Vercel (o rewrite só é aplicado quando não existe arquivo estático).
- `vercel.json` define `outputDirectory`, o rewrite e o bundle da função (inclui `templates/index.html`).
- O banco fica no **Turso** (libSQL via HTTP), porque o disco da Vercel é efêmero.

### 1. Criar o banco no Turso

```bash
# instale a CLI (ou crie pelo site https://turso.tech)
turso auth signup
turso db create brasiltec
turso db show brasiltec --url        # copie a URL libsql://...
turso db tokens create brasiltec     # copie o token
```

### 2. Configurar as variáveis na Vercel

No painel do projeto → **Settings → Environment Variables** (Production e Preview):

| Variável | Valor |
| --- | --- |
| `TURSO_DATABASE_URL` | `libsql://brasiltec-....turso.io` |
| `TURSO_AUTH_TOKEN` | token gerado acima |
| `APP_URL` | `https://brasiltec.vercel.app` |
| `APP_ENV` | `production` |
| `DEMO_MODE` | `1` (mantém a faixa de demonstração) ou `0` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | credenciais reais do administrador (aplicadas na criação do banco) |

`APP_URL` também é detectado automaticamente pelas variáveis da Vercel, mas
defini-lo explicitamente evita divergência entre preview e produção.

> Defina `ADMIN_EMAIL` e `ADMIN_PASSWORD` **antes** da primeira requisição: o
> usuário administrador é criado junto com o conteúdo inicial e não é
> sobrescrito depois. Para trocar a senha após o primeiro acesso, use o painel
> administrativo ou um banco novo.

### 3. Deploy

```bash
npm i -g vercel
vercel link
vercel --prod
```

Ou faça push no GitHub: a integração existente builda e publica sozinha.
O schema e o conteúdo demonstrativo são criados automaticamente na primeira
requisição (somente se o banco estiver vazio).

> Na Vercel, o **Root Directory** deve ser a pasta que contém `vercel.json`,
> `api/` e `public/` (a raiz do repositório, se você publicou o conteúdo do
> projeto). Use **Framework Preset: Other** e não defina Build Command.

### Solução de problemas

- **500 em todas as rotas**: `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` ausentes ou
  inválidos. Veja os logs da função em **Deployments → Functions**.
- **Login não persiste**: confira `APP_URL` e `COOKIE_SECURE=1` (HTTPS).
- **Dados sumindo**: você está usando SQLite local (`ALLOW_LOCAL_DB=1`). Em
  serverless o arquivo é recriado a cada cold start; use Turso.

## Documentação

- [Arquitetura e API](docs/ARQUITETURA.md)
- [Guia de administração e conteúdo](docs/ADMINISTRACAO.md)
- [LGPD e segurança](docs/LGPD-E-SEGURANCA.md)
- [Deploy e operação](docs/DEPLOY.md)

## Limites conhecidos

- SQLite em arquivo único é usado apenas no desenvolvimento. Em produção na Vercel o banco é o Turso (libSQL), compartilhado entre as funções.
- Envio de e-mail e pagamento online são opcionais e ficam desativados sem credenciais.
- Não há upload de arquivos pelo navegador; imagens e materiais são servidos de `public/assets`.
- A recuperação de senha, sem provedor de e-mail configurado, só exibe o link no modo demonstrativo.
