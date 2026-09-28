import secrets
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.config import get_settings

# Sniff the real type from magic bytes rather than trusting the client's Content-Type.
_SIGNATURES: list[tuple[bytes, int, str]] = [
    (b"\xff\xd8\xff", 0, "jpg"),
    (b"\x89PNG\r\n\x1a\n", 0, "png"),
    (b"WEBP", 8, "webp"),
    (b"GIF8", 0, "gif"),
]


def _detect_extension(head: bytes) -> str | None:
    for magic, offset, ext in _SIGNATURES:
        if head[offset : offset + len(magic)] == magic:
            if ext == "webp" and not head.startswith(b"RIFF"):
                continue
            return ext
    return None


async def save_image(upload: UploadFile, folder: str) -> str:
    """Store an uploaded image under MEDIA_DIR/<folder>/ and return its relative path."""
    settings = get_settings()
    data = await upload.read(settings.max_upload_bytes + 1)
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "Image is too large (max 5 MB)")
    ext = _detect_extension(data[:16])
    if ext is None:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Only JPEG, PNG, WebP or GIF images"
        )
    relative = f"{folder}/{secrets.token_hex(8)}.{ext}"
    target = settings.media_dir / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return relative


def delete_image(relative: str | None) -> None:
    if not relative:
        return
    media_root = get_settings().media_dir.resolve()
    target = (media_root / relative).resolve()
    if target.is_relative_to(media_root):
        Path(target).unlink(missing_ok=True)
