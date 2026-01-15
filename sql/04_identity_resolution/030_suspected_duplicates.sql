-- Identity Resolution: Detecta possíveis duplicatas (versão simplificada)
DROP TABLE IF EXISTS core.suspected_duplicates CASCADE;

CREATE TABLE core.suspected_duplicates (
    id SERIAL PRIMARY KEY,
    customer_id_a INTEGER,
    customer_id_b INTEGER,
    match_type TEXT,
    similarity_score DECIMAL(5,2),
    reason TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Match por telefone (rápido)
INSERT INTO core.suspected_duplicates (customer_id_a, customer_id_b, match_type, similarity_score, reason)
SELECT 
    MIN(customer_id) as customer_id_a,
    MAX(customer_id) as customer_id_b,
    'phone_match',
    100.0,
    'Mesmo telefone: ' || phone_master
FROM core.customer
WHERE phone_master IS NOT NULL
  AND LENGTH(phone_master) >= 10
GROUP BY phone_master
HAVING COUNT(*) > 1;

-- Match por documento (rápido)
INSERT INTO core.suspected_duplicates (customer_id_a, customer_id_b, match_type, similarity_score, reason)
SELECT 
    MIN(customer_id) as customer_id_a,
    MAX(customer_id) as customer_id_b,
    'document_match',
    100.0,
    'Mesmo documento: ' || document_master
FROM core.customer
WHERE document_master IS NOT NULL
GROUP BY document_master
HAVING COUNT(*) > 1;

-- Stats
SELECT 
    'Total de suspeitas' as info,
    COUNT(*) as quantidade
FROM core.suspected_duplicates
UNION ALL
SELECT 
    'Por tipo: ' || match_type,
    COUNT(*)
FROM core.suspected_duplicates
GROUP BY match_type;
