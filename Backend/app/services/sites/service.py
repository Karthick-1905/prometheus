"""Site Manager: sites, assignments, QR check-in/out."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.domain import (
    Equipment,
    EquipmentAssignment,
    ProjectSite,
    RentalContract,
    User,
)
from app.models.enums import (
    AssignmentStatus,
    EquipmentStatus,
    ProjectSiteStatus,
    RentalContractStatus,
)


class SiteService:
    @staticmethod
    def list_sites(
        db: Session, *, company_id: Optional[int] = None
    ) -> list[dict[str, Any]]:
        stmt = select(ProjectSite).order_by(ProjectSite.site_id)
        if company_id is not None:
            stmt = stmt.where(ProjectSite.company_id == company_id)
        rows = db.execute(stmt).scalars().all()
        return [SiteService._site_dict(s) for s in rows]

    @staticmethod
    def get_site(
        db: Session, site_id: int, *, company_id: Optional[int] = None
    ) -> Optional[dict[str, Any]]:
        site = db.get(ProjectSite, site_id)
        if not site:
            return None
        if company_id is not None and site.company_id != company_id:
            return None
        return SiteService._site_dict(site)

    @staticmethod
    def create_site(
        db: Session,
        *,
        company_id: int,
        site_name: str,
        location: Optional[str] = None,
        status: str = "ACTIVE",
    ) -> dict[str, Any]:
        try:
            st = ProjectSiteStatus(status)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=f"Invalid status: {status}") from exc
        site = ProjectSite(
            company_id=company_id,
            site_name=site_name,
            location=location,
            status=st,
        )
        db.add(site)
        db.commit()
        db.refresh(site)
        return SiteService._site_dict(site)

    @staticmethod
    def site_summary(db: Session, site_id: int, *, company_id: Optional[int] = None) -> dict[str, Any]:
        site = SiteService.get_site(db, site_id, company_id=company_id)
        if not site:
            raise HTTPException(status_code=404, detail="Site not found")
        active = SiteService.list_active_assignments(db, site_id=site_id)
        return {
            **site,
            "activeAssignments": len(active),
            "equipment": active,
        }

    @staticmethod
    def list_active_assignments(
        db: Session,
        *,
        site_id: Optional[int] = None,
        company_id: Optional[int] = None,
    ) -> list[dict[str, Any]]:
        stmt = (
            select(EquipmentAssignment)
            .options(
                joinedload(EquipmentAssignment.site),
                joinedload(EquipmentAssignment.contract).joinedload(RentalContract.equipment),
            )
            .where(EquipmentAssignment.status == AssignmentStatus.ACTIVE)
            .order_by(EquipmentAssignment.assignment_id.desc())
        )
        if site_id is not None:
            stmt = stmt.where(EquipmentAssignment.site_id == site_id)
        rows = db.execute(stmt).unique().scalars().all()
        out = []
        for a in rows:
            contract = a.contract
            if company_id is not None and contract and contract.company_id != company_id:
                continue
            out.append(SiteService._assignment_dict(a))
        return out

    @staticmethod
    def resolve_equipment_by_code(
        db: Session, *, qr_code: Optional[str] = None, rfid_tag: Optional[str] = None
    ) -> Optional[Equipment]:
        if not qr_code and not rfid_tag:
            return None
        stmt = select(Equipment)
        if qr_code:
            stmt = stmt.where(Equipment.qr_code == qr_code)
        else:
            stmt = stmt.where(Equipment.rfid_tag == rfid_tag)
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def equipment_by_qr(db: Session, qr_code: str) -> dict[str, Any]:
        eq = SiteService.resolve_equipment_by_code(db, qr_code=qr_code)
        if not eq:
            raise HTTPException(status_code=404, detail="Equipment not found for QR code")
        return SiteService._equipment_scan_payload(db, eq)

    @staticmethod
    def equipment_by_rfid(db: Session, rfid_tag: str) -> dict[str, Any]:
        eq = SiteService.resolve_equipment_by_code(db, rfid_tag=rfid_tag)
        if not eq:
            raise HTTPException(status_code=404, detail="Equipment not found for RFID tag")
        return SiteService._equipment_scan_payload(db, eq)

    @staticmethod
    def scan_checkout(
        db: Session,
        *,
        action: str,
        site_id: int,
        actor_user_id: int,
        company_id: Optional[int] = None,
        qr_code: Optional[str] = None,
        rfid_tag: Optional[str] = None,
        equipment_id: Optional[int] = None,
        operator_id: Optional[str] = None,
    ) -> dict[str, Any]:
        action = action.upper().strip()
        if action not in {"CHECK_OUT", "CHECK_IN"}:
            raise HTTPException(status_code=422, detail="action must be CHECK_OUT or CHECK_IN")

        site = db.get(ProjectSite, site_id)
        if not site:
            raise HTTPException(status_code=404, detail="Site not found")
        if company_id is not None and site.company_id != company_id:
            raise HTTPException(status_code=403, detail="Site outside your company scope")

        if equipment_id is not None:
            eq = db.get(Equipment, equipment_id)
        else:
            eq = SiteService.resolve_equipment_by_code(db, qr_code=qr_code, rfid_tag=rfid_tag)
        if not eq:
            raise HTTPException(status_code=404, detail="Equipment not found")

        contract = SiteService._active_contract_for_equipment(db, eq.equipment_id)
        if not contract:
            raise HTTPException(
                status_code=409,
                detail="No ACTIVE/OVERDUE rental contract for this equipment",
            )
        if company_id is not None and contract.company_id != company_id:
            raise HTTPException(status_code=403, detail="Contract outside your company scope")

        actor = db.get(User, actor_user_id)
        if not actor:
            # create ephemeral demo actor if missing (SQLite tests may only seed one user)
            raise HTTPException(
                status_code=400,
                detail="Actor user not found; pass a valid company user id via X-User-Id or use seeded user",
            )

        now = datetime.utcnow()
        warnings: list[str] = []
        if contract.expected_return and contract.expected_return < now:
            warnings.append("Contract is past expected return")
        elif contract.expected_return:
            days_left = (contract.expected_return - now).days
            if days_left <= 2:
                warnings.append(f"Return due in {days_left} day(s)")

        if action == "CHECK_OUT":
            existing = SiteService._active_assignment_for_contract(db, contract.contract_id)
            if existing and existing.site_id == site_id:
                return {
                    "action": action,
                    "alreadyActive": True,
                    "assignment": SiteService._assignment_dict(existing),
                    "warnings": warnings,
                    "operatorId": operator_id,
                }
            if existing:
                existing.status = AssignmentStatus.RETURNED
                existing.checkin_time = now

            assignment = EquipmentAssignment(
                contract_id=contract.contract_id,
                site_id=site_id,
                assigned_by=actor_user_id,
                checked_out_by=actor_user_id,
                checkout_time=now,
                status=AssignmentStatus.ACTIVE,
            )
            db.add(assignment)
            if eq.status != EquipmentStatus.RENTED:
                eq.status = EquipmentStatus.RENTED
            db.commit()
            db.refresh(assignment)
            # reload with relationships
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
            try:
                from app.services.notifications import NotificationService

                NotificationService.notify_site_booking(db, assignment, send_email=True)
            except Exception:  # noqa: BLE001
                pass
            return {
                "action": action,
                "alreadyActive": False,
                "assignment": SiteService._assignment_dict(assignment),
                "warnings": warnings,
                "operatorId": operator_id,
            }

        # CHECK_IN
        active = SiteService._active_assignment_for_contract(db, contract.contract_id)
        if not active:
            raise HTTPException(status_code=409, detail="No active checkout to check in")
        if site_id and active.site_id != site_id:
            warnings.append(
                f"Checked in at site {site_id} but was assigned to site {active.site_id}"
            )
        active.status = AssignmentStatus.RETURNED
        active.checkin_time = now
        db.commit()
        db.refresh(active)
        active = db.execute(
            select(EquipmentAssignment)
            .options(
                joinedload(EquipmentAssignment.site),
                joinedload(EquipmentAssignment.contract).joinedload(RentalContract.equipment),
            )
            .where(EquipmentAssignment.assignment_id == active.assignment_id)
        ).unique().scalar_one()
        return {
            "action": action,
            "alreadyActive": False,
            "assignment": SiteService._assignment_dict(active),
            "warnings": warnings,
            "operatorId": operator_id,
        }

    @staticmethod
    def create_assignment(
        db: Session,
        *,
        contract_id: int,
        site_id: int,
        actor_user_id: int,
        company_id: Optional[int] = None,
    ) -> dict[str, Any]:
        contract = db.get(RentalContract, contract_id)
        if not contract:
            raise HTTPException(status_code=404, detail="Contract not found")
        if company_id is not None and contract.company_id != company_id:
            raise HTTPException(status_code=403, detail="Contract outside scope")
        site = db.get(ProjectSite, site_id)
        if not site:
            raise HTTPException(status_code=404, detail="Site not found")
        if company_id is not None and site.company_id != company_id:
            raise HTTPException(status_code=403, detail="Site outside scope")

        existing = SiteService._active_assignment_for_contract(db, contract_id)
        if existing:
            existing.status = AssignmentStatus.RETURNED
            existing.checkin_time = datetime.utcnow()

        a = EquipmentAssignment(
            contract_id=contract_id,
            site_id=site_id,
            assigned_by=actor_user_id,
            checked_out_by=actor_user_id,
            checkout_time=datetime.utcnow(),
            status=AssignmentStatus.ACTIVE,
        )
        db.add(a)
        db.commit()
        db.refresh(a)
        a = db.execute(
            select(EquipmentAssignment)
            .options(
                joinedload(EquipmentAssignment.site),
                joinedload(EquipmentAssignment.contract).joinedload(RentalContract.equipment),
                joinedload(EquipmentAssignment.contract).joinedload(RentalContract.company),
                joinedload(EquipmentAssignment.contract).joinedload(RentalContract.dealer),
            )
            .where(EquipmentAssignment.assignment_id == a.assignment_id)
        ).unique().scalar_one()
        try:
            from app.services.notifications import NotificationService

            NotificationService.notify_site_booking(db, a, send_email=True)
        except Exception:  # noqa: BLE001 — booking must not fail if notify fails
            pass
        return SiteService._assignment_dict(a)

    # ── helpers ────────────────────────────────────────────────────

    @staticmethod
    def _active_contract_for_equipment(
        db: Session, equipment_id: int
    ) -> Optional[RentalContract]:
        stmt = (
            select(RentalContract)
            .where(
                RentalContract.equipment_id == equipment_id,
                RentalContract.rental_status.in_(
                    [RentalContractStatus.ACTIVE, RentalContractStatus.OVERDUE]
                ),
            )
            .order_by(RentalContract.contract_id.desc())
            .limit(1)
        )
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def _active_assignment_for_contract(
        db: Session, contract_id: int
    ) -> Optional[EquipmentAssignment]:
        stmt = (
            select(EquipmentAssignment)
            .where(
                EquipmentAssignment.contract_id == contract_id,
                EquipmentAssignment.status == AssignmentStatus.ACTIVE,
            )
            .order_by(EquipmentAssignment.assignment_id.desc())
            .limit(1)
        )
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def _equipment_scan_payload(db: Session, eq: Equipment) -> dict[str, Any]:
        contract = SiteService._active_contract_for_equipment(db, eq.equipment_id)
        active = (
            SiteService._active_assignment_for_contract(db, contract.contract_id)
            if contract
            else None
        )
        return {
            "equipmentId": eq.equipment_id,
            "equipmentName": eq.equipment_name,
            "equipmentType": eq.equipment_type,
            "qrCode": eq.qr_code,
            "rfidTag": eq.rfid_tag,
            "status": eq.status.value if eq.status else None,
            "contractId": contract.contract_id if contract else None,
            "rentalStatus": contract.rental_status.value if contract and contract.rental_status else None,
            "activeAssignmentId": active.assignment_id if active else None,
            "activeSiteId": active.site_id if active else None,
            "allowedActions": ["CHECK_OUT", "CHECK_IN"] if contract else [],
        }

    @staticmethod
    def _site_dict(s: ProjectSite) -> dict[str, Any]:
        return {
            "siteId": s.site_id,
            "companyId": s.company_id,
            "siteName": s.site_name,
            "location": s.location,
            "status": s.status.value if s.status else None,
        }

    @staticmethod
    def _assignment_dict(a: EquipmentAssignment) -> dict[str, Any]:
        eq = a.contract.equipment if a.contract else None
        return {
            "assignmentId": a.assignment_id,
            "contractId": a.contract_id,
            "siteId": a.site_id,
            "siteName": a.site.site_name if a.site else None,
            "equipmentId": eq.equipment_id if eq else None,
            "equipmentName": eq.equipment_name if eq else None,
            "equipmentType": eq.equipment_type if eq else None,
            "status": a.status.value if a.status else None,
            "checkoutTime": a.checkout_time.isoformat() if a.checkout_time else None,
            "checkinTime": a.checkin_time.isoformat() if a.checkin_time else None,
            "assignedBy": a.assigned_by,
            "checkedOutBy": a.checked_out_by,
        }
