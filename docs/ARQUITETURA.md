# Arquitetura e API

## Visão geral

A aplicação é um monólito Node.js com duas camadas servidas pelo mesmo processo:

```
Navegador
  │
  ├── HTML/CSS/JS estáticos (public/)         → CDN (Vercel) ou servidor HTTP (server/server.js)
  └── fetch JSON (/api/...)                   → roteador → regras de negócio → banco (libSQL/Turso)
```

- **Sem build.** O navegador carrega o HTML renderizado a partir de `templates/index.html`, que inicializa a SPA em `public/assets/js/app.js`. As rotas são resolvidas no cliente; o servidor devolve o template renderizado para qualquer rota de página (fallback SPA).
- **Dependência única.** Back-end usa módulos nativos (`node:http`, `node:crypto`, `node:fs`) e `@libsql/client` para falar com o banco. No desenvolvimento local, `node:sqlite` é usado como fallback sem servidor externo.
- **Fonte da verdade no servidor.** Permissões, progresso, notas, certificados, pedidos e receita são calculados e validados no back-end. O cliente apenas apresenta dados.

### Camadas do servidor

| Arquivo | Responsabilidade |
| --- | --- |
| `server/server.js` | Servidor HTTP, parsing de cookies/corpo, CSRF, origem, sessão, fallback SPA, SEO, estáticos, cache. |
| `server/config.js` | Leitura de `.env`, valores padrão e configuração pública exposta ao cliente. |
| `server/db.js` | Conexão com o banco (libSQL/Turso ou SQLite local), criação do schema, helpers assíncronos `get/all/run/transaction`. |
| `server/security.js` | Hash `scrypt`, geração de tokens, hash de sessão, rate limit, validação de senha. |
| `server/services.js` | Regras compartilhadas: cursos, progresso, avaliação, certificado, cartões do aluno. |
| `server/payments.js` | Preferência Mercado Pago, consulta de pagamento, aprovação/reembolso de pedido. |
| `server/email.js` | Envio via Resend quando configurado; caso contrário, apenas registra. |
| `server/api/*.js` | Rotas: `public`, `auth`, `student`, `admin` e webhook de pagamento. |

## Modelo de dados

Banco relacional SQLite com chaves estrangeiras e índices. Tabelas principais:

| Domínio | Tabelas |
| --- | --- |
| Contas | `users`, `sessions`, `password_resets` |
| Catálogo | `categories`, `instructors`, `courses`, `modules`, `lessons`, `materials` |
| Aprendizagem | `enrollments`, `lesson_progress`, `notes`, `assessments`, `questions`, `attempts`, `certificates` |
| Comércio | `coupons`, `orders`, `payments` |
| Conteúdo público | `testimonials`, `faqs`, `leads` |
| Operação | `settings`, `activity_log` |

Relações centrais:

```
users 1─N enrollments N─1 courses 1─N modules 1─N lessons 1─N materials
courses 1─1 assessments 1─N questions
users 1─N attempts N─1 assessments
enrollments 1─0..1 certificates
users 1─N orders N─1 courses
orders 1─N payments
```

Pontos importantes:

- `enrollments` tem restrição única por `(user_id, course_id)`.
- `lesson_progress` tem restrição única por `(enrollment_id, lesson_id)`.
- `notes` tem restrição única por `(user_id, lesson_id)`.
- `certificates.code` é único e usado na verificação pública.
- `orders.code` é único e serve de referência para o provedor de pagamento.
- `activity_log` registra ações relevantes para auditoria.

## Autenticação e sessão

1. O cliente obtém um token CSRF em `GET /api/auth/csrf` (cookie `bte_csrf`, legível pelo JS).
2. Login/cadastro validam credenciais e criam uma sessão:
   - token aleatório enviado ao navegador em cookie `bte_session` (`HttpOnly`, `SameSite=Lax`, `Secure` em produção);
   - no banco, guarda-se apenas o **hash SHA-256** do token.
3. Toda requisição mutante exige o cabeçalho `x-csrf-token` igual ao token da sessão/ cookie.
4. Requisições com `Origin` de outro host são recusadas.
5. O servidor resolve o usuário a partir do cookie em cada requisição e verifica papel/status antes de executar a rota.

Papéis:

| Papel | Acesso |
| --- | --- |
| `student` | Área do aluno, próprios dados, próprios pedidos. |
| `instructor` | Painel administrativo restrito aos cursos em que é instrutor. |
| `admin` | Painel completo, alunos, pedidos, cupons, configurações. |

## Regras de negócio

