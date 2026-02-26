"""
Router SMS — Envio via Comtele + histórico.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta

from src.db.connection import get_postgres_connection
from src.connectors.comtele import send_sms

router = APIRouter(prefix="/api/sms", tags=["SMS"])

SP_TZ = timezone(timedelta(hours=-3))


def _now():
    return datetime.now(SP_TZ).replace(tzinfo=None)


class SendSmsRequest(BaseModel):
    phone: str
    message: str
    customer_id: Optional[int] = None


@router.post("/send")
def send_sms_message(req: SendSmsRequest):
    """Envia SMS e salva no histórico."""
    result = send_sms(req.phone, req.message)

    conn = get_postgres_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO comm.sms_messages (recipient, customer_id, content, status, external_id, error_message, sent_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            req.phone,
            req.customer_id,
            req.message,
            "sent" if result["success"] else "failed",
            result.get("external_id", ""),
            result.get("error"),
            _now(),
        ))
        sms_id = cursor.fetchone()[0]
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

    return {
        "success": result["success"],
        "sms_id": sms_id,
        "error": result.get("error"),
    }


@router.get("/history")
def sms_history(limit: int = 200):
    """Lista histórico de SMS enviados com stats."""
    conn = get_postgres_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT s.id, s.recipient, c.name_master, s.content, s.status,
               s.sent_at, s.error_message
        FROM comm.sms_messages s
        LEFT JOIN core.customer c ON s.customer_id = c.customer_id
        ORDER BY s.sent_at DESC
        LIMIT %s
    """, (limit,))

    history = []
    for r in cursor.fetchall():
        history.append({
            "id": r[0], "recipient": r[1], "customer_name": r[2],
            "content": r[3], "status": r[4],
            "sent_at": r[5].isoformat() if r[5] else None,
            "error_message": r[6],
        })

    # Stats
    cursor.execute("""
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status IN ('sent', 'delivered') THEN 1 ELSE 0 END) as delivered,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM comm.sms_messages
    """)
    row = cursor.fetchone()
    stats = {"total": row[0] or 0, "delivered": row[1] or 0, "failed": row[2] or 0}

    cursor.close()
    conn.close()
    return {"history": history, "stats": stats}


@router.get("/customers")
def search_customers(search: str = ""):
    """Busca clientes com telefone para envio de SMS."""
    if len(search) < 2:
        return []

    conn = get_postgres_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT c.customer_id, c.name_master, c.phone_master, c.email_master,
               COALESCE(m.total_revenue, 0) as total_revenue
        FROM core.customer c
        LEFT JOIN metrics.customer_summary m ON c.customer_id = m.customer_id
        WHERE c.phone_master IS NOT NULL
          AND c.phone_master != ''
          AND (c.name_master ILIKE %s OR c.phone_master LIKE %s OR c.email_master ILIKE %s)
        ORDER BY m.total_revenue DESC NULLS LAST
        LIMIT 20
    """, (f"%{search}%", f"%{search}%", f"%{search}%"))

    results = []
    for r in cursor.fetchall():
        results.append({
            "customer_id": r[0], "name": r[1], "phone": r[2],
            "email": r[3], "total_revenue": float(r[4]),
        })

    cursor.close()
    conn.close()
    return results