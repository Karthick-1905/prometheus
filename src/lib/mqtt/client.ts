import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import { logger } from '../logger';

const BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const CLIENT_ID = process.env.MQTT_CLIENT_ID || `ingestion_service_${Math.random().toString(16).substring(2, 8)}`;

const defaultOptions: IClientOptions = {
  clientId: CLIENT_ID,
  clean: true,
  connectTimeout: 5000,
  reconnectPeriod: 2000, // Attempt reconnection every 2s on disconnect
};

let clientInstance: MqttClient | null = null;

export function getMqttClient(customOptions?: Partial<IClientOptions>): MqttClient {
  if (clientInstance) {
    return clientInstance;
  }

  logger.info({ brokerUrl: BROKER_URL, clientId: CLIENT_ID }, 'Initializing MQTT client...');

  const options: IClientOptions = {
    ...defaultOptions,
    ...customOptions,
  };

  clientInstance = mqtt.connect(BROKER_URL, options);

  clientInstance.on('connect', () => {
    logger.info({ clientId: options.clientId }, 'Successfully connected to Mosquitto MQTT broker');
  });

  clientInstance.on('reconnect', () => {
    logger.warn('MQTT connection lost. Attempting auto-reconnect...');
  });

  clientInstance.on('offline', () => {
    logger.warn('MQTT client is currently offline');
  });

  clientInstance.on('error', (error: Error) => {
    logger.error({ err: error.message }, 'MQTT client encountered a connection error');
  });

  clientInstance.on('close', () => {
    logger.debug('MQTT client connection closed');
  });

  return clientInstance;
}

export async function disconnectMqttClient(): Promise<void> {
  if (!clientInstance) return;

  return new Promise((resolve) => {
    clientInstance?.end(false, () => {
      logger.info('MQTT client disconnected gracefully');
      clientInstance = null;
      resolve();
    });
  });
}
