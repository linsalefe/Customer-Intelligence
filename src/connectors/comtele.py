import requests
from src.settings import COMTELE_API_KEY


COMTELE_BASE_URL = "https://sms.comtele.com.br/api/v2"


def send_sms(phone: str, message: str) -> dict:
    """Envia SMS via Comtele. Retorna dict com status e external_id."""
    if not COMTELE_API_KEY:
        return {"success": False, "error": "COMTELE_API_KEY não configurada"}

    # Garante formato: apenas números, com DDD
    phone_clean = phone.replace("+", "").replace("-", "").replace(" ", "").replace("(", "").replace(")", "")
    # Remove 55 do início se tiver (Comtele espera DDD+Número, sem código do país)
    if phone_clean.startswith("55") and len(phone_clean) > 11:
        phone_clean = phone_clean[2:]

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
        response = requests.post(f"{COMTELE_BASE_URL}/send", json=payload, headers=headers, timeout=10)
        data = response.json()

        if response.status_code == 200 and data.get("Success"):
            return {
                "success": True,
                "external_id": data.get("Object", ""),
                "status": "sent"
            }
        else:
            return {
                "success": False,
                "error": data.get("Message", f"HTTP {response.status_code}")
            }
    except Exception as e:
        return {"success": False, "error": str(e)}


def get_sms_report(start_date: str, end_date: str) -> dict:
    """Busca relatório detalhado de SMS enviados."""
    if not COMTELE_API_KEY:
        return {"success": False, "error": "COMTELE_API_KEY não configurada"}

    headers = {
        "Content-Type": "application/json",
        "auth-key": COMTELE_API_KEY
    }

    try:
        response = requests.get(
            f"{COMTELE_BASE_URL}/detailedreporting",
            headers=headers,
            params={"StartDate": start_date, "EndDate": end_date},
            timeout=15
        )
        data = response.json()
        if data.get("Success"):
            return {"success": True, "data": data.get("Object", [])}
        return {"success": False, "error": data.get("Message", "")}
    except Exception as e:
        return {"success": False, "error": str(e)}