# Guia de administração e conteúdo

Este guia descreve o uso do painel e o fluxo recomendado para publicar conteúdo real no lugar do conteúdo demonstrativo.

## Acesso

1. Entre em `/entrar` com uma conta `admin` ou `instructor`.
2. O sistema redireciona para `/admin`.
3. `instructor` vê apenas os cursos em que está vinculado; `admin` vê tudo.

Credenciais de demonstração:

- Admin: `admin@brasiltec.demo` / `Admin@2026`
- Instrutor: `instrutor@brasiltec.demo` / `Instrutor@2026`

> Em produção, altere a senha do admin imediatamente e defina `DEMO_MODE=0`.

## Mapa do painel

| Tela | Rota | Para quê |
| --- | --- | --- |
| Visão geral | `/admin` | KPIs, pedidos recentes, matrículas e atalhos. |
| Cursos | `/admin/cursos` | Lista, filtro, criação e arquivamento. |
| Editor de curso | `/admin/cursos/:id` | Dados, módulos, aulas, materiais e avaliação. |
| Alunos | `/admin/alunos` | Busca, perfil, matrículas e status. |
| Matrículas | `/admin/matriculas` | Matrícula manual e mudança de status. |
| Pedidos | `/admin/pedidos` | Aprovar, recusar, cancelar e reembolsar. |
| Cupons | `/admin/cupons` | Criar e gerenciar descontos. |
| Conteúdo | `/admin/conteudo` | Depoimentos, FAQ, categorias e leads. |
| Configurações | `/admin/configuracoes` | Textos institucionais e contatos. |
| Atividade | `/admin/atividade` | Auditoria das últimas ações. |

## Fluxo para publicar um curso real

1. **Categoria** — crie ou ajuste em *Conteúdo → Categorias*.
2. **Instrutor** — cadastre em *Cursos → Instrutor* (nome, titulação, bio, especialidades).
3. **Curso** — em *Cursos → Novo curso*, preencha:
   - título, subtítulo e descrição;
   - nível, modalidade e carga horária;
   - preço (`0` para gratuito);
   - imagem de capa (caminho em `/assets/img/...`);
   - certificado e avaliação obrigatória;
   - percentual mínimo de conclusão.
4. **Módulos e aulas** — no editor do curso, adicione módulos e aulas na ordem desejada. Cada aula pode ter texto, vídeo e materiais.
5. **Materiais** — anexe PDFs já publicados em `public/assets/materials/`.
6. **Avaliação** (opcional) — configure nota mínima, tentativas e questões. O gabarito fica apenas no servidor.
7. **Prévia** — o curso em `draft` não aparece no site. Use *Publicar* quando estiver pronto.
8. **Verificação** — abra `/cursos/<slug>` em uma aba anônima e confira textos, imagens, preço e botões.

### Regras de publicação

- `draft`: invisível no site.
- `published`: visível no catálogo e acessível para matrícula.
- `archived`: removido do site, mas preserva matrículas e certificados.
- O slug é gerado do título e mantido único.

## Matrículas

- **Gratuita:** o aluno clica em *Matricular* e o acesso é imediato.
- **Paga:** o aluno gera um pedido `pending`; o acesso só é liberado após:
  - confirmação do webhook do provedor (produção), ou
  - aprovação manual em *Pedidos → Aprovar*.
- **Manual:** em *Matrículas*, o admin pode matricular um aluno diretamente.
- **Status:** `active`, `completed`, `cancelled`, `blocked`.
- Bloquear/cancelar remove o acesso, mas mantém o histórico.

## Pedidos e pagamentos

| Status | Significado | Efeito |
| --- | --- | --- |
| `pending` | Aguardando pagamento/confirmação. | Sem acesso. |
| `approved` | Pagamento confirmado. | Matrícula ativa. |
| `refused` | Pagamento recusado. | Sem acesso; pode ser aprovado depois. |
| `cancelled` | Pedido cancelado. | Matrícula ativa é cancelada. |
| `refunded` | Estorno confirmado. | Acesso removido, histórico preservado. |

- A aprovação manual registra provedor `manual`, método escolhido e data de pagamento.
- O botão de aprovar **não** substitui a conferência financeira: use-o apenas após confirmar o recebimento.
- Nenhum dado de cartão é exibido ou armazenado.

## Cupons

Campos: código, tipo (`percent` ou `fixed`), valor, valor mínimo, limite de usos, validade e status.

- O código é normalizado para maiúsculas.
- O desconto é validado no servidor no momento da matrícula.
- O uso é contabilizado apenas quando o pedido é aprovado.

## Conteúdo institucional

Em *Configurações* é possível editar:

- nome e slogan do site;
- textos da home (eyebrow, título e subtítulo do hero);
- título e texto “Sobre”;
- nota institucional;
- Instagram, e-mail, telefone e horário de atendimento;
- texto de suporte;
- aviso de ambiente demonstrativo;
- data de atualização da política de privacidade.

Alterações são refletidas nas páginas públicas após recarregar.

> **Não invente dados institucionais.** Reconhecimento de cursos, números de alunos, anos de atuação e depoimentos devem vir de fontes oficiais da BrasilTec. O texto atual sobre reconhecimento é uma nota demonstrativa e deve ser revisado antes de publicar.

## Depoimentos e FAQ

- Depoimentos só podem ser publicados com **autorização registrada**.
- O nome exibido deve ser o autorizado pelo aluno.
- FAQ: mantenha perguntas curtas e respostas objetivas; use a ordem para controlar a exibição.

## Leads

Contatos do formulário público aparecem em *Conteúdo → Leads*.

- Status: `new`, `in_progress`, `done`, `archived` (conforme a interface).
- Use o status para organizar o atendimento.
- Não exporte dados de leads sem base legal e cuidado com dados pessoais (ver [LGPD](LGPD-E-SEGURANCA.md)).

## Auditoria

*Atividade* mostra as 100 ações mais recentes com autor, ação, entidade e descrição. Use para:

- conferir aprovações de pedidos;
- investigar alterações de curso;
- acompanhar acessos e falhas de login.

## Checklist antes de publicar

- [ ] `DEMO_MODE=0` e aviso demonstrativo removido.
- [ ] Credenciais demo desativadas ou com senha trocada.
- [ ] Cursos reais publicados e cursos demo arquivados.
- [ ] Depoimentos com autorização registrada.
- [ ] Nota institucional revisada pela BrasilTec.
- [ ] Contatos oficiais preenchidos.
- [ ] Política de privacidade e termos revisados juridicamente.
- [ ] Imagens com direitos de uso confirmados.
- [ ] Backup do banco configurado.
