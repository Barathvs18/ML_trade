import logging
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings
from app.db import connect_db, close_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("algopredict")
health_state = {"upstox_token_ok": False, "feed_connected": False, "ml_reachable": False}


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.scheduler import build_scheduler, guarded_backfill, backfill_state
    backfill_task = None
    scheduler = build_scheduler()
    try:
        await connect_db()
        app.state.db_ok = True
    except Exception:
        app.state.db_ok = False
        logger.exception("Database connection failed")
    scheduler.start()
    backfill_task = __import__("asyncio").create_task(guarded_backfill(),name="market-candle-backfill")
    yield
    scheduler.shutdown(wait=False)
    if backfill_task and not backfill_task.done():
        backfill_task.cancel()
        try: await backfill_task
        except __import__("asyncio").CancelledError: pass
    await close_db()


def create_app() -> FastAPI:
    app = FastAPI(title="AlgoPredict API", version="1.0.0", lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=[settings.frontend_url], allow_credentials=True,
                       allow_methods=["*"], allow_headers=["*"])
    from app.modules.auth.router import router as auth_router
    from app.modules.market.router import router as market_router
    from app.modules.market.ws import router as ws_router
    from app.modules.predictions.router import router as predictions_router
    from app.modules.paper.router import router as paper_router
    from app.modules.dashboard.router import router as dashboard_router
    app.include_router(auth_router); app.include_router(market_router); app.include_router(ws_router)
    app.include_router(predictions_router); app.include_router(paper_router); app.include_router(dashboard_router)

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid4()))
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

    @app.get("/health")
    async def health():
        from app.db import database
        db_ok = False
        if database is not None:
            try:
                await database.command("ping")
                db_ok = True
            except Exception:
                pass
        from app.core.timeutils import is_market_open, next_market_open
        from app.scheduler import backfill_state
        return {"status": "ok" if db_ok else "degraded", "db_ok": db_ok, **health_state,
                "market_open": is_market_open(),"next_market_open":next_market_open().isoformat(),"backfill":dict(backfill_state)}

    @app.exception_handler(Exception)
    async def unhandled_error(request: Request, exc: Exception):
        logger.exception("Unhandled request error", extra={"path": request.url.path})
        return JSONResponse(status_code=500, content={"error": {"code": "internal_error", "message": "An unexpected error occurred"}})

    return app


app = create_app()
