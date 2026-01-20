-- Tabela de auditoria de webhooks Hotmart
CREATE TABLE IF NOT EXISTS raw.hotmart_events (
    id BIGSERIAL PRIMARY KEY,
    received_at TIMESTAMP NOT NULL DEFAULT NOW(),
    event_type TEXT,
    transaction_id TEXT,
    email TEXT,
    payload JSONB NOT NULL,
    payload_hash TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_hotmart_events_payload_hash
ON raw.hotmart_events(payload_hash);

CREATE INDEX IF NOT EXISTS idx_hotmart_events_transaction
ON raw.hotmart_events(transaction_id);

CREATE INDEX IF NOT EXISTS idx_hotmart_events_email
ON raw.hotmart_events(email);
