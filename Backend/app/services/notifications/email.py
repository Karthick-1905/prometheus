"""Outbound email for rental notifications.

When SMTP is not configured, messages are logged (dev-safe) and marked SENT_LOG.
"""
from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage
from typing import Optional

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)


class EmailService:
    @staticmethod
    def send(
        *,
        to: str,
        subject: str,
        text_body: str,
        html_body: Optional[str] = None,
        settings: Optional[Settings] = None,
    ) -> dict:
        settings = settings or get_settings()
        if not settings.email_enabled:
            logger.info("Email disabled; skip send to=%s subject=%s", to, subject)
            return {"ok": True, "status": "SKIPPED", "detail": "email_enabled=false"}

        if not to or "@" not in to:
            return {"ok": False, "status": "FAILED", "detail": "Invalid recipient"}

        if not settings.smtp_host:
            logger.info(
                "[email:log] to=%s subject=%s\n%s",
                to,
                subject,
                text_body,
            )
            return {
                "ok": True,
                "status": "SENT_LOG",
                "detail": "No SMTP host configured; message logged",
            }

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = settings.smtp_from
        msg["To"] = to
        msg.set_content(text_body)
        if html_body:
            msg.add_alternative(html_body, subtype="html")

        try:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
                if settings.smtp_use_tls:
                    smtp.starttls()
                if settings.smtp_username:
                    smtp.login(settings.smtp_username, settings.smtp_password)
                smtp.send_message(msg)
            return {"ok": True, "status": "SENT", "detail": "delivered via SMTP"}
        except Exception as exc:  # noqa: BLE001
            logger.exception("SMTP send failed to=%s", to)
            return {"ok": False, "status": "FAILED", "detail": str(exc)}
