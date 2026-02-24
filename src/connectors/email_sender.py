import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os


SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "CENAT")


def send_email(to_email: str, subject: str, body: str) -> dict:
    """Envia e-mail via SMTP. Retorna dict com status."""
    if not SMTP_USER or not SMTP_PASSWORD:
        return {"success": False, "error": "SMTP_USER ou SMTP_PASSWORD não configurados"}

    try:
        msg = MIMEMultipart()
        msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_USER}>"
        msg["To"] = to_email
        msg["Subject"] = subject

        msg.attach(MIMEText(body, "plain", "utf-8"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)

        return {
            "success": True,
            "external_id": msg["Message-ID"] or "",
            "status": "sent"
        }
    except Exception as e:
        return {"success": False, "error": str(e)}