### Matrícula e acesso
- Curso gratuito (`price_cents = 0`): cria matrícula `active` imediatamente.
- Curso pago: cria pedido `pending`. **Nenhum acesso** é liberado até aprovação.
- Aprovação (webhook validado ou ação administrativa) cria/reativa matrícula `active`.
- Reembolso/cancelamento bloqueia a matrícula, preservando histórico.

### Progresso
- Cada aula concluída grava `lesson_progress`.
- O percentual é recalculado a partir das aulas do curso.
- A conclusão do curso considera `completion_percent` e, quando `require_assessment = 1`, a aprovação na avaliação.
- O curso permanece `active` até cumprir todas as regras.

### Avaliação
- O aluno inicia uma tentativa (`attempts`) e envia respostas.
- A correção ocorre no servidor; o gabarito nunca é enviado ao aluno.
- Respeita `pass_score` e `max_attempts`.
- A aprovação pode concluir a matrícula.

### Certificado
- Só é emitido quando a matrícula cumpre os requisitos e o curso permite certificado.
- Código no formato `BTE-AAAA-XXXXXX`, único.
- A verificação pública retorna apenas dados de conferência (aluno, curso, carga horária, data), sem dados sensíveis.

### Pagamentos
- O retorno do navegador é apenas informativo.
- O status real vem de `fetchPayment` no servidor (Mercado Pago) ou de aprovação manual.
- Webhook valida assinatura quando o segredo está configurado.
- Nenhum dado de cartão é recebido ou armazenado.

## API

Todas as respostas são JSON. Erros usam `{ "error": true, "message": "..." }` e, quando aplicável, `details`.

### Públicas

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/api/health` | Verificação de saúde. |
| GET | `/api/public/config` | Configuração pública (nome, ambiente, demo, pagamentos). |
| GET | `/api/public/categories` | Categorias ativas. |
| GET | `/api/public/courses` | Catálogo com `q`, `category`, `level`, `price`, `modality`, paginação. |
| GET | `/api/public/courses/:slug` | Detalhe, módulos, aulas e materiais de prévia. |
| GET | `/api/public/certificates/:code` | Verificação pública de certificado. |
| POST | `/api/public/contact` | Registra lead de contato. |

### Autenticação

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/api/auth/csrf` | Token CSRF. |
| GET | `/api/auth/session` | Usuário da sessão atual. |
| POST | `/api/auth/signup` | Cadastro de aluno. |
| POST | `/api/auth/login` | Login. |
| POST | `/api/auth/logout` | Encerra a sessão. |
| POST | `/api/auth/forgot-password` | Solicita redefinição. |
| POST | `/api/auth/reset-password` | Redefine com token. |
| POST | `/api/auth/change-password` | Troca de senha autenticada. |

