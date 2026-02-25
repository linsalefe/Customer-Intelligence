"""
Router WhatsApp — Webhook Evolution API + Endpoints de Chat.
Adaptado do EduFlow para Customer 360.
"""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import json
import re

from src.db.connection import get_postgres_connection, get_sqlalchemy_engine
from src.connectors.evolution_client import (
    send_text,
    send_media,
    send_audio,
    get_instance_status,
    get_qrcode,
    logout_instance,
    get_profile_picture,
)

router = APIRouter(prefix="/api/whatsapp", tags=["WhatsApp"])

SP_TZ = timezone(timedelta(hours=-3))


def _now():
    return datetime.now(SP_TZ).replace(tzinfo=None)


def _normalize_phone(phone: str) -> str:
    """Remove tudo exceto números."""
    return re.sub(r'\D', '', phone)


def _try_link_customer(phone: str, conn) -> Optional[int]:
    """Tenta vincular telefone ao core.customer."""
    cursor = conn.cursor()
    phone_clean = _normalize_phone(phone)

    # Buscar por telefone (últimos 10-11 dígitos)
    if len(phone_clean) >= 10:
        suffix = phone_clean[-11:] if len(phone_clean) >= 11 else phone_clean[-10:]
        cursor.execute(
            "SELECT customer_id FROM core.customer WHERE phone_master LIKE %s LIMIT 1",
            (f'%{suffix}',)
        )
        row = cursor.fetchone()
        if row:
            cursor.close()
            return row[0]

    cursor.close()
    return None


# ============================================================
# WEBHOOK — Recebe eventos da Evolution API
# ============================================================

@router.post("/webhook/{instance_name}")
async def evolution_webhook(instance_name: str, request: Request):
    """Recebe eventos do Evolution API (mensagens, conexão)."""
    try:
        payload = await request.json()
        event = payload.get("event", "").upper().replace(".", "_")

        print(f"📩 WA Webhook [{instance_name}]: {event}")

        conn = get_postgres_connection()
        cursor = conn.cursor()

        try:
            # === CONNECTION_UPDATE ===
            if event == "CONNECTION_UPDATE":
                state = payload.get("data", {}).get("state", "")
                print(f"🔗 Conexão [{instance_name}]: {state}")

            # === MESSAGES_UPSERT ===
            elif event == "MESSAGES_UPSERT":
                data = payload.get("data", {})
                messages = [data] if isinstance(data, dict) else data

                for msg in messages:
                    key = msg.get("key", {})
                    from_me = key.get("fromMe", False)
                    remote_jid = key.get("remoteJid", "")
                    msg_id = key.get("id", "")

                    # Ignorar grupos
                    if "@g.us" in remote_jid:
                        continue

                    phone = remote_jid.replace("@s.whatsapp.net", "")
                    sender_name = msg.get("pushName", phone)

                    # Extrair texto
                    message_content = msg.get("message", {})
                    msg_type = msg.get("messageType", "text")
                    text = (
                        message_content.get("conversation", "")
                        or message_content.get("extendedTextMessage", {}).get("text", "")
                    )

                    # Mídia
                    if msg_type in ("image", "audio", "video", "document", "sticker"):
                        media = message_content.get(msg_type, {})
                        media_id = media.get("id", "")
                        mime = media.get("mimetype", "")
                        caption = media.get("caption", "")
                        text = f"media:{media_id}|{mime}|{caption}"
                    elif not text:
                        continue

                    direction = "outbound" if from_me else "inbound"

                    # Timestamp
                    ts = msg.get("messageTimestamp", 0)
                    msg_time = datetime.fromtimestamp(int(ts), tz=SP_TZ).replace(tzinfo=None) if ts else _now()

                    # Upsert contato (só inbound)
                    if not from_me:
                        cursor.execute("SELECT id FROM comm.wa_contacts WHERE wa_id = %s", (phone,))
                        existing = cursor.fetchone()

                        if not existing:
                            customer_id = _try_link_customer(phone, conn)
                            cursor.execute("""
                                INSERT INTO comm.wa_contacts (wa_id, name, phone_normalized, customer_id, channel_name, last_message, last_message_time, last_direction, unread, created_at, updated_at)
                                VALUES (%s, %s, %s, %s, %s, %s, %s, 'inbound', 1, %s, %s)
                            """, (phone, sender_name, _normalize_phone(phone), customer_id, instance_name, text[:200], msg_time, msg_time, msg_time))
                            print(f"👤 Novo contato WA: {sender_name} ({phone}) | Customer: {customer_id}")
                        else:
                            cursor.execute("""
                                UPDATE comm.wa_contacts
                                SET name = COALESCE(NULLIF(%s, wa_id), name),
                                    last_message = %s, last_message_time = %s,
                                    last_direction = 'inbound',
                                    unread = unread + 1, updated_at = %s
                                WHERE wa_id = %s
                            """, (sender_name, text[:200], msg_time, msg_time, phone))

                    # Outbound — atualizar last_message
                    if from_me:
                        cursor.execute("""
                            UPDATE comm.wa_contacts
                            SET last_message = %s, last_message_time = %s,
                                last_direction = 'outbound', updated_at = %s
                            WHERE wa_id = %s
                        """, (text[:200], msg_time, msg_time, phone))

                    # Verificar duplicata de mensagem
                    cursor.execute("SELECT id FROM comm.wa_messages WHERE wa_message_id = %s", (msg_id,))
                    if cursor.fetchone():
                        continue

                    # Salvar mensagem
                    cursor.execute("""
                        INSERT INTO comm.wa_messages (wa_message_id, contact_wa_id, direction, message_type, content, timestamp, status)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """, (
                        msg_id, phone, direction,
                        msg_type if msg_type != "conversation" else "text",
                        text, msg_time,
                        "received" if not from_me else "sent"
                    ))

                    print(f"💬 {'📤' if from_me else '📥'} [{instance_name}] {sender_name}: {text[:80]}")

            # === MESSAGES_UPDATE (status: delivered, read) ===
            elif event == "MESSAGES_UPDATE":
                data = payload.get("data", {})
                updates = [data] if isinstance(data, dict) else data
                for upd in updates:
                    msg_id = upd.get("key", {}).get("id", "")
                    status = upd.get("status", "")
                    status_map = {"DELIVERY_ACK": "delivered", "READ": "read", "PLAYED": "read"}
                    new_status = status_map.get(status)
                    if msg_id and new_status:
                        cursor.execute(
                            "UPDATE comm.wa_messages SET status = %s WHERE wa_message_id = %s",
                            (new_status, msg_id)
                        )

            conn.commit()
        except Exception as e:
            conn.rollback()
            print(f"❌ Erro webhook WA: {e}")
            raise
        finally:
            cursor.close()
            conn.close()

        return {"status": "ok"}

    except Exception as e:
        print(f"❌ Erro webhook Evolution [{instance_name}]: {e}")
        return {"status": "error", "detail": str(e)}


