"""
Router SMS — Envio via Comtele + histórico.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json
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
            str(result.get("external_id", "")),
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

# === CAMPANHAS ===

class CampaignFilter(BaseModel):
    product: Optional[str] = None
    ltv_min: Optional[float] = None
    ltv_max: Optional[float] = None


class CampaignCreate(BaseModel):
    name: str
    message: str
    filters: CampaignFilter
    recipient_ids: list[int]  # customer_ids selecionados


@router.post("/campaigns/preview")
def campaign_preview(filters: CampaignFilter):
    """Retorna lista de clientes com base nos filtros para revisão."""
    conn = get_postgres_connection()
    cursor = conn.cursor()

    sql = """
        SELECT c.customer_id, c.name_master, c.phone_master, c.email_master,
               COALESCE(m.total_revenue, 0) as total_revenue,
               m.total_orders, m.is_active, m.recency_band
        FROM core.customer c
        LEFT JOIN metrics.customer_summary m ON c.customer_id = m.customer_id
        WHERE c.phone_master IS NOT NULL
          AND c.phone_master != ''
          AND LENGTH(c.phone_master) >= 10
          AND m.total_orders > 0
    """
    params = []

    if filters.product:
        sql += """
            AND c.customer_id IN (
                SELECT DISTINCT customer_id FROM core.orders
                WHERE product_name ILIKE %s
            )
        """
        params.append(f"%{filters.product}%")

    if filters.ltv_min is not None:
        sql += " AND COALESCE(m.total_revenue, 0) >= %s"
        params.append(filters.ltv_min)

    if filters.ltv_max is not None:
        sql += " AND COALESCE(m.total_revenue, 0) <= %s"
        params.append(filters.ltv_max)

    sql += " ORDER BY m.total_revenue DESC LIMIT 500"

    cursor.execute(sql, params)
    results = []
    for r in cursor.fetchall():
        results.append({
            "customer_id": r[0], "name": r[1], "phone": r[2],
            "email": r[3], "total_revenue": float(r[4]),
            "total_orders": r[5] or 0, "is_active": r[6] or False,
            "recency_band": r[7] or "",
        })

    cursor.close()
    conn.close()
    return {"total": len(results), "customers": results}


@router.get("/campaigns/products")
def list_products():
    """Lista produtos únicos para o filtro."""
    conn = get_postgres_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT DISTINCT product_name, COUNT(*) as total
        FROM core.orders
        WHERE product_name IS NOT NULL AND product_name != ''
        GROUP BY product_name
        ORDER BY total DESC
        LIMIT 100
    """)
    products = [{"name": r[0], "count": r[1]} for r in cursor.fetchall()]
    cursor.close()
    conn.close()
    return products


@router.post("/campaigns/send")
def send_campaign(req: CampaignCreate):
    """Cria campanha e dispara SMS para os destinatários selecionados."""
    if not req.recipient_ids:
        raise HTTPException(status_code=400, detail="Nenhum destinatário selecionado")
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Mensagem vazia")

    conn = get_postgres_connection()
    cursor = conn.cursor()

    try:
        # Criar campanha
        cursor.execute("""
            INSERT INTO comm.sms_campaigns (name, message, filters, total_recipients, status, sent_at)
            VALUES (%s, %s, %s, %s, 'sending', %s)
            RETURNING id
        """, (
            req.name, req.message,
            json.dumps(req.filters.dict()) if req.filters else "{}",
            len(req.recipient_ids), _now()
        ))
        campaign_id = cursor.fetchone()[0]
        conn.commit()

        # Buscar telefones dos selecionados
        cursor.execute("""
            SELECT customer_id, phone_master, name_master
            FROM core.customer
            WHERE customer_id = ANY(%s) AND phone_master IS NOT NULL
        """, (req.recipient_ids,))
        recipients = cursor.fetchall()

        total_sent = 0
        total_failed = 0

        for cid, phone, name in recipients:
            # Personalizar mensagem
            msg = req.message.replace("{nome}", name or "")

            result = send_sms(phone, msg)
            status = "sent" if result["success"] else "failed"

            cursor.execute("""
                INSERT INTO comm.sms_messages (recipient, customer_id, content, status, external_id, error_message, sent_at, campaign_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                phone, cid, msg, status,
                result.get("external_id", ""),
                result.get("error"),
                _now(), campaign_id
            ))

            if result["success"]:
                total_sent += 1
            else:
                total_failed += 1

        # Atualizar campanha
        cursor.execute("""
            UPDATE comm.sms_campaigns
            SET total_sent = %s, total_failed = %s, status = 'completed'
            WHERE id = %s
        """, (total_sent, total_failed, campaign_id))
        conn.commit()

        return {
            "success": True,
            "campaign_id": campaign_id,
            "total_sent": total_sent,
            "total_failed": total_failed,
        }

    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()


@router.get("/campaigns")
def list_campaigns(limit: int = 50):
    """Lista campanhas realizadas."""
    conn = get_postgres_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, name, message, total_recipients, total_sent, total_failed, status, sent_at
        FROM comm.sms_campaigns
        ORDER BY sent_at DESC NULLS LAST
        LIMIT %s
    """, (limit,))
    campaigns = []
    for r in cursor.fetchall():
        campaigns.append({
            "id": r[0], "name": r[1], "message": r[2],
            "total_recipients": r[3], "total_sent": r[4],
            "total_failed": r[5], "status": r[6],
            "sent_at": r[7].isoformat() if r[7] else None,
        })
    cursor.close()
    conn.close()
    return campaigns