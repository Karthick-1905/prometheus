"""Operational notifications: rental ending soon, overdue, site bookings."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.config import Settings, get_settings
from app.models.domain import (
    AppNotification,
    EquipmentAssignment,
    RentalContract,
)
from app.models.enums import AssignmentStatus, RentalContractStatus
from app.services.notifications.email import EmailService


class NotificationService:
    TYPE_ENDING_SOON = "RENTAL_ENDING_SOON"
    TYPE_OVERDUE = "RENTAL_OVERDUE"
    TYPE_SITE_BOOKED = "SITE_BOOKED"

    # ── public API ──────────────────────────────────────────────

    @staticmethod
    def list_notifications(
        db: Session,
        *,
        company_id: Optional[int] = None,
        unread_only: bool = False,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        stmt = select(AppNotification).order_by(AppNotification.created_at.desc()).limit(limit)
        if company_id is not None:
            stmt = stmt.where(AppNotification.company_id == company_id)
        if unread_only:
            stmt = stmt.where(AppNotification.is_read.is_(False))
        rows = db.execute(stmt).scalars().all()
        return [NotificationService.to_dict(n) for n in rows]

    @staticmethod
    def unread_count(db: Session, *, company_id: Optional[int] = None) -> int:
        stmt = select(AppNotification).where(AppNotification.is_read.is_(False))
        if company_id is not None:
            stmt = stmt.where(AppNotification.company_id == company_id)
        return len(list(db.execute(stmt).scalars().all()))

    @staticmethod
    def mark_read(
        db: Session,
        notification_id: int,
        *,
        company_id: Optional[int] = None,
    ) -> Optional[dict[str, Any]]:
        n = db.get(AppNotification, notification_id)
        if not n:
            return None
        if company_id is not None and n.company_id != company_id:
            return None
        if not n.is_read:
            n.is_read = True
            n.read_at = datetime.utcnow()
            db.commit()
            db.refresh(n)
        return NotificationService.to_dict(n)

    @staticmethod
    def mark_all_read(db: Session, *, company_id: Optional[int] = None) -> int:
        stmt = select(AppNotification).where(AppNotification.is_read.is_(False))
        if company_id is not None:
            stmt = stmt.where(AppNotification.company_id == company_id)
        rows = list(db.execute(stmt).scalars().all())
        now = datetime.utcnow()
        for n in rows:
            n.is_read = True
            n.read_at = now
        db.commit()
        return len(rows)

    @staticmethod
    def scan_rental_events(
        db: Session,
        *,
        company_id: Optional[int] = None,
        ending_soon_days: Optional[int] = None,
        send_email: bool = True,
        settings: Optional[Settings] = None,
    ) -> dict[str, Any]:
        """Create notifications for ending-soon and overdue rentals; send emails."""
        settings = settings or get_settings()
        days = ending_soon_days if ending_soon_days is not None else settings.rental_ending_soon_days
        now = datetime.utcnow()
        until = now + timedelta(days=max(1, days))
        created = {"endingSoon": 0, "overdue": 0, "emails": 0}

        # Mark ACTIVE contracts past expected_return as OVERDUE
        active_past = select(RentalContract).where(
            RentalContract.rental_status == RentalContractStatus.ACTIVE,
            RentalContract.expected_return.is_not(None),
            RentalContract.expected_return < now,
        )
        if company_id is not None:
            active_past = active_past.where(RentalContract.company_id == company_id)
        for c in db.execute(active_past).scalars().all():
            c.rental_status = RentalContractStatus.OVERDUE
        db.commit()

        # Ending soon (still ACTIVE, return within window)
        exp_stmt = (
            select(RentalContract)
            .options(
                joinedload(RentalContract.equipment),
                joinedload(RentalContract.company),
                joinedload(RentalContract.dealer),
            )
            .where(
                RentalContract.rental_status == RentalContractStatus.ACTIVE,
                RentalContract.expected_return.is_not(None),
                RentalContract.expected_return >= now,
                RentalContract.expected_return <= until,
            )
        )
        if company_id is not None:
            exp_stmt = exp_stmt.where(RentalContract.company_id == company_id)

        for contract in db.execute(exp_stmt).unique().scalars().all():
            n = NotificationService._ensure_ending_soon(db, contract, settings=settings)
            if n:
                created["endingSoon"] += 1
                if send_email and NotificationService._dispatch_email(db, n, settings=settings):
                    created["emails"] += 1

        # Overdue
        od_stmt = (
            select(RentalContract)
            .options(
                joinedload(RentalContract.equipment),
                joinedload(RentalContract.company),
                joinedload(RentalContract.dealer),
            )
            .where(RentalContract.rental_status == RentalContractStatus.OVERDUE)
        )
        if company_id is not None:
            od_stmt = od_stmt.where(RentalContract.company_id == company_id)

        for contract in db.execute(od_stmt).unique().scalars().all():
            n = NotificationService._ensure_overdue(db, contract, settings=settings)
            if n:
                created["overdue"] += 1
                if send_email and NotificationService._dispatch_email(db, n, settings=settings):
                    created["emails"] += 1

        return {
            "success": True,
            "endingSoonDays": days,
            "created": created,
            "generatedAt": now.isoformat(),
        }

    @staticmethod
    def notify_site_booking(
        db: Session,
        assignment: EquipmentAssignment,
        *,
        send_email: bool = True,
        settings: Optional[Settings] = None,
    ) -> Optional[dict[str, Any]]:
        """Notify when machinery is booked / checked out to a site."""
        settings = settings or get_settings()
        # Ensure relationships
        if assignment.contract is None or assignment.site is None:
            assignment = db.execute(
                select(EquipmentAssignment)
                .options(
                    joinedload(EquipmentAssignment.site),
                    joinedload(EquipmentAssignment.contract).joinedload(RentalContract.equipment),
                    joinedload(EquipmentAssignment.contract).joinedload(RentalContract.company),
                    joinedload(EquipmentAssignment.contract).joinedload(RentalContract.dealer),
                )
                .where(EquipmentAssignment.assignment_id == assignment.assignment_id)
            ).unique().scalar_one()

        contract = assignment.contract
        site = assignment.site
        if not contract or not site:
            return None

        eq_name = (
            contract.equipment.equipment_name
            if contract.equipment
            else f"Equipment #{contract.equipment_id}"
        )
        site_name = site.site_name or f"Site #{site.site_id}"
        recipient = NotificationService._recipient_email(contract)
        action_url = (
            f"{settings.frontend_public_url.rstrip('/')}/fleet/assets"
            f"?equipmentId={contract.equipment_id}"
        )
        dedupe = f"{NotificationService.TYPE_SITE_BOOKED}:a{assignment.assignment_id}"

        existing = db.execute(
            select(AppNotification).where(AppNotification.dedupe_key == dedupe)
        ).scalar_one_or_none()
        if existing:
            return NotificationService.to_dict(existing)

        body = (
            f"{eq_name} has been booked for {site_name}. "
            f"Checkout time: {assignment.checkout_time.isoformat() if assignment.checkout_time else 'now'}. "
            f"Contract #{contract.contract_id}."
        )
        n = AppNotification(
            company_id=contract.company_id,
            dealer_id=contract.dealer_id,
            site_id=site.site_id,
            contract_id=contract.contract_id,
            equipment_id=contract.equipment_id,
            assignment_id=assignment.assignment_id,
            notification_type=NotificationService.TYPE_SITE_BOOKED,
            severity="INFO",
            title=f"Booked for site: {eq_name}",
            body=body,
            action_url=action_url,
            action_label="View equipment",
            recipient_email=recipient,
            email_status="PENDING",
            is_read=False,
            dedupe_key=dedupe,
            created_at=datetime.utcnow(),
        )
        db.add(n)
        db.commit()
        db.refresh(n)
        if send_email:
            NotificationService._dispatch_email(db, n, settings=settings)
            db.refresh(n)
        return NotificationService.to_dict(n)

    @staticmethod
    def extend_contract(
        db: Session,
        contract_id: int,
        *,
        extra_days: int = 7,
        company_id: Optional[int] = None,
        settings: Optional[Settings] = None,
    ) -> dict[str, Any]:
        """Extend expected return and re-activate if overdue."""
        settings = settings or get_settings()
        extra_days = max(1, min(90, int(extra_days)))
        contract = db.execute(
            select(RentalContract)
            .options(joinedload(RentalContract.equipment), joinedload(RentalContract.company))
            .where(RentalContract.contract_id == contract_id)
        ).unique().scalar_one_or_none()
        if not contract:
            raise ValueError("Contract not found")
        if company_id is not None and contract.company_id != company_id:
            raise PermissionError("Contract outside company scope")

        base = contract.expected_return or datetime.utcnow()
        if base < datetime.utcnow():
            base = datetime.utcnow()
        new_return = base + timedelta(days=extra_days)
        contract.expected_return = new_return
        if contract.rental_status == RentalContractStatus.OVERDUE:
            contract.rental_status = RentalContractStatus.ACTIVE
        db.commit()
        db.refresh(contract)

        eq_name = (
            contract.equipment.equipment_name
            if contract.equipment
            else f"Equipment #{contract.equipment_id}"
        )
        # Acknowledge via notification (no email spam for extension confirm unless wanted)
        dedupe = (
            f"RENTAL_EXTENDED:c{contract.contract_id}:"
            f"{new_return.date().isoformat()}"
        )
        existing = db.execute(
            select(AppNotification).where(AppNotification.dedupe_key == dedupe)
        ).scalar_one_or_none()
        if not existing:
            n = AppNotification(
                company_id=contract.company_id,
                dealer_id=contract.dealer_id,
                contract_id=contract.contract_id,
                equipment_id=contract.equipment_id,
                notification_type="RENTAL_EXTENDED",
                severity="INFO",
                title=f"Rental extended: {eq_name}",
                body=(
                    f"Contract #{contract.contract_id} extended by {extra_days} day(s). "
                    f"New expected return: {new_return.date().isoformat()}."
                ),
                action_url=f"{settings.frontend_public_url.rstrip('/')}/fleet/assets",
                action_label="View fleet",
                recipient_email=NotificationService._recipient_email(contract),
                email_status="SKIPPED",
                is_read=False,
                dedupe_key=dedupe,
                created_at=datetime.utcnow(),
            )
            db.add(n)
            db.commit()

        return {
            "contractId": contract.contract_id,
            "equipmentId": contract.equipment_id,
            "equipmentName": eq_name,
            "expectedReturn": new_return.isoformat(),
            "rentalStatus": contract.rental_status.value if contract.rental_status else None,
            "extraDays": extra_days,
        }

    @staticmethod
    def to_dict(n: AppNotification) -> dict[str, Any]:
        return {
            "notificationId": n.notification_id,
            "companyId": n.company_id,
            "dealerId": n.dealer_id,
            "siteId": n.site_id,
            "contractId": n.contract_id,
            "equipmentId": n.equipment_id,
            "assignmentId": n.assignment_id,
            "type": n.notification_type,
            "severity": n.severity,
            "title": n.title,
            "body": n.body,
            "actionUrl": n.action_url,
            "actionLabel": n.action_label,
            "recipientEmail": n.recipient_email,
            "emailStatus": n.email_status,
            "emailError": n.email_error,
            "emailSentAt": n.email_sent_at.isoformat() if n.email_sent_at else None,
            "isRead": n.is_read,
            "readAt": n.read_at.isoformat() if n.read_at else None,
            "createdAt": n.created_at.isoformat() if n.created_at else None,
        }

    # ── internals ───────────────────────────────────────────────

    @staticmethod
    def _recipient_email(contract: RentalContract) -> Optional[str]:
        if contract.company and contract.company.email:
            return contract.company.email
        if contract.dealer and contract.dealer.email:
            return contract.dealer.email
        # lazy load company if needed
        return None

    @staticmethod
    def _ensure_ending_soon(
        db: Session,
        contract: RentalContract,
        *,
        settings: Settings,
    ) -> Optional[AppNotification]:
        day_key = (
            contract.expected_return.date().isoformat()
            if contract.expected_return
            else "none"
        )
        dedupe = f"{NotificationService.TYPE_ENDING_SOON}:c{contract.contract_id}:{day_key}"
        existing = db.execute(
            select(AppNotification).where(AppNotification.dedupe_key == dedupe)
        ).scalar_one_or_none()
        if existing:
            return None

        eq_name = (
            contract.equipment.equipment_name
            if contract.equipment
            else f"Equipment #{contract.equipment_id}"
        )
        return_date = (
            contract.expected_return.date().isoformat() if contract.expected_return else "soon"
        )
        days_left = 0
        if contract.expected_return:
            days_left = max(0, (contract.expected_return.date() - datetime.utcnow().date()).days)
        extend_url = (
            f"{settings.frontend_public_url.rstrip('/')}/notifications"
            f"?extend={contract.contract_id}"
        )
        body = (
            f"The rental for {eq_name} (contract #{contract.contract_id}) is due on {return_date} "
            f"({days_left} day(s) remaining). "
            f"If you still need the machine, extend the rental from the link below."
        )
        n = AppNotification(
            company_id=contract.company_id,
            dealer_id=contract.dealer_id,
            contract_id=contract.contract_id,
            equipment_id=contract.equipment_id,
            notification_type=NotificationService.TYPE_ENDING_SOON,
            severity="WARNING",
            title=f"Rental ending soon: {eq_name}",
            body=body,
            action_url=extend_url,
            action_label="Extend rental",
            recipient_email=NotificationService._recipient_email(contract),
            email_status="PENDING",
            is_read=False,
            dedupe_key=dedupe,
            created_at=datetime.utcnow(),
        )
        db.add(n)
        db.commit()
        db.refresh(n)
        return n

    @staticmethod
    def _ensure_overdue(
        db: Session,
        contract: RentalContract,
        *,
        settings: Settings,
    ) -> Optional[AppNotification]:
        day_key = datetime.utcnow().date().isoformat()
        dedupe = f"{NotificationService.TYPE_OVERDUE}:c{contract.contract_id}:{day_key}"
        existing = db.execute(
            select(AppNotification).where(AppNotification.dedupe_key == dedupe)
        ).scalar_one_or_none()
        if existing:
            return None

        eq_name = (
            contract.equipment.equipment_name
            if contract.equipment
            else f"Equipment #{contract.equipment_id}"
        )
        return_date = (
            contract.expected_return.date().isoformat()
            if contract.expected_return
            else "past due"
        )
        # Active site for context
        site_name = None
        active_a = db.execute(
            select(EquipmentAssignment)
            .options(joinedload(EquipmentAssignment.site))
            .where(
                EquipmentAssignment.contract_id == contract.contract_id,
                EquipmentAssignment.status == AssignmentStatus.ACTIVE,
            )
            .limit(1)
        ).unique().scalar_one_or_none()
        if active_a and active_a.site:
            site_name = active_a.site.site_name

        extend_url = (
            f"{settings.frontend_public_url.rstrip('/')}/notifications"
            f"?extend={contract.contract_id}"
        )
        site_bit = f" Currently booked at {site_name}." if site_name else ""
        body = (
            f"{eq_name} (contract #{contract.contract_id}) is OVERDUE. "
            f"Expected return was {return_date}.{site_bit} "
            f"Please return the equipment or extend the rental."
        )
        n = AppNotification(
            company_id=contract.company_id,
            dealer_id=contract.dealer_id,
            site_id=active_a.site_id if active_a else None,
            contract_id=contract.contract_id,
            equipment_id=contract.equipment_id,
            assignment_id=active_a.assignment_id if active_a else None,
            notification_type=NotificationService.TYPE_OVERDUE,
            severity="CRITICAL",
            title=f"Rental overdue: {eq_name}",
            body=body,
            action_url=extend_url,
            action_label="Extend rental",
            recipient_email=NotificationService._recipient_email(contract),
            email_status="PENDING",
            is_read=False,
            dedupe_key=dedupe,
            created_at=datetime.utcnow(),
        )
        db.add(n)
        db.commit()
        db.refresh(n)
        return n

    @staticmethod
    def _dispatch_email(
        db: Session,
        notification: AppNotification,
        *,
        settings: Settings,
    ) -> bool:
        if not notification.recipient_email:
            notification.email_status = "SKIPPED"
            notification.email_error = "No recipient email on company/dealer"
            db.commit()
            return False
        if notification.email_status in {"SENT", "SENT_LOG"}:
            return False

        subject = f"[CAT Rental] {notification.title}"
        text = notification.body
        if notification.action_url:
            text += f"\n\n{notification.action_label or 'Open'}: {notification.action_url}\n"
        text += "\n— CAT Smart Rental\n"

        html = f"""
        <div style="font-family:system-ui,sans-serif;max-width:560px;line-height:1.5;color:#1f1b10">
          <h2 style="margin:0 0 12px;font-size:18px">{notification.title}</h2>
          <p style="margin:0 0 16px">{notification.body}</p>
          {f'<p><a href="{notification.action_url}" style="display:inline-block;padding:10px 14px;background:#ffcd11;color:#6f5800;text-decoration:none;font-weight:700;border-radius:8px">{notification.action_label or "Open"}</a></p>' if notification.action_url else ''}
          <p style="margin-top:20px;font-size:12px;color:#4e4632">CAT Smart Rental</p>
        </div>
        """
        result = EmailService.send(
            to=notification.recipient_email,
            subject=subject,
            text_body=text,
            html_body=html,
            settings=settings,
        )
        notification.email_status = result["status"]
        notification.email_error = None if result["ok"] else result.get("detail")
        if result["ok"] and result["status"] in {"SENT", "SENT_LOG"}:
            notification.email_sent_at = datetime.utcnow()
        db.commit()
        return bool(result["ok"])
