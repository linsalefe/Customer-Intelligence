-- Core: Tabela master de clientes
DROP TABLE IF EXISTS core.customer CASCADE;

CREATE TABLE core.customer (
    customer_id SERIAL PRIMARY KEY,
    email_master TEXT NOT NULL,
    name_master TEXT,
    phone_master TEXT,
    document_master TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_customer_email ON core.customer(email_master);
CREATE INDEX idx_customer_phone ON core.customer(phone_master);
CREATE INDEX idx_customer_document ON core.customer(document_master);

-- Popula com base nas vendas (prioridade para quem já comprou)
INSERT INTO core.customer (email_master, name_master, phone_master, document_master, city, state, country)
SELECT DISTINCT ON (email_norm)
    email_norm as email_master,
    name_norm as name_master,
    phone_norm as phone_master,
    document_norm as document_master,
    city,
    state,
    country
FROM stg.orders_unified
WHERE email_norm IS NOT NULL
ORDER BY email_norm, sale_date_parsed DESC;

-- Adiciona leads que não compraram ainda
INSERT INTO core.customer (email_master, name_master, phone_master, city, state, country)
SELECT DISTINCT ON (email_norm)
    email_norm,
    name_norm,
    phone_norm,
    cidade,
    estado,
    pais
FROM stg.contacts
WHERE email_norm NOT IN (SELECT email_master FROM core.customer)
  AND email_norm IS NOT NULL
ORDER BY email_norm;

-- Stats
SELECT 
    'core.customer' as tabela,
    COUNT(*) as total_clientes,
    COUNT(DISTINCT email_master) as emails_unicos,
    COUNT(DISTINCT phone_master) as telefones_unicos,
    COUNT(DISTINCT document_master) as documentos_unicos
FROM core.customer;
