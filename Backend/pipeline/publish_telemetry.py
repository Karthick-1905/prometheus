#!/usr/bin/env python3
"""
publish_telemetry.py
--------------------
Caterpillar Telemetry MQTT Publisher Simulator in Python.
Reads telemetry.csv and publishes records in real-time.
"""

import os
import sys
import time
import json
import csv
from urllib.parse import urlparse
import paho.mqtt.client as mqtt

# Configurations
CSV_PATH = os.path.join(os.path.dirname(__file__), 'telemetry.csv')
BROKER_URL_RAW = os.getenv('MQTT_BROKER_URL', 'mqtt://broker.hivemq.com:1883')
PUBLISH_INTERVAL_MS = int(os.getenv('PUBLISH_INTERVAL_MS', '1000')) # default 1 sec
CLIENT_ID = f"cat_publisher_py_{int(time.time())}"
BASE_TOPIC = 'caterpillar/telemetry'

def parse_broker_url(url_str):
    """
    Parses a broker URL into host and port.
    Supports mqtt://, tcp://, and raw hosts.
    """
    url = urlparse(url_str)
    host = url.hostname or url_str
    if ':' in host:
        host, port_str = host.split(':', 1)
        port = int(port_str)
    else:
        port = url.port or 1883
    return host, port

def main():
    print('----------------------------------------------------')
    print('Caterpillar Telemetry MQTT Publisher Simulator (Python)')
    print(f'CSV File: {CSV_PATH}')
    
    host, port = parse_broker_url(BROKER_URL_RAW)
    print(f'MQTT Broker: {host}:{port}')
    print(f'Publish Interval: {PUBLISH_INTERVAL_MS}ms per row')
    print('----------------------------------------------------')

    if not os.path.exists(CSV_PATH):
        print(f"Error: CSV File not found at {CSV_PATH}", file=sys.stderr)
        sys.exit(1)

    # Load CSV data into memory
    queue = []
    try:
        with open(CSV_PATH, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Basic schema alignment and type casting for json serialization
                payload = {
                    "timestamp": row.get("timestamp"),
                    "equipmentId": row.get("equipmentId"),
                    "equipmentType": row.get("equipmentType", "Excavator"),
                    "dealerId": row.get("dealerId") or None,
                    "siteId": row.get("siteId") or None,
                    "operatorId": row.get("operatorId") or None,
                    "engineStatus": row.get("engineStatus", "ON"),
                    "fuelLevel": float(row.get("fuelLevel", 0)) if row.get("fuelLevel") else 0.0,
                    "engineHours": float(row.get("engineHours", 0)) if row.get("engineHours") else 0.0,
                    "idleHours": float(row.get("idleHours", 0)) if row.get("idleHours") else 0.0,
                    "speed": float(row.get("speed", 0)) if row.get("speed") else 0.0,
                    "latitude": float(row.get("latitude")) if row.get("latitude") else None,
                    "longitude": float(row.get("longitude")) if row.get("longitude") else None,
                    "engineTemperature": float(row.get("engineTemperature", 0)) if row.get("engineTemperature") else 0.0,
                    "hydraulicPressure": float(row.get("hydraulicPressure", 0)) if row.get("hydraulicPressure") else 0.0,
                    "batteryVoltage": float(row.get("batteryVoltage", 0)) if row.get("batteryVoltage") else 0.0,
                    "loadPercentage": float(row.get("loadPercentage", 0)) if row.get("loadPercentage") else 0.0,
                    "vibrationLevel": float(row.get("vibrationLevel", 0)) if row.get("vibrationLevel") else 0.0,
                    "rentalStatus": row.get("rentalStatus", "Working")
                }
                queue.append(payload)
    except Exception as e:
        print(f"Error reading CSV: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"Loaded {len(queue)} telemetry rows into transmission queue.")

    # Connect to broker
    client = mqtt.Client(client_id=CLIENT_ID, clean_session=True)
    
    connected = False
    def on_connect(c, userdata, flags, rc):
        nonlocal connected
        if rc == 0:
            print("✓ Successfully connected to MQTT Broker!")
            connected = True
        else:
            print(f"MQTT connection failed with code {rc}")

    client.on_connect = on_connect

    try:
        client.connect(host, port, keepalive=60)
        client.loop_start()
    except Exception as e:
        print(f"Could not connect to MQTT broker: {e}")
        print("Running in DRY-RUN mode...")
    
    print("Beginning transmission loop. Press Ctrl+C to terminate...")
    currentIndex = 0

    try:
        while True:
            if not queue:
                print("Queue is empty, exiting.")
                break

            payload = queue[currentIndex]
            topic = f"{BASE_TOPIC}/{payload['equipmentType']}/{payload['equipmentId']}"
            payload_str = json.dumps(payload)

            if connected:
                res = client.publish(topic, payload_str, qos=0)
                res.wait_for_publish()
                # Print progress
                if currentIndex % 5 == 0 or currentIndex == 0:
                    print(f"[MQTT] Published | Topic: {topic} | Speed: {payload['speed']} km/h | Temp: {payload['engineTemperature']}°C")
            else:
                # Dry run
                if currentIndex % 2 == 0 or currentIndex == 0:
                    print(f"[DRY-RUN] Packet #{currentIndex} | Topic: {topic}")
                    print(json.dumps(payload, indent=2))
                    print('------------------------------------------------')

            currentIndex = (currentIndex + 1) % len(queue)
            time.sleep(PUBLISH_INTERVAL_MS / 1000.0)

    except KeyboardInterrupt:
        print("\nPublisher terminated by user.")
    finally:
        client.loop_stop()
        client.disconnect()

if __name__ == '__main__':
    main()
