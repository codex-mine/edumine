"""Outbound SMS via a generic HTTP gateway (Phase 14 — Communication Management).

Uses stdlib urllib rather than adding an HTTP client dependency, mirroring the
plain-smtplib approach in app/core/email.py. No specific vendor is mandated by
requirements.md/Architecture.md, so this targets a generic JSON webhook shape
(POST {sender_id, to, message} with a Bearer token) — swap `_send_sync` for a
vendor SDK call if one is adopted later.

When no gateway is configured (the default in this environment), the send is
logged and reported as "failed" rather than silently pretending to succeed —
sms_logs.status must reflect what actually happened, per Phase 14's
completion criteria ("SMS delivery status logs accurately").
"""

import json
import logging
import urllib.error
import urllib.request
from datetime import datetime, timezone

from starlette.concurrency import run_in_threadpool

from app.common.enums import SmsStatus
from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger("app.sms")


class SmsSendResult:
    __slots__ = ("status", "sent_at")

    def __init__(self, status: SmsStatus, sent_at: datetime | None) -> None:
        self.status = status
        self.sent_at = sent_at


def _send_sync(to_phone: str, message: str) -> SmsSendResult:
    if not settings.sms_gateway_url:
        logger.warning("SMS gateway not configured; not sent to %s. Message: %s", to_phone, message)
        return SmsSendResult(SmsStatus.failed, None)

    payload = json.dumps({"sender_id": settings.sms_sender_id, "to": to_phone, "message": message}).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if settings.sms_gateway_api_key:
        headers["Authorization"] = f"Bearer {settings.sms_gateway_api_key}"

    request = urllib.request.Request(settings.sms_gateway_url, data=payload, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            if 200 <= response.status < 300:
                return SmsSendResult(SmsStatus.sent, datetime.now(timezone.utc))
            logger.warning("SMS gateway returned status %s for %s", response.status, to_phone)
            return SmsSendResult(SmsStatus.failed, None)
    except (urllib.error.URLError, TimeoutError) as exc:
        logger.warning("SMS gateway send to %s failed: %s", to_phone, exc)
        return SmsSendResult(SmsStatus.failed, None)


async def send_sms(to_phone: str, message: str) -> SmsSendResult:
    return await run_in_threadpool(_send_sync, to_phone, message)
