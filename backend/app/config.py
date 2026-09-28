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

    # Email (Mailpit in development). With SMTP_SSL the connection is TLS from the start
    # (port 465); with SMTP_STARTTLS it upgrades after connecting (port 587).
    mail_enabled: bool = True
    smtp_host: str = "127.0.0.1"
    smtp_port: int = 1025
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_starttls: bool = False
    smtp_ssl: bool = False
    smtp_timeout_seconds: float = 15
    # Name announced in the SMTP greeting (EHLO). Default: the MAIL_FROM domain. Setting it
    # avoids a reverse-DNS lookup of this machine on every send, which can stall for seconds.
    smtp_helo_hostname: str | None = None
    mail_from: str = "Mordjane <orders@mordjane.local>"
    # Base URL of the storefront, for links in emails (tracking page, admin order page).
    public_site_url: str = "http://localhost:3000"
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    max_upload_bytes: int = 5 * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()
