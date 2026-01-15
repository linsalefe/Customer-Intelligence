# 📊 Configuração do Metabase - Customer 360

## 1. Acesso Inicial

Abra no navegador: **http://localhost:3000**

⏳ Aguarde 1-2 minutos na primeira vez (Metabase está inicializando)

## 2. Setup Inicial

### Criar conta
- Email: seu@email.com
- Nome: Seu Nome
- Senha: (escolha uma senha)

### Adicionar Banco de Dados

**Clique em "Add Database"**

Configurações:
```
Database type: PostgreSQL
Name: Customer 360
Host: postgres
Port: 5432
Database name: customer360
Username: postgres
Password: postgres
```

⚠️ **IMPORTANTE**: Use `postgres` no host (não `localhost`) porque o Metabase está dentro do Docker.

**Clique em "Save"**

## 3. Explorar Schemas

No menu lateral:
- Clique em "Customer 360" (seu banco)
- Vá até o schema **`mart`**

Você verá 5 views prontas:
- ✅ active_inactive
- ✅ overview_kpis
- ✅ reactivation_list
- ✅ revenue_timeseries
- ✅ top_customers

## 4. Criar Dashboard

### 4.1. Criar Novo Dashboard
1. Clique no **"+" (New)** → **Dashboard**
2. Nome: "Customer 360 - Visão Geral"
3. Descrição: "Dashboard principal de inteligência de clientes"

### 4.2. Adicionar Cards - KPIs Principais

**Card 1: Total de Clientes**
- New Question → Native Query (SQL)
```sql
SELECT total_clientes FROM mart.overview_kpis
```
- Visualização: **Number**
- Título: "Total de Clientes"
- Adicionar ao Dashboard

**Card 2: Compradores**
```sql
SELECT total_compradores FROM mart.overview_kpis
```

**Card 3: Ativos**
```sql
SELECT clientes_ativos FROM mart.overview_kpis
```

**Card 4: Inativos**
```sql
SELECT clientes_inativos FROM mart.overview_kpis
```

**Card 5: Receita Total**
```sql
SELECT ROUND(receita_total, 2) as receita FROM mart.overview_kpis
```
- Formatar como moeda (R$)

**Card 6: Ticket Médio**
```sql
SELECT ROUND(ticket_medio, 2) as ticket FROM mart.overview_kpis
```

**Card 7: LTV Médio**
```sql
SELECT ROUND(ltv_medio, 2) as ltv FROM mart.overview_kpis
```

### 4.3. Gráfico de Pizza - Segmentação

**Nova pergunta:**
```sql
SELECT 
    customer_segment,
    COUNT(*) as clientes
FROM mart.active_inactive
GROUP BY customer_segment
ORDER BY clientes DESC
```
- Visualização: **Pie Chart**
- Título: "Distribuição de Clientes"

### 4.4. Gráfico de Linha - Receita ao Longo do Tempo
```sql
SELECT 
    TO_CHAR(mes, 'YYYY-MM') as mes,
    ROUND(receita_total, 2) as receita,
    clientes_unicos,
    total_pedidos
FROM mart.revenue_timeseries
WHERE mes >= CURRENT_DATE - INTERVAL '12 months'
ORDER BY mes
```
- Visualização: **Line Chart**
- X-axis: mes
- Y-axis: receita
- Título: "Receita - Últimos 12 Meses"

### 4.5. Tabela - Top 20 Clientes
```sql
SELECT 
    rank_revenue as rank,
    name_master as cliente,
    ROUND(total_revenue, 2) as ltv,
    total_orders as pedidos,
    CASE WHEN is_active THEN 'Ativo' ELSE 'Inativo' END as status
FROM mart.top_customers
WHERE rank_revenue <= 20
ORDER BY rank_revenue
```
- Visualização: **Table**
- Título: "Top 20 Clientes por LTV"

### 4.6. Tabela - Lista de Reativação
```sql
SELECT 
    name_master as cliente,
    email_master as email,
    phone_master as telefone,
    total_orders as pedidos,
    ROUND(ltv, 2) as ltv,
    days_since_last_purchase as dias_sem_comprar,
    reactivation_score as score
FROM mart.reactivation_list
WHERE reactivation_score >= 150
ORDER BY reactivation_score DESC, ltv DESC
LIMIT 30
```
- Visualização: **Table**
- Título: "Top 30 para Reativar (Score ≥ 150)"
- Adicionar botão de **Download CSV**

### 4.7. Gráfico de Barras - Recência
```sql
SELECT 
    recency_band,
    COUNT(*) as clientes,
    ROUND(AVG(total_revenue), 2) as ltv_medio
FROM mart.active_inactive
WHERE total_orders > 0
GROUP BY recency_band
ORDER BY 
    CASE recency_band
        WHEN '0-30 dias' THEN 1
        WHEN '31-60 dias' THEN 2
        WHEN '61-90 dias' THEN 3
        WHEN '91-180 dias' THEN 4
        ELSE 5
    END
```
- Visualização: **Bar Chart**
- Título: "Clientes por Faixa de Recência"

## 5. Organizar Dashboard

Arraste os cards para organizar:
```
┌─────────────────────────────────────────────────┐
│  KPIs em linha (7 cards pequenos)              │
├─────────────────────────────────────────────────┤
│  [Gráfico Pizza]    │  [Gráfico Linha Receita] │
├─────────────────────────────────────────────────┤
│  [Gráfico Barras Recência]                     │
├─────────────────────────────────────────────────┤
│  [Tabela Top 20 Clientes]                      │
├─────────────────────────────────────────────────┤
│  [Tabela Lista Reativação]                     │
└─────────────────────────────────────────────────┘
```

## 6. Compartilhar Dashboard

1. Clique em **"Share"** no dashboard
2. Copie o link público
3. Ou configure alertas automáticos

## 7. Exportar Dados

Em qualquer tabela:
- Clique nos **3 pontinhos** (...)
- Download results → **CSV**

## 8. Criar Alertas (Opcional)

Configure alertas para:
- Queda na receita mensal
- Aumento de clientes inativos
- Metas de vendas

## Troubleshooting

### Metabase não abre
```bash
docker logs customer360_bi
```

### Erro de conexão com banco
Verifique se usou `postgres` (não `localhost`) no host

### Dashboard lento
Adicione índices nas tabelas mais consultadas
