from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_session
from app.mail import MailError
from app.schemas.notifications import (
    MailServerOut,
    NotificationSettingsIn,
    NotificationSettingsOut,
    TestEmailIn,
    TestEmailOut,
)
from app.security import require_admin
from app.services import notifications

router = APIRouter(
    prefix="/admin/notifications", tags=["admin"], dependencies=[Depends(require_admin)]
)

Session = Annotated[AsyncSession, Depends(get_session)]


def _out(row) -> NotificationSettingsOut:
    settings = get_settings()
    out = NotificationSettingsOut.model_validate(row)
    out.mail_server = MailServerOut(
        enabled=settings.mail_enabled,
        host=settings.smtp_host,
        port=settings.smtp_port,
        sender=settings.mail_from,
    )
    return out


@router.get("", response_model=NotificationSettingsOut)
async def get_notification_settings(session: Session):
    row = await notifications.get_notification_settings(session)
    await session.commit()  # persists the default row the first time
    return _out(row)


@router.put("", response_model=NotificationSettingsOut)
async def update_notification_settings(data: NotificationSettingsIn, session: Session):
    row = await notifications.get_notification_settings(session)
    for field, value in data.model_dump().items():
        setattr(row, field, value)
    await session.commit()
    await session.refresh(row)
    return _out(row)


@router.post("/test", response_model=TestEmailOut)
async def send_test_email(data: TestEmailIn, session: Session):
    row = await notifications.get_notification_settings(session)
    to = data.to if data.to else list(row.admin_recipients)
    if not to:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Add at least one recipient first"
        )
    try:
        await notifications.send_test(to, row.admin_language)
    except MailError as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, f"The mail server refused or couldn't be reached: {exc}"
        ) from exc
    return TestEmailOut(sent_to=to)
