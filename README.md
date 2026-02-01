# Customer 360 Intelligence System

Sistema completo de inteligência de clientes com unificação de dados, métricas RFM, análise de cohort, webhooks em tempo real e dashboards prontos para BI.

## 📊 Status Atual

✅ **53.252 clientes** unificados (leads + compradores)  
✅ **30.390 vendas** processadas (Hotmart + Doity)  
✅ **R$ 9,27M** em receita total  
✅ **Webhook Hotmart** recebendo eventos em tempo real  
✅ **Análise de Cohort** com retenção mensal  
✅ **11 Marts prontos** para Power BI / Metabase / Looker  
✅ **Dashboard Metabase** com 8 abas funcionais  

## 🏗️ Arquitetura
```
┌─────────────────┐
│    SOURCES      │  RD Station (42k leads) + Hotmart (13k vendas) + Doity (17k eventos)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│      RAW        │  Dados brutos (raw.rd_leads, raw.sales_orders, raw.hotmart_events)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    STAGING      │  Normalização (emails, telefones, datas, preços)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     CORE        │  Customer 360 (core.customer, core.orders)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    METRICS      │  RFM, Ativo/Inativo, Recência, Cohorts
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     MART        │  Views prontas para Dashboard
└─────────────────┘
```

## 🚀 Quickstart

### 1. Pré-requisitos
- Python 3.11+
- Docker
- PostgreSQL 15 (via Docker)

### 2. Instalação
```bash
# Clone o repositório
git clone <repo>
cd Customer-Intelligence

# Crie ambiente virtual
python3 -m venv venv
source venv/bin/activate

# Instale dependências
pip install -r requirements.txt

# Suba PostgreSQL + Metabase
cd docker && docker-compose up -d && cd ..
```

### 3. Uso do CLI
```bash
# Testar conexão
python -m src.main test-db

# Ver KPIs
python -m src.main show-kpis

# Importar dados
python -m src.main import-data --rdstation data/landing/rdstation/arquivo.csv --hotmart data/landing/hotmart/arquivo.xls

# Construir warehouse (staging → marts)
python -m src.main build-warehouse

# Pipeline completo (importa + constrói)
python -m src.main full-refresh
```

### 4. Webhook Hotmart (tempo real)
```bash
# Terminal 1 - API
uvicorn src.webhook_api.app:app --host 0.0.0.0 --port 8008 --reload

# Terminal 2 - Expor publicamente
ngrok http 8008
```

### 5. Acessar Dashboards
```
Metabase: http://localhost:3000
```

## 📊 Fontes de Dados

| Fonte | Tipo | Registros | Receita |
|-------|------|-----------|---------|
| **RD Station** | Leads (CSV) | 42.327 contatos | - |
| **Hotmart** | Vendas (XLS) | 13.013 vendas | R$ 7,5M |
| **Doity** | Eventos (XLSX) | 17.377 inscrições | R$ 1,7M |
| **Webhook Hotmart** | Real-time (JSON) | Contínuo | - |

## 📈 KPIs Atuais
```
👥 53.252 clientes totais
🛒 19.653 compradores
✅ 1.088 ativos (5,5%)
❌ 18.565 inativos (94,5%)

💰 R$ 9,27M receita total
🎫 R$ 305 ticket médio
💎 R$ 471 LTV médio

📦 30.390 pedidos totais
📅 398 vendas últimos 30 dias
```

## 📊 Marts Disponíveis para BI

| Mart | Descrição |
|------|-----------|
| `mart.overview_kpis` | KPIs principais do negócio |
| `mart.active_inactive` | Segmentação de clientes |
| `mart.reactivation_list` | Lista priorizada para reativação |
| `mart.reactivation_products` | Histórico de produtos dos inativos |
| `mart.revenue_timeseries` | Série temporal de receita |
| `mart.top_customers` | Top clientes por LTV |
| `mart.congressos` | Produtos high-ticket (>= R$90) |
| `mart.seminarios` | Produtos low-ticket (R$9-20) |
| `mart.cohort_retention` | Análise de cohort e retenção |
| `mart.evolucao_mensal` | Comparativo mês a mês |
| `mart.vendas_hotmart_mensal` | Vendas Hotmart por mês e produto |

## 🔔 Webhook Hotmart

Recebe eventos em tempo real:
- ✅ Compra aprovada
- ✅ Compra cancelada
- ✅ Aguardando pagamento
- ✅ Compra reembolsada
- ✅ Chargeback

**Endpoint:** `POST /webhooks/hotmart`  
**Autenticação:** Header `X-HOTMART-HOTTOK`

## 📊 Dashboard Metabase

8 abas configuradas:

| Aba | Conteúdo |
|-----|----------|
| Dash Geral | KPIs principais |
| Clientes Ativos | Segmentação |
| KPI | Métricas consolidadas |
| Lista de Reativação | Top inativos priorizados |
| Lista Gerais | Visão completa de clientes |
| High Ticket | Congressos (>= R$90) |
| Low Ticket | Seminários (R$9-20) |
| Análise de Cohort | Retenção mensal |

## 🎯 Insights Principais

1. **Retenção crítica**: Apenas 3-5% dos clientes voltam (mercado: 15-25%)
2. **Grande oportunidade**: 18.565 inativos com potencial de reativação
3. **High-ticket domina**: Congressos geram 97% da receita (R$ 8,98M)
4. **Taxa de conversão**: 37% dos leads se tornaram compradores

## 🔧 Conectar BI
```
Host: localhost
Port: 5433
Database: customer360
User: postgres
Password: postgres
Schema: mart
```

## 📁 Estrutura do Projeto
```
Customer-Intelligence/
├── config/              # Regras de negócio e mapeamento
├── data/landing/        # Arquivos fonte (RD, Hotmart, Doity)
├── docker/              # Docker Compose (PostgreSQL + Metabase)
├── sql/                 # Transformações SQL (6 camadas)
├── src/
│   ├── db/              # Conexão, loaders, SQL runner
│   ├── transforms/      # Normalização de dados
│   ├── webhook_api/     # FastAPI para webhooks Hotmart
│   ├── main.py          # CLI principal
│   └── settings.py      # Configurações
├── requirements.txt
├── QUICKSTART.md
├── DICIONARIO_DADOS.md
└── METABASE_SETUP.md
```

## 🛠️ Tecnologias

- **Database**: PostgreSQL 15
- **ETL**: Python 3.11 + Pandas
- **Transformações**: SQL
- **Webhooks**: FastAPI + Uvicorn
- **BI**: Metabase
- **CLI**: Click
- **Containers**: Docker Compose

## 📝 Regras de Negócio

- **Cliente Ativo**: Comprou nos últimos 90 dias
- **Cliente Inativo**: Não compra há mais de 90 dias
- **Lead**: Nunca comprou
- **Congressos**: Produtos >= R$ 90
- **Seminários**: Produtos R$ 9-20
- **Status válidos**: Aprovado, Completo, Concluído, Gratuito, Autorizado

## 🔄 Próximos Passos

- [ ] Deploy em produção (Contabo)
- [ ] Domínio próprio com SSL
- [ ] Auto-rebuild warehouse após webhook
- [ ] Webhook Doity
- [ ] ML para predição de churn
- [ ] Alertas automáticos (WhatsApp/Email)
- [ ] API REST para consultas externas

## 👨‍💻 Desenvolvedor

Alefe Guimarães Barbosa
