-- Mart: Vendas Hotmart por mês e produto
DROP VIEW IF EXISTS mart.vendas_hotmart_mensal CASCADE;

CREATE VIEW mart.vendas_hotmart_mensal AS
SELECT
    DATE_TRUNC('month', o.sale_date) as mes,
    TO_CHAR(o.sale_date, 'YYYY-MM') as mes_formatado,
    o.product_name as curso,
    COUNT(*) as total_vendas,
    COUNT(DISTINCT o.customer_id) as clientes_unicos,
    ROUND(SUM(o.total_price), 2) as faturamento_total,
    ROUND(AVG(o.total_price), 2) as ticket_medio
FROM core.orders o
WHERE o.source = 'hotmart'
  AND o.sale_date IS NOT NULL
GROUP BY DATE_TRUNC('month', o.sale_date), TO_CHAR(o.sale_date, 'YYYY-MM'), o.product_name
ORDER BY mes DESC, faturamento_total DESC;

-- Teste: Janeiro 2026
SELECT 
    mes_formatado,
    curso,
    total_vendas,
    clientes_unicos,
    faturamento_total,
    ticket_medio
FROM mart.vendas_hotmart_mensal
WHERE mes_formatado = '2026-01'
ORDER BY faturamento_total DESC;
