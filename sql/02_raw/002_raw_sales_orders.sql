-- Tabela raw para vendas (Hotmart/Doit)
DROP TABLE IF EXISTS raw.sales_orders CASCADE;

CREATE TABLE raw.sales_orders (
    id SERIAL PRIMARY KEY,
    source TEXT,  -- 'hotmart', 'doit', etc
    transaction_id TEXT,
    product_name TEXT,
    status TEXT,
    sale_date TEXT,
    confirmation_date TEXT,
    name TEXT,
    email TEXT,
    document TEXT,
    phone TEXT,
    ddd TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    total_price TEXT,
    payment_type TEXT,
    currency TEXT,
    producer_name TEXT,
    affiliate_name TEXT,
    raw_data JSONB,
    imported_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sales_email ON raw.sales_orders(email);
CREATE INDEX idx_sales_transaction ON raw.sales_orders(transaction_id);
CREATE INDEX idx_sales_date ON raw.sales_orders(sale_date);
CREATE INDEX idx_sales_source ON raw.sales_orders(source);
CREATE INDEX idx_sales_imported ON raw.sales_orders(imported_at);
