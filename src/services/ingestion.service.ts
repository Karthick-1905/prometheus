import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { TelemetrySchema } from '../schemas/telemetry.schema';
import { EquipmentRepository } from '../repositories/equipment.repository';
import { TelemetryRepository } from '../repositories/telemetry.repository';
import { RentalRepository } from '../repositories/rental.repository';
import { IngestionResult } from '../types/telemetry';

// Feature Flag: Set to false to enable duplicate packet detection in production
const SKIP_DUPLICATE_CHECK = true;

export class IngestionService {
  private equipmentRepo: EquipmentRepository;
  private telemetryRepo: TelemetryRepository;
  private rentalRepo: RentalRepository;

  constructor(
    equipmentRepo = new EquipmentRepository(),
    telemetryRepo = new TelemetryRepository(),
    rentalRepo = new RentalRepository()
  ) {
    this.equipmentRepo = equipmentRepo;
    this.telemetryRepo = telemetryRepo;
    this.rentalRepo = rentalRepo;

    if (SKIP_DUPLICATE_CHECK) {
      logger.warn('WARNING: Duplicate packet detection is temporarily disabled.');
    }
  }

  /**
   * Main entry point for processing incoming raw MQTT message payload.
   */
  public async processRawPayload(topic: string, rawPayload: string): Promise<IngestionResult> {
    logger.info({ topic }, 'Processing incoming MQTT telemetry payload...');

    // Step 1: Parse JSON Safely
    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(rawPayload);
    } catch (err: any) {
      logger.error({ err: err.message, rawPayload }, 'Edge Case Triggered: Invalid JSON payload string');
      return {
        success: false,
        error: 'Invalid JSON payload structure',
      };
    }

    // Step 2: Validate Payload using Zod Schema
    const validationResult = TelemetrySchema.safeParse(parsedPayload);
    if (!validationResult.success) {
      const formattedErrors = validationResult.error.format();
      logger.warn(
        { errors: formattedErrors, topic },
        'Edge Case Triggered: Payload failed Zod validation rules'
      );
      return {
        success: false,
        error: 'Payload validation failed',
        validationDetails: formattedErrors,
      };
    }

    const validatedData = validationResult.data;
    const packetDate = new Date(validatedData.timestamp);

    // TEMPORARY: Duplicate packet check disabled for end-to-end integration testing.
    // Restore before production deployment.
    if (!SKIP_DUPLICATE_CHECK) {
      try {
        const isDuplicate = await this.telemetryRepo.isDuplicatePacket(
          validatedData,
          packetDate
        );
        if (isDuplicate) {
          logger.warn(
            { equipmentId: validatedData.equipmentId, timestamp: validatedData.timestamp },
            'Edge Case Triggered: Duplicate telemetry packet received and skipped'
          );
          return {
            success: true,
            equipmentId: validatedData.equipmentId,
            error: 'Duplicate packet skipped',
          };
        }
      } catch (dbErr: any) {
        logger.error({ err: dbErr.message }, 'Edge Case Triggered: Database connection error during duplicate check');
        return {
          success: false,
          error: `Database unavailable: ${dbErr.message}`,
        };
      }
    }

    // Step 4: Execute Atomic Database Transaction (Telemetry insert + Equipment update + Rental update)
    try {
      await prisma.$transaction(async (tx: any) => {
        // 4a. Store in Telemetry table
        await this.telemetryRepo.createTelemetry(validatedData, tx);

        // 4b. Update Equipment table with latest state
        await this.equipmentRepo.upsertEquipment(validatedData, tx);

        // 4c. Synchronize Rental entity if siteId is specified
        await this.rentalRepo.syncRentalInfo(validatedData, tx);
      });

      logger.info(
        {
          equipmentId: validatedData.equipmentId,
          status: validatedData.rentalStatus,
          siteId: validatedData.siteId,
        },
        'Successfully ingested telemetry and synchronized state in database'
      );

      return {
        success: true,
        equipmentId: validatedData.equipmentId,
      };
    } catch (err: any) {
      logger.error(
        { err: err.message || err, equipmentId: validatedData.equipmentId },
        'Edge Case Triggered: Database transaction failed'
      );
      return {
        success: false,
        error: `Database write failure: ${err.message || err}`,
      };
    }
  }
}
