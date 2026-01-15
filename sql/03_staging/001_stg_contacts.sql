-- Staging: Contatos normalizados do RD Station
DROP TABLE IF EXISTS stg.contacts CASCADE;

CREATE TABLE stg.contacts AS
SELECT
    id as source_id,
    'rdstation' as source,
    LOWER(TRIM(email)) as email_norm,
    REGEXP_REPLACE(LOWER(TRIM(email)), '\s+', '', 'g') as email_clean,
    INITCAP(TRIM(nome)) as name_norm,
    REGEXP_REPLACE(COALESCE(celular, telefone), '\D', '', 'g') as phone_norm,
    cidade,
    estado,
    pais,
    empresa as company,
    cargo as job_title,
    tags,
    estagio_funil as lead_stage,
    data_primeira_conversao as first_conversion_date,
    data_ultima_conversao as last_conversion_date,
    imported_at
FROM raw.rd_leads
WHERE email IS NOT NULL
  AND TRIM(email) != '';

-- Índices
CREATE INDEX idx_stg_contacts_email ON stg.contacts(email_norm);
CREATE INDEX idx_stg_contacts_phone ON stg.contacts(phone_norm);
CREATE INDEX idx_stg_contacts_source ON stg.contacts(source);

-- Stats
SELECT 
    'stg.contacts' as tabela,
    COUNT(*) as total_registros,
    COUNT(DISTINCT email_norm) as emails_unicos,
    COUNT(DISTINCT phone_norm) as telefones_unicos
FROM stg.contacts;
