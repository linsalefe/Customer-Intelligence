-- Mart: Histórico de produtos dos clientes para reativação
DROP VIEW IF EXISTS mart.reactivation_products CASCADE;

CREATE VIEW mart.reactivation_products AS
SELECT
    r.customer_id,
    r.email_master,
    r.name_master,
    r.phone_master,
    r.ltv,
    r.total_orders,
    r.last_purchase_date,
    r.days_since_last_purchase,
    r.reactivation_score,
    o.product_name,
    o.sale_date::date as data_compra,
    o.total_price as valor_pago,
    o.source as plataforma
FROM mart.reactivation_list r
INNER JOIN core.orders o ON r.customer_id = o.customer_id
ORDER BY r.reactivation_score DESC, o.sale_date DESC;

-- Teste: Top 10 para reativar com seus produtos
SELECT 
    email_master,
    name_master,
    reactivation_score,
    COUNT(DISTINCT product_name) as produtos_diferentes,
    STRING_AGG(DISTINCT product_name, ', ') as lista_produtos
FROM mart.reactivation_products
GROUP BY email_master, name_master, reactivation_score
ORDER BY reactivation_score DESC
LIMIT 10;
