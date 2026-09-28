"""Transactional email content: EN/FR/AR strings, formatting helpers and Jinja templates."""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from zoneinfo import ZoneInfo

from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.emails.strings import STRINGS

TUNIS = ZoneInfo("Africa/Tunis")

_env = Environment(
    loader=FileSystemLoader(Path(__file__).parent / "templates"),
    autoescape=select_autoescape(["html"]),
    trim_blocks=True,
    lstrip_blocks=True,
)


def lang_of(locale: str | None) -> str:
    return locale if locale in ("en", "ar") else "fr"


def money(value: Decimal | float | int, lang: str) -> str:
    """12,500 DT (fr) / 12.500 DT (en) / 12,500 د.ت (ar): the dinar always shows 3 decimals."""
    amount = f"{Decimal(value):,.3f}"  # 1,234.500
    if lang != "en":
        amount = amount.replace(",", "\u202f").replace(".", ",")
    return f"{amount} د.ت" if lang == "ar" else f"{amount} DT"


def weight(grams: int | None, lang: str) -> str:
    if not grams:
        return ""
    unit_g, unit_kg = ("غ", "كغ") if lang == "ar" else ("g", "kg")
    if grams >= 1000:
        kg = f"{grams / 1000:g}"
        return f"{kg if lang == 'en' else kg.replace('.', ',')} {unit_kg}"
    return f"{grams} {unit_g}"


def when(dt: datetime, lang: str) -> str:
    local = dt.astimezone(TUNIS)
    return local.strftime("%d %b %Y, %H:%M") if lang == "en" else local.strftime("%d/%m/%Y %H:%M")


def item_name(item, lang: str) -> str:
    """An order line's product name as the customer saw it (Arabic falls back to French)."""
    if lang == "ar":
        return item.product_name_ar or item.product_name_fr
    return item.product_name_fr if lang == "fr" else item.product_name


@dataclass
class Rendered:
    subject: str
    html: str
    text: str


def render(template: str, lang: str, subject: str, **context) -> Rendered:
    """Render `<template>.html` and `<template>.txt` with the language's strings."""
    rtl = lang == "ar"
    ctx = {
        "t": STRINGS[lang],
        "lang": lang,
        # Arabic reads right to left: flip the text direction and the table alignment.
        "dir": "rtl" if rtl else "ltr",
        "start": "right" if rtl else "left",
        "end": "left" if rtl else "right",
        "item_name": lambda item: item_name(item, lang),
        "money": lambda v: money(v, lang),
        "weight": lambda g: weight(g, lang),
        "when": lambda d: when(d, lang),
        "subject": subject,
        **context,
    }
    html = _env.get_template(f"{template}.html").render(**ctx)
    text = _env.get_template(f"{template}.txt").render(**ctx)
    return Rendered(subject=subject, html=html, text=text)
