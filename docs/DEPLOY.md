# Deploy e operação

## Pré-requisitos

- Node.js **24 LTS** (ou superior) no servidor.
- Um domínio com HTTPS (obrigatório para cookies seguros e para o Mercado Pago).
- Processo supervisionado (systemd, PM2 ou container).
- Diretório de dados persistente e com backup para o SQLite.

O projeto não tem dependências de produção, então **não é necessário `npm install`**. Basta copiar o diretório e rodar o Node.

## Variáveis de produção

Crie `.env` a partir de `.env.example`:

```dotenv
APP_ENV=production
PORT=4173
APP_URL=https://app.brasilteceducacao.com.br
APP_NAME=BrasilTec Educação
DB_PATH=data/brasiltec.db
DEMO_MODE=0
COOKIE_SECURE=1

ADMIN_NAME=Administração BrasilTec
ADMIN_EMAIL=admin@seudominio.com.br
ADMIN_PASSWORD=<senha-forte-gerada>

RESEND_API_KEY=<chave>
MAIL_FROM=BrasilTec Educação <no-reply@seudominio.com.br>
SUPPORT_EMAIL=suporte@seudominio.com.br

MP_ACCESS_TOKEN=<token>
MP_WEBHOOK_SECRET=<segredo>
MP_PUBLIC_KEY=<chave-publica>

LOGIN_MAX_ATTEMPTS=8
LOGIN_WINDOW_MINUTES=15
```

Regras:

- `APP_URL` deve ser a URL pública final (sem barra no fim). É usada em e-mails, links e retorno de pagamento.
- `COOKIE_SECURE=1` exige HTTPS; com HTTP os cookies não serão enviados.
- `DEMO_MODE=0` remove a faixa de demonstração e os acessos rápidos.
- Nunca versione o `.env`.

## Primeira subida

```bash
node server/server.js
```

O banco e o schema são criados automaticamente em `DB_PATH`. Com banco vazio:

- a conta admin é criada com `ADMIN_*`;
- o conteúdo demonstrativo é inserido **se** o modo demonstração estiver ativo.

> Se você quer um banco de produção vazio (sem cursos demo), defina `DEMO_MODE=0` **antes** do primeiro start. Caso contrário, arquive os cursos demonstrativos pelo painel.

## systemd

`/etc/systemd/system/brasiltec.service`:

```ini
[Unit]
Description=BrasilTec Educação
After=network.target

[Service]
Type=simple
User=brasiltec
Group=brasiltec
WorkingDirectory=/srv/brasiltec-ead
ExecStart=/usr/bin/node server/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

# Proteções básicas
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/srv/brasiltec-ead/data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now brasiltec
sudo systemctl status brasiltec
journalctl -u brasiltec -f
```

O servidor trata `SIGTERM`/`SIGINT` e encerra de forma ordenada.

## Nginx como proxy reverso

```nginx
server {
    listen 80;
    server_name app.brasilteceducacao.com.br;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.brasilteceducacao.com.br;

    ssl_certificate     /etc/letsencrypt/live/app.brasilteceducacao.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.brasilteceducacao.com.br/privkey.pem;

    client_max_body_size 2m;

    location / {
        proxy_pass http://127.0.0.1:4173;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

> **Atenção:** o servidor usa o IP da conexão (`req.socket.remoteAddress`) para rate limit. Atrás de proxy, todos os clientes compartilham o IP do proxy. Para produção atrás de Nginx, ajuste `server.js` para confiar em `X-Forwarded-For` **apenas** quando a conexão vier do proxy local, ou aplique rate limit no próprio Nginx. Sem isso, o limite de login pode bloquear usuários legítimos.

## Backup e restauração

O SQLite usa WAL. Para backup consistente:

```bash
# parada breve (recomendado)
sudo systemctl stop brasiltec
cp data/brasiltec.db "backup/brasiltec-$(date +%F-%H%M).db"
sudo systemctl start brasiltec

