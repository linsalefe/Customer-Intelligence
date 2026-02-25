"""
Client para Evolution API v2.x — adaptado do EduFlow para Customer 360.
Gerencia instância, QR code, status e envio de mensagens.
"""
import requests
from src.settings import (
    EVOLUTION_API_URL,
    EVOLUTION_API_KEY,
    EVOLUTION_INSTANCE_NAME,
)

HEADERS = {
    "apikey": EVOLUTION_API_KEY,
    "Content-Type": "application/json",
}
TIMEOUT = 15


def get_instance_status(instance_name: str = None) -> dict:
    """Verifica status de conexão da instância."""
    name = instance_name or EVOLUTION_INSTANCE_NAME
    res = requests.get(
        f"{EVOLUTION_API_URL}/instance/connectionState/{name}",
        headers=HEADERS,
        timeout=TIMEOUT,
    )
    return res.json()


def get_qrcode(instance_name: str = None) -> dict:
    """Busca QR code para conectar a instância."""
    name = instance_name or EVOLUTION_INSTANCE_NAME
    res = requests.get(
        f"{EVOLUTION_API_URL}/instance/connect/{name}",
        headers=HEADERS,
        timeout=TIMEOUT,
    )
    return res.json()


def logout_instance(instance_name: str = None) -> dict:
    """Desconecta o WhatsApp da instância (sem deletar)."""
    name = instance_name or EVOLUTION_INSTANCE_NAME
    res = requests.delete(
        f"{EVOLUTION_API_URL}/instance/logout/{name}",
        headers=HEADERS,
        timeout=TIMEOUT,
    )
    return res.json()


def send_text(to: str, text: str, instance_name: str = None) -> dict:
    """Envia mensagem de texto via WhatsApp."""
    name = instance_name or EVOLUTION_INSTANCE_NAME
    number = to.replace("+", "").replace("-", "").replace(" ", "")
    res = requests.post(
        f"{EVOLUTION_API_URL}/message/sendText/{name}",
        headers=HEADERS,
        timeout=TIMEOUT,
        json={"number": number, "text": text},
    )
    return res.json()


def send_media(to: str, media_type: str, base64_data: str, filename: str, mimetype: str, caption: str = "", instance_name: str = None) -> dict:
    """Envia mídia (imagem, vídeo, documento) via Evolution API."""
    name = instance_name or EVOLUTION_INSTANCE_NAME
    number = to.replace("+", "").replace("-", "").replace(" ", "")

    if ";base64," in base64_data:
        base64_data = base64_data.split(";base64,")[1]

    res = requests.post(
        f"{EVOLUTION_API_URL}/message/sendMedia/{name}",
        headers=HEADERS,
        timeout=60,
        json={
            "number": number,
            "mediatype": media_type,
            "media": base64_data,
            "fileName": filename,
            "mimetype": mimetype,
            "caption": caption,
        },
    )
    return res.json()


def send_audio(to: str, base64_data: str, instance_name: str = None) -> dict:
    """Envia áudio via Evolution API."""
    name = instance_name or EVOLUTION_INSTANCE_NAME
    number = to.replace("+", "").replace("-", "").replace(" ", "")

    if ";base64," in base64_data:
        base64_data = base64_data.split(";base64,")[1]

    res = requests.post(
        f"{EVOLUTION_API_URL}/message/sendWhatsAppAudio/{name}",
        headers=HEADERS,
        timeout=60,
        json={"number": number, "audio": base64_data, "encoding": True},
    )
    return res.json()


def get_profile_picture(number: str, instance_name: str = None) -> str | None:
    """Busca URL da foto de perfil de um contato."""
    name = instance_name or EVOLUTION_INSTANCE_NAME
    number = number.replace("+", "").replace("-", "").replace(" ", "")
    try:
        res = requests.post(
            f"{EVOLUTION_API_URL}/chat/fetchProfilePictureUrl/{name}",
            headers=HEADERS,
            timeout=10,
            json={"number": number},
        )
        data = res.json()
        if isinstance(data, dict):
            return data.get("profilePictureUrl") or data.get("profilePicUrl")
        return None
    except Exception:
        return None


def fetch_media(media_id: str, remote_jid: str = None, from_me: bool = False, instance_name: str = None) -> dict:
    """Busca mídia pelo ID (para servir no frontend).
    Requer remote_jid no formato '5511999999999@s.whatsapp.net'.
    """
    name = instance_name or EVOLUTION_INSTANCE_NAME
    key = {"id": media_id}
    if remote_jid:
        key["remoteJid"] = remote_jid if "@" in remote_jid else f"{remote_jid}@s.whatsapp.net"
        key["fromMe"] = from_me
    try:
        res = requests.post(
            f"{EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/{name}",
            headers=HEADERS,
            timeout=30,
            json={"message": {"key": key}},
        )
        return res.json()
    except Exception:
        return {}
