"""
Orquestracao de disparo: segmento do 360 -> broadcast no Mensage -> espelho local.

JWT (require_role). Reusa OS MESMOS filtros da pagina /clientes (dashboard.export_customers):
segment (Ativo/Inativo), product/product_search, min/max revenue. So dispara pra
phone_canon NAO nulo; wa_id = '55' + phone_canon (Meta/Evo aceitam com DDI).
"""
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from src.db.connection import get_sqlalchemy_engine
from src.webhook_api.auth_router import require_role
from src.settings import OFFICIAL_CHANNEL_ID, UNOFFICIAL_CHANNEL_ID
from src.connectors import mensage_client

router = APIRouter(prefix="/api/disparo", tags=["disparo"])


class SegmentFilters(BaseModel):
    segment: Optional[str] = None          # "Ativo" | "Inativo"
    product: Optional[str] = None
    product_search: Optional[str] = None
    min_revenue: Optional[float] = None
    max_revenue: Optional[float] = None


def _build_segment(f: SegmentFilters):
    """Espelha dashboard.export_customers; sempre exige phone_canon nao nulo."""
    conditions = ["m.total_orders > 0", "c.phone_canon IS NOT NULL"]
    params = {}

    if f.segment == "Ativo":
        conditions.append("m.is_active = true")
    elif f.segment == "Inativo":
        conditions.append("m.is_active = false")

    if f.min_revenue is not None:
        conditions.append("m.total_revenue >= :min_revenue")
        params["min_revenue"] = f.min_revenue
    if f.max_revenue is not None:
        conditions.append("m.total_revenue <= :max_revenue")
        params["max_revenue"] = f.max_revenue

    product_join = ""
    if f.product or f.product_search:
        product_join = "INNER JOIN core.orders o ON c.customer_id = o.customer_id"
        if f.product:
            conditions.append("o.product_name = :product")
            params["product"] = f.product
        if f.product_search:
            conditions.append("LOWER(o.product_name) LIKE LOWER(:product_search)")
            params["product_search"] = f"%{f.product_search}%"

    where_clause = " AND ".join(conditions)
    base = f"""
        FROM core.customer c
        INNER JOIN metrics.customer_summary m ON c.customer_id = m.customer_id
        {product_join}
        WHERE {where_clause}
    """
    return base, params


@router.post("/preview")
def preview(filters: SegmentFilters, user: dict = Depends(require_role("admin", "gestor", "operador"))):
    base, params = _build_segment(filters)
    engine = get_sqlalchemy_engine()
    with engine.connect() as conn:
        count = conn.execute(text(f"SELECT COUNT(DISTINCT c.customer_id) {base}"), params).scalar()
        sample_rows = conn.execute(
            text(f"SELECT DISTINCT c.customer_id, c.name_master {base} ORDER BY c.customer_id LIMIT 5"),
            params,
        ).fetchall()
    sample = [{"customer_id": r[0], "name": r[1]} for r in sample_rows]
    return {"count": count or 0, "sample": sample}


def _resolve_contacts(filters: SegmentFilters):
    base, params = _build_segment(filters)
    engine = get_sqlalchemy_engine()
    with engine.connect() as conn:
        rows = conn.execute(
            text(f"SELECT DISTINCT c.customer_id, c.name_master, c.phone_canon {base}"),
            params,
        ).fetchall()
    contacts = []
    for r in rows:
        canon = r[2]
        if not canon:  # guarda extra; o WHERE ja filtra
            continue
        contacts.append({"wa_id": "55" + canon, "name": r[1] or ""})
    return contacts


class CreateDisparo(BaseModel):
    filters: SegmentFilters
    channel: str                      # "official" | "unofficial"
    message: dict                     # oficial: {template_id, template_params?} | nao-oficial: {text, media_id?}
    name: Optional[str] = None
    scheduled_at: Optional[str] = None
    interval_seconds: int = 2


