-- Metrics: Análise de Cohort (Retenção por mês da primeira compra)
DROP TABLE IF EXISTS metrics.cohorts CASCADE;

CREATE TABLE metrics.cohorts AS
WITH first_purchase AS (
    SELECT 
        customer_id,
        DATE_TRUNC('month', MIN(sale_date))::date as cohort_month
    FROM core.orders
    GROUP BY customer_id
),
customer_purchases AS (
    SELECT 
        o.customer_id,
        fp.cohort_month,
        DATE_TRUNC('month', o.sale_date)::date as purchase_month,
        EXTRACT(YEAR FROM AGE(o.sale_date, fp.cohort_month)) * 12 + 
        EXTRACT(MONTH FROM AGE(o.sale_date, fp.cohort_month)) as months_since_first,
        o.total_price
    FROM core.orders o
    INNER JOIN first_purchase fp ON o.customer_id = fp.customer_id
)
SELECT
    cohort_month,
    months_since_first as month_number,
    COUNT(DISTINCT customer_id) as customers,
    COUNT(*) as orders,
    ROUND(SUM(total_price), 2) as revenue
FROM customer_purchases
GROUP BY cohort_month, months_since_first
ORDER BY cohort_month, months_since_first;

CREATE INDEX idx_cohorts_month ON metrics.cohorts(cohort_month);
CREATE INDEX idx_cohorts_number ON metrics.cohorts(month_number);

-- Análise: Taxa de retenção
SELECT 
    cohort_month,
    month_number,
    customers,
    ROUND(100.0 * customers / FIRST_VALUE(customers) OVER (
        PARTITION BY cohort_month ORDER BY month_number
    ), 2) as retention_rate
FROM metrics.cohorts
WHERE cohort_month >= '2025-01-01'
ORDER BY cohort_month DESC, month_number
LIMIT 50;
