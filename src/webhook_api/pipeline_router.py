"""
Router Pipeline — CRUD de etapas + listagem de contatos por etapa.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from src.db.connection import get_postgres_connection

router = APIRouter(prefix="/api/pipeline", tags=["Pipeline"])


# === MODELS ===

class StageCreate(BaseModel):
    name: str
    color: str = "#8696a0"
    position: Optional[int] = None

class StageUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    position: Optional[int] = None

class MoveContact(BaseModel):
    lead_status: str


# === ETAPAS ===

@router.get("/stages")
def list_stages():
    """Lista todas as etapas ativas do pipeline."""
    conn = get_postgres_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, name, color, position FROM comm.pipeline_stages WHERE is_active = true ORDER BY position"
    )
    stages = [{"id": r[0], "name": r[1], "color": r[2], "position": r[3]} for r in cursor.fetchall()]
    cursor.close()
    conn.close()
    return stages


@router.post("/stages")
def create_stage(req: StageCreate):
    """Cria nova etapa no pipeline."""
    conn = get_postgres_connection()
    cursor = conn.cursor()
    if req.position is None:
        cursor.execute("SELECT COALESCE(MAX(position), -1) + 1 FROM comm.pipeline_stages WHERE is_active = true")
        req.position = cursor.fetchone()[0]
    cursor.execute(
        "INSERT INTO comm.pipeline_stages (name, color, position) VALUES (%s, %s, %s) RETURNING id",
        (req.name, req.color, req.position)
    )
    new_id = cursor.fetchone()[0]
    conn.commit()
    cursor.close()
    conn.close()
    return {"id": new_id, "status": "created"}


@router.put("/stages/{stage_id}")
def update_stage(stage_id: int, req: StageUpdate):
    """Edita nome, cor ou posição de uma etapa."""
    conn = get_postgres_connection()
    cursor = conn.cursor()
    updates, params = [], []
    if req.name is not None:
        updates.append("name = %s")
        params.append(req.name)
    if req.color is not None:
        updates.append("color = %s")
        params.append(req.color)
    if req.position is not None:
        updates.append("position = %s")
        params.append(req.position)
    if not updates:
        raise HTTPException(status_code=400, detail="Nada para atualizar")
    params.append(stage_id)
    cursor.execute(f"UPDATE comm.pipeline_stages SET {', '.join(updates)} WHERE id = %s", params)
    conn.commit()
    cursor.close()
    conn.close()
    return {"status": "updated"}


@router.delete("/stages/{stage_id}")
def delete_stage(stage_id: int):
    """Desativa uma etapa (soft delete)."""
    conn = get_postgres_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE comm.pipeline_stages SET is_active = false WHERE id = %s", (stage_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return {"status": "deleted"}


@router.put("/stages/reorder")
def reorder_stages(positions: dict):
    """Reordena etapas. Recebe {"stage_id": new_position, ...}"""
    conn = get_postgres_connection()
    cursor = conn.cursor()
    for stage_id, position in positions.items():
        cursor.execute(
            "UPDATE comm.pipeline_stages SET position = %s WHERE id = %s",
            (position, int(stage_id))
        )
    conn.commit()
    cursor.close()
    conn.close()
    return {"status": "reordered"}


# === CONTATOS POR ETAPA ===

@router.get("/contacts")
def pipeline_contacts():
    """Lista contatos WhatsApp agrupados por lead_status."""
    conn = get_postgres_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT wa_id, name, phone_normalized, customer_id, lead_status,
               last_message, last_message_time, unread, notes
        FROM comm.wa_contacts
        WHERE is_active = true
        ORDER BY last_message_time DESC NULLS LAST
    """)
    contacts = []
    for r in cursor.fetchall():
        contacts.append({
            "wa_id": r[0], "name": r[1], "phone": r[2],
            "customer_id": r[3], "lead_status": r[4] or "novo",
            "last_message": r[5], "last_message_time": r[6].isoformat() if r[6] else None,
            "unread": r[7] or 0, "notes": r[8],
        })
    cursor.close()
    conn.close()
    return contacts


@router.patch("/contacts/{wa_id}/move")
def move_contact(wa_id: str, req: MoveContact):
    """Move contato para outra etapa do pipeline."""
    conn = get_postgres_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE comm.wa_contacts SET lead_status = %s, updated_at = NOW() WHERE wa_id = %s",
        (req.lead_status, wa_id)
    )
    conn.commit()
    cursor.close()
    conn.close()
    return {"status": "moved"}