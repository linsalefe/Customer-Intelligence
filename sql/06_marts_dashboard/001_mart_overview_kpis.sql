-- Mart: KPIs principais para dashboard
DROP VIEW IF EXISTS mart.overview_kpis CASCADE;

CREATE VIEW mart.overview_kpis AS
SELECT
    -- Clientes
    (SELECT COUNT(*) FROM core.customer) as total_clientes,
    (SELECT COUNT(*) FROM metrics.customer_summary WHERE total_orders > 0) as total_compradores,
    (SELECT COUNT(*) FROM metrics.customer_summary WHERE is_active) as clientes_ativos,
    (SELECT COUNT(*) FROM metrics.customer_summary WHERE NOT is_active AND total_orders > 0) as clientes_inativos,
    (SELECT COUNT(*) FROM metrics.customer_summary WHERE total_orders = 0) as leads_nao_convertidos,
    
    -- Financeiro
    (SELECT ROUND(SUM(total_price), 2) FROM core.orders) as receita_total,
    (SELECT ROUND(AVG(total_price), 2) FROM core.orders) as ticket_medio,
    (SELECT ROUND(AVG(total_revenue), 2) FROM metrics.customer_summary WHERE total_orders > 0) as ltv_medio,
    
    -- Pedidos
    (SELECT COUNT(*) FROM core.orders) as total_pedidos,
    (SELECT COUNT(*) FROM core.orders WHERE sale_date >= CURRENT_DATE - INTERVAL '30 days') as pedidos_ultimos_30_dias,
    (SELECT COUNT(*) FROM core.orders WHERE sale_date >= CURRENT_DATE - INTERVAL '90 days') as pedidos_ultimos_90_dias,
    
    -- Datas
    (SELECT MIN(sale_date)::date FROM core.orders) as primeira_venda,
    (SELECT MAX(sale_date)::date FROM core.orders) as ultima_venda;

-- Teste
SELECT * FROM mart.overview_kpis;
