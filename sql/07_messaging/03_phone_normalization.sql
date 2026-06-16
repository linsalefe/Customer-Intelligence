-- 07_messaging / 03 — Linker de telefone: normalizacao canonica + indice + backfill.
-- Idempotente. NAO reescreve phone_master (coluna nova phone_canon).
--
-- REGRAS DE NORMALIZACAO (comm.normalize_phone_br):
--   1. Remove tudo que nao for digito.
--   2. DDI: se tiver 12 ou 13 digitos E comecar com '55', remove o '55'.
--      (O guard por comprimento protege numeros do DDD 55 (Santa Maria/RS):
--       um celular DDD 55 = 11 digitos (5598xxxxxxx) NAO entra em (12,13) e fica intacto;
--       um landline DDD 55 = 10 digitos idem. So removemos '55' quando ele e DDI.)
--   3. 9o DIGITO: numero de 10 digitos (DDD + 8 locais) cujo 1o digito local e {6,7,8,9}
--      e celular antigo sem o 9 => insere '9' apos o DDD -> 11 digitos (regra Anatel).
--      Se o 1o digito local for {2,3,4,5} e fixo => mantem 10. Isso e o que casa o wa_id da
--      Farmer (que chega 55+DDD+8, sem o 9) com o cadastro do cliente (DDD+9+8).
--   4. Forma canonica = SEM DDI, com DDD: 10 digitos (fixo) ou 11 (celular com 9o digito).
--   5. Se sobrar != 10 e != 11 digitos (ex.: 8/9 sem DDD), retorna NULL
--      (sem DDD nao da pra casar com seguranca).
--
-- LIMITACAO CONHECIDA (deferida): colisao de phone_canon (LIMIT 1 arbitrario) e estrategia
--   pros telefones que normalizam pra <10 digitos ficam pra discussao posterior.

CREATE OR REPLACE FUNCTION comm.normalize_phone_br(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    WITH d AS (
        SELECT regexp_replace(COALESCE(raw, ''), '\D', '', 'g') AS digits
    ),
    s AS (
        -- tira DDI 55 (gated por comprimento p/ nao corromper DDD 55)
        SELECT CASE
            WHEN length(digits) IN (12, 13) AND left(digits, 2) = '55'
                THEN substr(digits, 3)
            ELSE digits
        END AS c
        FROM d
    ),
    n AS (
        -- insere 9o digito em celular de 10 digitos (1o local em {6,7,8,9})
        SELECT CASE
            WHEN length(c) = 11 THEN c
            WHEN length(c) = 10 AND substr(c, 3, 1) IN ('6', '7', '8', '9')
                THEN left(c, 2) || '9' || substr(c, 3)
            WHEN length(c) = 10 THEN c
            ELSE c
        END AS canon
        FROM s
    )
    SELECT CASE WHEN length(canon) IN (10, 11) THEN canon ELSE NULL END
    FROM n;
$$;

-- Coluna canonica + indice (aditivo em core.customer)
ALTER TABLE core.customer ADD COLUMN IF NOT EXISTS phone_canon text;
CREATE INDEX IF NOT EXISTS idx_customer_phone_canon ON core.customer(phone_canon);

-- Backfill (so onde ha telefone real; idempotente)
UPDATE core.customer
SET phone_canon = comm.normalize_phone_br(phone_master)
WHERE phone_master IS NOT NULL AND phone_master <> '';

-- Match real (substitui o LIKE '%suffix' ingenuo): usa o indice acima.
-- Sera chamado pelo backend de mensageria na S3.
CREATE OR REPLACE FUNCTION comm.link_customer(p_wa_id text)
RETURNS int
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_canon text;
    v_id    int;
BEGIN
    v_canon := comm.normalize_phone_br(p_wa_id);
    IF v_canon IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT customer_id INTO v_id
    FROM core.customer
    WHERE phone_canon = v_canon
    LIMIT 1;

    RETURN v_id;
END;
$$;
