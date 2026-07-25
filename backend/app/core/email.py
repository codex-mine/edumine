"""Outbound transactional email (password reset links) via plain SMTP.

Uses stdlib smtplib rather than adding a mail dependency. When SMTP isn't
configured (e.g. local dev without credentials), the message is logged
instead of raised so the rest of the flow keeps working.
"""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger("app.email")


def _send_sync(to_email: str, subject: str, html_body: str, text_body: str) -> None:
    if not settings.smtp_host or not settings.smtp_username or not settings.smtp_password:
        logger.warning(
            "SMTP not configured; skipping send to %s. Subject: %s\n%s", to_email, subject, text_body
        )
        return

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email or settings.smtp_username}>"
    message["To"] = to_email
    message.attach(MIMEText(text_body, "plain"))
    message.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
        if settings.smtp_use_tls:
            server.starttls()
        server.login(settings.smtp_username, settings.smtp_password)
        server.sendmail(settings.smtp_from_email or settings.smtp_username, [to_email], message.as_string())


async def send_email(to_email: str, subject: str, html_body: str, text_body: str) -> None:
    await run_in_threadpool(_send_sync, to_email, subject, html_body, text_body)


async def send_password_reset_email(to_email: str, full_name: str, reset_link: str) -> None:
    subject = "Reset your Codex Edumine password"
    text_body = (
        f"Hi {full_name},\n\n"
        "We received a request to reset your Codex Edumine password. "
        f"Open the link below to choose a new one:\n{reset_link}\n\n"
        f"This link expires in {settings.password_reset_token_expire_minutes} minutes. "
        "If you didn't request this, you can safely ignore this email.\n\n"
        "- Codex Edumine"
    )
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1e1b2e;">
      <h2 style="color: #4f46e5;">Reset your password</h2>
      <p>Hi {full_name},</p>
      <p>We received a request to reset your Codex Edumine password. Click the button below to choose a new one.</p>
      <p style="margin: 24px 0;">
        <a href="{reset_link}" style="background: #4f46e5; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Reset password
        </a>
      </p>
      <p style="font-size: 13px; color: #6b7280;">
        This link expires in {settings.password_reset_token_expire_minutes} minutes.
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
    """
    await send_email(to_email, subject, html_body, text_body)
