-- Mart: Série temporal de receita (para gráficos)
DROP VIEW IF EXISTS mart.revenue_timeseries CASCADE;

CREATE VIEW mart.revenue_timeseries AS
SELECT
    DATE_TRUNC('month', o.sale_date) as mes,
    COUNT(DISTINCT o.customer_id) as clientes_unicos,
    COUNT(*) as total_pedidos,
    SUM(o.total_price) as receita_total,
    AVG(o.total_price) as ticket_medio,
    COUNT(DISTINCT CASE WHEN DATE_TRUNC('month', o.sale_date) = DATE_TRUNC('month', f.first_purchase) THEN o.customer_id END) as novos_clientes
FROM core.orders o
LEFT JOIN (
    SELECT customer_id, MIN(sale_date) as first_purchase
    FROM core.orders
    GROUP BY customer_id
) f ON o.customer_id = f.customer_id
GROUP BY DATE_TRUNC('month', o.sale_date)
ORDER BY mes;

-- Últimos 12 meses
SELECT 
    TO_CHAR(mes, 'YYYY-MM') as mes,
    clientes_unicos,
    total_pedidos,
    ROUND(receita_total, 2) as receita,
    ROUND(ticket_medio, 2) as ticket_medio,
    novos_clientes
FROM mart.revenue_timeseries
WHERE mes >= CURRENT_DATE - INTERVAL '12 months'
ORDER BY mes;
