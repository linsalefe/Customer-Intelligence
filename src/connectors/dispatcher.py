from sqlalchemy import text
from src.db.connection import get_sqlalchemy_engine
from src.connectors.comtele import send_sms
from src.connectors.email_sender import send_email
from src.connectors.evolution import send_whatsapp


def dispatch_message(
    channel: str,
    customer_id: int,
    recipient: str,
    body: str,
    sent_by: int,
    subject: str = None,
    template_id: int = None
) -> dict:
    """Envia mensagem pelo canal escolhido e registra no banco."""

    # 1. Envia pela API do canal
    if channel == "sms":
        result = send_sms(recipient, body)
    elif channel == "email":
        if not subject:
            return {"success": False, "error": "Assunto obrigatório para e-mail"}
        result = send_email(recipient, subject, body)
    elif channel == "whatsapp":
        result = send_whatsapp(recipient, body)
    else:
        return {"success": False, "error": f"Canal inválido: {channel}"}

    # 2. Define status para salvar
    status = result.get("status", "sent") if result["success"] else "failed"
    external_id = result.get("external_id", "")
    error_message = result.get("error") if not result["success"] else None

    # 3. Registra no banco
    engine = get_sqlalchemy_engine()
    with engine.begin() as conn:
        row = conn.execute(
            text("""
                INSERT INTO comm.messages 
                    (customer_id, channel, template_id, recipient, subject, body, 
                     status, external_id, error_message, sent_by)
                VALUES 
                    (:customer_id, :channel, :template_id, :recipient, :subject, :body,
                     :status, :external_id, :error_message, :sent_by)
                RETURNING id, status, sent_at
            """),
            {
                "customer_id": customer_id,
                "channel": channel,
                "template_id": template_id,
                "recipient": recipient,
                "subject": subject,
                "body": body,
                "status": status,
                "external_id": external_id,
                "error_message": error_message,
                "sent_by": sent_by,
            }
        ).fetchone()

    return {
        "success": result["success"],
        "message_id": row[0],
        "status": row[1],
        "sent_at": str(row[2]),
        "error": error_message
    }
