from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import text

from src.db.connection import get_sqlalchemy_engine
from src.webhook_api.auth_router import get_current_user
from src.connectors.dispatcher import dispatch_message

router = APIRouter(prefix="/api/messaging", tags=["messaging"])


# --- Models ---

class SendMessageRequest(BaseModel):
    customer_id: int
    channel: str  # sms, email, whatsapp
    recipient: str  # telefone ou email
    body: str
    subject: Optional[str] = None
    template_id: Optional[int] = None


class TemplateCreateRequest(BaseModel):
    channel: str
    name: str
    subject: Optional[str] = None
    body: str


class TemplateUpdateRequest(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    is_active: Optional[bool] = None


# --- 3.2 Envio individual ---

@router.post("/send")
def send_message(data: SendMessageRequest, user: dict = Depends(get_current_user)):
    user_id = int(user.get("sub"))

    result = dispatch_message(
        channel=data.channel,
        customer_id=data.customer_id,
        recipient=data.recipient,
        body=data.body,
        sent_by=user_id,
        subject=data.subject,
        template_id=data.template_id
    )

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Erro ao enviar"))

    return result


# --- 3.3 Listar templates ---

@router.get("/templates")
def list_templates(
    channel: str = Query(None),
    user: dict = Depends(get_current_user)
):
    engine = get_sqlalchemy_engine()
    query = "SELECT * FROM comm.templates WHERE is_active = true"
    params = {}

    if channel:
        query += " AND channel = :channel"
        params["channel"] = channel

    query += " ORDER BY name"

    with engine.connect() as conn:
        result = conn.execute(text(query), params)
        keys = list(result.keys())
        rows = [dict(zip(keys, r)) for r in result.fetchall()]

    return {"data": rows}


# --- 3.4 Criar template ---

@router.post("/templates")
def create_template(data: TemplateCreateRequest, user: dict = Depends(get_current_user)):
    if data.channel not in ("sms", "email", "whatsapp"):
        raise HTTPException(status_code=400, detail="Canal inválido")

    user_id = int(user.get("sub"))
    engine = get_sqlalchemy_engine()

    with engine.begin() as conn:
        row = conn.execute(
            text("""
                INSERT INTO comm.templates (channel, name, subject, body, created_by)
                VALUES (:channel, :name, :subject, :body, :created_by)
                RETURNING id, channel, name, subject, body, is_active
            """),
            {
                "channel": data.channel,
                "name": data.name,
                "subject": data.subject,
                "body": data.body,
                "created_by": user_id
            }
        ).fetchone()

    return {"id": row[0], "channel": row[1], "name": row[2], "subject": row[3], "body": row[4], "is_active": row[5]}


# --- 3.5 Editar template ---

@router.put("/templates/{template_id}")
def update_template(template_id: int, data: TemplateUpdateRequest, user: dict = Depends(get_current_user)):
    updates = []
    params = {"template_id": template_id}

    if data.name is not None:
        updates.append("name = :name")
        params["name"] = data.name
    if data.subject is not None:
        updates.append("subject = :subject")
        params["subject"] = data.subject
    if data.body is not None:
        updates.append("body = :body")
        params["body"] = data.body
    if data.is_active is not None:
        updates.append("is_active = :is_active")
        params["is_active"] = data.is_active

    if not updates:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")

    updates.append("updated_at = NOW()")
    query = f"UPDATE comm.templates SET {', '.join(updates)} WHERE id = :template_id RETURNING id, channel, name, subject, body, is_active"

    engine = get_sqlalchemy_engine()
    with engine.begin() as conn:
        row = conn.execute(text(query), params).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Template não encontrado")

    return {"id": row[0], "channel": row[1], "name": row[2], "subject": row[3], "body": row[4], "is_active": row[5]}


# --- 3.6 Histórico do cliente ---

@router.get("/history/{customer_id}")
def get_message_history(
    customer_id: int,
    channel: str = Query(None),
    limit: int = Query(50, le=200),
    user: dict = Depends(get_current_user)
):
    engine = get_sqlalchemy_engine()
    query = """
        SELECT m.id, m.channel, m.recipient, m.subject, m.body, m.status,
               m.error_message, m.sent_at, m.delivered_at, m.opened_at,
               u.name as sent_by_name, t.name as template_name
        FROM comm.messages m
        INNER JOIN core.users u ON m.sent_by = u.id
        LEFT JOIN comm.templates t ON m.template_id = t.id
        WHERE m.customer_id = :customer_id
    """
    params = {"customer_id": customer_id, "limit": limit}

    if channel:
        query += " AND m.channel = :channel"
        params["channel"] = channel

    query += " ORDER BY m.sent_at DESC LIMIT :limit"

    with engine.connect() as conn:
        result = conn.execute(text(query), params)
        keys = list(result.keys())
        rows = [dict(zip(keys, r)) for r in result.fetchall()]

    return {"data": rows}


# --- 3.7 Relatório para o diretor ---

@router.get("/report")
def get_messaging_report(
    months: int = Query(3, le=12),
    user: dict = Depends(get_current_user)
):
    engine = get_sqlalchemy_engine()

    # Resumo por canal e período
    summary_query = """
        SELECT * FROM comm.report_summary
        WHERE periodo >= (CURRENT_DATE - MAKE_INTERVAL(months => :months))::date
        ORDER BY periodo DESC, channel
    """

    # Totais gerais
    totals_query = """
        SELECT
            COUNT(*) as total_mensagens,
            SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as entregues,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as falhadas,
            COUNT(DISTINCT customer_id) as clientes_contactados,
            COUNT(DISTINCT sent_by) as operadores
        FROM comm.messages
        WHERE sent_at >= CURRENT_DATE - MAKE_INTERVAL(months => :months)
    """

    with engine.connect() as conn:
        summary_result = conn.execute(text(summary_query), {"months": months})
        summary_keys = list(summary_result.keys())
        summary_rows = [dict(zip(summary_keys, r)) for r in summary_result.fetchall()]

        totals_result = conn.execute(text(totals_query), {"months": months})
        totals_keys = list(totals_result.keys())
        totals_row = dict(zip(totals_keys, totals_result.fetchone()))

    return {"summary": summary_rows, "totals": totals_row}


# --- WhatsApp Connection ---

@router.get("/whatsapp/status")
def whatsapp_status(user: dict = Depends(get_current_user)):
    from src.connectors.evolution import get_instance_status
    result = get_instance_status()
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@router.get("/whatsapp/qrcode")
def whatsapp_qrcode(user: dict = Depends(get_current_user)):
    from src.connectors.evolution import get_qrcode
    result = get_qrcode()
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result