# ou online, usando a API de backup do SQLite (ex.: sqlite3 .backup)
sqlite3 data/brasiltec.db ".backup 'backup/brasiltec-$(date +%F-%H%M).db'"
```

Guarde cópias criptografadas fora do servidor. Teste a restauração periodicamente:

```bash
sudo systemctl stop brasiltec
cp backup/brasiltec-AAAA-MM-DD-HHMM.db data/brasiltec.db
rm -f data/brasiltec.db-wal data/brasiltec.db-shm
sudo systemctl start brasiltec
```

## Atualização

```bash
sudo systemctl stop brasiltec
# copie os arquivos novos (sem sobrescrever data/ nem .env)
sudo systemctl start brasiltec
```

- O schema é criado/atualizado de forma idempotente na inicialização.
- Faça backup antes de qualquer atualização.
- Se houver mudança incompatível de schema, ela deve ser implementada como migração explícita (hoje o projeto não possui sistema de migrações versionadas).

## Pagamentos (Mercado Pago)

1. Crie a aplicação no painel do Mercado Pago e obtenha o access token.
2. Configure `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY` e `MP_WEBHOOK_SECRET`.
3. Cadastre a URL de webhook: `https://seu-dominio/api/payments/mercadopago/webhook`.
4. Faça um pedido de teste e confira:
   - pedido `pending` antes do pagamento;
   - webhook recebido e validado;
   - pedido `approved` e matrícula ativa depois;
   - nenhum acesso liberado apenas pelo retorno do navegador.

Sem credenciais, o checkout cria o pedido e o painel permite aprovação manual.

## E-mail (Resend)

1. Verifique o domínio no Resend.
2. Configure `RESEND_API_KEY` e `MAIL_FROM` com um remetente do domínio verificado.
3. Teste recuperação de senha e boas-vindas.

Sem chave, os e-mails não são enviados; no modo demonstrativo o link de redefinição aparece na tela.

## Monitoramento

- **Saúde:** `GET /api/health` deve retornar `200` com `{ "ok": true }`.
- **Logs:** stdout/stderr via systemd/journal.
- **Erros 5xx:** acompanhe `journalctl`; erros inesperados são registrados com prefixo `[api]`.
- **Disco:** monitore o crescimento de `data/` e dos backups.
- **Auditoria:** consulte `/admin/atividade` para ações sensíveis.

## Checklist de go-live

- [ ] HTTPS ativo e redirecionando HTTP → HTTPS.
- [ ] `APP_ENV=production`, `DEMO_MODE=0`, `COOKIE_SECURE=1`.
- [ ] Senha do admin trocada; credenciais demo desativadas.
- [ ] Conteúdo demonstrativo substituído ou arquivado.
- [ ] Nota institucional e depoimentos revisados.
- [ ] Política de privacidade e termos publicados.
- [ ] Backup automático configurado e restauração testada.
- [ ] `GET /api/health` monitorado.
- [ ] Webhook de pagamento testado ponta a ponta (se ativo).
- [ ] E-mail transacional testado (se ativo).
- [ ] `sitemap.xml` e `robots.txt` conferidos no domínio real.
- [ ] Teste manual em celular, tablet e desktop.
- [ ] Acessibilidade revisada (teclado, foco, contraste, leitor de tela).

## Deploy na Vercel (serverless)

A Vercel não mantém um processo Node de longa duração nem disco persistente.
Por isso o projeto tem dois modos:

- **Local/VPS:** `node server/server.js` com SQLite em `data/`.
- **Vercel:** `api/index.js` (função catch-all) + `public/` no CDN + **Turso**
  (libSQL via HTTP) como banco compartilhado.

Passos resumidos (detalhes no README):

1. Crie um banco no Turso e gere um token.
2. Defina `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `APP_URL` e
   `APP_ENV=production` nas variáveis de ambiente da Vercel.
3. Faça o deploy (push no GitHub ou `vercel --prod`).

O `vercel.json` já configura:

- `outputDirectory: "public"` (front-end no CDN);
- rewrite de todas as rotas para `/api/index`;
- `includeFiles: "public/**"` (o servidor lê `index.html` para injetar SEO).

Sem Turso em produção a aplicação falha com uma mensagem explícita — isso evita
subir um site que "funciona" mas perde dados a cada cold start.

## Escala

No modo VPS o desenho é de **uma instância** com SQLite. Na Vercel o banco é o
Turso (compartilhado entre as funções). Para cargas maiores:

1. use o Turso com réplicas na região da função;
2. mantenha sessões no banco (já é o caso);
3. use storage de objetos para imagens, vídeos e PDFs;
4. coloque o webhook atrás de fila/idempotência distribuída.
