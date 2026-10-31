from fastapi import APIRouter, Request, Response, Depends
from fastapi.responses import RedirectResponse
from app.config import settings
from app.core.deps import get_current_user
from app.core.security import create_access_token, set_auth_cookie, clear_auth_cookie
from app.modules.auth.service import oauth, upsert_google_user

router = APIRouter(prefix="/auth", tags=["auth"])

@router.get("/google/login")
async def google_login(request: Request):
    return await oauth.google.authorize_redirect(request, settings.google_redirect_uri)

@router.get("/google/callback")
async def google_callback(request: Request):
    token = await oauth.google.authorize_access_token(request)
    profile = token.get("userinfo") or await oauth.google.userinfo(token=token)
    user, _ = await upsert_google_user(profile)
    response = RedirectResponse(settings.frontend_url.rstrip("/") + "/dashboard")
    set_auth_cookie(response, create_access_token(user["user_id"]))
    return response

@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return {"id": user.get("user_id", user.get("google_id")), "email": user["email"], "name": user.get("name"), "picture": user.get("picture")}

@router.post("/logout")
async def logout():
    response = Response(status_code=204)
    clear_auth_cookie(response)
    return response
