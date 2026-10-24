# LGPD e segurança

> Este documento descreve **o que a plataforma implementa** e serve como ponto de partida operacional. Não substitui assessoria jurídica. A BrasilTec deve revisar bases legais, prazos e textos com responsável de privacidade/DPO.

## Dados tratados

| Categoria | Exemplos | Onde fica | Finalidade |
| --- | --- | --- | --- |
| Identificação | nome, e-mail, telefone | `users` | Conta, acesso e comunicação. |
| Autenticação | hash de senha, hash de sessão, IP, user agent | `users`, `sessions` | Segurança e prevenção a fraude. |
| Aprendizagem | matrículas, progresso, anotações, tentativas, notas | `enrollments`, `lesson_progress`, `notes`, `attempts` | Prestação do serviço educacional. |
| Certificação | nome no certificado, curso, carga horária, código | `certificates` | Emissão e verificação pública. |
| Comercial | pedidos, valores, cupom, status, referência do provedor | `orders`, `payments` | Cobrança e suporte. |
| Atendimento | nome, e-mail, telefone, assunto, mensagem | `leads` | Responder contatos. |
| Auditoria | autor, ação, entidade, descrição | `activity_log` | Segurança e rastreabilidade. |

**Não são coletados nem armazenados:** número de cartão, CVV, dados bancários completos. O checkout usa página hospedada do provedor.

## Bases legais (referência)

- **Execução de contrato:** conta, matrícula, acesso ao curso, progresso, certificado e cobrança.
- **Cumprimento de obrigação legal/regulatória:** registros fiscais e de auditoria aplicáveis.
- **Legítimo interesse:** segurança, prevenção a fraude e melhoria do serviço, com avaliação de impacto.
- **Consentimento:** comunicações de marketing e depoimentos publicados (com autorização registrada).
- **Exercício regular de direitos:** defesa em processos.

A base aplicável a cada tratamento deve ser validada pela instituição.

## Direitos do titular

| Direito | Como é atendido hoje |
| --- | --- |
| Confirmação e acesso | Área do aluno + `GET /api/student/export`. |
| Correção | Edição de nome e telefone no perfil; e-mail via suporte. |
| Portabilidade | Exportação em JSON pelo próprio aluno. |
| Informação sobre compartilhamento | Seção “Terceiros” abaixo. |
| Revogação de consentimento | Suporte; para marketing, solicitar descadastro. |
| Eliminação | Solicitação ao suporte; exclusão manual pelo administrador, respeitando prazos legais. |

Não há autoexclusão de conta na interface. O atendimento deve registrar a solicitação, confirmar a identidade e executar o procedimento interno.

## Cookies e sessão

| Cookie | Finalidade | Acessível por JS | Duração |
| --- | --- | --- | --- |
| `bte_session` | Sessão autenticada | Não (`HttpOnly`) | 30 dias |
| `bte_csrf` | Proteção CSRF | Sim | 30 dias |

- Não há cookies de publicidade, analytics ou rastreamento de terceiros.
- O aviso de cookies informa o uso de cookies essenciais.
- Em produção, `COOKIE_SECURE=1` exige HTTPS.

## Medidas de segurança implementadas

- Senhas com `scrypt` e salt individual; nunca em texto puro.
- Sessões opacas: o banco guarda apenas SHA-256 do token.
- CSRF obrigatório em métodos mutantes, com token por sessão.
- Verificação de origem (`Origin`) em requisições mutantes.
- Autorização por papel e por escopo (instrutor só acessa seus cursos) no servidor.
- Rate limit de login, cadastro e contato.
- Validação e limite de tamanho de todos os campos.
- Consultas parametrizadas (sem concatenação de entrada do usuário).
- Trilha de auditoria para ações sensíveis.
- Cabeçalhos de segurança: `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`/`frame-ancestors`.
- Áreas privadas com `noindex, nofollow`.
- Segredos apenas no servidor (`.env`), nunca no bundle do cliente.

## Terceiros

| Serviço | Quando é usado | Dados enviados |
| --- | --- | --- |
| Mercado Pago | Apenas se `MP_ACCESS_TOKEN` estiver configurado. | Valor, referência do pedido, e-mail/nome do pagador na preferência; o pagamento ocorre no ambiente do provedor. |
| Resend | Apenas se `RESEND_API_KEY` estiver configurado. | E-mail, nome e conteúdo transacional (boas-vindas, redefinição). |

Sem credenciais, esses serviços ficam desativados. Ao ativá-los, formalize contrato de operador e avalie transferência internacional.

## Retenção

Sugestão de política a validar com a instituição:

| Dado | Prazo sugerido |
| --- | --- |
| Conta e matrícula | Enquanto houver relação + prazo legal aplicável. |
| Certificados | Prazo de validade/verificação definido pela instituição. |
| Pedidos e pagamentos | Prazo fiscal e contábil aplicável. |
| Leads | Até conclusão do atendimento + prazo de defesa. |
| Logs de atividade | Prazo curto de segurança (ex.: 6–12 meses). |
| Sessões expiradas | Removidas na expiração/consulta. |

## Backup e incidentes

1. Faça backup do arquivo SQLite e guarde cópia criptografada fora do servidor.
2. Restrinja acesso ao backup e teste a restauração periodicamente.
3. Em caso de incidente: contenha, registre, avalie risco aos titulares e comunique a ANPD e os titulares quando exigido.
4. Preserve evidências (logs, `activity_log`) e documente a linha do tempo.
5. Revogue sessões e credenciais comprometidas.

## Checklist de privacidade antes de publicar

- [ ] Política de privacidade revisada e com data atualizada.
- [ ] Termos de uso revisados.
- [ ] Base legal documentada por finalidade.
- [ ] Canal de atendimento ao titular divulgado.
- [ ] Depoimentos com autorização registrada.
- [ ] Contratos com operadores (pagamento/e-mail) formalizados.
- [ ] Backup e retenção definidos.
- [ ] `DEMO_MODE=0`, credenciais demo removidas e `COOKIE_SECURE=1`.
- [ ] Revisão de acessibilidade e de conteúdo institucional concluída.
