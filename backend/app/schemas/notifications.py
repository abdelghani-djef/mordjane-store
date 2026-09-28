import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Lenient on purpose: staff addresses may be on internal domains (e.g. team@shop.local).
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _clean_recipients(values: list[str]) -> list[str]:
    seen: list[str] = []
    for raw in values:
        email = raw.strip().lower()
        if not email:
            continue
        if not _EMAIL.match(email):
            raise ValueError(f"not an email address: {raw!r}")
        if email not in seen:
            seen.append(email)
    return seen


class NotificationSettingsIn(BaseModel):
    admin_recipients: list[str] = Field(default_factory=list, max_length=20)
    admin_language: Literal["en", "fr"] = "fr"
    notify_admin_new_order: bool = True
    notify_admin_status_change: bool = True
    notify_admin_low_stock: bool = True
    low_stock_threshold: int = Field(5, ge=0, le=100_000)
    notify_customer_confirmation: bool = True
    notify_customer_validated: bool = False
    notify_customer_shipped: bool = False
    notify_customer_delivered: bool = True
    notify_customer_cancelled: bool = True

    @field_validator("admin_recipients")
    @classmethod
    def _recipients(cls, v: list[str]) -> list[str]:
        return _clean_recipients(v)


class MailServerOut(BaseModel):
    """Where email is sent from (read-only; set by environment variables)."""

    enabled: bool
    host: str
    port: int
    sender: str


class NotificationSettingsOut(NotificationSettingsIn):
    model_config = ConfigDict(from_attributes=True)

    mail_server: MailServerOut | None = None


class TestEmailIn(BaseModel):
    # Defaults to the saved staff recipients.
    to: list[str] | None = Field(None, max_length=20)

    @field_validator("to")
    @classmethod
    def _to(cls, v: list[str] | None) -> list[str] | None:
        return _clean_recipients(v) if v is not None else None


class TestEmailOut(BaseModel):
    sent_to: list[str]
