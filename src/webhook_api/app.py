import os
import json
import hashlib
from datetime import datetime
from typing import Any, Optional, Dict

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from src.db.connection import get_sqlalchemy_engine
from src.webhook_api.auth_router import router as auth_router
from src.webhook_api.dashboard_router import router as dashboard_router
from src.webhook_api.sms_router import router as sms_router
from src.webhook_api.pipeline_router import router as pipeline_router
from src.webhook_api.users_router import router as users_router
from src.webhook_api.messaging_router import router as messaging_router
from src.webhook_api.whatsapp_router import router as whatsapp_router

app = FastAPI(title="Customer360 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://100.24.2.187:3001", "http://cenatdata.online", "https://cenatdata.online", "http://www.cenatdata.online", "https://www.cenatdata.online"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(dashboard_router)
app.include_router(users_router)
app.include_router(messaging_router)
app.include_router(whatsapp_router)
app.include_router(pipeline_router)
app.include_router(sms_router)

HOTMART_HOTTOK = os.getenv("HOTMART_HOTTOK", "").strip()

STATUS_MAP = {
    "APPROVED": "Aprovado",
    "COMPLETE": "Completo",
    "COMPLETED": "Completo",
    "CANCELLED": "Cancelado",
    "CANCELED": "Cancelado",
    "REFUNDED": "Reembolsado",
    "CHARGEBACK": "Chargeback",
    "EXPIRED": "Expirado",
    "OVERDUE": "Atrasado",
    "WAITING_PAYMENT": "Aguardando pagamento",
    "AWAITING_PAYMENT": "Aguardando pagamento",
}

def _sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def _get(d: Any, *path: str) -> Optional[Any]:
    cur = d
    for p in path:
        if not isinstance(cur, dict) or p not in cur:
            return None
        cur = cur[p]
    return cur

def _extract_fields(payload: Dict[str, Any]) -> Dict[str, Optional[str]]:
    event_type = payload.get("event") or _get(payload, "data", "event")
    data = payload.get("data", {}) if isinstance(payload.get("data"), dict) else payload
    purchase = data.get("purchase", {}) if isinstance(data.get("purchase"), dict) else data
    buyer = data.get("buyer", {}) if isinstance(data.get("buyer"), dict) else {}
    
    transaction_id = purchase.get("transaction") or data.get("transaction_id")
    status_raw = purchase.get("status") or data.get("status")
    status_norm = STATUS_MAP.get(str(status_raw).upper(), str(status_raw) if status_raw else None)
    
    email = buyer.get("email") or data.get("email")
    name = buyer.get("name") or data.get("name")
    product_name = _get(data, "product", "name") or purchase.get("product_name")
    
    sale_date = purchase.get("order_date") or data.get("purchase_date")
    confirmation_date = purchase.get("approval_date") or data.get("confirmation_date")
    total_price = purchase.get("full_price") or purchase.get("price")
    payment_type = purchase.get("payment_type")
    currency = purchase.get("currency")
    
    return {
        "event_type": str(event_type) if event_type else None,
        "transaction_id": str(transaction_id) if transaction_id else None,
        "status_norm": status_norm,
        "email": str(email).lower().strip() if email else None,
        "name": str(name).strip() if name else None,
        "product_name": str(product_name).strip() if product_name else None,
        "sale_date": str(sale_date) if sale_date else None,
        "confirmation_date": str(confirmation_date) if confirmation_date else None,
        "total_price": str(total_price) if total_price else None,
        "payment_type": str(payment_type) if payment_type else None,
        "currency": str(currency) if currency else None,
    }

@app.get("/health")
def health():
    return {"ok": True, "ts": datetime.utcnow().isoformat()}

@app.post("/webhooks/hotmart")
async def hotmart_webhook(request: Request):
    hottok = (request.headers.get("x-hotmart-hottok") or "").strip()
    
    if not HOTMART_HOTTOK:
        raise HTTPException(status_code=500, detail="HOTMART_HOTTOK não configurado")
    if hottok != HOTMART_HOTTOK:
        raise HTTPException(status_code=401, detail="Token inválido")
    
    raw_body = await request.body()
    payload_hash = _sha256_hex(raw_body)
    
    try:
        payload = await request.json()
    except Exception:
        payload = {"raw": raw_body.decode("utf-8", errors="replace")}
    
    fields = _extract_fields(payload)
    engine = get_sqlalchemy_engine()
    
    with engine.begin() as conn:
        conn.execute(
            text("""
                INSERT INTO raw.hotmart_events (event_type, transaction_id, email, payload, payload_hash)
                VALUES (:event_type, :transaction_id, :email, CAST(:payload AS JSONB), :payload_hash)
                ON CONFLICT (payload_hash) DO NOTHING
            """),
            {
                "event_type": fields["event_type"],
                "transaction_id": fields["transaction_id"],
                "email": fields["email"],
                "payload": json.dumps(payload, ensure_ascii=False),
                "payload_hash": payload_hash,
            }
        )
    
    return {"ok": True}
