-- Staging: Vendas normalizadas (Hotmart/Doity)
DROP TABLE IF EXISTS stg.orders_unified CASCADE;

CREATE TABLE stg.orders_unified AS
SELECT
    id as source_id,
    source,
    transaction_id,
    product_name,
    status,
    -- Converte data no formato DD/MM/YYYY HH:MM:SS
    CASE 
        WHEN sale_date ~ '^\d{2}/\d{2}/\d{4}' THEN 
            TO_TIMESTAMP(sale_date, 'DD/MM/YYYY HH24:MI:SS')
        ELSE NULL
    END as sale_date_parsed,
    CASE 
        WHEN confirmation_date ~ '^\d{2}/\d{2}/\d{4}' THEN 
            TO_TIMESTAMP(confirmation_date, 'DD/MM/YYYY HH24:MI:SS')
        ELSE NULL
    END as confirmation_date_parsed,
    INITCAP(TRIM(name)) as name_norm,
    LOWER(TRIM(email)) as email_norm,
    REGEXP_REPLACE(document, '\D', '', 'g') as document_norm,
    REGEXP_REPLACE(COALESCE(ddd || phone, phone), '\D', '', 'g') as phone_norm,
    city,
    state,
    country,
    -- Converte valores (trata vírgula brasileira)
    CAST(
        REPLACE(
            REGEXP_REPLACE(total_price, '[^\d,.]', '', 'g'),
            ',', '.'
        ) AS DECIMAL(10,2)
    ) as total_price_num,
    payment_type,
    currency,
    imported_at
FROM raw.sales_orders
WHERE email IS NOT NULL
  AND TRIM(email) != ''
  AND status IN ('Aprovado', 'Completo', 'Complete', 'approved', 'completed', 'Concluído', 'Gratuito', 'Autorizado');

-- Índices
CREATE INDEX idx_stg_orders_email ON stg.orders_unified(email_norm);
CREATE INDEX idx_stg_orders_document ON stg.orders_unified(document_norm);
CREATE INDEX idx_stg_orders_phone ON stg.orders_unified(phone_norm);
CREATE INDEX idx_stg_orders_transaction ON stg.orders_unified(transaction_id);
CREATE INDEX idx_stg_orders_date ON stg.orders_unified(sale_date_parsed);

-- Stats
SELECT 
    'stg.orders_unified' as tabela,
    COUNT(*) as total_registros,
    COUNT(DISTINCT email_norm) as emails_unicos,
    MIN(sale_date_parsed) as primeira_venda,
    MAX(sale_date_parsed) as ultima_venda,
    SUM(total_price_num) as receita_total
FROM stg.orders_unified;
