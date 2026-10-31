from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")
    mongo_uri: str = "mongodb://localhost:27017"
    db_name: str = "algopredict"
    jwt_secret: str = "change-me"
    jwt_expire_minutes: int = 1440
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/auth/google/callback"
    frontend_url: str = "http://localhost:3000"
    upstox_api_key: str = ""
    upstox_api_secret: str = ""
    upstox_redirect_uri: str = "http://localhost:8000/admin/upstox/callback"
    admin_emails: str = ""
    ml_service_url: str = "http://localhost:8001"
    ml_api_key: str = ""
    ml_mock: bool = True
    feed_mode: str = "replay"
    sideways_threshold_pct: float = 0.05
    starting_balance: float = 100000.0
    squareoff_time: str = "15:20"
    cookie_secure: bool = False
    cookie_samesite: str = "lax"
    slippage_bps: float = 2.0

    @property
    def admin_email_set(self) -> set[str]:
        return {email.strip().lower() for email in self.admin_emails.split(",") if email.strip()}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
