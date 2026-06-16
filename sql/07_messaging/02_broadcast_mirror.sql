-- 07_messaging / 02 — Espelho local do job de disparo do Mensage.
-- Idempotente. Sem FK cross-server: mensage_job_id e so a referencia remota.
-- Permite ao Customer rastrear o disparo (audiencia, agendamento, progresso) localmente.

CREATE TABLE IF NOT EXISTS comm.broadcast_jobs (
    id               serial PRIMARY KEY,
    mensage_job_id   int,
    channel          text,
    audience_summary jsonb,
    scheduled_at     timestamptz,
    status           text DEFAULT 'pending',
    total_targets    int,
    sent_count       int,
    error_count      int,
    created_by       int REFERENCES core.users(id),
    created_at       timestamptz DEFAULT now(),
    updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_jobs_status ON comm.broadcast_jobs(status);
CREATE INDEX IF NOT EXISTS idx_broadcast_jobs_mensage ON comm.broadcast_jobs(mensage_job_id);