@router.post("/create")
def create(body: CreateDisparo, user: dict = Depends(require_role("admin", "gestor"))):
    if body.channel == "official":
        channel_id = OFFICIAL_CHANNEL_ID
        message_payload = {"template_id": body.message.get("template_id"),
                           "template_params": body.message.get("template_params", {})}
        if not message_payload["template_id"]:
            raise HTTPException(status_code=422, detail="canal oficial exige template_id")
    elif body.channel == "unofficial":
        if not UNOFFICIAL_CHANNEL_ID:
            raise HTTPException(status_code=500, detail="UNOFFICIAL_CHANNEL_ID nao configurado")
        channel_id = int(UNOFFICIAL_CHANNEL_ID)
        message_payload = {"text": body.message.get("text", "")}
        if body.message.get("media_id"):
            message_payload["media_id"] = body.message["media_id"]
        if not message_payload.get("text") and not message_payload.get("media_id"):
            raise HTTPException(status_code=422, detail="canal nao-oficial exige text ou media_id")
    else:
        raise HTTPException(status_code=422, detail="channel deve ser 'official' ou 'unofficial'")

    contacts = _resolve_contacts(body.filters)
    if not contacts:
        raise HTTPException(status_code=422, detail="segmento vazio (nenhum contato com phone_canon)")

    name = body.name or f"Disparo {body.channel} ({len(contacts)} contatos)"

    # cria no Mensage
    try:
        job = mensage_client.create_broadcast(
            name=name, channel_id=channel_id, contacts=contacts,
            message_payload=message_payload, interval_seconds=body.interval_seconds,
            scheduled_at=body.scheduled_at,
        )
    except mensage_client.MensageError as e:
        raise HTTPException(status_code=502, detail=f"Mensage rejeitou o disparo: {e}")

    mensage_job_id = job.get("id")

    # espelha em comm.broadcast_jobs
    audience_summary = json.dumps({
        "filters": body.filters.model_dump(),
        "channel": body.channel,
        "total": len(contacts),
    }, ensure_ascii=False)
    engine = get_sqlalchemy_engine()
    with engine.begin() as conn:
        local_id = conn.execute(text("""
            INSERT INTO comm.broadcast_jobs
                (mensage_job_id, channel, audience_summary, scheduled_at, status,
                 total_targets, sent_count, error_count, created_by)
            VALUES (:job_id, :channel, CAST(:summary AS JSONB), :scheduled_at, 'pending',
                    :total, 0, 0, :created_by)
            RETURNING id
        """), {
            "job_id": mensage_job_id, "channel": body.channel, "summary": audience_summary,
            "scheduled_at": body.scheduled_at, "total": len(contacts),
            "created_by": int(user["sub"]),
        }).scalar()

    return {"id": local_id, "mensage_job_id": mensage_job_id,
            "status": job.get("status", "pending"), "total_targets": len(contacts)}


@router.get("/")
def list_jobs(user: dict = Depends(require_role("admin", "gestor", "operador"))):
    engine = get_sqlalchemy_engine()
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT id, mensage_job_id, channel, status, total_targets, sent_count,
                   error_count, scheduled_at, created_at, updated_at
            FROM comm.broadcast_jobs ORDER BY created_at DESC LIMIT 100
        """))
        keys = list(result.keys())
        rows = [dict(zip(keys, r)) for r in result.fetchall()]
    return {"data": rows}


@router.get("/{job_id}")
def get_job(job_id: int, refresh: bool = False,
            user: dict = Depends(require_role("admin", "gestor", "operador"))):
    engine = get_sqlalchemy_engine()
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT id, mensage_job_id, channel, audience_summary, status, total_targets,
                   sent_count, error_count, scheduled_at, created_by, created_at, updated_at
            FROM comm.broadcast_jobs WHERE id = :id
        """), {"id": job_id})
        keys = list(result.keys())
        row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Job nao encontrado")
    job = dict(zip(keys, row))

    # fallback opcional: forca refresh do status direto no Mensage
    if refresh and job.get("mensage_job_id"):
        try:
            remote = mensage_client.get_broadcast(job["mensage_job_id"])
            job["mensage_remote"] = remote
        except mensage_client.MensageError as e:
            job["mensage_remote_error"] = str(e)
    return job


@router.post("/{job_id}/cancel")
def cancel_job(job_id: int, user: dict = Depends(require_role("admin", "gestor"))):
    engine = get_sqlalchemy_engine()
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT mensage_job_id FROM comm.broadcast_jobs WHERE id = :id"),
            {"id": job_id},
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Job nao encontrado")
    mensage_job_id = row[0]

    cancelled_remote = False
    if mensage_job_id:
        try:
            mensage_client.cancel_broadcast(mensage_job_id)
            cancelled_remote = True
        except mensage_client.MensageError as e:
            raise HTTPException(status_code=502, detail=f"Mensage falhou ao cancelar: {e}")

    with engine.begin() as conn:
        conn.execute(text("""
            UPDATE comm.broadcast_jobs SET status = 'cancelled', updated_at = now() WHERE id = :id
        """), {"id": job_id})
    return {"status": "cancelled", "remote": cancelled_remote}
