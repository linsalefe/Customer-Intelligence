-- Mart: Evolução mensal completa (Jan 2025 - Jan 2026)
DROP VIEW IF EXISTS mart.evolucao_mensal CASCADE;

CREATE VIEW mart.evolucao_mensal AS
SELECT
    DATE_TRUNC('month', o.sale_date)::date as mes,
    TO_CHAR(o.sale_date, 'YYYY-MM') as mes_formatado,
    TO_CHAR(o.sale_date, 'Mon/YYYY') as mes_nome,
    
    -- Vendas
    COUNT(*) as total_vendas,
    COUNT(DISTINCT o.customer_id) as clientes_unicos,
    
    -- Receita
    ROUND(SUM(o.total_price), 2) as receita_total,
    ROUND(AVG(o.total_price), 2) as ticket_medio,
    
    -- Novos vs Recorrentes
    COUNT(DISTINCT CASE 
        WHEN DATE_TRUNC('month', o.sale_date) = DATE_TRUNC('month', m.first_purchase_date) 
        THEN o.customer_id 
    END) as clientes_novos,
    
    COUNT(DISTINCT CASE 
        WHEN DATE_TRUNC('month', o.sale_date) > DATE_TRUNC('month', m.first_purchase_date) 
        THEN o.customer_id 
    END) as clientes_recorrentes,
    
    -- Por fonte
    COUNT(*) FILTER (WHERE o.source = 'hotmart') as vendas_hotmart,
    COUNT(*) FILTER (WHERE o.source = 'doity') as vendas_doity,
    
    ROUND(SUM(o.total_price) FILTER (WHERE o.source = 'hotmart'), 2) as receita_hotmart,
    ROUND(SUM(o.total_price) FILTER (WHERE o.source = 'doity'), 2) as receita_doity

FROM core.orders o
LEFT JOIN metrics.customer_summary m ON o.customer_id = m.customer_id
WHERE o.sale_date >= '2025-01-01' 
  AND o.sale_date < '2026-02-01'
GROUP BY DATE_TRUNC('month', o.sale_date), TO_CHAR(o.sale_date, 'YYYY-MM'), TO_CHAR(o.sale_date, 'Mon/YYYY')
ORDER BY mes;

-- Visualização completa
SELECT 
    mes_nome as "Mês",
    total_vendas as "Total Vendas",
    clientes_unicos as "Clientes",
    clientes_novos as "Novos",
    clientes_recorrentes as "Recorrentes",
    receita_total as "Receita Total",
    ticket_medio as "Ticket Médio",
    vendas_hotmart as "Hotmart",
    vendas_doity as "Doity"
FROM mart.evolucao_mensal
ORDER BY mes;
