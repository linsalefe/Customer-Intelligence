-- Mart: Lista de clientes para reativação
DROP VIEW IF EXISTS mart.reactivation_list CASCADE;

CREATE VIEW mart.reactivation_list AS
SELECT
    c.customer_id,
    c.email_master,
    c.name_master,
    c.phone_master,
    c.city,
    c.state,
    m.total_orders,
    m.total_revenue as ltv,
    m.last_purchase_date,
    m.days_since_last_purchase,
    m.recency_band,
    -- Score de prioridade (quanto maior, mais prioritário)
    CASE 
        WHEN m.days_since_last_purchase BETWEEN 91 AND 180 THEN 100
        WHEN m.days_since_last_purchase BETWEEN 181 AND 365 THEN 80
        WHEN m.days_since_last_purchase > 365 THEN 60
        ELSE 0
    END +
    CASE 
        WHEN m.total_orders >= 5 THEN 50
        WHEN m.total_orders >= 3 THEN 30
        WHEN m.total_orders >= 2 THEN 20
        ELSE 10
    END +
    CASE 
        WHEN m.total_revenue >= 1000 THEN 50
        WHEN m.total_revenue >= 500 THEN 30
        WHEN m.total_revenue >= 200 THEN 20
        ELSE 10
    END as reactivation_score
FROM core.customer c
INNER JOIN metrics.customer_summary m ON c.customer_id = m.customer_id
WHERE m.is_active = false
  AND m.total_orders > 0
ORDER BY reactivation_score DESC, m.total_revenue DESC;

-- Top 20 para reativar
SELECT 
    email_master,
    name_master,
    phone_master,
    total_orders as pedidos,
    ltv,
    days_since_last_purchase as dias_sem_comprar,
    reactivation_score as score
FROM mart.reactivation_list
LIMIT 20;
