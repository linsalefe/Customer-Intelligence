from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy import text

from src.db.connection import get_sqlalchemy_engine
from src.auth.security import verify_password, create_access_token, decode_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])
security = HTTPBearer()


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado")
    return payload


def require_role(*roles):
    def checker(user: dict = Depends(get_current_user)):
        if user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Sem permissão")
        return user
    return checker


@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest):
    engine = get_sqlalchemy_engine()
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT id, name, email, password_hash, role, is_active FROM core.users WHERE email = :email"),
            {"email": data.email.lower().strip()}
        )
        user = result.fetchone()

    if not user:
        raise HTTPException(status_code=401, detail="Email ou senha inválidos")

    if not user[5]:
        raise HTTPException(status_code=403, detail="Usuário desativado")

    if not verify_password(data.password, user[3]):
        raise HTTPException(status_code=401, detail="Email ou senha inválidos")

    token_data = {"sub": str(user[0]), "email": user[2], "name": user[1], "role": user[4]}
    token = create_access_token(token_data)

    return LoginResponse(
        access_token=token,
        user={"id": user[0], "name": user[1], "email": user[2], "role": user[4]}
    )


@router.get("/me")
def get_me(user: dict = Depends(get_current_user)):
    return user
