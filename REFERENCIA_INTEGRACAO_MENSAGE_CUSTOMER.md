# Integração CENAT Mensage ↔ Customer 360 — Documento de Referência Completo

> **O que é este documento:** o registro completo da integração entre o **CENAT Mensage** (motor
> de WhatsApp oficial + não-oficial) e o **Customer 360** (inteligência de clientes), construída em
> Jun/2026. Arquitetura, decisões, contrato da ponte, modelo de dados, cada sprint, estado atual,
> infra, pendências e futuro. Pra retomar contexto a qualquer momento.
>
> **Data de referência:** 16/06/2026. **Status macro:** loop oficial (inbound + outbound) fechado em
> produção; página oficial completa no ar; pendências de higiene e merge.

---

## 0. Orientação rápida (leia primeiro se voltou depois de um tempo)

- **O objetivo:** mandar/receber WhatsApp **oficial (Meta)** e **não-oficial (Evolution/Farmer)**
  de dentro do Customer, disparando pra base de clientes (o 360) e com inbox dentro do Customer.
- **A arquitetura que venceu:** o **Mensage continua sendo o motor** (fica no Servidor A), o
  **Customer é o dono do inbox e do comando** (Servidor B). Os dois conversam por **HTTP** (uma
  "ponte"), nunca por Postgres cruzado. **Não** consolidamos num banco só — isso é o futuro (ver §10).
- **Onde está rodando:**
  - Mensage → Servidor A, domínio `cenat.whatsflow.cloud`.
  - Customer → Servidor B, domínio `cenatdata.online`. A página oficial é `cenatdata.online/whatsapp-oficial`.
- **O que está provado:** inbound oficial real (conversa "Álefe Lins"), outbound oficial destravado,
  disparo oficial por template (envio real entregue pelo Meta), página oficial completa.
- **O que falta:** merge das branches na main, rotação dos secrets, fechar a porta 5433 no SG,
  validar o caso da Farmer de 8 dígitos com tráfego real, e (futuro) plugar IA + consolidar banco.

---

## 1. O objetivo (o que o diretor pediu)

Enviar/disparar mensagens — por **API oficial (Meta)** e **não-oficial (Evolution)** — para as
pessoas que estão **dentro do Customer** (a base de 40k clientes do 360), com um **front de chat/
inbox dentro do Customer** (exigência). Resumindo: o Customer vira o cockpit; o WhatsApp (os dois
canais) opera por baixo.

---

## 2. Os dois sistemas

### 2.1 CENAT Mensage (o motor) — Servidor A
- **Stack:** FastAPI **async** + SQLAlchemy async + Alembic. Schema `mensageria`.
- **O ativo central:** abstração de provider — `app/messaging/provider.py` → `get_provider(channel)`
  devolve `MetaProvider` (oficial) **ou** `EvolutionProvider` (não-oficial), mesma interface
  `send_text/send_media/send_template`. O campo `Channel.provider` decide o caminho. **Já resolvia
  oficial + não-oficial antes da integração** — foi o motivo de o Mensage ser o motor.
- **Módulos:** `app/meta/` (Cloud API oficial completa), `app/evolution/` (Evolution completa),
  `app/chatbot/engine.py` (~1000 linhas, motor de chatbot visual), `app/broadcast/` +
  `app/campaign/` (workers de disparo), contact lists, templates, media.
