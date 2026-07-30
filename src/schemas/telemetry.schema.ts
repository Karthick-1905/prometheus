import { z } from 'zod';

export const TelemetrySchema = z.object({
  timestamp: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: 'Invalid ISO datetime string' }
  ),
  equipmentId: z.string({
    required_error: 'equipmentId is required',
  }).min(1, 'equipmentId cannot be empty'),

  equipmentType: z.string({
    required_error: 'equipmentType is required',
  }).min(1, 'equipmentType cannot be empty'),

  dealerId: z.string({
    required_error: 'dealerId is required',
  }).min(1, 'dealerId cannot be empty'),

  siteId: z.string().nullable().optional(),
  operatorId: z.string().nullable().optional(),

  engineStatus: z.enum(['ON', 'OFF'], {
    errorMap: () => ({ message: "engineStatus must be 'ON' or 'OFF'" }),
  }),

  fuelLevel: z
    .number({ required_error: 'fuelLevel is required' })
    .min(0, 'fuelLevel must be between 0 and 100')
    .max(100, 'fuelLevel must be between 0 and 100'),

  engineHours: z
    .number({ required_error: 'engineHours is required' })
    .min(0, 'engineHours must be >= 0'),

  idleHours: z
    .number({ required_error: 'idleHours is required' })
    .min(0, 'idleHours must be >= 0'),

  speed: z
    .number({ required_error: 'speed is required' })
    .min(0, 'speed must be >= 0'),

  latitude: z
    .number({ required_error: 'latitude is required' })
    .min(-90, 'latitude must be between -90 and 90')
    .max(90, 'latitude must be between -90 and 90'),

  longitude: z
    .number({ required_error: 'longitude is required' })
    .min(-180, 'longitude must be between -180 and 180')
    .max(180, 'longitude must be between -180 and 180'),

  engineTemperature: z
    .number({ required_error: 'engineTemperature is required' })
    .min(0, 'engineTemperature must be between 0 and 120')
    .max(120, 'engineTemperature must be between 0 and 120'),

  hydraulicPressure: z
    .number({ required_error: 'hydraulicPressure is required' })
    .min(0, 'hydraulicPressure must be >= 0'),

  batteryVoltage: z
    .number({ required_error: 'batteryVoltage is required' })
    .gt(0, 'batteryVoltage must be > 0'),

  loadPercentage: z
    .number({ required_error: 'loadPercentage is required' })
    .min(0, 'loadPercentage must be between 0 and 100')
    .max(100, 'loadPercentage must be between 0 and 100'),

  vibrationLevel: z
    .number({ required_error: 'vibrationLevel is required' })
    .min(0, 'vibrationLevel must be >= 0'),

  rentalStatus: z.enum(['Available', 'Working', 'Idle', 'Maintenance', 'Returned'], {
    errorMap: () => ({
      message: "rentalStatus must be one of: 'Available', 'Working', 'Idle', 'Maintenance', 'Returned'",
    }),
  }),
});

export type ValidatedTelemetry = z.infer<typeof TelemetrySchema>;
