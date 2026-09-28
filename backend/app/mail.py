"""Outgoing email over SMTP (Mailpit in development, a real provider in production)."""

import logging
import time
from email.message import EmailMessage
from email.utils import formatdate, make_msgid, parseaddr

import aiosmtplib

from app.config import get_settings

log = logging.getLogger("mordjane.mail")


class MailError(Exception):
    """The SMTP server refused the message or couldn't be reached."""


def build_message(to: list[str], subject: str, html: str, text: str) -> EmailMessage:
    settings = get_settings()
    message = EmailMessage()
    message["From"] = settings.mail_from
    message["To"] = ", ".join(to)
    message["Subject"] = subject
    message["Date"] = formatdate(localtime=True)
    message["Message-ID"] = make_msgid(domain="mordjane")
    message.set_content(text)
    message.add_alternative(html, subtype="html")
    return message


def helo_hostname() -> str:
    """Explicit EHLO name, so sending never waits on a reverse-DNS lookup of this host."""
    settings = get_settings()
    if settings.smtp_helo_hostname:
        return settings.smtp_helo_hostname
    _name, address = parseaddr(settings.mail_from)
    domain = address.rpartition("@")[2]
    return domain or "localhost"


async def send_email(to: list[str], subject: str, html: str, text: str) -> None:
    """Send one message to all `to` addresses. Raises MailError on failure."""
    settings = get_settings()
    if not to:
        return
    message = build_message(to, subject, html, text)
    if not settings.mail_enabled:
        log.info("Mail disabled; not sending %r to %s", subject, to)
        return
    started = time.perf_counter()
    try:
        await aiosmtplib.send(
            message,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_username,
            password=settings.smtp_password,
            use_tls=settings.smtp_ssl,
            start_tls=settings.smtp_starttls,
            timeout=settings.smtp_timeout_seconds,
            local_hostname=helo_hostname(),
        )
    except (aiosmtplib.SMTPException, OSError, TimeoutError) as exc:
        raise MailError(f"{type(exc).__name__}: {exc}") from exc
    log.info("Sent %r to %s in %.2fs", subject, to, time.perf_counter() - started)
