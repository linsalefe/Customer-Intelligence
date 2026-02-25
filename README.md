# Customer 360 Intelligence System

Sistema completo de inteligência de clientes com deduplicação, métricas RFM, dashboards interativos e gestão de usuários.

## 📊 Status Atual (Fev/2026)

- **40.526 compradores** únicos identificados
- **79.791 pedidos** processados (deduplicados)
- **R$ 17,5M** em receita total (com conversão de 12 moedas)
- **18.894 clientes ativos** nos últimos 365 dias
- **Frontend completo** com 8 páginas interativas
- **Domínio:** https://cenatdata.online

## 🗃️ Fontes de Dados

| Fonte | Registros | Receita | Descrição |
|-------|-----------|---------|-----------|
| **Pós-graduação** | 1.823 | R$ 9,7M | Cursos de especialização |
| **Hotmart** | 13.013 | R$ 7,5M | Cursos e eventos online |
| **Doity** | 64.706 | R$ 5,6M | Congressos e seminários |
| **Intercâmbio** | 270 | R$ 813K | Programas internacionais |

## 🏗️ Arquitetura
```
┌─────────────┐
│   SOURCES   │  RD Station + Hotmart + Doity + Pós + Intercâmbio
└──────┬──────┘
       │
       ▼
┌─────────────┐
│     RAW     │  Dados brutos (raw.rd_leads, raw.sales_orders)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   STAGING   │  Normalização (emails, telefones, datas, moedas)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    CORE     │  Customer 360 (core.customer, core.orders)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   METRICS   │  RFM, Ativo/Inativo, Recência
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    MART     │  Views otimizadas para Dashboard
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   FastAPI   │  API REST com JWT + RBAC
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Next.js   │  Frontend Dashboard (8 páginas)
└─────────────┘
```

## 🛠️ Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Database | PostgreSQL 15 |
| ETL | Python 3.11 + Pandas |
| Transformações | SQL (staging → core → metrics → mart) |
| API | FastAPI + JWT + SQLAlchemy |
| Frontend | Next.js 14 + TypeScript + Tailwind CSS v4 + Recharts |
| Infraestrutura | Docker + Docker Compose |
| Servidor | AWS Lightsail (Ubuntu 24) |
| WhatsApp | Evolution API (instância Farmer) |
| SSL | Let's Encrypt (auto-renovação) |

## 📱 Páginas do Dashboard

| Página | Descrição |
|--------|-----------|
| **Dashboard** | KPIs principais, gráficos de receita e pedidos |
| **Clientes** | Lista com filtros por produto, status, busca + exportação Excel/PDF |
| **Reativação** | Lista priorizada por score (0-200) com export CSV |
| **Top Clientes** | Ranking por LTV com pódio visual |
| **Receita** | Gráficos temporais de receita, pedidos e novos clientes |
| **Cohort** | Análise de retenção e receita por cohort mensal |
| **Usuários** | CRUD de usuários com perfis (Admin/Operacional/Viewer) |
| **WhatsApp** | Chat em tempo real via Evolution API + CRM integrado |

## 🔍 Filtros da Página Clientes

- **Busca por nome/email** - busca instantânea
- **Status** - Ativo / Inativo
- **Produto exato** - dropdown com todos os produtos
- **Busca por produto** - palavra-chave (ex: "Seminário", "Congresso")
- **Faixa de receita** - valor mínimo e máximo
- **Exportação** - Excel (CSV) e PDF com filtros aplicados

## 👥 Perfis de Acesso

| Perfil | Permissões |
|--------|-----------|
| **Admin** | Acesso total + gerenciar usuários |
| **Operacional** | Dashboard + Clientes + Reativação + Cohort |
| **Viewer** | Apenas visualização de dashboards |

## 📈 KPIs Atuais
```
👥 40.526 compradores
✅ 18.894 ativos (últimos 365 dias)
❌ 21.632 inativos

💰 R$ 17,5M receita total
🎫 R$ 219 ticket médio
💎 R$ 432 LTV médio

📦 79.791 pedidos
📅 318 vendas últimos 30 dias
💱 12 moedas convertidas para BRL
```

## 🚀 Setup Local

### Pré-requisitos
- Python 3.11+
- Node.js 20+
- Docker

