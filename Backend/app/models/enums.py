"""Domain enums (mirrors prisma/schema.prisma)."""
import enum


class UserRole(str, enum.Enum):
    FLEET_MANAGER = "FLEET_MANAGER"
    SITE_ENGINEER = "SITE_ENGINEER"


class ProjectSiteStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    ON_HOLD = "ON_HOLD"


class EquipmentStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    RENTED = "RENTED"
    MAINTENANCE = "MAINTENANCE"


class RentalContractStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    OVERDUE = "OVERDUE"


class AssignmentStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    RETURNED = "RETURNED"


class AnomalySeverity(str, enum.Enum):
    CRITICAL = "CRITICAL"
    WARNING = "WARNING"
    INFO = "INFO"


class AnomalyType(str, enum.Enum):
    UNASSIGNED_OPERATOR = "UNASSIGNED_OPERATOR"
    ENGINE_OVERHEAT = "ENGINE_OVERHEAT"
    SEVERE_VIBRATION = "SEVERE_VIBRATION"
    EXPIRED_RENTAL = "EXPIRED_RENTAL"
    MISSING_GPS = "MISSING_GPS"
    LOW_BATTERY = "LOW_BATTERY"
    ENGINE_HOURS_TAMPER = "ENGINE_HOURS_TAMPER"
    EXCESSIVE_IDLE = "EXCESSIVE_IDLE"
    FUEL_LEAK_THEFT = "FUEL_LEAK_THEFT"
    GEOFENCE_VIOLATION = "GEOFENCE_VIOLATION"
    STATISTICAL_OUTLIER = "STATISTICAL_OUTLIER"
