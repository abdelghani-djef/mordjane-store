from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://mordjane:mordjane@127.0.0.1:5433/mordjane"
    jwt_secret: str = "dev-only-jwt-secret-change-me-in-production"
    jwt_expire_minutes: int = 60 * 12
    cookie_secure: bool = False
    media_dir: Path = Path("media")
    currency: str = "TND"
    # Initial value only; admins change it under Notifications (stored in the database).
    low_stock_threshold: int = 5

    # Email goes through Gmail (see app/mail.py); false logs emails instead of sending them.
    mail_enabled: bool = True
    # The Gmail account that sends every email; it is also the sender address.
    gmail_address: str = ""
    # Secret: a Google app password, set GMAIL_APP_PASSWORD in .env, never in the code.
    gmail_app_password: str = ""
    # Base URL of the storefront, for links in emails (tracking page, admin order page).
    public_site_url: str = "https://elmordjane.kwin.tn"
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    max_upload_bytes: int = 5 * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()
