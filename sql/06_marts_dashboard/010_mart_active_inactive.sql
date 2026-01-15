-- Mart: Análise de clientes ativos vs inativos
DROP VIEW IF EXISTS mart.active_inactive CASCADE;

CREATE VIEW mart.active_inactive AS
SELECT
    c.customer_id,
    c.email_master,
    c.name_master,
    c.phone_master,
    c.city,
    c.state,
    m.total_orders,
    m.total_revenue,
    m.avg_ticket,
    m.first_purchase_date,
    m.last_purchase_date,
    m.days_since_last_purchase,
    m.is_active,
    m.recency_band,
    CASE 
        WHEN m.is_active THEN 'Ativo'
        WHEN m.total_orders > 0 THEN 'Inativo'
        ELSE 'Lead'
    END as customer_segment
FROM core.customer c
INNER JOIN metrics.customer_summary m ON c.customer_id = m.customer_id;

-- Teste: Distribuição por segmento
SELECT 
    customer_segment,
    COUNT(*) as clientes,
    ROUND(AVG(total_revenue), 2) as ltv_medio,
    SUM(total_orders) as pedidos_totais
FROM mart.active_inactive
GROUP BY customer_segment
ORDER BY clientes DESC;