- **Auth:** JWT HS256, tabela `mensageria.users`.
- **Onde roda (Servidor A):** EC2 `13.221.209.242` (público) / `172.26.10.190` (privado), VPC
  `vpc-010bc23592882ac7e`. Domínio `cenat.whatsflow.cloud`.
  - Backend: `systemd mensageria.service`, `uvicorn app.main:app :3020` (localhost), dir
    `/home/ubuntu/mensageria`, lê `.env` do próprio dir (perm 600).
  - Frontend Mensage: `mensageria-frontend.service`, Next.js `:3030`.
  - Evolution API: docker `evoapicloud/evolution-api:v2.3.7`, `:8080`.
  - Postgres: docker `postgres:15-alpine`, `127.0.0.1:5432` (não exposto), db `evolution`, schemas
    `mensageria` (do Mensage) + `public` (Evolution/Prisma, 37 tabelas). **Sem FK cross-schema.**
  - nginx: `cenat.whatsflow.cloud` (SSL Let's Encrypt), `/api/`→3020, `/`→3030. Evolution exposta
    por IP em `:8080`.
  - Legados: webhooks em `:3010` e `:5000` (não usados na integração).

### 2.2 Customer 360 (o host) — Servidor B
- **Stack:** FastAPI **sync** (psycopg2 + SQLAlchemy core). Schemas `core`/`metrics`/`mart`/`comm`/
  `raw`/`stg`/`audit`. **Sem Alembic** (migrations via `.sql`).
- **O ativo central:** o perfil 360 do cliente. 40.526 clientes, 79.791 pedidos, R$17,5M. RFM,
  ativo/inativo, dashboards. `comm.wa_contacts.customer_id` liga o telefone ao `core.customer`.
- **Auth:** JWT, tabela `core.users`, roles Admin/Operacional/Viewer.
- **Onde roda (Servidor B):** EC2 `100.24.2.187` / `ip-172-26-6-137`. Domínio `cenatdata.online`.
  - API: `:8001`. Frontend Next.js 14: `:3001`. Postgres `postgres:15` db `customer360` (`:5433`
    externo / `:5432` interno).
  - nginx: `cenatdata.online` (SSL), `/api/`→8001, `/`→3001.
  - **Importante:** desde a integração, **api e front rodam via `docker run`** (não compose) por
    causa de um bug do `docker-compose 1.29` (`ContainerConfig`). Ver §8.
  - Recursos: 2 vCPU, **1,9 GiB RAM** (gargalo — por isso não hospeda o Mensage), swap 4 GiB
    (adicionado na S2), disco 58 GB.

---

## 3. A decisão de arquitetura (e por que NÃO consolidamos)

Três caminhos foram avaliados:
- **A — Serviço/Sidecar:** Mensage continua como está, Customer consome por HTTP. ← **escolhido.**
- **C — Sub-app + banco único:** montar o Mensage dentro do Customer, um Postgres só. ← **futuro.**
- **B — Reescrever async→sync:** portar o motor pro app sync do Customer. ← **descartado** (semanas,
  regressão garantida, reescrever o chatbot async é a armadilha).

**Por que A e não C agora**, apesar de C ser "mais bonito":
1. **Servidor B não aguenta hospedar o Mensage** — 1,9 GiB RAM sem folga; subir mais um FastAPI +
   4 workers = risco de OOM derrubando o Postgres do 360.
2. **Banco cruzado entre servidores seria escrita pela internet + Postgres exposto** — o PG do B já
   estava exposto em `0.0.0.0:5433` com senha fraca; ampliar isso é vulnerabilidade.
3. **Dado ≠ compute:** guardar mensagens no Customer é trivial; o que pesava era rodar o *backend*
   do Mensage no B. O backend fica no A; o Customer só ganha tabelas.

**O desenho final:**
- **Mensage = motor** (oficial + não-oficial + broadcast + chatbot), fica no Servidor A.
- **Customer = dono do inbox** (dado em `comm.*`, UI no Next.js) e **comandante do disparo**;
  dono do 360 e do público.
- **Ponte HTTP** entre os dois (ver §4). Nunca Postgres cruzado.
- **Não-oficial (Farmer):** o Customer fala com a Evolution **direto** (já fazia).
- **Vínculo com o cliente 360 acontece na borda:** o Mensage entrega o telefone, o Customer resolve
  o `customer_id` (ver §5, o linker).
- **A UI é única:** tudo comandado pela tela do Customer; o Mensage é invisível pro usuário.

---

## 4. A ponte (o contrato HTTP entre os dois sistemas)

> **Autenticação — dois segredos, dois sentidos, independentes:**
> - **Customer → Mensage:** header `X-Service-Token` (= `SERVICE_TOKEN`, 64 chars).
> - **Mensage → Customer:** header `X-Webhook-Secret` (= `WEBHOOK_SECRET`, 64 chars).
> - **Os dois valores são idênticos nos dois servidores** (no `.env` do A e no `docker/.env` do B).
>   Se divergirem, a ponte falha calada (401/403). Eles passaram pelo chat → **rotacionar** (§9).

### 4.1 Customer → Mensage (base `https://cenat.whatsflow.cloud/api`)
Os endpoints de envio/broadcast aceitam **auth dupla**: JWT de usuário **OU** `X-Service-Token`
(implementado em `app/service_auth.py` → `get_user_or_service`). Vivem no `bridge_router`.
- `POST /meta/channels/6/send-text` `{to, text}` → `{status, wa_message_id, graph_response}`
- `POST /meta/channels/6/send-template` `{to, template_name, language_code, components}` → idem
- `POST /meta/channels/6/send-media` `{to, media_type, media_link|media_base64, mime_type, filename, caption}` → idem (criado na S1.3)
- `GET /meta/channels/6/templates` → lista de templates (auth dupla desde a S1.2)
- `POST /broadcasts` `{name, channel_id, audience_type:"csv", audience_spec:{contacts:[{wa_id,name}]}, message_payload, interval_seconds, scheduled_at}` → `{id}` (=job_id)
  - `message_payload` oficial: `{template_id, template_params:{"1":"...","2":"..."}}` (dict posicional, interpola `{nome}` por contato)
  - `message_payload` não-oficial: `{text, media_id?}`
- `GET /broadcasts/{id}` e `GET /broadcasts/{id}/logs` → status/progresso
- `POST /broadcasts/{id}/cancel`

> Endpoints **administrativos** do `/api/meta` (create/list/delete channel etc.) seguem **só-JWT** —
> não foram abertos pra service token.

### 4.2 Mensage → Customer (base `https://cenatdata.online`, validam `X-Webhook-Secret`)
Receivers em `src/webhook_api/relay_router.py` (sem JWT; fail-closed se o secret não bater):
- `POST /api/whatsapp/relay/inbound` `{wa_id, wa_message_id, message_type, content, timestamp, sender_name, channel:{id, provider, name}}` → grava `comm.*` `provider='official'` + chama `comm.link_customer(wa_id)`
- `POST /api/whatsapp/relay/status` `{wa_message_id, status}` → atualiza status (respeita received<sent<delivered<read)
- `POST /api/whatsapp/relay/broadcast-progress` `{job_id, status, sent_count, error_count, total_targets}` → atualiza `comm.broadcast_jobs` por `mensage_job_id`

### 4.3 Fluxos completos
- **Inbound oficial:** WhatsApp → webhook do Meta no Mensage → Mensage persiste + relaya → Customer
  grava `comm.*` `provider='official'` + liga `customer_id` → aparece no inbox oficial.
- **Outbound oficial 1:1:** UI do Customer → `/api/whatsapp/send/text {provider:official}` → backend
  do Customer chama a ponte (`/meta/channels/6/send-text`, X-Service-Token) → Meta → grava `comm.*`.
- **Disparo:** UI do Customer monta segmento (filtros do 360) → resolve lista `{wa_id,name}` →
  `POST /broadcasts` no Mensage → worker dispara (template oficial / texto não-oficial) com intervalo
  → `broadcast-progress` volta pro Customer → progresso na tela.
- **Não-oficial (Farmer):** Customer ↔ Evolution **direto** (webhook da Farmer e envio), sem passar
  pela ponte do Mensage.

---

## 5. Modelo de dados (Customer `comm.*` + o linker)

### 5.1 Tabelas
- **`comm.wa_contacts`** — `wa_id` (unique), `name`, `phone_normalized`, `customer_id` (FK
  `core.customer`), `channel_name`, `lead_status`, `notes`, `ai_active` (flag vestigial, nada lê),
  `assigned_to` (FK `core.users`), `last_message`/`_time`/`_direction`, `unread`, `is_active`,
  **`provider`** (`official|unofficial`, S2), **`channel_id`** (S2). Tags via `comm.contact_tags`.
- **`comm.wa_messages`** — `wa_message_id` (unique, dedup), `contact_wa_id` (FK), `direction`,
  `message_type`, `content`, `timestamp`, `status`, `sent_by_ai`, **`provider`** (S2), **`channel_id`** (S2).
- **`comm.sms_messages`** — SMS via Comtele (pré-integração).
- **`comm.broadcast_jobs`** (S2) — espelho local do disparo: `mensage_job_id`, `audience_summary`,
  `scheduled_at`, `status`, `total/sent/error_count`, `created_by`.
- **`comm.tags`** + **`comm.contact_tags`** (S5) — tags CRM e o vínculo contato↔tag.

### 5.2 O linker de telefone (S2) — peça crítica do vínculo 360
- **Coluna:** `core.customer.phone_canon` — telefone normalizado: só dígitos, tira DDI `55`,
  resultado 10 (fixo) ou 11 (celular com 9) dígitos. **Heurística do 9º dígito:** a Farmer entrega
  `55+DDD+8 dígitos` (sem o 9º), mas o cadastro tem 11 — então a normalização **insere o 9º** em
  celulares de 10 díg (1º dígito local ∈ {6,7,8,9} = móvel). Sem isso, match exato dá 0.
- **Índice** em `phone_canon` (Index Scan confirmado, não Seq Scan).
- **Função:** `comm.link_customer(wa_id)` → normaliza o wa_id e casa com `phone_canon`.
- **Cobertura:** dos 40.526 clientes, só **8.710 têm telefone real** (resto é string vazia); desses,
  **8.295 normalizaram** (95,2%), 415 viraram NULL (sem DDD, não-casáveis).
- **Status de validação:** provado sinteticamente (um número DDD 22, 11 díg, ligou `customer_id=3`).
  **Ainda NÃO validado** com um inbound real da Farmer de 8 dígitos (o pior caso) — pendência (§9).

---

## 6. O canal oficial e a Farmer (config concreta)

- **Canal oficial (no Mensage):** `mensageria.channels` id **6**, "Cenat - Financeiro (Meta)",
  `phone_number_id=1064349166769130`, `waba_id=979635254656744`, `whatsapp_token` SET,
  `is_connected=true`. → `OFFICIAL_CHANNEL_ID=6` no Customer.
- **Templates aprovados:** `teste_financeiro` (pt_BR, MARKETING, APPROVED — tem variáveis
  `{{1}}`/`{{2}}`), `hello_world` (en_US, UTILITY, APPROVED). Pra disparo real, precisa criar
  templates de marketing e esperar aprovação da Meta (dias).
- **A Farmer (não-oficial):** instância Evolution, owner `558388046720@s.whatsapp.net`. Conecta por
  **QR** na UI do Customer (`/whatsapp`). **NÃO é um `Channel` no Mensage** (lá só existe o canal 9
  "comunicados", evolution, desconectado). → **`UNOFFICIAL_CHANNEL_ID` está vazio** = disparo em
  massa não-oficial fica fora até cadastrar a Farmer como canal no Mensage. Inbox 1:1 e envio
  não-oficial funcionam (Customer fala com a Evolution direto).
- **Janela de 24h:** na API oficial, fora de 24h só vale **template**; texto livre só dentro da
  janela. A UI avisa.

---

## 7. Log de sprints (o que cada uma fez)

> Convenção: cada sprint roda na sessão do Claude Code do servidor da sua etiqueta. **Servidor A**
> = Mensage (`/home/ubuntu/mensageria`). **Servidor B** = Customer (`/home/ubuntu/Customer-Intelligence`).
> Branches separadas; **main ainda não tem S2–S5** (merge pendente).

| Sprint | Servidor | Branch | O que fez | Status |
|---|---|---|---|---|
| **S1** | A | `s1-ponte-mensage-20260615` | Fundação da ponte: `SERVICE_TOKEN`, `WEBHOOK_SECRET`, `APP_ENV=production`; relay inbound/status/progress; proteção dos endpoints de broadcast com auth dupla | ✅ |
| **S1.1** | A | `s1-1-disparo-template-20260615` | Disparo oficial por template no worker. O ramo de template já existia; o fix foram 3 bugs (formato dict de `template_params`, escopo por canal, erro claro). **Provado real:** job 50 → número real → Meta **delivered** + template interpolado | ✅ |
| **S1.2** | A | (mesma branch, commit `44523f6`) | Fix do 401: `list_templates` e `sync_templates` movidos de `@router` (só-JWT) → `@bridge_router` (auth dupla). Destravou o outbound oficial | ✅ |
| **S1.3** | A | `s1-3-send-media-20260616` (commit `46fa5de`) | Endpoint `POST /meta/channels/{id}/send-media` no bridge_router (mídia oficial 1:1, `media_link` ou base64) | ✅ |
| **S2** | B | `s2-fundacao-customer-20260616` | Fundação: colunas `provider`/`channel_id` em `comm.*`; `comm.broadcast_jobs`; **linker** (`phone_canon` + índice + `comm.link_customer`, heurística 9º dígito); swap 4 GiB; role `mensage_rw`; mem_limit | ✅ |
| **S3** | B | `s3-backend-mensageria-20260616` | Backend do Customer: receivers de relay; envio oficial via ponte; Evolution unificado por provider; orquestração de disparo (preview/create/list/cancel) | ✅ |
| **S4** | B | `s4-cockpit-ui-20260616` | Cockpit: inbox existente estendido (selo de canal, seletor de envio, painel 360, header de status); nova tela `/disparo` | ✅ |
| **S4.2** | B | `s4-2-pagina-oficial-20260616` | Página dedicada `/whatsapp-oficial` (filtro `provider=official`). *(S4.1 — "destrancar o gate da Farmer" — foi proposta mas substituída por esta página separada, a pedido do Álefe)* | ✅ |
| **S5** | B | `s5-oficial-full-20260616` | Página oficial **completa**: tags (`comm.tags`+`contact_tags`), atribuir a atendente, mídia/voz (via S1.3), status por ícone, busca/filtros, painel 360. **Sem IA, sem Exact** | ✅ |

---

## 8. Estado atual (o que funciona, o que falta)

### Funciona / provado
- ✅ **Cutover em produção:** Customer rodando o código novo (S3+), via `docker run`, sem derrubar
  WhatsApp/SMS antigos.
- ✅ **Inbound oficial real:** conversa "Álefe Lins" (canal 6) chegou pelo relay → `comm.*` →
  aparece em `/whatsapp-oficial`. (`customer_id` NULL porque Álefe não é cliente — correto.)
- ✅ **Outbound oficial destravado:** a ponte (`X-Service-Token`) responde 200 após a S1.2.
- ✅ **Disparo oficial por template:** envio real entregue pelo Meta (job 50).
- ✅ **Página oficial completa:** tags, atribuir, status por ícone, mídia/voz, busca/filtros, 360,
  sem IA, sem cérebro. No ar em `cenatdata.online/whatsapp-oficial`.
- ✅ **Tela `/disparo`:** preview real do segmento (ex.: 5.213 inativos), agendamento, progresso, cancel.

### Falta validar / pendente
- ⏳ **Caso da Farmer de 8 dígitos** com tráfego real (o pior caso da heurística do linker). Conectar
  a Farmer (QR) e mandar um inbound real dela de um cliente conhecido.
- ⏳ Smoke visual completo do envio oficial pela página (agora que a ponte está 200).

---

## 9. Pendências de higiene e segurança (fazer numa janela tranquila)

1. **Merge das branches na main:** `s2 → s3 → s4 → s4.2 → s5` (Customer) e as do Mensage. Hoje tudo
   vive em branch; produção roda o **build**, não o git. Mergear **depois** de confirmar o envio
   oficial fim a fim pela tela.
2. **Rotacionar secrets que passaram pelo chat:** `SERVICE_TOKEN` e `WEBHOOK_SECRET` (gerar novos,
   atualizar nos dois servidores ao mesmo tempo).
3. **Trocar secrets fracos:** `DB_PASSWORD` (estava `postgres/postgres`), `JWT_SECRET_KEY` (estava
   literal `...change-me`) — janela controlada, derruba sessões.
4. **Fechar o Postgres exposto:** AWS Security Group, restringir inbound TCP `5433` **só ao IP do
   Servidor A** (`13.221.209.242`), nunca `0.0.0.0/0`. (Console AWS — fora do alcance do Claude Code.)
5. **Servidor A sem git remote:** S1/S1.1/S1.2/S1.3 só como commit local. Adicionar remote e dar push.
6. **`docker-compose up` quebrado no Servidor B** (bug `ContainerConfig` do compose 1.29): api e
   front rodam via `docker run --restart unless-stopped`. **Instalar `docker compose v2`** pra parar
   de depender do `docker run` a cada deploy.
7. **Registro de teste `5511999999999`** no Servidor A (criado num smoke da S1.3) — autorizar o
   agente a remover (contato + mensagens desse número fictício).

---

## 10. Futuro (o que ficou pra depois, deliberadamente)

- **Consolidação (Estratégia C):** quando o Servidor B for **upsized** (mais RAM), migrar pra **um
  Postgres só** (schemas `core`/`comm`/`mensageria` juntos), montar o Mensage como sub-app do
  Customer, unificar auth, vínculo `customer_id` nativo. Aí destrava: **supressão de opt-out e dedup
  "já recebeu"** contra a base, e **métricas de conversão por segmento** (1+1 vira 3).
- **Plugar a IA de verdade:** o toggle de IA ficou de fora da página oficial (o Customer não tem
  motor; o cérebro vive no Mensage/chatbot). Conectar a IA do Mensage ao inbox é sprint própria.
- **Disparo em massa não-oficial:** cadastrar a Farmer como `Channel` no Mensage + setar
  `UNOFFICIAL_CHANNEL_ID`.
- **Integração real do Exact Spotter** (se o negócio pedir; hoje o painel 360 cobre esse lugar).
- **Templates de marketing reais** aprovados na Meta pros disparos oficiais de verdade.
- **WebSocket** no lugar do polling de progresso do disparo (se o volume justificar).

---

## 11. Gotchas e lições (pra não repetir e pra entender o "porquê")

- **A UI é a superfície de validação.** Três vezes a tela expôs furos que os smokes de backend não
  pegaram: o **401 do `SERVICE_TOKEN`** (a direção Customer→Mensage nunca tinha rodado), e o **gate
  do QR da Farmer** bloqueando o inbox. Curl não pega isso; a tela pega.
- **Disciplina de roteamento de sprint:** o cabeçalho de cada prompt diz o servidor, e a **primeira
  linha de `cd` revela a máquina** (`cd /home/ubuntu/mensageria` = A; `cd .../Customer-Intelligence`
  = B). Se o `cd` não encontra o diretório, é sessão errada. Os agentes **recusaram inventar o repo**
  na máquina errada duas vezes — comportamento correto.
- **Guardrails de segurança:** os agentes **recusaram** dumpar secrets pra arquivo e **deletar de DB
  compartilhado** sozinhos. Secrets e deleção destrutiva = **mão do Álefe**, com `!` na sessão do
  Claude Code ou no terminal direto.
- **`!` vs terminal puro:** o `!` só vale **dentro** da sessão do Claude Code. No terminal do
  servidor, é **sem** `!` (senão o `!` vira negação do bash e pula o comando).
- **Capturar-antes-de-recriar (cutover):** o container de produção não tinha `.env` no disco — os
  secrets reais (`EVOLUTION_*`/`COMTELE`/`JWT`/`DB`) só viviam no runtime. Capturados com
  `docker inspect ... Env` antes de recriar. Recriar sem isso = derrubar WhatsApp/SMS.
- **Uma mudança arriscada por vez:** o cutover trocou **só** o código da api, carregando todo secret
  verbatim; rotações ficaram pra outra janela.
- **Dado ≠ compute:** a razão de a consolidação não travar o inbox no Customer — guardar mensagens é
  barato; rodar o backend do Mensage no B é que era o problema.

---

## 12. Comandos úteis (referência rápida)

```bash
# --- Servidor A (Mensage) ---
# canais Evolution no Mensage (achar a Farmer / UNOFFICIAL_CHANNEL_ID):
docker exec postgres psql -U evolution -d evolution -c \
  "SELECT id,name,provider,instance_name,is_connected FROM mensageria.channels WHERE provider='evolution';"
# canal oficial:
docker exec postgres psql -U evolution -d evolution -c \
  "SELECT id,name,phone_number_id,waba_id,is_connected FROM mensageria.channels WHERE provider='official';"
# ler os secrets da ponte (sem expor: só pontas):
V=$(grep '^SERVICE_TOKEN=' /home/ubuntu/mensageria/.env | cut -d= -f2-); echo "len=${#V} ini=${V:0:6} fim=${V: -6}"
sudo systemctl restart mensageria && sudo journalctl -u mensageria -n 20 --no-pager

# --- Servidor B (Customer) ---
# conferir secrets no container vivo:
docker exec customer360_api printenv SERVICE_TOKEN | cut -c1-10
# testar a ponte (Customer->Mensage) sem enviar nada (200 = aberta):
TOK=$(docker exec customer360_api printenv SERVICE_TOKEN); \
  curl -s -o /dev/null -w "%{http_code}\n" https://cenat.whatsflow.cloud/api/meta/channels/6/templates -H "X-Service-Token: $TOK"
# deploy da api (compose quebrado — usar docker run):
cd /home/ubuntu/Customer-Intelligence && docker build -f docker/Dockerfile.api -t docker_api:latest .
docker stop customer360_api && docker rm customer360_api
docker run -d --name customer360_api --network docker_default --env-file docker/.env -p 8001:8001 --restart unless-stopped docker_api:latest
curl -s http://localhost:8001/health
# cobertura do linker:
docker exec customer360_db psql -U postgres -d customer360 -c \
  "SELECT count(*) FILTER (WHERE phone_canon IS NOT NULL) AS canon, count(*) AS total FROM core.customer WHERE phone_master <> '';"
```

---

## 13. Glossário de URLs/portas/identificadores

| Item | Valor |
|---|---|
| Mensage API (interno) | `localhost:3020` (Servidor A) |
| Mensage público | `https://cenat.whatsflow.cloud/api` |
| Customer API (interno) | `localhost:8001` (Servidor B) |
| Customer público | `https://cenatdata.online` |
| Página oficial | `https://cenatdata.online/whatsapp-oficial` |
| Inbox Farmer | `https://cenatdata.online/whatsapp` |
| Tela de disparo | `https://cenatdata.online/disparo` |
| Evolution API | `http://13.221.209.242:8080` |
| Servidor A | `13.221.209.242` / `172.26.10.190` |
| Servidor B | `100.24.2.187` / `ip-172-26-6-137` |
| Canal oficial (Mensage) | id `6`, `phone_number_id=1064349166769130`, `waba_id=979635254656744` |
| Farmer (Evolution) | owner `558388046720@s.whatsapp.net` |
| Schema do Mensage | `mensageria` (db `evolution`, Servidor A) |
| Schemas do Customer | `core`/`comm`/`metrics`/`mart` (db `customer360`, Servidor B) |
| `OFFICIAL_CHANNEL_ID` | `6` |
| `UNOFFICIAL_CHANNEL_ID` | (vazio — Farmer não é canal no Mensage) |
| `MENSAGE_BASE_URL` | `https://cenat.whatsflow.cloud` |

---

*Fim do documento. Mantenha-o junto dos prompts de sprint (S1–S5) — eles são o detalhe executável de
cada etapa registrada aqui.*