# ============================================================
# ENDPOINTS DE CHAT
# ============================================================

@router.get("/contacts")
def list_contacts(search: str = "", status: str = ""):
    """Lista contatos WhatsApp com última mensagem."""
    conn = get_postgres_connection()
    cursor = conn.cursor()

    sql = """
        SELECT wa_id, name, phone_normalized, customer_id, channel_name,
               lead_status, notes, ai_active, last_message, last_message_time,
               last_direction, unread, assigned_to, created_at
        FROM comm.wa_contacts
        WHERE is_active = true
    """
    params = []

    if search:
        sql += " AND (name ILIKE %s OR wa_id LIKE %s)"
        params.extend([f'%{search}%', f'%{search}%'])

    if status and status != "todos":
        sql += " AND lead_status = %s"
        params.append(status)

    sql += " ORDER BY last_message_time DESC NULLS LAST LIMIT 200"

    cursor.execute(sql, params)
    rows = cursor.fetchall()

    contacts = []
    for r in rows:
        contacts.append({
            "wa_id": r[0], "name": r[1], "phone_normalized": r[2],
            "customer_id": r[3], "channel_name": r[4],
            "lead_status": r[5], "notes": r[6], "ai_active": r[7],
            "last_message": r[8],
            "last_message_time": r[9].isoformat() if r[9] else None,
            "last_direction": r[10], "unread": r[11] or 0,
            "assigned_to": r[12],
            "created_at": r[13].isoformat() if r[13] else None,
            "tags": [],
        })

    cursor.close()
    conn.close()
    return contacts


