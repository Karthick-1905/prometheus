#!/usr/bin/env python3
"""
Python Equipment Simulator (Module 1)
Publishes realistic equipment telemetry JSON payloads to Mosquitto MQTT Broker using Paho-MQTT.
"""

import json
import time
import datetime
import random
import os
import sys

try:
    import paho.mqtt.client as mqtt
except ImportError:
    print("[ERROR] paho-mqtt package is not installed. Please install via: pip install paho-mqtt")
    sys.exit(1)

BROKER_HOST = os.getenv("MQTT_BROKER_HOST", "localhost")
BROKER_PORT = int(os.getenv("MQTT_BROKER_PORT", 1883))
TOPIC_PREFIX = "telemetry"

EQUIPMENT_LIST = [
    {
        "equipmentId": "CAT-EX-1001",
        "equipmentType": "Excavator",
        "dealerId": "D001",
        "siteId": "S003",
        "operatorId": "OP101",
        "rentalStatus": "Working",
        "latitude": 11.02453,
        "longitude": 76.93531,
        "engineHours": 452.4,
        "idleHours": 0.2,
        "fuelLevel": 91.8,
    }
]

def generate_telemetry(asset):
    """Generates realistic flat telemetry payload for an equipment asset."""
    is_working = asset["rentalStatus"] == "Working"
    engine_on = "ON" if is_working else "OFF"
    
    payload = {
        "timestamp": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "equipmentId": asset["equipmentId"],
        "equipmentType": asset["equipmentType"],
        "dealerId": asset["dealerId"],
        "siteId": asset["siteId"],
        "operatorId": asset["operatorId"],
        "engineStatus": engine_on,
        "fuelLevel": asset["fuelLevel"],
        "engineHours": asset["engineHours"],
        "idleHours": asset["idleHours"],
        "speed": 14 if engine_on == "ON" else 0,
        "latitude": asset["latitude"],
        "longitude": asset["longitude"],
        "engineTemperature": 83,
        "hydraulicPressure": 208,
        "batteryVoltage": 24.7,
        "loadPercentage": 74,
        "vibrationLevel": 2.1,
        "rentalStatus": asset["rentalStatus"],
    }
    return payload

def main():
    client = mqtt.Client(client_id=f"python_sim_{int(time.time())}")
    
    print(f"Connecting to Mosquitto MQTT Broker at {BROKER_HOST}:{BROKER_PORT}...")
    try:
        client.connect(BROKER_HOST, BROKER_PORT, 60)
    except Exception as e:
        print(f"❌ Connection error: {e}")
        sys.exit(1)
        
    client.loop_start()

    print("🚀 Python Equipment Simulator Started. Publishing single telemetry packet...")
    asset = EQUIPMENT_LIST[0]
    telemetry = generate_telemetry(asset)
    topic = f"{TOPIC_PREFIX}/{asset['equipmentId']}"
    payload_json = json.dumps(telemetry, indent=2)
    
    print(f"Payload to publish:\n{payload_json}")
    info = client.publish(topic, json.dumps(telemetry), qos=1)
    info.wait_for_publish()
    print(f"✓ Published successfully to topic '{topic}' with QoS 1")

    client.loop_stop()
    client.disconnect()

if __name__ == "__main__":
    main()
