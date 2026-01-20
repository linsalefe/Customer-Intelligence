-- Mart: Seminários (produtos entre R$ 9 e R$ 20)
DROP VIEW IF EXISTS mart.seminarios CASCADE;

CREATE VIEW mart.seminarios AS
SELECT
    o.order_id,
    o.customer_id,
    c.name_master as cliente,
    c.email_master as email,
    c.phone_master as telefone,
    o.product_name as seminario,
    o.sale_date::date as data_compra,
    o.total_price as valor,
    o.source as plataforma,
    CASE WHEN m.is_active THEN 'Ativo' ELSE 'Inativo' END as status_cliente
FROM core.orders o
INNER JOIN core.customer c ON o.customer_id = c.customer_id
INNER JOIN metrics.customer_summary m ON c.customer_id = m.customer_id
WHERE o.total_price >= 9 AND o.total_price <= 20
ORDER BY o.sale_date DESC;

-- Stats
SELECT 
    'Seminários' as categoria,
    COUNT(*) as total_vendas,
    COUNT(DISTINCT customer_id) as clientes_unicos,
    ROUND(SUM(valor), 2) as receita_total,
    ROUND(AVG(valor), 2) as ticket_medio
FROM mart.seminarios;
