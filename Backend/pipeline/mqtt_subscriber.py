#!/usr/bin/env python3
"""
mqtt_subscriber.py
------------------
MQTT Ingestion Worker in Python.
Subscribes to caterpillar/telemetry/#, parses payloads (flat or nested),
and invokes IngestionService to persist and run rules/anomaly detection.
"""

import os
import sys
import json
import traceback
from urllib.parse import urlparse
import paho.mqtt.client as mqtt

# Add Backend root directory to sys.path
backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_root)

from app.db.session import SessionLocal
from app.services.ingestion.service import IngestionService

# Configurations
BROKER_URL_RAW = os.getenv('MQTT_BROKER_URL', 'mqtt://broker.hivemq.com:1883')
MQTT_TOPIC = 'caterpillar/telemetry/#'
CLIENT_ID = f"cat_ingestor_py_{int(os.getpid())}"

def parse_broker_url(url_str):
    url = urlparse(url_str)
    host = url.hostname or url_str
    if ':' in host:
        host, port_str = host.split(':', 1)
        port = int(port_str)
    else:
        port = url.port or 1883
    return host, port

def flatten_telemetry(data: dict) -> dict:
    """
    Normalizes nested JS publisher telemetry format into a flat structure.
    If the payload is already flat, this function returns it safely.
    """
    flat = {**data}
    
    # Handle nested gps fields
    if "gps" in data and isinstance(data["gps"], dict):
        flat["latitude"] = data["gps"].get("latitude")
        flat["longitude"] = data["gps"].get("longitude")
        flat.pop("gps", None)
        
    # Handle nested engine fields
    if "engine" in data and isinstance(data["engine"], dict):
        flat["engineStatus"] = data["engine"].get("status")
        flat["engineHours"] = data["engine"].get("hours")
        flat["idleHours"] = data["engine"].get("idleHours")
        flat["loadPercentage"] = data["engine"].get("load")
        flat["engineTemperature"] = data["engine"].get("temperature")
        flat.pop("engine", None)
        
    # Handle nested fuel fields
    if "fuel" in data and isinstance(data["fuel"], dict):
        flat["fuelLevel"] = data["fuel"].get("level")
        flat.pop("fuel", None)
        
    # Handle nested diagnostics fields
    if "diagnostics" in data and isinstance(data["diagnostics"], dict):
        flat["hydraulicPressure"] = data["diagnostics"].get("hydraulicPressure")
        flat["batteryVoltage"] = data["diagnostics"].get("batteryVoltage")
        flat["vibrationLevel"] = data["diagnostics"].get("vibrationLevel")
        flat.pop("diagnostics", None)
        
    return flat

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✓ Connected to MQTT Broker successfully")
        print(f"Subscribing to: {MQTT_TOPIC}")
        client.subscribe(MQTT_TOPIC)
    else:
        print(f"Connection failed to MQTT Broker with code: {rc}")

def on_message(client, userdata, msg):
    try:
        payload_str = msg.payload.decode('utf-8')
        telemetry_raw = json.loads(payload_str)
    except Exception as e:
        print(f"[ERROR] Failed to parse JSON raw payload from topic {msg.topic}: {e}")
        return

    # Normalize fields (handles both nested or flat)
    telemetry_flat = flatten_telemetry(telemetry_raw)

    print(f"--- [MQTT Ingestion] Received from topic {msg.topic} ---")
    print(f"  Equipment ID: {telemetry_flat.get('equipmentId')}")
    print(f"  Type: {telemetry_flat.get('equipmentType')}")
    print(f"  Timestamp: {telemetry_flat.get('timestamp')}")

    # Process ingestion
    db = SessionLocal()
    try:
        result = IngestionService.process(db, telemetry_flat)
        print(f"  Persist execution result: {result}")
        if result.get("alertCount", 0) > 0:
            print(f"  [ALERT] {result['alertCount']} severe/outlier anomalies recorded!")
            for alert in result.get("alerts", []):
                print(f"    - {alert['anomalyType']} ({alert['severity']}): {alert['description']}")
    except Exception as e:
        print(f"  [ERROR] Ingestion failed: {e}", file=sys.stderr)
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

def main():
    host, port = parse_broker_url(BROKER_URL_RAW)
    print("=" * 60)
    print(" CAT Smart Rental - MQTT Python Ingestor Service")
    print("=" * 60)
    print(f"Broker: {host}:{port}")
    print(f"Topic:  {MQTT_TOPIC}")
    print("=" * 60)

    client = mqtt.Client(client_id=CLIENT_ID, clean_session=True)
    client.on_connect = on_connect
    client.on_message = on_message

    try:
        client.connect(host, port, keepalive=60)
    except Exception as e:
        print(f"Failed to connect to MQTT broker ({host}:{port}): {e}")
        sys.exit(1)

    print("Subscribing and entering events loop. Press Ctrl+C to terminate...")
    try:
        client.loop_forever()
    except KeyboardInterrupt:
        print("\nIngestor service terminated by user.")
    finally:
        client.disconnect()

if __name__ == '__main__':
    main()
