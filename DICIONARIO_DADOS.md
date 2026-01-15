# 📖 Dicionário de Dados - Customer 360

## Schemas

| Schema | Descrição |
|--------|-----------|
| `raw` | Dados brutos das fontes originais |
| `stg` | Dados normalizados e padronizados |
| `core` | Entidades principais do Customer 360 |
| `metrics` | Agregações e métricas por cliente |
| `mart` | Views otimizadas para BI |

## Tabelas Core

### `core.customer`
Tabela master de clientes (48.013 registros)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `customer_id` | INTEGER | ID único do cliente |
| `email_master` | TEXT | Email principal (normalizado) |
| `name_master` | TEXT | Nome principal |
| `phone_master` | TEXT | Telefone principal (apenas números) |
| `document_master` | TEXT | CPF/CNPJ (apenas números) |
| `city` | TEXT | Cidade |
| `state` | TEXT | Estado (UF) |
| `country` | TEXT | País |

### `core.orders`
Pedidos vinculados aos clientes (13.013 registros)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `order_id` | INTEGER | ID único do pedido |
| `customer_id` | INTEGER | FK para core.customer |
| `source` | TEXT | Fonte (hotmart, doit) |
| `transaction_id` | TEXT | ID da transação na fonte |
| `product_name` | TEXT | Nome do produto |
| `sale_date` | TIMESTAMP | Data da venda |
| `total_price` | DECIMAL | Valor total |
| `payment_type` | TEXT | Tipo de pagamento |
| `currency` | TEXT | Moeda |

### `metrics.customer_summary`
Resumo e métricas por cliente (48.013 registros)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `customer_id` | INTEGER | FK para core.customer |
| `total_orders` | INTEGER | Total de pedidos |
| `total_revenue` | DECIMAL | Receita total (LTV) |
| `avg_ticket` | DECIMAL | Ticket médio |
| `first_purchase_date` | DATE | Data primeira compra |
| `last_purchase_date` | DATE | Data última compra |
| `days_since_last_purchase` | INTEGER | Dias desde última compra |
| `is_active` | BOOLEAN | Cliente ativo? (< 90 dias) |
| `recency_band` | TEXT | Faixa de recência |

## Views Mart (Para BI)

### `mart.overview_kpis`
KPIs principais consolidados (1 linha)

| Campo | Descrição |
|-------|-----------|
| `total_clientes` | Total de clientes únicos |
| `total_compradores` | Clientes que já compraram |
| `clientes_ativos` | Compradores ativos (< 90 dias) |
| `clientes_inativos` | Compradores inativos (> 90 dias) |
| `leads_nao_convertidos` | Leads que nunca compraram |
| `receita_total` | Receita total acumulada |
| `ticket_medio` | Ticket médio geral |
| `ltv_medio` | LTV médio dos compradores |
| `total_pedidos` | Total de pedidos |
| `pedidos_ultimos_30_dias` | Pedidos últimos 30 dias |
| `pedidos_ultimos_90_dias` | Pedidos últimos 90 dias |

### `mart.active_inactive`
Segmentação completa de clientes (48.013 linhas)

| Campo | Descrição |
|-------|-----------|
| `customer_id` | ID do cliente |
| `email_master` | Email |
| `name_master` | Nome |
| `phone_master` | Telefone |
| `city` | Cidade |
| `state` | Estado |
| `total_orders` | Total de pedidos |
| `total_revenue` | LTV do cliente |
| `avg_ticket` | Ticket médio |
| `first_purchase_date` | Primeira compra |
| `last_purchase_date` | Última compra |
| `days_since_last_purchase` | Dias sem comprar |
| `is_active` | Ativo/Inativo |
| `recency_band` | Faixa de recência |
| `customer_segment` | Ativo / Inativo / Lead |

### `mart.reactivation_list`
Lista priorizada para campanhas de reativação (7.752 linhas)

| Campo | Descrição |
|-------|-----------|
| `customer_id` | ID do cliente |
| `email_master` | Email para contato |
| `name_master` | Nome |
| `phone_master` | Telefone |
| `total_orders` | Histórico de pedidos |
| `ltv` | Valor já gasto |
| `last_purchase_date` | Última compra |
| `days_since_last_purchase` | Dias sem comprar |
| `recency_band` | Faixa de recência |
| `reactivation_score` | Score de prioridade (0-200) |

**Cálculo do reactivation_score:**
- Recência: 91-180 dias = 100pts, 181-365 = 80pts, 365+ = 60pts
- Frequência: 5+ pedidos = 50pts, 3-4 = 30pts, 2 = 20pts, 1 = 10pts
- Monetário: R$1000+ = 50pts, R$500-999 = 30pts, R$200-499 = 20pts, <R$200 = 10pts

### `mart.revenue_timeseries`
Série temporal para gráficos (73 linhas - desde 2020)

| Campo | Descrição |
|-------|-----------|
| `mes` | Mês (truncado) |
| `clientes_unicos` | Clientes que compraram no mês |
| `total_pedidos` | Pedidos no mês |
| `receita_total` | Receita do mês |
| `ticket_medio` | Ticket médio do mês |
| `novos_clientes` | Clientes comprando pela 1ª vez |

### `mart.top_customers`
Ranking de clientes por receita e frequência (8.859 linhas)

| Campo | Descrição |
|-------|-----------|
| `customer_id` | ID do cliente |
| `email_master` | Email |
| `name_master` | Nome |
| `phone_master` | Telefone |
| `total_orders` | Total de pedidos |
| `total_revenue` | LTV |
| `avg_ticket` | Ticket médio |
| `is_active` | Status atual |
| `rank_revenue` | Ranking por LTV |
| `rank_frequency` | Ranking por frequência |

## Regras de Negócio

### Cliente Ativo
- Comprou nos últimos 90 dias
- `is_active = true`

### Cliente Inativo
- Não compra há mais de 90 dias
- `is_active = false`
- Já comprou pelo menos 1 vez

### Lead
- Nunca comprou
- `total_orders = 0`

### Faixas de Recência
- `0-30 dias`: Comprou no último mês
- `31-60 dias`: Comprou entre 1-2 meses atrás
- `61-90 dias`: Comprou entre 2-3 meses atrás
- `91-180 dias`: Comprou entre 3-6 meses atrás
- `180+ dias`: Comprou há mais de 6 meses
- `Nunca comprou`: Lead não convertido

## Status de Vendas Válidos

Apenas vendas com estes status são consideradas:
- `Aprovado`
- `Completo`
- `Complete`
- `approved`
- `completed`
