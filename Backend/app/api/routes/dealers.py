"""Dealer admin APIs — inventory + contracts."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.dealer import ContractCreate, EquipmentCreate, EquipmentUpdate
from app.security.dashboard_access import (
    DashboardPrincipal,
    get_dashboard_principal,
    require_dealer,
)
from app.services.dealer import DealerService

router = APIRouter(prefix="/api/v1/dealers", tags=["Dealer"])


def _principal(
    principal: DashboardPrincipal = Depends(get_dashboard_principal),
) -> DashboardPrincipal:
    require_dealer(principal)
    return principal


def _dealer_id(principal: DashboardPrincipal) -> int:
    if principal.dealer_id is None:
        raise HTTPException(status_code=400, detail="dealerId required for dealer routes")
    return principal.dealer_id


@router.get("/me")
def dealer_me(
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    return {"success": True, "data": DealerService.me(db, _dealer_id(principal))}


@router.get("/me/summary")
def dealer_summary(
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    return {"success": True, "data": DealerService.summary(db, _dealer_id(principal))}


@router.get("/equipment")
def list_equipment(
    status: Optional[str] = Query(None),
    equipmentType: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    rows = DealerService.list_equipment(
        db,
        dealer_id=_dealer_id(principal),
        status=status,
        equipment_type=equipmentType,
        q=q,
        limit=limit,
    )
    return {"success": True, "data": rows, "meta": {"total": len(rows)}}


@router.post("/equipment")
def create_equipment(
    body: EquipmentCreate,
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    row = DealerService.create_equipment(
        db,
        dealer_id=_dealer_id(principal),
        equipment_name=body.equipmentName,
        equipment_type=body.equipmentType,
        model=body.model,
        serial_number=body.serialNumber,
        daily_rental_cost=body.dailyRentalCost,
        status=body.status,
    )
    return {"success": True, "data": row}


@router.get("/equipment/{equipment_id}")
def get_equipment(
    equipment_id: int,
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    return {
        "success": True,
        "data": DealerService.get_equipment(db, equipment_id, dealer_id=_dealer_id(principal)),
    }


@router.patch("/equipment/{equipment_id}")
def update_equipment(
    equipment_id: int,
    body: EquipmentUpdate,
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    row = DealerService.update_equipment(
        db,
        equipment_id,
        dealer_id=_dealer_id(principal),
        equipment_name=body.equipmentName,
        equipment_type=body.equipmentType,
        model=body.model,
        serial_number=body.serialNumber,
        daily_rental_cost=body.dailyRentalCost,
        status=body.status,
    )
    return {"success": True, "data": row}


@router.post("/equipment/{equipment_id}/qr")
def rotate_qr(
    equipment_id: int,
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    return {
        "success": True,
        "data": DealerService.rotate_qr(db, equipment_id, dealer_id=_dealer_id(principal)),
    }


@router.get("/contracts")
def list_contracts(
    rentalStatus: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    rows = DealerService.list_contracts(
        db,
        dealer_id=_dealer_id(principal),
        rental_status=rentalStatus,
        limit=limit,
    )
    return {"success": True, "data": rows, "meta": {"total": len(rows)}}


@router.post("/contracts")
def create_contract(
    body: ContractCreate,
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    row = DealerService.create_contract(
        db,
        dealer_id=_dealer_id(principal),
        company_id=body.companyId,
        equipment_id=body.equipmentId,
        rental_start=body.rentalStart,
        expected_return=body.expectedReturn,
    )
    return {"success": True, "data": row}


@router.post("/contracts/{contract_id}/complete")
def complete_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    return {
        "success": True,
        "data": DealerService.complete_contract(
            db, contract_id, dealer_id=_dealer_id(principal)
        ),
    }
