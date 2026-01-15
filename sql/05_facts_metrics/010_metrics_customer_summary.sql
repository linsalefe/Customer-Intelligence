-- Metrics: Resumo por cliente (RFM + Ativo/Inativo)
DROP TABLE IF EXISTS metrics.customer_summary CASCADE;

CREATE TABLE metrics.customer_summary (
    customer_id INTEGER PRIMARY KEY REFERENCES core.customer(customer_id),
    total_orders INTEGER,
    total_revenue DECIMAL(10,2),
    avg_ticket DECIMAL(10,2),
    first_purchase_date DATE,
    last_purchase_date DATE,
    days_since_last_purchase INTEGER,
    is_active BOOLEAN,
    recency_band TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Popula métricas
INSERT INTO metrics.customer_summary
SELECT 
    c.customer_id,
    COALESCE(COUNT(o.order_id), 0) as total_orders,
    COALESCE(SUM(o.total_price), 0) as total_revenue,
    COALESCE(AVG(o.total_price), 0) as avg_ticket,
    MIN(o.sale_date)::date as first_purchase_date,
    MAX(o.sale_date)::date as last_purchase_date,
    COALESCE(CURRENT_DATE - MAX(o.sale_date)::date, 9999) as days_since_last_purchase,
    CASE 
        WHEN MAX(o.sale_date)::date >= CURRENT_DATE - INTERVAL '90 days' THEN true
        ELSE false
    END as is_active,
    CASE 
        WHEN MAX(o.sale_date) IS NULL THEN 'Nunca comprou'
        WHEN CURRENT_DATE - MAX(o.sale_date)::date <= 30 THEN '0-30 dias'
        WHEN CURRENT_DATE - MAX(o.sale_date)::date <= 60 THEN '31-60 dias'
        WHEN CURRENT_DATE - MAX(o.sale_date)::date <= 90 THEN '61-90 dias'
        WHEN CURRENT_DATE - MAX(o.sale_date)::date <= 180 THEN '91-180 dias'
        ELSE '180+ dias'
    END as recency_band
FROM core.customer c
LEFT JOIN core.orders o ON c.customer_id = o.customer_id
GROUP BY c.customer_id;

CREATE INDEX idx_customer_summary_active ON metrics.customer_summary(is_active);
CREATE INDEX idx_customer_summary_recency ON metrics.customer_summary(recency_band);

-- Stats gerais
SELECT 
    'GERAL' as categoria,
    COUNT(*) as total_clientes,
    SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as ativos,
    SUM(CASE WHEN NOT is_active THEN 1 ELSE 0 END) as inativos,
    SUM(CASE WHEN total_orders = 0 THEN 1 ELSE 0 END) as nunca_compraram
FROM metrics.customer_summary;

-- Stats por recência
SELECT 
    recency_band,
    COUNT(*) as clientes,
    ROUND(AVG(total_revenue), 2) as ltv_medio
FROM metrics.customer_summary
WHERE total_orders > 0
GROUP BY recency_band
ORDER BY 
    CASE recency_band
        WHEN '0-30 dias' THEN 1
        WHEN '31-60 dias' THEN 2
        WHEN '61-90 dias' THEN 3
        WHEN '91-180 dias' THEN 4
        ELSE 5
    END;
