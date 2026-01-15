-- Core: Tabela de pedidos vinculados ao customer_id
DROP TABLE IF EXISTS core.orders CASCADE;

CREATE TABLE core.orders (
    order_id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES core.customer(customer_id),
    source TEXT,
    transaction_id TEXT,
    product_name TEXT,
    sale_date TIMESTAMP,
    confirmation_date TIMESTAMP,
    total_price DECIMAL(10,2),
    payment_type TEXT,
    currency TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_orders_customer ON core.orders(customer_id);
CREATE INDEX idx_orders_date ON core.orders(sale_date);
CREATE INDEX idx_orders_transaction ON core.orders(transaction_id);

-- Popula vinculando vendas aos clientes
INSERT INTO core.orders (
    customer_id,
    source,
    transaction_id,
    product_name,
    sale_date,
    confirmation_date,
    total_price,
    payment_type,
    currency
)
SELECT 
    c.customer_id,
    o.source,
    o.transaction_id,
    o.product_name,
    o.sale_date_parsed,
    o.confirmation_date_parsed,
    o.total_price_num,
    o.payment_type,
    o.currency
FROM stg.orders_unified o
INNER JOIN core.customer c ON o.email_norm = c.email_master;

-- Stats
SELECT 
    'core.orders' as tabela,
    COUNT(*) as total_pedidos,
    COUNT(DISTINCT customer_id) as clientes_compradores,
    MIN(sale_date)::date as primeira_venda,
    MAX(sale_date)::date as ultima_venda,
    ROUND(SUM(total_price), 2) as receita_total,
    ROUND(AVG(total_price), 2) as ticket_medio
FROM core.orders;
