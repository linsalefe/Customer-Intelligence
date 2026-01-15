# Customer 360 Intelligence System

Sistema completo de inteligência de clientes com deduplicação, métricas RFM e dashboards prontos para BI.

## 📊 Status Atual

✅ **48.013 clientes** unificados (leads + compradores)
✅ **13.013 vendas** processadas
✅ **R$ 7,5M** em receita total
✅ **Marts prontos** para Power BI / Metabase / Looker

## 🏗️ Arquitetura
```
┌─────────────┐
│   SOURCES   │  RD Station (42k leads) + Hotmart (13k vendas)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│     RAW     │  Dados brutos (raw.rd_leads, raw.sales_orders)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   STAGING   │  Normalização (emails, telefones, datas)
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
│    MART     │  Views prontas para Dashboard
└─────────────┘
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

# Suba PostgreSQL
cd docker && docker-compose up -d && cd ..

# Configure .env (já está pronto)
```

### 3. Uso do CLI
```bash
# Testar conexão
python -m src.main test-db

# Ver KPIs
python -m src.main show-kpis

# Importar dados manualmente
python -m src.main import-data --rdstation data/landing/rdstation/arquivo.csv --hotmart data/landing/hotmart/arquivo.xls

# Construir warehouse (staging → marts)
python -m src.main build-warehouse

# Pipeline completo (importa + constrói)
python -m src.main full-refresh
```

## 📊 Marts Disponíveis para BI

Conecte seu BI diretamente no schema `mart`:

### 1. `mart.overview_kpis`
KPIs principais do negócio
- Total de clientes, compradores, ativos, inativos
- Receita total, ticket médio, LTV
- Pedidos por período

### 2. `mart.active_inactive`
Segmentação de clientes
- customer_id, email, nome, telefone
- total_orders, total_revenue, ltv
- is_active, recency_band, customer_segment

### 3. `mart.reactivation_list`
Lista priorizada para reativação
- Clientes inativos com maior potencial
- reactivation_score (quanto maior, mais prioritário)
- Ordenado por score + LTV

### 4. `mart.revenue_timeseries`
Série temporal para gráficos
- Receita por mês
- Clientes únicos, pedidos, ticket médio
- Novos clientes por mês

### 5. `mart.top_customers`
Top clientes por receita e frequência
- Ranking por LTV
- Ranking por frequência de compras

## 📈 KPIs Atuais
```
👥 48.013 clientes totais
🛒 8.859 compradores
✅ 1.107 ativos (2,3%)
❌ 7.752 inativos (87,5% dos compradores)
🆕 39.154 leads não convertidos

💰 R$ 7,5M receita total
🎫 R$ 578 ticket médio
💎 R$ 850 LTV médio

📦 13.013 pedidos
📅 406 vendas últimos 30 dias
```

## 🎯 Insights Principais

1. **Grande oportunidade de reativação**: 7.752 clientes inativos com LTV médio de R$ 920
2. **Taxa de conversão de leads**: 18,5% (8.859 compradores / 48.013 total)
3. **Clientes recorrentes**: 4.154 pedidos de clientes que compraram 2+ vezes
4. **Top cliente**: R$ 197k LTV (Claudia Andrea Astudillo Cardona)

## 🔧 Manutenção

### Atualizar dados
```bash
# 1. Colocar novos arquivos em data/landing/
# 2. Rodar pipeline
python -m src.main full-refresh
```

### Conectar BI
```
Host: localhost
Port: 5433
Database: customer360
User: postgres
Password: postgres
Schema: mart
```

## 📁 Estrutura de Dados

### Schemas
- `raw`: Dados brutos das fontes
- `stg`: Dados normalizados
- `core`: Customer 360 + pedidos
- `metrics`: Agregações por cliente
- `mart`: Views para BI
- `audit`: Logs e qualidade

### Tabelas Principais
- `core.customer`: 48k clientes master
- `core.orders`: 13k pedidos linkados
- `metrics.customer_summary`: Métricas por cliente (RFM, ativo/inativo)

## 🛠️ Tecnologias

- **Database**: PostgreSQL 15
- **ETL**: Python 3.11 + Pandas
- **Transformações**: SQL
- **CLI**: Click
- **BI Ready**: Power BI / Metabase / Looker Studio

## 📝 Regras de Negócio

- **Cliente Ativo**: Comprou nos últimos 90 dias
- **Cliente Inativo**: Não compra há mais de 90 dias
- **Lead**: Nunca comprou
- **Status válidos de venda**: Aprovado, Completo, Complete

## 🔄 Próximos Passos

- [ ] Adicionar fonte Doit
- [ ] Deduplicação fuzzy avançada
- [ ] Cohort analysis (retenção)
- [ ] Previsão de churn (ML)
- [ ] API REST para consultas

## 👨‍💻 Desenvolvedor

Alefe Guimarães Barbosa
