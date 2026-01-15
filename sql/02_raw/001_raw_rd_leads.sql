-- Tabela raw para leads do RD Station
DROP TABLE IF EXISTS raw.rd_leads CASCADE;

CREATE TABLE raw.rd_leads (
    id SERIAL PRIMARY KEY,
    email TEXT,
    nome TEXT,
    telefone TEXT,
    celular TEXT,
    empresa TEXT,
    cargo TEXT,
    cidade TEXT,
    estado TEXT,
    pais TEXT,
    tags TEXT,
    estagio_funil TEXT,
    status_comunicacao TEXT,
    data_primeira_conversao TEXT,
    data_ultima_conversao TEXT,
    total_conversoes TEXT,
    raw_data JSONB,
    imported_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rd_leads_email ON raw.rd_leads(email);
CREATE INDEX idx_rd_leads_imported ON raw.rd_leads(imported_at);