@router.get("/contacts/{wa_id}/messages")
def get_messages(wa_id: str, limit: int = 100):
    """Histórico de mensagens de um contato."""
    conn = get_postgres_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, wa_message_id, direction, message_type, content,
               timestamp, status, sent_by_ai, sent_by
        FROM comm.wa_messages
        WHERE contact_wa_id = %s
        ORDER BY timestamp ASC
        LIMIT %s
    """, (wa_id, limit))

    messages = []
    for r in cursor.fetchall():
        messages.append({
            "id": r[0], "wa_message_id": r[1], "direction": r[2],
            "type": r[3], "content": r[4],
            "timestamp": r[5].isoformat() if r[5] else None,
            "status": r[6], "sent_by_ai": r[7] or False,
            "sent_by": r[8],
        })

    cursor.close()
    conn.close()
    return messages


class SendTextRequest(BaseModel):
    to: str
    text: str

@router.post("/send/text")
def send_text_message(req: SendTextRequest):
    """Envia mensagem de texto pelo WhatsApp."""
    try:
        result = send_text(req.to, req.text)

        # Salvar no banco
        conn = get_postgres_connection()
        cursor = conn.cursor()

        # Extrair message_id da resposta
        msg_id = None
        if isinstance(result, dict):
            msg_id = result.get("key", {}).get("id", "")

        cursor.execute("""
            INSERT INTO comm.wa_messages (wa_message_id, contact_wa_id, direction, message_type, content, timestamp, status)
            VALUES (%s, %s, 'outbound', 'text', %s, %s, 'sent')
            ON CONFLICT (wa_message_id) DO NOTHING
        """, (msg_id or f"manual_{_now().timestamp()}", req.to, req.text, _now()))

        # Atualizar contato
        cursor.execute("""
            UPDATE comm.wa_contacts
            SET last_message = %s, last_message_time = %s,
                last_direction = 'outbound', unread = 0, updated_at = %s
            WHERE wa_id = %s
        """, (req.text[:200], _now(), _now(), req.to))

        conn.commit()
        cursor.close()
        conn.close()

        return {"status": "sent", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/contacts/{wa_id}/read")
def mark_as_read(wa_id: str):
    """Marca contato como lido (zera unread)."""
    conn = get_postgres_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE comm.wa_contacts SET unread = 0 WHERE wa_id = %s", (wa_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return {"status": "ok"}


class UpdateContactRequest(BaseModel):
    lead_status: Optional[str] = None
    notes: Optional[str] = None
    assigned_to: Optional[int] = None

@router.patch("/contacts/{wa_id}")
def update_contact(wa_id: str, req: UpdateContactRequest):
    """Atualiza status/notas/atribuição de um contato."""
    conn = get_postgres_connection()
    cursor = conn.cursor()

    updates = []
    params = []

    if req.lead_status:
        updates.append("lead_status = %s")
        params.append(req.lead_status)
    if req.notes is not None:
        updates.append("notes = %s")
        params.append(req.notes)
    if req.assigned_to is not None:
        updates.append("assigned_to = %s")
        params.append(req.assigned_to if req.assigned_to > 0 else None)

    if updates:
        updates.append("updated_at = %s")
        params.append(_now())
        params.append(wa_id)
        cursor.execute(f"UPDATE comm.wa_contacts SET {', '.join(updates)} WHERE wa_id = %s", params)
        conn.commit()

    cursor.close()
    conn.close()
    return {"status": "updated"}


@router.get("/contacts/{wa_id}/picture")
def contact_picture(wa_id: str):
    """Busca foto de perfil do contato."""
    try:
        url = get_profile_picture(wa_id)
        return {"profilePictureUrl": url}
    except:
        return {"profilePictureUrl": None}


# ============================================================
# INSTÂNCIA
# ============================================================

@router.get("/instance/status")
def instance_status():
    """Status da conexão da instância Farmer."""
    try:
        data = get_instance_status()
        state = data.get("instance", {}).get("state", "close")
        return {"state": state, "is_connected": state == "open"}
    except Exception as e:
        return {"state": "error", "is_connected": False, "error": str(e)}


@router.get("/instance/qrcode")
def instance_qrcode():
    """QR Code para conectar a instância."""
    try:
        return get_qrcode()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/instance/logout")
def instance_logout():
    """Desconecta a instância."""
    try:
        return logout_instance()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# TEMPLATES DE MENSAGEM RÁPIDA
# ============================================================

@router.get("/templates")
def list_templates(category: str = ""):
    """Lista templates de mensagem rápida."""
    conn = get_postgres_connection()
    cursor = conn.cursor()

    sql = "SELECT id, name, body, category FROM comm.wa_templates WHERE is_active = true"
    params = []
    if category:
        sql += " AND category = %s"
        params.append(category)
    sql += " ORDER BY name"

    cursor.execute(sql, params)
    templates = [{"id": r[0], "name": r[1], "body": r[2], "category": r[3]} for r in cursor.fetchall()]

    cursor.close()
    conn.close()
    return templates


class CreateTemplateRequest(BaseModel):
    name: str
    body: str
    category: str = "geral"

@router.post("/templates")
def create_template(req: CreateTemplateRequest):
    """Cria template de mensagem rápida."""
    conn = get_postgres_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO comm.wa_templates (name, body, category) VALUES (%s, %s, %s) RETURNING id",
        (req.name, req.body, req.category)
    )
    new_id = cursor.fetchone()[0]
    conn.commit()
    cursor.close()
    conn.close()
    return {"id": new_id, "status": "created"}


@router.delete("/templates/{template_id}")
def delete_template(template_id: int):
    """Desativa um template."""
    conn = get_postgres_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE comm.wa_templates SET is_active = false WHERE id = %s", (template_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return {"status": "deleted"}


# ============================================================
# ENVIO DE MÍDIA
# ============================================================

class SendMediaRequest(BaseModel):
    to: str
    media_type: str
    base64_data: str
    filename: str
    mimetype: str
    caption: Optional[str] = ""

@router.post("/send/media")
def send_media_message(req: SendMediaRequest):
    """Envia mídia pelo WhatsApp."""
    try:
        if req.media_type == "audio":
            from src.connectors.evolution_client import send_audio as send_audio_fn
            result = send_audio_fn(req.to, req.base64_data)
        else:
            result = send_media(
                req.to, req.media_type, req.base64_data,
                req.filename, req.mimetype, req.caption or ""
            )

        conn = get_postgres_connection()
        cursor = conn.cursor()
        msg_id = result.get("key", {}).get("id", "") if isinstance(result, dict) else ""
        content = f"media:{msg_id or chr(39)sent{chr(39)}|{req.mimetype}|{req.filename}"
        cursor.execute("""
            INSERT INTO comm.wa_messages (wa_message_id, contact_wa_id, direction, message_type, content, timestamp, status)
            VALUES (%s, %s, 'outbound', %s, %s, %s, 'sent')
            ON CONFLICT (wa_message_id) DO NOTHING
        """, (msg_id or f"media_{_now().timestamp()}", req.to, req.media_type, content, _now()))
        cursor.execute("""
            UPDATE comm.wa_contacts SET last_message = %s, last_message_time = %s,
                last_direction = 'outbound', unread = 0, updated_at = %s WHERE wa_id = %s
        """, (f"📎 {req.filename}", _now(), _now(), req.to))
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "sent", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/media/{media_id}")
def get_media_file(media_id: str):
    """Proxy de mídia da Evolution API."""
    from src.connectors.evolution_client import fetch_media
    from fastapi.responses import Response
    import base64
    try:
        data = fetch_media(media_id)
        b64 = data.get("base64", "")
        mimetype = data.get("mimetype", "application/octet-stream")
        if not b64:
            raise HTTPException(status_code=404, detail="Mídia não encontrada")
        if ";base64," in b64:
            b64 = b64.split(";base64,")[1]
        binary = base64.b64decode(b64)
        return Response(content=binary, media_type=mimetype)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# DADOS DO CUSTOMER 360 VINCULADO
# ============================================================

@router.get("/contacts/{wa_id}/customer")
def get_customer_data(wa_id: str):
    """Busca dados do Customer 360 vinculado ao contato WA."""
    conn = get_postgres_connection()
    cursor = conn.cursor()

    # Buscar customer_id do contato
    cursor.execute("SELECT customer_id FROM comm.wa_contacts WHERE wa_id = %s", (wa_id,))
    row = cursor.fetchone()
    if not row or not row[0]:
        cursor.close()
        conn.close()
        return {"linked": False}

    customer_id = row[0]

    # Buscar dados do cliente
    cursor.execute("""
        SELECT c.customer_id, c.email_master, c.name_master, c.phone_master,
               c.city, c.state,
               m.total_orders, m.total_revenue, m.avg_ticket,
               m.first_purchase_date, m.last_purchase_date,
               m.days_since_last_purchase, m.is_active, m.recency_band
        FROM core.customer c
        LEFT JOIN metrics.customer_summary m ON c.customer_id = m.customer_id
        WHERE c.customer_id = %s
    """, (customer_id,))

    r = cursor.fetchone()
    cursor.close()
    conn.close()

    if not r:
        return {"linked": False}

    return {
        "linked": True,
        "customer_id": r[0],
        "email": r[1],
        "name": r[2],
        "phone": r[3],
        "city": r[4],
        "state": r[5],
        "total_orders": r[6] or 0,
        "total_revenue": float(r[7] or 0),
        "avg_ticket": float(r[8] or 0),
        "first_purchase": r[9].isoformat() if r[9] else None,
        "last_purchase": r[10].isoformat() if r[10] else None,
        "days_since_purchase": r[11] or 0,
        "is_active": r[12] or False,
        "recency_band": r[13] or "Nunca comprou",
    }
