import mqtt from 'mqtt';

const BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const client = mqtt.connect(BROKER_URL);

const VALID_TELEMETRY = {
  timestamp: "2026-07-30T09:05:00Z",
  equipmentId: "CAT-EX-1001",
  equipmentType: "Excavator",
  dealerId: "D001",
  siteId: "S003",
  operatorId: "OP101",
  engineStatus: "ON",
  fuelLevel: 91.8,
  engineHours: 452.4,
  idleHours: 0.2,
  speed: 14,
  latitude: 11.02453,
  longitude: 76.93531,
  engineTemperature: 83,
  hydraulicPressure: 208,
  batteryVoltage: 24.7,
  loadPercentage: 74,
  vibrationLevel: 2.1,
  rentalStatus: "Working"
};

const EDGE_CASES = [
  {
    name: '1. Valid Telemetry Payload',
    topic: 'telemetry/CAT-EX-1001',
    payload: JSON.stringify(VALID_TELEMETRY),
  },
  {
    name: '2. Duplicate Packet (Same Equipment + Timestamp)',
    topic: 'telemetry/CAT-EX-1001',
    payload: JSON.stringify(VALID_TELEMETRY),
  },
  {
    name: '3. Invalid JSON String',
    topic: 'telemetry/CAT-EX-1001',
    payload: '{"timestamp": "2026-07-30T09:05:00Z", "equipmentId": "CAT-EX-1001", INVALID_JSON...}',
  },
  {
    name: '4. Missing Required Fields (missing dealerId)',
    topic: 'telemetry/CAT-EX-1001',
    payload: JSON.stringify({
      ...VALID_TELEMETRY,
      timestamp: "2026-07-30T09:10:00Z",
      dealerId: undefined,
    }),
  },
  {
    name: '5. Invalid GPS (Latitude > 90)',
    topic: 'telemetry/CAT-EX-1001',
    payload: JSON.stringify({
      ...VALID_TELEMETRY,
      timestamp: "2026-07-30T09:15:00Z",
      latitude: 195.123,
    }),
  },
  {
    name: '6. Impossible Fuel Level (Fuel > 100)',
    topic: 'telemetry/CAT-EX-1001',
    payload: JSON.stringify({
      ...VALID_TELEMETRY,
      timestamp: "2026-07-30T09:20:00Z",
      fuelLevel: 150.0,
    }),
  },
  {
    name: '7. Negative Runtime (engineHours < 0)',
    topic: 'telemetry/CAT-EX-1001',
    payload: JSON.stringify({
      ...VALID_TELEMETRY,
      timestamp: "2026-07-30T09:25:00Z",
      engineHours: -10.5,
    }),
  },
  {
    name: '8. Unknown Topic Route',
    topic: 'other/sensors/CAT-EX-1001',
    payload: JSON.stringify(VALID_TELEMETRY),
  },
];

client.on('connect', async () => {
  console.log('📡 Publisher Connected to Mosquitto MQTT Broker');
  console.log('--------------------------------------------------');

  for (const testCase of EDGE_CASES) {
    console.log(`📤 Publishing Test: ${testCase.name}`);
    client.publish(testCase.topic, testCase.payload, { qos: 1 });
    await new Promise((res) => setTimeout(res, 500));
  }

  console.log('--------------------------------------------------');
  console.log('✅ All test payloads published successfully.');
  client.end();
});

client.on('error', (err) => {
  console.error('❌ MQTT Publisher error:', err.message);
});
