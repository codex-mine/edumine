"""Storage for user-uploaded files (certificates, marksheets, NID scans).

Two providers are supported, selected by `settings.storage_provider`:

- ``local`` (default) — files are written under `settings.upload_dir` and served
  back via the static file mount at `settings.upload_base_url` (wired up in
  `app.main`).
- ``cloudinary`` — files are pushed to Cloudinary and its `secure_url` is
  returned. Credentials are validated at startup in `app.core.config`, so a
  misconfigured deployment refuses to boot rather than failing on first upload.

Callers only ever see `save_upload_file(file) -> url`, `upload_image_bytes(...)
-> UploadedAsset`, and `delete_asset(public_id)`, so switching providers is a
configuration change rather than a code change.

`public_id` is the handle needed to delete an asset later: the Cloudinary public
ID under that provider, and the stored path relative to `upload_dir` under the
local one.
"""

import urllib.request
import uuid
from dataclasses import dataclass
from pathlib import Path

import cloudinary
import cloudinary.uploader
from fastapi import UploadFile
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings
from app.core.exceptions import ValidationException

settings = get_settings()

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
}

# Used when a caller hands over raw bytes plus a content type, rather than an
# UploadFile whose filename already carries a suffix.
CONTENT_TYPE_SUFFIXES = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


@dataclass(frozen=True)
class UploadedAsset:
    """A stored file: where to read it, and the handle needed to delete it."""

    url: str
    public_id: str


def _reject_unsupported(content_type: str | None) -> None:
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise ValidationException(
            "Unsupported file type — only PDF, JPEG, PNG, or WEBP files are allowed",
            details=[{"field": "file", "issue": "Unsupported content type"}],
        )


def _reject_oversized(size_bytes: int) -> None:
    if size_bytes > settings.max_upload_size_mb * 1024 * 1024:
        raise ValidationException(
            f"File exceeds the {settings.max_upload_size_mb}MB upload limit",
            details=[{"field": "file", "issue": "File too large"}],
        )


# --- Local provider -----------------------------------------------------------


def _upload_dir() -> Path:
    path = Path(settings.upload_dir)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _local_path(public_id: str) -> Path:
    """Resolve a local public_id (a path relative to `upload_dir`) to a real path.

    Refuses anything that escapes the upload directory — public IDs round-trip
    through the database, so they are treated as untrusted input on the way back.
    """
    root = _upload_dir().resolve()
    candidate = (root / public_id).resolve()
    if root != candidate and root not in candidate.parents:
        raise ValidationException(
            "Invalid file reference",
            details=[{"field": "public_id", "issue": "Path escapes the upload directory"}],
        )
    return candidate


def _local_store(data: bytes, *, folder: str, stored_name: str) -> UploadedAsset:
    relative = f"{folder.strip('/')}/{stored_name}" if folder.strip("/") else stored_name
    destination = _local_path(relative)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)
    return UploadedAsset(url=f"{settings.upload_base_url}/{relative}", public_id=relative)


# --- Cloudinary provider ------------------------------------------------------


def _configure_cloudinary() -> None:
    cloudinary.config(
        cloud_name=settings.cloudinary_cloud_name,
        api_key=settings.cloudinary_api_key,
        api_secret=settings.cloudinary_api_secret,
        secure=True,
    )


def _cloudinary_folder(folder: str) -> str:
    parts = (settings.cloudinary_folder.strip("/"), folder.strip("/"))
    return "/".join(part for part in parts if part)


def _cloudinary_store_sync(data: bytes, *, folder: str, public_id: str) -> UploadedAsset:
    """Blocking — the Cloudinary SDK is synchronous. Always call via run_in_threadpool."""
    _configure_cloudinary()
    response = cloudinary.uploader.upload(
        data,
        folder=_cloudinary_folder(folder),
        public_id=public_id,
        resource_type="auto",
        overwrite=True,
        invalidate=True,
    )
    # Cloudinary's returned public_id already includes the folder prefix, which is
    # exactly what destroy() expects back.
    return UploadedAsset(url=response["secure_url"], public_id=response["public_id"])


def _cloudinary_destroy_sync(public_id: str) -> None:
    """Blocking — always call via run_in_threadpool.

    `resource_type` is not recoverable from a public ID alone, and the allowed
    content types can land as either `image` (JPEG/PNG/WEBP/PDF) or `raw`, so both
    are tried. Cloudinary answers "not found" for an asset that is already gone,
    which is treated as success — deleting twice is not an error for callers.
    """
    _configure_cloudinary()
    for resource_type in ("image", "raw"):
        response = cloudinary.uploader.destroy(
            public_id, resource_type=resource_type, invalidate=True
        )
        if response.get("result") == "ok":
            return


# --- Provider dispatch --------------------------------------------------------


async def _store(data: bytes, *, folder: str, public_id: str, suffix: str) -> UploadedAsset:
    if settings.storage_provider == "cloudinary":
        # Cloudinary derives the extension from the file itself, so the suffix is
        # only meaningful to the local provider's filenames.
        return await run_in_threadpool(
            _cloudinary_store_sync, data, folder=folder, public_id=public_id
        )
    return _local_store(data, folder=folder, stored_name=f"{public_id}{suffix}")


async def save_upload_file(file: UploadFile) -> str:
    _reject_unsupported(file.content_type)

    contents = await file.read()
    _reject_oversized(len(contents))

    asset = await _store(
        contents,
        folder="",
        public_id=uuid.uuid4().hex,
        suffix=Path(file.filename or "").suffix,
    )
    return asset.url


async def upload_image_bytes(
    data: bytes, *, folder: str, public_id: str, content_type: str
) -> UploadedAsset:
    """Store bytes a caller already holds in memory (rather than an UploadFile).

    `folder` is a provider-relative path segment — a subdirectory of `upload_dir`
    locally, and a path under `settings.cloudinary_folder` on Cloudinary.
    """
    _reject_unsupported(content_type)
    _reject_oversized(len(data))

    return await _store(
        data, folder=folder, public_id=public_id, suffix=CONTENT_TYPE_SUFFIXES[content_type]
    )


async def delete_asset(public_id: str) -> None:
    """Remove a stored asset. Deleting one that no longer exists is a no-op."""
    if settings.storage_provider == "cloudinary":
        await run_in_threadpool(_cloudinary_destroy_sync, public_id)
        return
    _local_path(public_id).unlink(missing_ok=True)


def _fetch_remote_sync(url: str) -> bytes:
    """Blocking — always call via run_in_threadpool."""
    if not url.lower().startswith("https://"):
        # These URLs come back from our own uploads, but they round-trip through
        # the database; refusing anything but https keeps a tampered row from
        # turning this into a file:// or gopher:// read.
        raise ValidationException(
            "Stored asset URL is not an https URL",
            details=[{"field": "url", "issue": "Unsupported scheme"}],
        )
    with urllib.request.urlopen(url, timeout=30) as response:  # noqa: S310 — scheme checked above
        return response.read()


async def fetch_asset(public_id: str, url: str) -> bytes:
    """Read a stored asset back.

    Needed to re-run the OMR pipeline over a sheet that was already uploaded,
    without asking the user to re-scan it.
    """
    if settings.storage_provider == "cloudinary":
        return await run_in_threadpool(_fetch_remote_sync, url)
    return _local_path(public_id).read_bytes()
