-- Mart: Top clientes por receita e frequência
DROP VIEW IF EXISTS mart.top_customers CASCADE;

CREATE VIEW mart.top_customers AS
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
    m.is_active,
    -- Ranking
    RANK() OVER (ORDER BY m.total_revenue DESC) as rank_revenue,
    RANK() OVER (ORDER BY m.total_orders DESC) as rank_frequency
FROM core.customer c
INNER JOIN metrics.customer_summary m ON c.customer_id = m.customer_id
WHERE m.total_orders > 0;

-- Top 30 por receita
SELECT 
    rank_revenue as rank,
    name_master as nome,
    email_master as email,
    total_orders as pedidos,
    ROUND(total_revenue, 2) as ltv,
    ROUND(avg_ticket, 2) as ticket_medio,
    CASE WHEN is_active THEN 'Ativo' ELSE 'Inativo' END as status
FROM mart.top_customers
WHERE rank_revenue <= 30
ORDER BY rank_revenue;
