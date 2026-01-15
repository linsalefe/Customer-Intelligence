# 🚀 Guia Rápido - Customer 360

## Comandos Essenciais

### Ver KPIs
```bash
python -m src.main show-kpis
```

### Atualizar dados (quando chegarem novos arquivos)
```bash
# 1. Copiar arquivos para data/landing/
cp ~/Downloads/novo_arquivo.csv data/landing/rdstation/
cp ~/Downloads/novas_vendas.xls data/landing/hotmart/

# 2. Rodar pipeline completo
python -m src.main full-refresh
```

### Conectar Power BI / Metabase

**Credenciais:**
```
Host: localhost
Port: 5433
Database: customer360
User: postgres
Password: postgres
```

**Tabelas para usar:**
- `mart.overview_kpis` → KPIs principais
- `mart.active_inactive` → Segmentação de clientes
- `mart.reactivation_list` → Lista de reativação
- `mart.revenue_timeseries` → Gráficos de receita
- `mart.top_customers` → Top clientes

## Queries Úteis

### Top 20 clientes para reativar
```sql
SELECT 
    email_master,
    name_master,
    phone_master,
    total_orders,
    ltv,
    days_since_last_purchase,
    reactivation_score
FROM mart.reactivation_list
LIMIT 20;
```

### Receita últimos 12 meses
```sql
SELECT 
    TO_CHAR(mes, 'YYYY-MM') as mes,
    clientes_unicos,
    total_pedidos,
    ROUND(receita_total, 2) as receita
FROM mart.revenue_timeseries
WHERE mes >= CURRENT_DATE - INTERVAL '12 months'
ORDER BY mes;
```

### Distribuição por segmento
```sql
SELECT 
    customer_segment,
    COUNT(*) as clientes,
    ROUND(AVG(total_revenue), 2) as ltv_medio
FROM mart.active_inactive
GROUP BY customer_segment;
```

## Troubleshooting

### PostgreSQL não conecta
```bash
# Ver logs
docker logs customer360_db

# Reiniciar
docker restart customer360_db
```

### Dados não aparecem no BI
```bash
# Verificar se marts existem
docker exec customer360_db psql -U postgres -d customer360 -c "\dv mart.*"

# Reconstruir marts
python -m src.main build-warehouse
```

### Erro ao importar dados
```bash
# Verificar encoding
file data/landing/rdstation/*.csv

# Teste de conexão
python -m src.main test-db
```
