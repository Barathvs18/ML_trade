from datetime import datetime, timezone, timedelta
from app.db import get_db

async def save_token(token: str, expires_in: int = 86400):
    expiry=datetime.now(timezone.utc)+timedelta(seconds=expires_in)
    await get_db().system_tokens.update_one({"_id":"upstox"},{"$set":{"access_token":token,"expires_at":expiry}},upsert=True)

async def load_token() -> str | None:
    row=await get_db().system_tokens.find_one({"_id":"upstox"})
    if not row or row.get("expires_at",datetime.min.replace(tzinfo=timezone.utc)) <= datetime.now(timezone.utc): return None
    return row.get("access_token")
