"""Outgoing email through Resend's HTTP API."""

import logging
import time

import httpx

from app.config import get_settings

log = logging.getLogger("mordjane.mail")

RESEND_URL = "https://api.resend.com/emails"
# Resend's shared test sender; it can only deliver to the Resend account's own address,
# so every email goes there whoever it was meant for (until a domain is verified).
RESEND_FROM = "onboarding@resend.dev"
RESEND_TO = "abdelghanismartdrilling@gmail.com"
TIMEOUT_SECONDS = 15


class MailError(Exception):
    """Resend refused the message or couldn't be reached."""


def build_payload(subject: str, html: str, text: str) -> dict:
    return {"from": RESEND_FROM, "to": RESEND_TO, "subject": subject, "html": html, "text": text}


async def send_email(to: list[str], subject: str, html: str, text: str) -> None:
    """Send one message (meant for `to`) to RESEND_TO. Raises MailError on failure."""
    settings = get_settings()
    if not to:
        return
    if not settings.mail_enabled:
        log.info("Mail disabled; not sending %r to %s", subject, to)
        return
    if not settings.resend_api_key:
        raise MailError("RESEND_API_KEY is not set in .env")
    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            response = await client.post(
                RESEND_URL,
                headers={"Authorization": f"Bearer {settings.resend_api_key}"},
                json=build_payload(subject, html, text),
            )
    except httpx.HTTPError as exc:
        raise MailError(f"{type(exc).__name__}: {exc}") from exc
    if response.is_error:
        raise MailError(f"Resend answered {response.status_code}: {response.text}")
    log.info(
        "Sent %r (for %s) to %s in %.2fs", subject, to, RESEND_TO, time.perf_counter() - started
    )
