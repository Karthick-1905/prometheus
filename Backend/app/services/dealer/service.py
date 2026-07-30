"""Dealer admin: inventory and rental contracts."""
from __future__ import annotations

import secrets
from datetime import datetime
from decimal import Decimal
from typing import Any, Optional

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.domain import Company, Dealer, Equipment, RentalContract
from app.models.enums import EquipmentStatus, RentalContractStatus


class DealerService:
    @staticmethod
    def me(db: Session, dealer_id: int) -> dict[str, Any]:
        dealer = db.get(Dealer, dealer_id)
        if not dealer:
            raise HTTPException(status_code=404, detail="Dealer not found")
        return {
            "dealerId": dealer.dealer_id,
            "dealerName": dealer.dealer_name,
            "email": dealer.email,
            "phone": dealer.phone,
            "address": dealer.address,
        }

    @staticmethod
    def summary(db: Session, dealer_id: int) -> dict[str, Any]:
        dealer = db.get(Dealer, dealer_id)
        if not dealer:
            raise HTTPException(status_code=404, detail="Dealer not found")

        eq_counts = db.execute(
            select(Equipment.status, func.count())
            .where(Equipment.dealer_id == dealer_id)
            .group_by(Equipment.status)
        ).all()
        by_status = {
            (s.value if hasattr(s, "value") else str(s or "UNKNOWN")): c for s, c in eq_counts
        }
        total_eq = sum(by_status.values())

        contract_counts = db.execute(
            select(RentalContract.rental_status, func.count())
            .where(RentalContract.dealer_id == dealer_id)
            .group_by(RentalContract.rental_status)
        ).all()
        by_contract = {
            (s.value if hasattr(s, "value") else str(s or "UNKNOWN")): c
            for s, c in contract_counts
        }

        return {
            "dealerId": dealer_id,
            "totals": {
                "equipment": total_eq,
                "available": by_status.get("AVAILABLE", 0),
                "rented": by_status.get("RENTED", 0),
                "maintenance": by_status.get("MAINTENANCE", 0),
                "activeContracts": by_contract.get("ACTIVE", 0),
                "overdueContracts": by_contract.get("OVERDUE", 0),
                "completedContracts": by_contract.get("COMPLETED", 0),
            },
            "equipmentByStatus": by_status,
            "contractsByStatus": by_contract,
        }

    @staticmethod
    def list_equipment(
        db: Session,
        *,
        dealer_id: int,
        status: Optional[str] = None,
        equipment_type: Optional[str] = None,
        q: Optional[str] = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        stmt = (
            select(Equipment)
            .where(Equipment.dealer_id == dealer_id)
            .order_by(Equipment.equipment_id)
            .limit(limit)
        )
        if status:
            try:
                stmt = stmt.where(Equipment.status == EquipmentStatus(status))
            except ValueError as exc:
                raise HTTPException(status_code=422, detail=f"Invalid status: {status}") from exc
        if equipment_type:
            stmt = stmt.where(Equipment.equipment_type == equipment_type)
        rows = db.execute(stmt).scalars().all()
        out = []
        for eq in rows:
            if q:
                blob = " ".join(
                    str(x or "")
                    for x in (eq.equipment_name, eq.equipment_type, eq.serial_number, eq.qr_code)
                ).lower()
                if q.lower() not in blob:
                    continue
            out.append(DealerService._equipment_dict(eq))
        return out

    @staticmethod
    def get_equipment(db: Session, equipment_id: int, *, dealer_id: int) -> dict[str, Any]:
        eq = db.get(Equipment, equipment_id)
        if not eq or eq.dealer_id != dealer_id:
            raise HTTPException(status_code=404, detail="Equipment not found")
        return DealerService._equipment_dict(eq)

    @staticmethod
    def create_equipment(
        db: Session,
        *,
        dealer_id: int,
        equipment_name: str,
        equipment_type: str,
        model: Optional[str] = None,
        serial_number: Optional[str] = None,
        daily_rental_cost: Optional[float] = None,
        status: str = "AVAILABLE",
    ) -> dict[str, Any]:
        if not db.get(Dealer, dealer_id):
            raise HTTPException(status_code=404, detail="Dealer not found")
        try:
            st = EquipmentStatus(status)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=f"Invalid status: {status}") from exc
        eq = Equipment(
            dealer_id=dealer_id,
            equipment_name=equipment_name,
            equipment_type=equipment_type,
            model=model,
            serial_number=serial_number,
            daily_rental_cost=Decimal(str(daily_rental_cost)) if daily_rental_cost is not None else None,
            status=st,
            qr_code=f"QR-{secrets.token_hex(4).upper()}",
            rfid_tag=f"RFID-{secrets.token_hex(4).upper()}",
        )
        db.add(eq)
        db.commit()
        db.refresh(eq)
        return DealerService._equipment_dict(eq)

    @staticmethod
    def update_equipment(
        db: Session,
        equipment_id: int,
        *,
        dealer_id: int,
        **fields: Any,
    ) -> dict[str, Any]:
        eq = db.get(Equipment, equipment_id)
        if not eq or eq.dealer_id != dealer_id:
            raise HTTPException(status_code=404, detail="Equipment not found")
        if "equipment_name" in fields and fields["equipment_name"] is not None:
            eq.equipment_name = fields["equipment_name"]
        if "equipment_type" in fields and fields["equipment_type"] is not None:
            eq.equipment_type = fields["equipment_type"]
        if "model" in fields:
            eq.model = fields["model"]
        if "serial_number" in fields:
            eq.serial_number = fields["serial_number"]
        if "daily_rental_cost" in fields and fields["daily_rental_cost"] is not None:
            eq.daily_rental_cost = Decimal(str(fields["daily_rental_cost"]))
        if "status" in fields and fields["status"] is not None:
            try:
                eq.status = EquipmentStatus(fields["status"])
            except ValueError as exc:
                raise HTTPException(status_code=422, detail=f"Invalid status: {fields['status']}") from exc
        db.commit()
        db.refresh(eq)
        return DealerService._equipment_dict(eq)

    @staticmethod
    def rotate_qr(db: Session, equipment_id: int, *, dealer_id: int) -> dict[str, Any]:
        eq = db.get(Equipment, equipment_id)
        if not eq or eq.dealer_id != dealer_id:
            raise HTTPException(status_code=404, detail="Equipment not found")
        eq.qr_code = f"QR-{secrets.token_hex(4).upper()}"
        eq.rfid_tag = eq.rfid_tag or f"RFID-{secrets.token_hex(4).upper()}"
        db.commit()
        db.refresh(eq)
        return {
            "equipmentId": eq.equipment_id,
            "qrCode": eq.qr_code,
            "rfidTag": eq.rfid_tag,
        }

    @staticmethod
    def list_contracts(
        db: Session,
        *,
        dealer_id: int,
        rental_status: Optional[str] = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        stmt = (
            select(RentalContract)
            .where(RentalContract.dealer_id == dealer_id)
            .options(
                joinedload(RentalContract.equipment),
                joinedload(RentalContract.company),
            )
            .order_by(RentalContract.contract_id.desc())
            .limit(limit)
        )
        if rental_status:
            try:
                stmt = stmt.where(RentalContract.rental_status == RentalContractStatus(rental_status))
            except ValueError as exc:
                raise HTTPException(status_code=422, detail=f"Invalid rentalStatus: {rental_status}") from exc
        rows = db.execute(stmt).unique().scalars().all()
        return [DealerService._contract_dict(c) for c in rows]

    @staticmethod
    def create_contract(
        db: Session,
        *,
        dealer_id: int,
        company_id: int,
        equipment_id: int,
        rental_start: datetime,
        expected_return: datetime,
    ) -> dict[str, Any]:
        if not db.get(Dealer, dealer_id):
            raise HTTPException(status_code=404, detail="Dealer not found")
        if not db.get(Company, company_id):
            raise HTTPException(status_code=404, detail="Company not found")
        eq = db.get(Equipment, equipment_id)
        if not eq or eq.dealer_id != dealer_id:
            raise HTTPException(status_code=404, detail="Equipment not found for dealer")
        if eq.status == EquipmentStatus.RENTED:
            raise HTTPException(status_code=409, detail="Equipment already rented")
        if eq.status == EquipmentStatus.MAINTENANCE:
            raise HTTPException(status_code=409, detail="Equipment in maintenance")

        contract = RentalContract(
            dealer_id=dealer_id,
            company_id=company_id,
            equipment_id=equipment_id,
            rental_start=rental_start,
            expected_return=expected_return,
            rental_status=RentalContractStatus.ACTIVE,
        )
        eq.status = EquipmentStatus.RENTED
        db.add(contract)
        db.commit()
        db.refresh(contract)
        contract = db.execute(
            select(RentalContract)
            .options(
                joinedload(RentalContract.equipment),
                joinedload(RentalContract.company),
            )
            .where(RentalContract.contract_id == contract.contract_id)
        ).unique().scalar_one()
        return DealerService._contract_dict(contract)

    @staticmethod
    def complete_contract(db: Session, contract_id: int, *, dealer_id: int) -> dict[str, Any]:
        contract = db.get(RentalContract, contract_id)
        if not contract or contract.dealer_id != dealer_id:
            raise HTTPException(status_code=404, detail="Contract not found")
        contract.rental_status = RentalContractStatus.COMPLETED
        contract.actual_return = datetime.utcnow()
        eq = db.get(Equipment, contract.equipment_id)
        if eq:
            eq.status = EquipmentStatus.AVAILABLE
        db.commit()
        db.refresh(contract)
        contract = db.execute(
            select(RentalContract)
            .options(
                joinedload(RentalContract.equipment),
                joinedload(RentalContract.company),
            )
            .where(RentalContract.contract_id == contract.contract_id)
        ).unique().scalar_one()
        return DealerService._contract_dict(contract)

    @staticmethod
    def _equipment_dict(eq: Equipment) -> dict[str, Any]:
        return {
            "equipmentId": eq.equipment_id,
            "dealerId": eq.dealer_id,
            "equipmentName": eq.equipment_name,
            "equipmentType": eq.equipment_type,
            "model": eq.model,
            "serialNumber": eq.serial_number,
            "qrCode": eq.qr_code,
            "rfidTag": eq.rfid_tag,
            "status": eq.status.value if eq.status else None,
            "dailyRentalCost": float(eq.daily_rental_cost) if eq.daily_rental_cost is not None else None,
        }

    @staticmethod
    def _contract_dict(c: RentalContract) -> dict[str, Any]:
        return {
            "contractId": c.contract_id,
            "dealerId": c.dealer_id,
            "companyId": c.company_id,
            "companyName": c.company.company_name if c.company else None,
            "equipmentId": c.equipment_id,
            "equipmentName": c.equipment.equipment_name if c.equipment else None,
            "equipmentType": c.equipment.equipment_type if c.equipment else None,
            "rentalStart": c.rental_start.isoformat() if c.rental_start else None,
            "expectedReturn": c.expected_return.isoformat() if c.expected_return else None,
            "actualReturn": c.actual_return.isoformat() if c.actual_return else None,
            "rentalStatus": c.rental_status.value if c.rental_status else None,
        }
