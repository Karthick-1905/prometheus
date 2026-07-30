import dotenv from 'dotenv';
dotenv.config();

import { logger } from './lib/logger';
import { MqttSubscriber } from './lib/mqtt/subscriber';
import { IngestionService } from './services/ingestion.service';
import { disconnectMqttClient } from './lib/mqtt/client';
import { prisma } from './lib/prisma';

async function bootstrapIngestionService() {
  logger.info('=====================================================');
  logger.info('🚀 Starting Smart Asset Rental Data Ingestion Service');
  logger.info('=====================================================');

  const ingestionService = new IngestionService();
  const subscriber = new MqttSubscriber(process.env.MQTT_TOPIC || 'telemetry/#');

  subscriber.subscribe(async (topic: string, rawPayload: string) => {
    await ingestionService.processRawPayload(topic, rawPayload);
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal. Stopping MQTT Ingestion Service...');
    try {
      await subscriber.unsubscribe();
      await disconnectMqttClient();
      await prisma.$disconnect();
      logger.info('Ingestion Service shut down cleanly.');
      process.exit(0);
    } catch (err: any) {
      logger.error({ err: err.message }, 'Error during graceful shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error.message, stack: error.stack }, 'Uncaught Exception detected');
  });
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled Promise Rejection detected');
  });
}

bootstrapIngestionService();
