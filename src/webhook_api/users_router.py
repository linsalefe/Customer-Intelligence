from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import text

from src.db.connection import get_sqlalchemy_engine
from src.auth.security import hash_password
from src.webhook_api.auth_router import get_current_user, require_role

router = APIRouter(prefix="/api/users", tags=["users"])


class CreateUserRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str = "viewer"


class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


@router.get("")
def list_users(user: dict = Depends(require_role("admin"))):
    engine = get_sqlalchemy_engine()
    with engine.connect() as conn:
        result = conn.execute(text(
            "SELECT id, name, email, role, is_active, created_at FROM core.users ORDER BY id"
        ))
        keys = list(result.keys())
        rows = [dict(zip(keys, r)) for r in result.fetchall()]
    return {"data": rows}


@router.post("")
def create_user(data: CreateUserRequest, user: dict = Depends(require_role("admin"))):
    if data.role not in ("admin", "operacional", "viewer"):
        raise HTTPException(status_code=400, detail="Role inválida")

    engine = get_sqlalchemy_engine()
    hashed = hash_password(data.password)

    try:
        with engine.begin() as conn:
            result = conn.execute(
                text("""
                    INSERT INTO core.users (name, email, password_hash, role)
                    VALUES (:name, :email, :password_hash, :role)
                    RETURNING id, name, email, role, is_active
                """),
                {"name": data.name, "email": data.email.lower().strip(), "password_hash": hashed, "role": data.role}
            )
            row = result.fetchone()
    except Exception:
        raise HTTPException(status_code=409, detail="Email já cadastrado")

    return {"id": row[0], "name": row[1], "email": row[2], "role": row[3], "is_active": row[4]}


@router.put("/{user_id}")
def update_user(user_id: int, data: UpdateUserRequest, user: dict = Depends(require_role("admin"))):
    engine = get_sqlalchemy_engine()
    updates = []
    params = {"user_id": user_id}

    if data.name is not None:
        updates.append("name = :name")
        params["name"] = data.name
    if data.role is not None:
        if data.role not in ("admin", "operacional", "viewer"):
            raise HTTPException(status_code=400, detail="Role inválida")
        updates.append("role = :role")
        params["role"] = data.role
    if data.is_active is not None:
        updates.append("is_active = :is_active")
        params["is_active"] = data.is_active
    if data.password is not None:
        updates.append("password_hash = :password_hash")
        params["password_hash"] = hash_password(data.password)

    if not updates:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")

    updates.append("updated_at = NOW()")
    query = f"UPDATE core.users SET {', '.join(updates)} WHERE id = :user_id RETURNING id, name, email, role, is_active"

    with engine.begin() as conn:
        result = conn.execute(text(query), params)
        row = result.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    return {"id": row[0], "name": row[1], "email": row[2], "role": row[3], "is_active": row[4]}


@router.delete("/{user_id}")
def delete_user(user_id: int, user: dict = Depends(require_role("admin"))):
    if str(user_id) == user.get("sub"):
        raise HTTPException(status_code=400, detail="Não pode deletar a si mesmo")

    engine = get_sqlalchemy_engine()
    with engine.begin() as conn:
        result = conn.execute(text("DELETE FROM core.users WHERE id = :user_id RETURNING id"), {"user_id": user_id})
        row = result.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    return {"ok": True, "deleted_id": row[0]}
