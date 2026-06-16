"""
Receivers do relay Mensage -> Customer.

O Mensage JA faz estes POSTs; esta sprint cria os receivers. Autenticacao por
X-Webhook-Secret (constant-time), NAO por JWT. Grava em comm.* com provider e
resolve customer_id via comm.link_customer (heuristica do 9o digito em trafego real).
"""
import hmac
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, Any

from src.db.connection import get_postgres_connection
from src.settings import WEBHOOK_SECRET

router = APIRouter(prefix="/api/whatsapp/relay", tags=["relay"])

SP_TZ = timezone(timedelta(hours=-3))

# ordem de status: nao regredir (received < sent < delivered < read).
# status fora da escala (failed/pending) aplicam sempre.
_STATUS_RANK = {"received": 1, "sent": 2, "delivered": 3, "read": 4}


def _now():
    return datetime.now(SP_TZ).replace(tzinfo=None)


def _check_secret(request: Request):
    sent = request.headers.get("x-webhook-secret", "")
    if not WEBHOOK_SECRET or not hmac.compare_digest(sent, WEBHOOK_SECRET):
        raise HTTPException(status_code=403, detail="Webhook secret invalido")


def _parse_ts(ts: Any):
    if ts is None:
        return _now()
    # epoch (int/float ou string de digitos)
    if isinstance(ts, (int, float)):
        return datetime.fromtimestamp(int(ts), tz=SP_TZ).replace(tzinfo=None)
    s = str(ts).strip()
    if s.isdigit():
        return datetime.fromtimestamp(int(s), tz=SP_TZ).replace(tzinfo=None)
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(SP_TZ).replace(tzinfo=None)
    except ValueError:
        return _now()


class InboundRelay(BaseModel):
    wa_id: str
    wa_message_id: Optional[str] = None
    message_type: Optional[str] = "text"
    content: Optional[str] = ""
    timestamp: Optional[Any] = None
    sender_name: Optional[str] = None
    channel: Optional[dict] = None


@router.post("/inbound")
async def relay_inbound(payload: InboundRelay, request: Request):
    _check_secret(request)

    wa_id = payload.wa_id
    if not wa_id:
        raise HTTPException(status_code=422, detail="wa_id obrigatorio")

    channel = payload.channel or {}
    channel_id = channel.get("id")
    channel_name = channel.get("name") or "oficial"
    provider = channel.get("provider") or "official"
    msg_time = _parse_ts(payload.timestamp)
    content = payload.content or ""
    sender_name = payload.sender_name or wa_id
    msg_type = payload.message_type or "text"

    conn = get_postgres_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, customer_id FROM comm.wa_contacts WHERE wa_id = %s", (wa_id,))
        existing = cursor.fetchone()

        if not existing:
            # link_customer roda aqui em trafego real (heuristica do 9o digito)
            cursor.execute("SELECT comm.link_customer(%s)", (wa_id,))
            customer_id = cursor.fetchone()[0]
            cursor.execute("""
                INSERT INTO comm.wa_contacts
                    (wa_id, name, phone_normalized, customer_id, channel_name, provider, channel_id,
                     last_message, last_message_time, last_direction, unread, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'inbound', 1, %s, %s)
            """, (wa_id, sender_name, wa_id, customer_id, channel_name, provider, channel_id,
                  content[:200], msg_time, msg_time, msg_time))
        else:
            customer_id = existing[1]
            # re-linka se ainda nao tinha customer_id
            cursor.execute("""
                UPDATE comm.wa_contacts
                SET name = COALESCE(NULLIF(%s, wa_id), name),
                    customer_id = COALESCE(customer_id, comm.link_customer(wa_id)),
                    provider = %s,
                    channel_id = COALESCE(%s, channel_id),
                    last_message = %s, last_message_time = %s,
                    last_direction = 'inbound', unread = unread + 1, updated_at = %s
                WHERE wa_id = %s
            """, (sender_name, provider, channel_id, content[:200], msg_time, msg_time, wa_id))

        # dedup por wa_message_id (unique em comm.wa_messages)
        inserted = False
        if payload.wa_message_id:
            cursor.execute("SELECT 1 FROM comm.wa_messages WHERE wa_message_id = %s", (payload.wa_message_id,))
            if cursor.fetchone():
                conn.commit()
                return {"status": "duplicate", "customer_id": customer_id}

        cursor.execute("""
            INSERT INTO comm.wa_messages
                (wa_message_id, contact_wa_id, direction, message_type, content, timestamp, status, provider)
            VALUES (%s, %s, 'inbound', %s, %s, %s, 'received', %s)
            ON CONFLICT (wa_message_id) DO NOTHING
        """, (payload.wa_message_id, wa_id, msg_type, content, msg_time, provider))
        inserted = cursor.rowcount > 0

        conn.commit()
        return {"status": "ok", "inserted": inserted, "customer_id": customer_id}
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


class StatusRelay(BaseModel):
    wa_message_id: str
    status: str


@router.post("/status")
async def relay_status(payload: StatusRelay, request: Request):
    _check_secret(request)

    conn = get_postgres_connection()
    cursor = conn.cursor()
    try:
        new_rank = _STATUS_RANK.get(payload.status)
        if new_rank is None:
            # status fora da escala (failed/pending): aplica direto
            cursor.execute(
                "UPDATE comm.wa_messages SET status = %s WHERE wa_message_id = %s",
                (payload.status, payload.wa_message_id),
            )
        else:
            # so avanca; nao regride read->delivered
            cursor.execute("""
                UPDATE comm.wa_messages SET status = %s
                WHERE wa_message_id = %s
                  AND COALESCE(
                        CASE status WHEN 'received' THEN 1 WHEN 'sent' THEN 2
                                    WHEN 'delivered' THEN 3 WHEN 'read' THEN 4 ELSE 0 END, 0) < %s
            """, (payload.status, payload.wa_message_id, new_rank))
        updated = cursor.rowcount
        conn.commit()
        return {"status": "ok", "updated": updated}
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


class ProgressRelay(BaseModel):
    job_id: int
    status: Optional[str] = None
    sent_count: Optional[int] = None
    error_count: Optional[int] = None
    total_targets: Optional[int] = None


@router.post("/broadcast-progress")
async def relay_broadcast_progress(payload: ProgressRelay, request: Request):
    _check_secret(request)

    conn = get_postgres_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            UPDATE comm.broadcast_jobs
            SET status = COALESCE(%s, status),
                sent_count = COALESCE(%s, sent_count),
                error_count = COALESCE(%s, error_count),
                total_targets = COALESCE(%s, total_targets),
                updated_at = now()
            WHERE mensage_job_id = %s
        """, (payload.status, payload.sent_count, payload.error_count,
              payload.total_targets, payload.job_id))
        updated = cursor.rowcount
        conn.commit()
        return {"status": "ok", "updated": updated}
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()
