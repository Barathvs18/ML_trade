from datetime import datetime, timezone
from authlib.integrations.starlette_client import OAuth
from app.config import settings
from app.db import get_db

oauth = OAuth()
oauth.register(name="google", client_id=settings.google_client_id, client_secret=settings.google_client_secret,
               server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
               client_kwargs={"scope": "openid email profile"})

async def upsert_google_user(profile: dict) -> tuple[dict, bool]:
    db = get_db()
    now = datetime.now(timezone.utc)
    google_id = profile["sub"]
    existing = await db.users.find_one({"google_id": google_id})
    record = {"google_id": google_id, "email": profile["email"].lower(), "name": profile.get("name", ""),
              "picture": profile.get("picture"), "last_login": now}
    if existing:
        await db.users.update_one({"_id": existing["_id"]}, {"$set": record})
        existing.update(record)
        return existing, False
    record.update({"created_at": now, "user_id": google_id})
    await db.users.insert_one(record)
    from app.modules.paper.service import create_wallet
    await create_wallet(google_id)
    return record, True
