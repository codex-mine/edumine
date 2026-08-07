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


async def send_account_welcome_email(
    to_email: str,
    full_name: str,
    *,
    role_label: str,
    employee_code: str,
    temporary_password: str,
    designation: str | None = None,
    joining_date: str | None = None,
) -> None:
    subject = f"Welcome to Codex Edumine — your {role_label} account"
    profile_lines = [f"Employee ID: {employee_code}"]
    if designation:
        profile_lines.append(f"Designation: {designation}")
    if joining_date:
        profile_lines.append(f"Joining date: {joining_date}")
    profile_text = "\n".join(profile_lines)
    profile_html = "".join(f"<p>{line}</p>" for line in profile_lines)

    text_body = (
        f"Hi {full_name},\n\n"
        f"Your {role_label} account has been created on Codex Edumine.\n\n"
        f"{profile_text}\n\n"
        f"Login email: {to_email}\n"
        f"Temporary password: {temporary_password}\n\n"
        "This is your date of birth (DDMMYYYY). Please change it after your first login.\n\n"
        "- Codex Edumine"
    )
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1e1b2e;">
      <h2 style="color: #4f46e5;">Welcome to Codex Edumine</h2>
      <p>Hi {full_name},</p>
      <p>Your <strong>{role_label}</strong> account has been created.</p>
      {profile_html}
      <p style="margin: 24px 0; padding: 12px 16px; background: #f1f3f6; border-radius: 8px;">
        <strong>Login email:</strong> {to_email}<br/>
        <strong>Temporary password:</strong> {temporary_password}
      </p>
      <p style="font-size: 13px; color: #6b7280;">
        The temporary password is your date of birth (DDMMYYYY). Please change it after your first login.
      </p>
    </div>
    """
    await send_email(to_email, subject, html_body, text_body)


async def send_exam_question_assignment_email(
    to_email: str, teacher_name: str, *, exam_name: str, class_name: str, subject_name: str, deadline: str
) -> None:
    subject = f"Exam questions needed: {subject_name} — {exam_name}"
    text_body = (
        f"Hi {teacher_name},\n\n"
        f"You have been assigned to prepare and submit exam questions for {subject_name} ({class_name}) "
        f"as part of {exam_name}.\n\n"
        f"Submission deadline: {deadline}\n\n"
        "Please log in to Codex Edumine to prepare and submit your questions before the deadline.\n\n"
        "- Codex Edumine"
    )
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1e1b2e;">
      <h2 style="color: #4f46e5;">Exam questions needed</h2>
      <p>Hi {teacher_name},</p>
      <p>You have been assigned to prepare and submit exam questions for <strong>{subject_name}</strong> ({class_name}) as part of <strong>{exam_name}</strong>.</p>
      <p><strong>Submission deadline:</strong> {deadline}</p>
      <p style="font-size: 13px; color: #6b7280;">Log in to Codex Edumine to prepare and submit your questions before the deadline.</p>
    </div>
    """
    await send_email(to_email, subject, html_body, text_body)


async def send_deadline_extension_request_email(
    to_email: str, admin_name: str, *, teacher_name: str, exam_name: str, class_name: str, subject_name: str,
    reason: str, requested_deadline: str,
) -> None:
    subject = f"Deadline extension requested: {subject_name} — {exam_name}"
    text_body = (
        f"Hi {admin_name},\n\n"
        f"{teacher_name} has requested a question submission deadline extension for {subject_name} ({class_name}), "
        f"{exam_name}.\n\n"
        f"Reason: {reason}\n"
        f"Requested new deadline: {requested_deadline}\n\n"
        "Review and act on this request from the Exams module.\n\n"
        "- Codex Edumine"
    )
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1e1b2e;">
      <h2 style="color: #4f46e5;">Deadline extension requested</h2>
      <p>Hi {admin_name},</p>
      <p><strong>{teacher_name}</strong> has requested a question submission deadline extension for <strong>{subject_name}</strong> ({class_name}), {exam_name}.</p>
      <p><strong>Reason:</strong> {reason}</p>
      <p><strong>Requested new deadline:</strong> {requested_deadline}</p>
    </div>
    """
    await send_email(to_email, subject, html_body, text_body)


async def send_question_revision_requested_email(
    to_email: str, teacher_name: str, *, exam_name: str, class_name: str, subject_name: str, note: str
) -> None:
    subject = f"Revision requested: {subject_name} — {exam_name}"
    text_body = (
        f"Hi {teacher_name},\n\n"
        f"Your submitted questions for {subject_name} ({class_name}), {exam_name} need changes "
        "before they can be approved.\n\n"
        f"What to change: {note}\n\n"
        "Open the Exams module to edit and resubmit your questions.\n\n"
        "- Codex Edumine"
    )
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1e1b2e;">
      <h2 style="color: #4f46e5;">Revision requested</h2>
      <p>Hi {teacher_name},</p>
      <p>Your submitted questions for <strong>{subject_name}</strong> ({class_name}), {exam_name} need changes before they can be approved.</p>
      <p><strong>What to change:</strong> {note}</p>
      <p>Open the Exams module to edit and resubmit your questions.</p>
    </div>
    """
    await send_email(to_email, subject, html_body, text_body)


async def send_deadline_extended_email(
    to_email: str, teacher_name: str, *, exam_name: str, class_name: str, subject_name: str, new_deadline: str
) -> None:
    subject = f"Deadline extended: {subject_name} — {exam_name}"
    text_body = (
        f"Hi {teacher_name},\n\n"
        f"Your question submission deadline for {subject_name} ({class_name}), {exam_name} has been extended to "
        f"{new_deadline}.\n\n"
        "- Codex Edumine"
    )
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1e1b2e;">
      <h2 style="color: #4f46e5;">Deadline extended</h2>
      <p>Hi {teacher_name},</p>
      <p>Your question submission deadline for <strong>{subject_name}</strong> ({class_name}), {exam_name} has been extended to <strong>{new_deadline}</strong>.</p>
    </div>
    """
    await send_email(to_email, subject, html_body, text_body)
