-- 07_messaging / 04 — Role dedicado pra ponte/relay de mensageria.
-- Aditivo: NAO altera o role 'postgres'. mensage_rw e o usuario que o Servidor A usa
-- (nao superuser): R/W em comm, apenas SELECT em core.
--
-- A SENHA NAO ESTA AQUI (nao versionar secret). Criar/rotacionar fora do git:
--   ALTER ROLE mensage_rw LOGIN PASSWORD '<forte>';
-- Este arquivo so cria o role (sem login ate ter senha) e aplica os grants — idempotente.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mensage_rw') THEN
        CREATE ROLE mensage_rw NOLOGIN;
    END IF;
END $$;

-- comm: leitura e escrita
GRANT USAGE ON SCHEMA comm TO mensage_rw;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA comm TO mensage_rw;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA comm TO mensage_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA comm
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mensage_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA comm
    GRANT USAGE, SELECT ON SEQUENCES TO mensage_rw;

-- core: somente leitura (o linker precisa de SELECT em core.customer)
GRANT USAGE ON SCHEMA core TO mensage_rw;
GRANT SELECT ON ALL TABLES IN SCHEMA core TO mensage_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA core
    GRANT SELECT ON TABLES TO mensage_rw;

-- executar o linker
GRANT EXECUTE ON FUNCTION comm.normalize_phone_br(text) TO mensage_rw;
GRANT EXECUTE ON FUNCTION comm.link_customer(text) TO mensage_rw;
