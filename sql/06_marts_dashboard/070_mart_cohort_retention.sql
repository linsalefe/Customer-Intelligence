-- Mart: Cohort Retention (para heatmap no Metabase)
DROP VIEW IF EXISTS mart.cohort_retention CASCADE;

CREATE VIEW mart.cohort_retention AS
SELECT 
    TO_CHAR(cohort_month, 'YYYY-MM') as cohort,
    month_number,
    customers,
    orders,
    revenue,
    ROUND(100.0 * customers / FIRST_VALUE(customers) OVER (
        PARTITION BY cohort_month ORDER BY month_number
    ), 1) as retention_pct
FROM metrics.cohorts
ORDER BY cohort_month DESC, month_number;

-- Teste
SELECT * FROM mart.cohort_retention WHERE cohort >= '2025-01' LIMIT 20;
