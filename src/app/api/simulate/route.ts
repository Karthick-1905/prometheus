import { NextRequest, NextResponse } from 'next/server';
import { IngestionService } from '@/services/ingestion.service';
import { AnomalyService } from '@/services/anomaly/anomaly.service';
import { TelemetrySchema } from '@/schemas/telemetry.schema';
import mqtt from 'mqtt';

/**
 * POST /api/simulate
 * Simulates a telemetry packet. Pushes to local MQTT broker if online,
 * and directly calls the IngestionService to process database updates and ML alerts.
 */
export async function POST(request: NextRequest) {
  try {
    const telemetry = await request.json();

    const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
    const topic = `telemetry/${telemetry.equipmentId || 'CAT-EX-1001'}`;

    let mqttPublished = false;
    let mqttError: string | null = null;

    try {
      const client = mqtt.connect(brokerUrl, {
        connectTimeout: 1000,
        reconnectPeriod: 0,
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          client.end(true);
          reject(new Error('MQTT connection/publish timeout'));
        }, 1200);

        client.on('connect', () => {
          client.publish(topic, JSON.stringify(telemetry), { qos: 1 }, (err) => {
            clearTimeout(timeout);
            client.end();
            if (err) reject(err);
            else resolve();
          });
        });

        client.on('error', (err) => {
          clearTimeout(timeout);
          client.end(true);
          reject(err);
        });
      });
      mqttPublished = true;
    } catch (err: any) {
      mqttError = err.message;
      console.warn('MQTT broker offline (falling back to direct ingestion service):', err.message);
    }

    // Direct invocation fallback so it runs database + hybrid anomaly pipeline immediately
    const ingestion = new IngestionService();
    const result = await ingestion.processRawPayload(topic, JSON.stringify(telemetry));

    // Force run detectAndRecord synchronously during simulator tests to ensure DB state has updated
    if (result.success) {
      const validationResult = TelemetrySchema.safeParse(telemetry);
      if (validationResult.success) {
        try {
          await AnomalyService.detectAndRecord(validationResult.data);
        } catch (anomalyErr: any) {
          console.error('Failed executing anomaly service in simulation:', anomalyErr.message);
        }
      }
    }

    return NextResponse.json({
      success: result.success,
      mqttPublished,
      mqttError,
      result
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
