import secrets
from fastapi import Header,HTTPException
from app.config import settings

async def require_api_key(x_api_key:str|None=Header(default=None,alias="X-API-Key")):
    expected=settings.ml_api_key
    if not expected or not x_api_key or not secrets.compare_digest(x_api_key,expected):
        raise HTTPException(status_code=401,detail="Invalid or missing API key")
