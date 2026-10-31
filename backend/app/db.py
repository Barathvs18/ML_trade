from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import settings

client: AsyncIOMotorClient | None = None
database: AsyncIOMotorDatabase | None = None


async def connect_db() -> None:
    global client, database
    client = AsyncIOMotorClient(settings.mongo_uri, serverSelectionTimeoutMS=3000)
    database = client[settings.db_name]
    await database.command("ping")
    await create_indexes()


async def close_db() -> None:
    global client, database
    if client is not None:
        client.close()
    client = database = None


def get_db() -> AsyncIOMotorDatabase:
    if database is None:
        raise RuntimeError("Database is not connected")
    return database


async def create_indexes() -> None:
    db = get_db()
    await db.users.create_index("google_id", unique=True)
    await db.users.create_index("email", unique=True)
    await db.candles.create_index([("symbol", 1), ("interval", 1), ("start", 1)], unique=True)
    await db.predictions.create_index([("user_id", 1), ("made_at", -1)])
    await db.predictions.create_index([("status", 1), ("resolve_at", 1)])
    await db.wallets.create_index("user_id", unique=True)
    await db.positions.create_index([("user_id", 1), ("symbol", 1)], unique=True)
    await db.trades.create_index([("user_id", 1), ("ts", -1)])
    await db.equity_snapshots.create_index([("user_id", 1), ("ts", -1)])
