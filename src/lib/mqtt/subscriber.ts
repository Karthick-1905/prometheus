import { MqttClient } from 'mqtt';
import { getMqttClient } from './client';
import { logger } from '../logger';

export type TelemetryMessageHandler = (topic: string, rawPayload: string) => Promise<void>;

export class MqttSubscriber {
  private client: MqttClient;
  private topicPattern: string;
  private messageHandler: TelemetryMessageHandler | null = null;

  constructor(topicPattern: string = process.env.MQTT_TOPIC || 'telemetry/#') {
    this.client = getMqttClient();
    this.topicPattern = topicPattern;
  }

  /**
   * Registers a message processor and subscribes to configured MQTT topic(s).
   */
  public subscribe(handler: TelemetryMessageHandler): void {
    this.messageHandler = handler;

    // Ensure topic subscription occurs once connected or re-connected
    if (this.client.connected) {
      this.executeSubscription();
    }

    this.client.on('connect', () => {
      logger.info({ topic: this.topicPattern }, 'Re-establishing MQTT subscriptions after connection...');
      this.executeSubscription();
    });

    this.client.on('message', async (topic: string, payload: Buffer) => {
      await this.handleIncomingMessage(topic, payload);
    });
  }

  private executeSubscription(): void {
    this.client.subscribe(this.topicPattern, { qos: 1 }, (err) => {
      if (err) {
        logger.error({ err: err.message, topic: this.topicPattern }, 'Failed to subscribe to MQTT topic');
      } else {
        logger.info({ topic: this.topicPattern }, 'Successfully subscribed to MQTT topic pattern');
      }
    });
  }

  /**
   * Validates incoming topic prefix and passes raw string payload to registered handler.
   */
  private async handleIncomingMessage(topic: string, payloadBuffer: Buffer): Promise<void> {
    const rawPayload = payloadBuffer.toString('utf-8');

    logger.debug({ topic, length: rawPayload.length }, 'Received MQTT payload message');

    // Edge case check: Unknown topic filter
    if (!topic.startsWith('telemetry/')) {
      logger.warn({ topic }, 'Ignored message from unknown or unhandled topic pattern');
      return;
    }

    if (!this.messageHandler) {
      logger.error('No telemetry message handler registered to process received payload');
      return;
    }

    try {
      await this.messageHandler(topic, rawPayload);
    } catch (err: any) {
      logger.error(
        { err: err.message || err, topic },
        'Unhandled exception while processing incoming telemetry message'
      );
    }
  }

  /**
   * Unsubscribes from the current topic pattern.
   */
  public unsubscribe(): Promise<void> {
    return new Promise((resolve) => {
      this.client.unsubscribe(this.topicPattern, (err) => {
        if (err) {
          logger.error({ err: err.message, topic: this.topicPattern }, 'Error unsubscribing from topic');
        } else {
          logger.info({ topic: this.topicPattern }, 'Unsubscribed from MQTT topic');
        }
        resolve();
      });
    });
  }
}
