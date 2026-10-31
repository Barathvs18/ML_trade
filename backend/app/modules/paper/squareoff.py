from app.db import get_db
from app.modules.paper.engine import close_position

async def square_off_all():
    async for position in get_db().positions.find({}):
        try: await close_position(position["user_id"],position["symbol"],"auto_squareoff",force=True)
        except Exception: continue

async def recover_previous_day_positions():
    from app.core.timeutils import to_ist, now_ist
    today=now_ist().date()
    async for position in get_db().positions.find({}):
        opened=position.get("opened_at")
        if opened and to_ist(opened).date()<today:
            try: await close_position(position["user_id"],position["symbol"],"startup_recovery",force=True)
            except Exception: continue