### 1. Backend
```bash
# Suba o PostgreSQL
cd docker && docker-compose up -d && cd ..

# Instale dependências Python
pip install -r requirements.txt

# Inicie a API
python3 -m uvicorn src.webhook_api.app:app --reload --port 8001
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev -- -p 3001
```

### 3. Acesso
- **Frontend:** http://localhost:3001
- **API:** http://localhost:8001
- **Login:** admin@cenat.com / admin123

## 🐳 Deploy Produção

### Servidor AWS Lightsail
```bash
cd docker
docker-compose -f docker-compose.prod.yml up -d --build
```

### Serviços
- **PostgreSQL** → porta 5433
- **API FastAPI** → porta 8001
- **Frontend Next.js** → porta 3001
- **Nginx** → portas 80/443 (reverse proxy + SSL)

### Domínio
- **URL:** https://cenatdata.online
- **SSL:** Let's Encrypt (renovação automática via certbot)

## 📱 WhatsApp Business (Evolution API)

### Funcionalidades
- **Chat em tempo real** - Interface estilo WhatsApp Web com polling
- **Webhook** - Recebe mensagens via Evolution API automaticamente
- **Mídia** - Envio/recebimento de imagens, áudio, vídeo e documentos
- **Templates** - Mensagens pré-definidas com variáveis ({nome})
- **CRM integrado** - Painel lateral com dados do Customer 360 (LTV, pedidos, status)
- **Lead management** - Status (Novo → Qualificado → Convertido), tags, notas
- **Auto-link** - Vinculação automática com core.customer via telefone

### Configuração
- **Evolution API:** http://13.221.209.242:8080
- **Instância:** Farmer
- **Webhook:** https://cenatdata.online/api/whatsapp/webhook/Farmer

## 📊 Regras de Negócio

### Cliente Ativo
- Comprou nos últimos **365 dias** (12 meses)
- Alinhado com ciclo anual de eventos

### Score de Reativação (0-200)
- **Recência:** 366-545 dias = 100pts | 546-730 = 80pts | 730+ = 60pts
- **Frequência:** 5+ pedidos = 50pts | 3-4 = 30pts | 2 = 20pts | 1 = 10pts
- **Monetário:** R$1000+ = 50pts | R$500-999 = 30pts | R$200-499 = 20pts | <R$200 = 10pts

### Conversão de Moedas
- BRL: 1.0 | USD: 5.80 | EUR: 6.30 | COP: 0.0014 | ARS: 0.0055 | CLP: 0.006

## 🔧 CLI
```bash
python -m src.main test-db          # Testa conexão
python -m src.main show-kpis        # Mostra KPIs
python -m src.main import-data      # Importa dados
python -m src.main build-warehouse  # Reconstrói warehouse
python -m src.main full-refresh     # Pipeline completo
```

## 📁 Estrutura do Projeto
```
Customer-Intelligence/
├── config/                  # Configurações (sources.yml, business_rules.yml)
├── data/
│   └── landing/
│       ├── doity/           # 96 arquivos de congressos
│       ├── hotmart/         # Vendas Hotmart
│       ├── intercâmbio/     # Participantes intercâmbio
│       ├── pós/             # Alunos pós-graduação
│       └── rdstation/       # Leads RD Station
├── docker/                  # Docker configs
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   ├── Dockerfile.api
│   └── Dockerfile.frontend
├── frontend/                # Next.js Dashboard
│   └── src/
│       ├── app/             # Páginas (dashboard, clientes, receita, etc)
│       ├── components/      # Layout, sidebar
│       ├── contexts/        # Auth context
│       └── lib/             # API client
├── sql/                     # Transformações SQL
│   ├── 02_raw/
│   ├── 03_staging/
│   ├── 04_identity_resolution/
│   ├── 05_facts_metrics/
│   └── 06_marts_dashboard/
├── src/                     # Backend Python
│   ├── auth/                # JWT + security
│   ├── db/                  # Connection, loaders, sql_runner
│   ├── transforms/          # Normalização
│   ├── connectors/          # Evolution API, Comtele, Email
│   ├── webhook_api/         # FastAPI routers + WhatsApp webhook
│   └── settings.py
└── requirements.txt
```

## 👨‍💻 Desenvolvido por

Alefe Guimel Lins Barbosa