# IoT Data Pipeline Simulator

This folder contains the scripts and files for generating and publishing Caterpillar machinery rental fleet telemetry data in real-time.

---

## 1. Data Generation

To generate the synthetic telemetry dataset representing 100 Caterpillar machines operating over a 90-day window with simulated events and 5% operational anomalies, run:

```bash
node scripts/generate_data.js
```

This will create `pipeline/telemetry.csv` containing approximately 2.6 million telemetry events.

---

## 2. Real-time MQTT Publishing

To publish the telemetry data line-by-line as structured JSON payloads to an MQTT broker, follow these steps:

### Install Dependency
Ensure the `mqtt` library is installed:
```bash
npm install mqtt
```

### Run Publisher
Execute the publisher script:
```bash
node pipeline/publish_telemetry.js
```

### Configuration Options
You can configure the publisher via environment variables:
* `MQTT_BROKER_URL`: Address of the broker. Defaults to HiveMQ public broker (`mqtt://broker.hivemq.com:1883`). Can be set to local Mosquitto instances like `mqtt://localhost:1883`.
* `PUBLISH_INTERVAL_MS`: Telemetry broadcast rate in milliseconds per row. Defaults to `100` (10 packets per second).

Example configuration:
```bash
$env:MQTT_BROKER_URL="mqtt://localhost:1883"
$env:PUBLISH_INTERVAL_MS="50"
node pipeline/publish_telemetry.js
```

---

## MQTT Payload Scheme
The published MQTT payload matches standard Caterpillar IoT telemetry structure:

```json
{
  "timestamp": "2026-05-02 00:00",
  "equipmentId": "CAT-EX-1001",
  "equipmentType": "Excavator",
  "dealerId": "CAT-DL-1001",
  "siteId": "S101",
  "operatorId": "OP1001",
  "gps": {
    "latitude": 13.0827,
    "longitude": 80.2707
  },
  "engine": {
    "status": "ON",
    "hours": 150.25,
    "idleHours": 30.12,
    "load": 65,
    "temperature": 84
  },
  "speed": 14,
  "fuel": {
    "level": 84.5,
    "consumed": 0.8
  },
  "diagnostics": {
    "hydraulicPressure": 152,
    "batteryVoltage": 13.8,
    "vibrationLevel": 3.8
  },
  "rentalStatus": "Working"
}
```
Topic hierarchy: `caterpillar/telemetry/{EquipmentType}/{EquipmentID}`
