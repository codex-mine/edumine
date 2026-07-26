"""Local-disk storage for user-uploaded files (certificates, marksheets, NID scans).

No cloud object storage is configured for this project, so uploads are written
to a local directory (`settings.upload_dir`) and served back via a static file
mount at `settings.upload_base_url` (wired up in `app.main`). Swap this module
out for an S3-backed implementation later without touching callers — they only
see `save_upload_file(file) -> url`.
"""

import uuid
from pathlib import Path

from fastapi import UploadFile

from app.core.config import get_settings
from app.core.exceptions import ValidationException

settings = get_settings()

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
}


def _upload_dir() -> Path:
    path = Path(settings.upload_dir)
    path.mkdir(parents=True, exist_ok=True)
    return path


async def save_upload_file(file: UploadFile) -> str:
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise ValidationException(
            "Unsupported file type — only PDF, JPEG, PNG, or WEBP files are allowed",
            details=[{"field": "file", "issue": "Unsupported content type"}],
        )

    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    contents = await file.read()
    if len(contents) > max_bytes:
        raise ValidationException(
            f"File exceeds the {settings.max_upload_size_mb}MB upload limit",
            details=[{"field": "file", "issue": "File too large"}],
        )

    suffix = Path(file.filename or "").suffix
    stored_name = f"{uuid.uuid4().hex}{suffix}"
    destination = _upload_dir() / stored_name
    destination.write_bytes(contents)

    return f"{settings.upload_base_url}/{stored_name}"
