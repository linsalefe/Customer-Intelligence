import requests
from src.settings import COMTELE_API_KEY


COMTELE_BASE_URL = "https://api.comtele.com.br/v2/send"


def send_sms(phone: str, message: str) -> dict:
    """Envia SMS via Comtele. Retorna dict com status e external_id."""
    if not COMTELE_API_KEY:
        return {"success": False, "error": "COMTELE_API_KEY não configurada"}

    if len(message) > 160:
        return {"success": False, "error": f"Mensagem com {len(message)} caracteres (máximo 160)"}

    # Garante formato: apenas números, com 55 na frente
    phone_clean = phone.replace("+", "").replace("-", "").replace(" ", "").replace("(", "").replace(")", "")
    if not phone_clean.startswith("55"):
        phone_clean = "55" + phone_clean

    headers = {
        "Content-Type": "application/json",
        "auth-key": COMTELE_API_KEY
    }

    payload = {
        "Sender": "CENAT",
        "Receivers": phone_clean,
        "Content": message
    }

    try:
        response = requests.post(COMTELE_BASE_URL, json=payload, headers=headers, timeout=10)
        data = response.json()

        if response.status_code == 200 and data.get("Success"):
            return {
                "success": True,
                "external_id": data.get("Object", {}).get("Id", ""),
                "status": "sent"
            }
        else:
            return {
                "success": False,
                "error": data.get("Message", f"HTTP {response.status_code}")
            }
    except Exception as e:
        return {"success": False, "error": str(e)}
