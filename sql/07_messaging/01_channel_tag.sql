-- 07_messaging / 01 — Tag de canal em comm.* (oficial vs nao-oficial)
-- Idempotente. Os 14 contatos existentes sao Evolution/Farmer => 'unofficial' (default cobre).
-- channel_id e so rotulo (sem FK cross-server): futuramente aponta pro canal
--   (ex.: canal oficial id 6 do Mensage / instancia Evolution).

ALTER TABLE comm.wa_contacts
    ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'unofficial';
ALTER TABLE comm.wa_contacts
    ADD COLUMN IF NOT EXISTS channel_id int;

ALTER TABLE comm.wa_messages
    ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'unofficial';
ALTER TABLE comm.wa_messages
    ADD COLUMN IF NOT EXISTS channel_id int;

-- CHECK guardado (idempotente via catalogo)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'wa_contacts_provider_check'
    ) THEN
        ALTER TABLE comm.wa_contacts
            ADD CONSTRAINT wa_contacts_provider_check
            CHECK (provider IN ('official', 'unofficial'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'wa_messages_provider_check'
    ) THEN
        ALTER TABLE comm.wa_messages
            ADD CONSTRAINT wa_messages_provider_check
            CHECK (provider IN ('official', 'unofficial'));
    END IF;
END $$;

-- Filtrar por canal no inbox
CREATE INDEX IF NOT EXISTS idx_wa_messages_provider ON comm.wa_messages(provider);
CREATE INDEX IF NOT EXISTS idx_wa_contacts_provider ON comm.wa_contacts(provider);
