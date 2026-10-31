from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from fastapi import Response
from app.config import settings

ALGORITHM = "HS256"

def create_access_token(subject: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    return jwt.encode({"sub": subject, "exp": exp}, settings.jwt_secret, algorithm=ALGORITHM)

def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except JWTError:
        return None

def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie("access_token", token, httponly=True, secure=settings.cookie_secure,
                        samesite=settings.cookie_samesite, max_age=settings.jwt_expire_minutes * 60, path="/")

def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie("access_token", httponly=True, secure=settings.cookie_secure,
                           samesite=settings.cookie_samesite, path="/")
