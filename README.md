# Customer 360 Intelligence System

Sistema completo de inteligência de clientes com deduplicação, métricas RFM, dashboards interativos e gestão de usuários.

## 📊 Status Atual

- **18.971 compradores** únicos identificados
- **25.129 pedidos** processados (deduplicados)
- **R$ 2,6M** em receita total (com conversão de 12 moedas)
- **852 clientes ativos** nos últimos 90 dias
- **Frontend completo** com 7 páginas interativas

## 🏗️ Arquitetura
```
┌─────────────┐
│   SOURCES   │  RD Station (42k leads) + Hotmart (13k vendas) + Doity
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
│   Next.js   │  Frontend Dashboard (7 páginas)
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

## 📱 Páginas do Dashboard

| Página | Descrição |
|--------|-----------|
| **Dashboard** | KPIs principais, gráficos de receita e pedidos |
| **Clientes** | Lista de compradores com histórico de compras |
| **Reativação** | Lista priorizada por score (0-200) com export CSV |
| **Top Clientes** | Ranking por LTV com pódio visual |
| **Receita** | Gráficos temporais de receita, pedidos e novos clientes |
| **Cohort** | Análise de retenção e receita por cohort mensal |
| **Usuários** | CRUD de usuários com perfis (Admin/Operacional/Viewer) |

## 👥 Perfis de Acesso

| Perfil | Permissões |
|--------|-----------|
| **Admin** | Acesso total + gerenciar usuários |
| **Operacional** | Dashboard + Clientes + Reativação + Cohort |
| **Viewer** | Apenas visualização de dashboards |

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

## 🐳 Deploy com Docker
```bash
cd docker
docker-compose -f docker-compose.prod.yml up -d --build
```

Serviços:
- **PostgreSQL** → porta 5433
- **API FastAPI** → porta 8001
- **Frontend Next.js** → porta 3001

## 📈 KPIs Atuais
```
👥 18.971 compradores
✅ 852 ativos (últimos 90 dias)
❌ 18.119 inativos

💰 R$ 2,6M receita total
🎫 R$ 105 ticket médio
💎 R$ 139 LTV médio

📦 25.129 pedidos (deduplicados)
📅 307 vendas últimos 30 dias
💱 12 moedas convertidas para BRL
```

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
├── data/                    # Dados (landing, processed)
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
│   ├── webhook_api/         # FastAPI routers
│   └── settings.py
└── requirements.txt
```

## 👨‍💻 Desenvolvido por

Alefe Guimarães Barbosa