### Aluno (requer `student`)

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/api/student/overview` | Painel do aluno. |
| GET | `/api/student/courses` | Cursos matriculados. |
| GET | `/api/student/courses/:id` | Conteúdo do curso matriculado. |
| POST | `/api/student/courses/:id/enroll` | Matrícula gratuita ou criação de pedido. |
| GET | `/api/student/lessons/:id` | Aula, materiais, navegação e anotação. |
| POST | `/api/student/lessons/:id/complete` | Marca/desmarca aula concluída. |
| PUT | `/api/student/lessons/:id/note` | Salva anotação da aula. |
| GET | `/api/student/assessments/:courseId` | Avaliação e tentativas. |
| POST | `/api/student/assessments/:courseId/attempts` | Inicia tentativa. |
| POST | `/api/student/attempts/:id/submit` | Envia respostas. |
| GET | `/api/student/attempts` | Histórico de avaliações. |
| POST | `/api/student/courses/:id/certificate` | Emite certificado. |
| GET | `/api/student/certificates` | Certificados do aluno. |
| GET | `/api/student/orders` | Pedidos do aluno. |
| GET | `/api/student/orders/:code` | Detalhe do pedido. |
| GET | `/api/student/profile` | Perfil. |
| PATCH | `/api/student/profile` | Atualiza nome e telefone. |
| POST | `/api/auth/change-password` | Troca a senha (exige senha atual). |
| GET | `/api/student/export` | Exporta os dados do titular (LGPD). |

### Administração (requer `admin` ou `instructor`, com escopo)

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/api/admin/overview` | KPIs e resumo. |
| GET/POST | `/api/admin/courses` | Lista/cria cursos. |
| GET/PATCH/DELETE | `/api/admin/courses/:id` | Detalhe, edição e arquivamento. |
| POST | `/api/admin/courses/:id/modules` | Cria módulo. |
| PATCH/DELETE | `/api/admin/modules/:id` | Edita/remove módulo. |
| POST | `/api/admin/modules/:id/lessons` | Cria aula. |
| PATCH/DELETE | `/api/admin/lessons/:id` | Edita/remove aula. |
| POST | `/api/admin/lessons/:id/materials` | Anexa material. |
| DELETE | `/api/admin/materials/:id` | Remove material. |
| PUT | `/api/admin/courses/:id/assessment` | Configura avaliação. |
| POST | `/api/admin/courses/:id/questions` | Cria questão. |
| PATCH/DELETE | `/api/admin/questions/:id` | Edita/remove questão. |
| GET | `/api/admin/students` | Lista alunos (somente admin). |
| GET/PATCH | `/api/admin/students/:id` | Detalhe/status do aluno. |
| GET | `/api/admin/instructors` | Lista instrutores. |
| POST/PATCH | `/api/admin/instructors` | Cria/edita instrutor. |
| GET/POST | `/api/admin/enrollments` | Lista/cria matrícula. |
| PATCH | `/api/admin/enrollments/:id` | Altera status da matrícula. |
| GET | `/api/admin/orders` | Lista pedidos. |
| PATCH | `/api/admin/orders/:id` | Aprova, recusa, cancela ou reembolsa. |
| GET/POST | `/api/admin/coupons` | Lista/cria cupons. |
| PATCH/DELETE | `/api/admin/coupons/:id` | Edita/remove cupom. |
| GET/POST | `/api/admin/testimonials` | Lista/cria depoimentos. |
| PATCH/DELETE | `/api/admin/testimonials/:id` | Edita/remove depoimento. |
| GET/POST | `/api/admin/faqs` | Lista/cria FAQ. |
| PATCH/DELETE | `/api/admin/faqs/:id` | Edita/remove FAQ. |
| GET/POST | `/api/admin/categories` | Lista/cria categorias. |
| PATCH/DELETE | `/api/admin/categories/:id` | Edita/remove categoria. |
| GET | `/api/admin/leads` | Lista contatos. |
| PATCH | `/api/admin/leads/:id` | Altera status do lead. |
| GET/PUT | `/api/admin/settings` | Lê/salva configurações. |
| GET | `/api/admin/activity` | Registro de atividade. |

### Webhook

| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/api/payments/mercadopago/webhook` | Notificação do provedor; valida assinatura e consulta o pagamento. |

## Front-end

| Arquivo | Papel |
| --- | --- |
| `public/assets/js/app.js` | Tabela de rotas, layouts, guards, navegação e ciclo de render. |
| `public/assets/js/api.js` | Cliente `fetch` com CSRF, tratamento de erros e redirecionamentos. |
| `public/assets/js/ui.js` | Componentes e helpers (ícones, cards, breadcrumb, modais, formatação). |
| `public/assets/js/pages/public.js` | Home, sobre, como funciona, FAQ, contato, políticas e verificação. |
| `public/assets/js/pages/catalog.js` | Catálogo e filtros. |
| `public/assets/js/pages/course.js` | Detalhe do curso e matrícula. |
| `public/assets/js/pages/auth.js` | Login, cadastro e recuperação de senha. |
| `public/assets/js/pages/student.js` | Painel, cursos, player, avaliações, certificados, pedidos e perfil. |
| `public/assets/js/pages/admin.js` | Painel e CRUDs administrativos. |
| `public/assets/css/*` | Tokens, layout e componentes responsivos. |

## SEO e indexação

- O servidor injeta título, descrição, canonical, Open Graph e JSON-LD por rota.
- `/aluno/*` e `/admin/*` recebem `noindex, nofollow`.
- `robots.txt` bloqueia áreas privadas e aponta o sitemap.
- `sitemap.xml` é gerado a partir dos cursos publicados.

## Decisões e trade-offs

| Decisão | Motivo |
| --- | --- |
| SPA sem framework | Simplicidade de deploy, zero build, carregamento rápido. |
| libSQL (Turso) com fallback SQLite | Banco único acessível por HTTP, sem módulo nativo, compatível com funções serverless; SQLite local mantém o desenvolvimento simples. |
| Sessão opaca + hash no banco | Revogação imediata e menos exposição em caso de vazamento do banco. |
| CSRF em cookie separado | Permite o cliente enviar o token sem expor o cookie de sessão. |
| Sem upload de mídia | Evita superfície de risco e dependência de storage externo. |
| Pagamento opcional | A plataforma funciona em modo demonstração e evolui para produção com credenciais. |
