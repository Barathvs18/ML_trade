from fastapi import Request
from app.core.security import decode_access_token
from app.core.errors import AppError
from app.db import get_db

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    payload = decode_access_token(token) if token else None
    if not payload or not payload.get("sub"):
        raise AppError(401, "unauthorized", "Authentication required")
    user = await get_db().users.find_one({"user_id": payload["sub"]})
    if not user:
        raise AppError(401, "unauthorized", "Authentication required")
    return user

async def require_admin(user: dict = __import__("fastapi").Depends(get_current_user)) -> dict:
    from app.config import settings
    if user.get("email", "").lower() not in settings.admin_email_set:
        raise AppError(403, "forbidden", "Administrator access required")
    return user
