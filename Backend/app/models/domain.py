"""
SQLAlchemy models mapped from prisma/schema.prisma (PostgreSQL / Neon).
Table names match Prisma @@map so existing Neon data keeps working.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import (
    AnomalySeverity,
    AnomalyType,
    AssignmentStatus,
    EquipmentStatus,
    ProjectSiteStatus,
    RentalContractStatus,
    UserRole,
)


class Dealer(Base):
    __tablename__ = "Dealer"

    dealer_id: Mapped[int] = mapped_column("dealer_id", Integer, primary_key=True, autoincrement=True)
    dealer_name: Mapped[Optional[str]] = mapped_column("dealer_name", String)
    email: Mapped[Optional[str]] = mapped_column(String)
    phone: Mapped[Optional[str]] = mapped_column(String)
    address: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column("created_at", DateTime(timezone=False), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column("updated_at", DateTime(timezone=False), server_default=func.now(), onupdate=func.now())

    equipments: Mapped[list["Equipment"]] = relationship(back_populates="dealer")
    rental_contracts: Mapped[list["RentalContract"]] = relationship(back_populates="dealer")


class Company(Base):
    __tablename__ = "Company"

    company_id: Mapped[int] = mapped_column("company_id", Integer, primary_key=True, autoincrement=True)
    company_name: Mapped[Optional[str]] = mapped_column("company_name", String)
    email: Mapped[Optional[str]] = mapped_column(String)
    phone: Mapped[Optional[str]] = mapped_column(String)
    address: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column("created_at", DateTime(timezone=False), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column("updated_at", DateTime(timezone=False), server_default=func.now(), onupdate=func.now())

    project_sites: Mapped[list["ProjectSite"]] = relationship(back_populates="company")
    rental_contracts: Mapped[list["RentalContract"]] = relationship(back_populates="company")
    users: Mapped[list["User"]] = relationship(back_populates="company")


class User(Base):
    __tablename__ = "User"

    user_id: Mapped[int] = mapped_column("user_id", Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column("company_id", ForeignKey("Company.company_id", ondelete="CASCADE"))
    name: Mapped[Optional[str]] = mapped_column(String)
    email: Mapped[Optional[str]] = mapped_column(String)
    password: Mapped[Optional[str]] = mapped_column(String)
    role: Mapped[Optional[UserRole]] = mapped_column(Enum(UserRole, name="UserRole", create_constraint=False))
    created_at: Mapped[datetime] = mapped_column("created_at", DateTime(timezone=False), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column("updated_at", DateTime(timezone=False), server_default=func.now(), onupdate=func.now())

    company: Mapped["Company"] = relationship(back_populates="users")
    assigned_assignments: Mapped[list["EquipmentAssignment"]] = relationship(
        back_populates="assigned_by_user",
        foreign_keys="EquipmentAssignment.assigned_by",
    )
    checked_out_assignments: Mapped[list["EquipmentAssignment"]] = relationship(
        back_populates="checked_out_by_user",
        foreign_keys="EquipmentAssignment.checked_out_by",
    )


class ProjectSite(Base):
    __tablename__ = "ProjectSite"

    site_id: Mapped[int] = mapped_column("site_id", Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column("company_id", ForeignKey("Company.company_id", ondelete="CASCADE"))
    site_name: Mapped[Optional[str]] = mapped_column("site_name", String)
    location: Mapped[Optional[str]] = mapped_column(String)
    status: Mapped[Optional[ProjectSiteStatus]] = mapped_column(
        Enum(ProjectSiteStatus, name="ProjectSiteStatus", create_constraint=False)
    )
    created_at: Mapped[datetime] = mapped_column("created_at", DateTime(timezone=False), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column("updated_at", DateTime(timezone=False), server_default=func.now(), onupdate=func.now())

    company: Mapped["Company"] = relationship(back_populates="project_sites")
    equipment_assignments: Mapped[list["EquipmentAssignment"]] = relationship(back_populates="site")


class Equipment(Base):
    __tablename__ = "Equipment"

    equipment_id: Mapped[int] = mapped_column("equipment_id", Integer, primary_key=True, autoincrement=True)
    dealer_id: Mapped[int] = mapped_column("dealer_id", ForeignKey("Dealer.dealer_id", ondelete="CASCADE"))
    equipment_name: Mapped[Optional[str]] = mapped_column("equipment_name", String)
    equipment_type: Mapped[Optional[str]] = mapped_column("equipment_type", String)
    model: Mapped[Optional[str]] = mapped_column(String)
    serial_number: Mapped[Optional[str]] = mapped_column("serial_number", String)
    qr_code: Mapped[Optional[str]] = mapped_column("qr_code", String)
    rfid_tag: Mapped[Optional[str]] = mapped_column("rfid_tag", String)
    status: Mapped[Optional[EquipmentStatus]] = mapped_column(
        Enum(EquipmentStatus, name="EquipmentStatus", create_constraint=False)
    )
    daily_rental_cost: Mapped[Optional[Decimal]] = mapped_column("daily_rental_cost", Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column("created_at", DateTime(timezone=False), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column("updated_at", DateTime(timezone=False), server_default=func.now(), onupdate=func.now())

    dealer: Mapped["Dealer"] = relationship(back_populates="equipments")
    telemetries: Mapped[list["EquipmentTelemetry"]] = relationship(back_populates="equipment")
    rental_contracts: Mapped[list["RentalContract"]] = relationship(back_populates="equipment")


class RentalContract(Base):
    __tablename__ = "RentalContract"

    contract_id: Mapped[int] = mapped_column("contract_id", Integer, primary_key=True, autoincrement=True)
    dealer_id: Mapped[int] = mapped_column("dealer_id", ForeignKey("Dealer.dealer_id", ondelete="CASCADE"))
    company_id: Mapped[int] = mapped_column("company_id", ForeignKey("Company.company_id", ondelete="CASCADE"))
    equipment_id: Mapped[int] = mapped_column("equipment_id", ForeignKey("Equipment.equipment_id", ondelete="CASCADE"))
    rental_start: Mapped[Optional[datetime]] = mapped_column("rental_start", DateTime(timezone=False))
    expected_return: Mapped[Optional[datetime]] = mapped_column("expected_return", DateTime(timezone=False))
    actual_return: Mapped[Optional[datetime]] = mapped_column("actual_return", DateTime(timezone=False))
    rental_status: Mapped[Optional[RentalContractStatus]] = mapped_column(
        "rental_status", Enum(RentalContractStatus, name="RentalContractStatus", create_constraint=False)
    )
    created_at: Mapped[datetime] = mapped_column("created_at", DateTime(timezone=False), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column("updated_at", DateTime(timezone=False), server_default=func.now(), onupdate=func.now())

    company: Mapped["Company"] = relationship(back_populates="rental_contracts")
    dealer: Mapped["Dealer"] = relationship(back_populates="rental_contracts")
    equipment: Mapped["Equipment"] = relationship(back_populates="rental_contracts")
    equipment_assignments: Mapped[list["EquipmentAssignment"]] = relationship(back_populates="contract")


class EquipmentAssignment(Base):
    __tablename__ = "EquipmentAssignment"

    assignment_id: Mapped[int] = mapped_column("assignment_id", Integer, primary_key=True, autoincrement=True)
    contract_id: Mapped[int] = mapped_column("contract_id", ForeignKey("RentalContract.contract_id", ondelete="CASCADE"))
    site_id: Mapped[int] = mapped_column("site_id", ForeignKey("ProjectSite.site_id", ondelete="CASCADE"))
    assigned_by: Mapped[int] = mapped_column("assigned_by", ForeignKey("User.user_id", ondelete="CASCADE"))
    checked_out_by: Mapped[int] = mapped_column("checked_out_by", ForeignKey("User.user_id", ondelete="CASCADE"))
    checkout_time: Mapped[Optional[datetime]] = mapped_column("checkout_time", DateTime(timezone=False))
    checkin_time: Mapped[Optional[datetime]] = mapped_column("checkin_time", DateTime(timezone=False))
    status: Mapped[Optional[AssignmentStatus]] = mapped_column(
        Enum(AssignmentStatus, name="AssignmentStatus", create_constraint=False)
    )
    created_at: Mapped[datetime] = mapped_column("created_at", DateTime(timezone=False), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column("updated_at", DateTime(timezone=False), server_default=func.now(), onupdate=func.now())

    assigned_by_user: Mapped["User"] = relationship(
        back_populates="assigned_assignments", foreign_keys=[assigned_by]
    )
    checked_out_by_user: Mapped["User"] = relationship(
        back_populates="checked_out_assignments", foreign_keys=[checked_out_by]
    )
    contract: Mapped["RentalContract"] = relationship(back_populates="equipment_assignments")
    site: Mapped["ProjectSite"] = relationship(back_populates="equipment_assignments")
    usage_logs: Mapped[list["UsageLog"]] = relationship(back_populates="assignment")


class UsageLog(Base):
    __tablename__ = "UsageLog"

    usage_id: Mapped[int] = mapped_column("usage_id", Integer, primary_key=True, autoincrement=True)
    assignment_id: Mapped[int] = mapped_column(
        "assignment_id", ForeignKey("EquipmentAssignment.assignment_id", ondelete="CASCADE")
    )
    runtime_hours: Mapped[Optional[Decimal]] = mapped_column("runtime_hours", Numeric(10, 2))
    idle_hours: Mapped[Optional[Decimal]] = mapped_column("idle_hours", Numeric(10, 2))
    fuel_consumed: Mapped[Optional[Decimal]] = mapped_column("fuel_consumed", Numeric(10, 2))
    latitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(9, 6))
    longitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(9, 6))
    recorded_at: Mapped[Optional[datetime]] = mapped_column("recorded_at", DateTime(timezone=False))

    assignment: Mapped["EquipmentAssignment"] = relationship(back_populates="usage_logs")


class EquipmentTelemetry(Base):
    __tablename__ = "EquipmentTelemetry"
    __table_args__ = (Index("ix_equipment_telemetry_eq_ts", "equipment_id", "timestamp"),)

    telemetry_id: Mapped[int] = mapped_column("telemetry_id", BigInteger, primary_key=True, autoincrement=True)
    equipment_id: Mapped[int] = mapped_column("equipment_id", ForeignKey("Equipment.equipment_id", ondelete="CASCADE"))
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=False))
    engine_status: Mapped[Optional[str]] = mapped_column("engine_status", String(10))
    fuel_level: Mapped[Optional[Decimal]] = mapped_column("fuel_level", Numeric(5, 2))
    engine_hours: Mapped[Optional[Decimal]] = mapped_column("engine_hours", Numeric(10, 2))
    idle_hours: Mapped[Optional[Decimal]] = mapped_column("idle_hours", Numeric(10, 2))
    speed: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))
    latitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(9, 6))
    longitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(9, 6))
    engine_temperature: Mapped[Optional[Decimal]] = mapped_column("engine_temperature", Numeric(5, 2))
    hydraulic_pressure: Mapped[Optional[Decimal]] = mapped_column("hydraulic_pressure", Numeric(7, 2))
    battery_voltage: Mapped[Optional[Decimal]] = mapped_column("battery_voltage", Numeric(5, 2))
    load_percentage: Mapped[Optional[Decimal]] = mapped_column("load_percentage", Numeric(5, 2))
    vibration_level: Mapped[Optional[Decimal]] = mapped_column("vibration_level", Numeric(5, 2))
    rental_status: Mapped[Optional[str]] = mapped_column("rental_status", String(20))
    created_at: Mapped[datetime] = mapped_column("created_at", DateTime(timezone=False), server_default=func.now())

    equipment: Mapped["Equipment"] = relationship(back_populates="telemetries")


class AnomalyAlert(Base):
    __tablename__ = "AnomalyAlert"
    __table_args__ = (
        Index("ix_anomaly_alert_eq_detected", "equipment_id", "detected_at"),
        Index("ix_anomaly_alert_resolved_detected", "is_resolved", "detected_at"),
    )

    alert_id: Mapped[int] = mapped_column("alert_id", Integer, primary_key=True, autoincrement=True)
    equipment_id: Mapped[str] = mapped_column("equipment_id", String)
    equipment_type: Mapped[Optional[str]] = mapped_column("equipment_type", String)
    site_id: Mapped[Optional[str]] = mapped_column("site_id", String)
    operator_id: Mapped[Optional[str]] = mapped_column("operator_id", String)
    anomaly_type: Mapped[AnomalyType] = mapped_column(
        "anomaly_type", Enum(AnomalyType, name="AnomalyType", create_constraint=False)
    )
    severity: Mapped[AnomalySeverity] = mapped_column(
        Enum(AnomalySeverity, name="AnomalySeverity", create_constraint=False)
    )
    description: Mapped[str] = mapped_column(Text)
    recommendation: Mapped[str] = mapped_column(Text)
    trigger_value: Mapped[Optional[str]] = mapped_column("trigger_value", String)
    threshold_value: Mapped[Optional[str]] = mapped_column("threshold_value", String)
    is_resolved: Mapped[bool] = mapped_column("is_resolved", Boolean, default=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column("resolved_at", DateTime(timezone=False))
    detected_at: Mapped[datetime] = mapped_column("detected_at", DateTime(timezone=False), server_default=func.now())
