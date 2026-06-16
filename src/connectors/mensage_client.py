"""
Cliente HTTP da ponte Customer -> Mensage (Servidor A / cenat-mensage).

Sync (requests), timeout curto. Toda chamada leva X-Service-Token.
Contrato (fonte da verdade — o Customer nao le o codigo do Mensage):
  POST {base}/api/meta/channels/{id}/send-text      {to, text}
  POST {base}/api/meta/channels/{id}/send-template  {to, template_name, language_code, components}
  POST {base}/api/broadcasts                         {name, channel_id, audience_type, audience_spec, message_payload, interval_seconds, scheduled_at}
  GET  {base}/api/broadcasts/{id}
  GET  {base}/api/broadcasts/{id}/logs
  POST {base}/api/broadcasts/{id}/cancel
"""
import requests

from src.settings import MENSAGE_BASE_URL, SERVICE_TOKEN

TIMEOUT = 10


class MensageError(Exception):
    """Falha ao falar com a ponte do Mensage."""


def _headers() -> dict:
    return {"X-Service-Token": SERVICE_TOKEN, "Content-Type": "application/json"}


def _url(path: str) -> str:
    return f"{MENSAGE_BASE_URL.rstrip('/')}/api{path}"


def _post(path: str, body: dict) -> dict:
    try:
        resp = requests.post(_url(path), json=body, headers=_headers(), timeout=TIMEOUT)
    except requests.RequestException as e:
        raise MensageError(f"conexao com Mensage falhou: {e}") from e
    if resp.status_code >= 400:
        raise MensageError(f"Mensage {resp.status_code} em {path}: {resp.text[:300]}")
    return resp.json() if resp.content else {}


def _get(path: str) -> dict:
    try:
        resp = requests.get(_url(path), headers=_headers(), timeout=TIMEOUT)
    except requests.RequestException as e:
        raise MensageError(f"conexao com Mensage falhou: {e}") from e
    if resp.status_code >= 400:
        raise MensageError(f"Mensage {resp.status_code} em {path}: {resp.text[:300]}")
    return resp.json() if resp.content else {}


# === Envio direto (canal oficial) ===

def send_text(channel_id: int, to: str, text: str) -> dict:
    return _post(f"/meta/channels/{channel_id}/send-text", {"to": to, "text": text})


def list_templates(channel_id: int) -> dict:
    return _get(f"/meta/channels/{channel_id}/templates")


def send_template(channel_id: int, to: str, template_name: str,
                  language_code: str, components: list) -> dict:
    return _post(
        f"/meta/channels/{channel_id}/send-template",
        {"to": to, "template_name": template_name,
         "language_code": language_code, "components": components},
    )


# === Broadcast / disparo ===

def create_broadcast(name: str, channel_id: int, contacts: list,
                     message_payload: dict, interval_seconds: int = 2,
                     scheduled_at=None) -> dict:
    body = {
        "name": name,
        "channel_id": channel_id,
        "audience_type": "csv",
        "audience_spec": {"contacts": contacts},
        "message_payload": message_payload,
        "interval_seconds": interval_seconds,
        "scheduled_at": scheduled_at,
    }
    return _post("/broadcasts", body)


def get_broadcast(job_id: int) -> dict:
    return _get(f"/broadcasts/{job_id}")


def get_broadcast_logs(job_id: int) -> dict:
    return _get(f"/broadcasts/{job_id}/logs")


def cancel_broadcast(job_id: int) -> dict:
    return _post(f"/broadcasts/{job_id}/cancel", {})
