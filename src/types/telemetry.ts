export type EngineStatus = 'ON' | 'OFF';

export type RentalStatusType = 'Available' | 'Working' | 'Idle' | 'Maintenance' | 'Returned';

export interface RawTelemetryPayload {
  timestamp: string;
  equipmentId: string;
  equipmentType: string;
  dealerId: string;
  siteId?: string | null;
  operatorId?: string | null;
  engineStatus: EngineStatus;
  fuelLevel: number;
  engineHours: number;
  idleHours: number;
  speed: number;
  latitude: number;
  longitude: number;
  engineTemperature: number;
  hydraulicPressure: number;
  batteryVoltage: number;
  loadPercentage: number;
  vibrationLevel: number;
  rentalStatus: RentalStatusType;
}

export interface IngestionResult {
  success: boolean;
  equipmentId?: string;
  error?: string;
  validationDetails?: any;
}
