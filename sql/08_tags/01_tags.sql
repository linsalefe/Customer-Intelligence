-- 08_tags / 01 — Tags de contato no inbox. Idempotente.

CREATE TABLE IF NOT EXISTS comm.tags (
    id         serial PRIMARY KEY,
    name       text UNIQUE NOT NULL,
    color      text DEFAULT '#888',
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comm.contact_tags (
    contact_wa_id text NOT NULL,
    tag_id        int NOT NULL REFERENCES comm.tags(id) ON DELETE CASCADE,
    created_at    timestamptz DEFAULT now(),
    PRIMARY KEY (contact_wa_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_tags_wa ON comm.contact_tags(contact_wa_id);
