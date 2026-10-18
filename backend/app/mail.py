"""Outgoing email through Gmail's SMTP server, logged in with a Google app password."""

import asyncio
import logging
import smtplib
import ssl
import time
from email.message import EmailMessage

from app.config import get_settings

log = logging.getLogger("mordjane.mail")

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 465
TIMEOUT_SECONDS = 15


class MailError(Exception):
    """Gmail refused the message or couldn't be reached."""


def build_message(sender: str, to: list[str], subject: str, html: str, text: str) -> EmailMessage:
    message = EmailMessage()
    message["From"] = sender
    message["To"] = ", ".join(to)
    message["Subject"] = subject
    message.set_content(text)
    message.add_alternative(html, subtype="html")
    return message


def _send(message: EmailMessage, address: str, password: str) -> None:
    context = ssl.create_default_context()
    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=TIMEOUT_SECONDS, context=context) as smtp:
        smtp.login(address, password)
        refused = smtp.send_message(message)
    if refused:
        raise MailError(f"Gmail refused {', '.join(refused)}")


async def send_email(to: list[str], subject: str, html: str, text: str) -> None:
    """Send one message to all `to` addresses. Raises MailError on failure."""
    settings = get_settings()
    if not to:
        return
    if not settings.mail_enabled:
        log.info("Mail disabled; not sending %r to %s", subject, to)
        return
    if not (settings.gmail_address and settings.gmail_app_password):
        raise MailError("GMAIL_ADDRESS and GMAIL_APP_PASSWORD are not set in .env")
    message = build_message(settings.gmail_address, to, subject, html, text)
    # Google shows app passwords in groups of four ("abcd efgh ijkl mnop").
    password = settings.gmail_app_password.replace(" ", "")
    started = time.perf_counter()
    try:
        await asyncio.to_thread(_send, message, settings.gmail_address, password)
    except (smtplib.SMTPException, OSError) as exc:
        raise MailError(f"{type(exc).__name__}: {exc}") from exc
    log.info("Sent %r to %s in %.2fs", subject, to, time.perf_counter() - started)
