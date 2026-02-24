import requests
from src.settings import EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE_NAME


def send_whatsapp(phone: str, message: str) -> dict:
    """Envia mensagem WhatsApp via Evolution API. Retorna dict com status."""
    if not EVOLUTION_API_URL or not EVOLUTION_API_KEY:
        return {"success": False, "error": "Evolution API não configurada"}

    # Garante formato: apenas números, com 55 na frente
    phone_clean = phone.replace("+", "").replace("-", "").replace(" ", "").replace("(", "").replace(")", "")
    if not phone_clean.startswith("55"):
        phone_clean = "55" + phone_clean

    url = f"{EVOLUTION_API_URL.rstrip('/')}/message/sendText/{EVOLUTION_INSTANCE_NAME}"

    headers = {
        "Content-Type": "application/json",
        "apikey": EVOLUTION_API_KEY
    }

    payload = {
        "number": phone_clean,
        "text": message
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=15)
        data = response.json()

        if response.status_code in (200, 201):
            return {
                "success": True,
                "external_id": data.get("key", {}).get("id", ""),
                "status": "sent"
            }
        else:
            return {
                "success": False,
                "error": data.get("message", f"HTTP {response.status_code}")
            }
    except Exception as e:
        return {"success": False, "error": str(e)}


def get_instance_status() -> dict:
    """Retorna status da instância (open, close, connecting)."""
    if not EVOLUTION_API_URL or not EVOLUTION_API_KEY:
        return {"success": False, "error": "Evolution API não configurada"}

    url = f"{EVOLUTION_API_URL.rstrip('/')}/instance/connectionState/{EVOLUTION_INSTANCE_NAME}"
    headers = {"apikey": EVOLUTION_API_KEY}

    try:
        response = requests.get(url, headers=headers, timeout=10)
        data = response.json()
        return {"success": True, "state": data.get("state", "unknown")}
    except Exception as e:
        return {"success": False, "error": str(e)}


def get_qrcode() -> dict:
    """Gera QR Code para conectar a instância."""
    if not EVOLUTION_API_URL or not EVOLUTION_API_KEY:
        return {"success": False, "error": "Evolution API não configurada"}

    url = f"{EVOLUTION_API_URL.rstrip('/')}/instance/connect/{EVOLUTION_INSTANCE_NAME}"
    headers = {"apikey": EVOLUTION_API_KEY}

    try:
        response = requests.get(url, headers=headers, timeout=15)
        data = response.json()

        if response.status_code == 200:
            return {
                "success": True,
                "qrcode": data.get("base64", data.get("qrcode", {}).get("base64", "")),
                "state": data.get("state", "connecting")
            }
        else:
            return {"success": False, "error": data.get("message", f"HTTP {response.status_code}")}
    except Exception as e:
        return {"success": False, "error": str(e)}
