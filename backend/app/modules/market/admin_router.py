from fastapi import APIRouter,Depends,HTTPException,Request
from fastapi.responses import RedirectResponse
from app.config import settings
from app.core.deps import require_admin
from app.modules.market.upstox_client import get_login_url,exchange_code_for_token
from app.modules.market.token_store import save_token

router=APIRouter(prefix="/admin/upstox",tags=["admin"])

@router.get("/login")
async def upstox_login(_admin=Depends(require_admin)):
    return RedirectResponse(get_login_url())

@router.get("/callback")
async def upstox_callback(request:Request,_admin=Depends(require_admin)):
    code=request.query_params.get("code")
    if not code:raise HTTPException(400,"Missing Upstox authorization code")
    token=await exchange_code_for_token(code)
    access=token.get("access_token");expires=int(token.get("expires_in",86400))
    if not access:raise HTTPException(502,"Upstox token response did not contain an access token")
    await save_token(access,expires)
    from app.main import health_state
    health_state["upstox_token_ok"]=True
    return RedirectResponse(settings.frontend_url.rstrip("/")+"/dashboard")
