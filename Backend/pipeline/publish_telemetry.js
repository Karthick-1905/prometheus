const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Import mqtt safely
let mqtt;
try {
  mqtt = require('mqtt');
} catch (e) {
  console.error('\n[WARNING] The "mqtt" package is not installed.');
  console.error('Please run "npm install mqtt" in your terminal to enable publishing.');
  console.error('Running in DRY-RUN mode (JSON payloads will be printed to console only).\n');
}

// Configurations
const CSV_PATH = path.join(__dirname, 'telemetry.csv');
const BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com:1883';
const CLIENT_ID = `cat_publisher_${Math.random().toString(16).substring(2, 8)}`;
const BASE_TOPIC = 'caterpillar/telemetry';

// Speed configuration: publish a row every X milliseconds
const PUBLISH_INTERVAL_MS = parseInt(process.env.PUBLISH_INTERVAL_MS) || 100; // 10 rows per second default

// CSV Columns index map (headers from CSV file)
const HEADERS = [
  'Timestamp', 'EquipmentID', 'EquipmentType', 'DealerID', 'SiteID', 'OperatorID',
  'Latitude', 'Longitude', 'EngineStatus', 'Speed', 'EngineHours', 'IdleHours',
  'FuelLevel', 'FuelConsumed', 'HydraulicPressure', 'EngineTemperature',
  'BatteryVoltage', 'VibrationLevel', 'LoadPercentage', 'RentalStatus'
];

console.log('----------------------------------------------------');
console.log('Caterpillar Telemetry MQTT Publisher Simulator');
console.log(`CSV File: ${CSV_PATH}`);
console.log(`MQTT Broker: ${mqtt ? BROKER_URL : 'None (Dry-run)'}`);
console.log(`Publish Interval: ${PUBLISH_INTERVAL_MS}ms per row`);
console.log('----------------------------------------------------');

// Connect to broker if mqtt is available
let client = null;
if (mqtt) {
  console.log('Connecting to MQTT Broker...');
  client = mqtt.connect(BROKER_URL, {
    clientId: CLIENT_ID,
    clean: true,
    connectTimeout: 5000,
    reconnectPeriod: 1000
  });

  client.on('connect', () => {
    console.log('✓ Successfully connected to MQTT Broker!');
    startPublishing();
  });

  client.on('error', (err) => {
    console.error('MQTT connection error:', err.message);
    console.log('Switching to DRY-RUN mode...');
    client = null;
    startPublishing();
  });
} else {
  // Start in dry-run mode immediately
  setTimeout(startPublishing, 1000);
}

function startPublishing() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`Error: CSV File not found at ${CSV_PATH}`);
    console.error('Please generate telemetry.csv first by running "node scripts/generate_data.js"');
    process.exit(1);
  }

  const fileStream = fs.createReadStream(CSV_PATH);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let isHeader = true;
  const queue = [];
  
  rl.on('line', (line) => {
    if (isHeader) {
      isHeader = false; // Skip CSV headers row
      return;
    }
    if (line.trim()) {
      queue.push(line);
    }
  });

  rl.on('close', () => {
    console.log(`Loaded ${queue.length.toLocaleString()} telemetry rows into transmission queue.`);
    console.log('Beginning transmission loop. Press Ctrl+C to terminate...');
    
    let currentIndex = 0;
    
    function sendNext() {
      if (currentIndex >= queue.length) {
        console.log('Reached the end of telemetry.csv. Restarting loop...');
        currentIndex = 0;
      }
      
      const line = queue[currentIndex];
      currentIndex++;
      
      // Parse CSV line
      const values = line.split(',');
      if (values.length < HEADERS.length) {
        // Skip malformed lines
        setTimeout(sendNext, 0);
        return;
      }
      
      // Map columns to structured JSON object
      const telemetryObj = {
        timestamp: values[0],
        equipmentId: values[1],
        equipmentType: values[2],
        dealerId: values[3],
        siteId: values[4] === 'NULL' ? null : values[4],
        operatorId: values[5] === 'NULL' ? null : values[5],
        gps: {
          latitude: values[6] ? parseFloat(values[6]) : null,
          longitude: values[7] ? parseFloat(values[7]) : null
        },
        engine: {
          status: values[8],
          hours: parseFloat(values[10]),
          idleHours: parseFloat(values[11]),
          load: parseInt(values[18]),
          temperature: parseInt(values[15])
        },
        speed: parseInt(values[9]),
        fuel: {
          level: parseFloat(values[12]),
          consumed: parseFloat(values[13])
        },
        diagnostics: {
          hydraulicPressure: parseInt(values[14]),
          batteryVoltage: parseFloat(values[16]),
          vibrationLevel: parseFloat(values[17])
        },
        rentalStatus: values[19]
      };
      
      const payloadString = JSON.stringify(telemetryObj);
      const topic = `${BASE_TOPIC}/${telemetryObj.equipmentType}/${telemetryObj.equipmentId}`;
      
      if (client && client.connected) {
        client.publish(topic, payloadString, { qos: 0 }, (err) => {
          if (err) {
            console.error('Failed to publish packet:', err);
          }
        });
        
        // Print progress every 100 rows to keep console output clean
        if (currentIndex % 100 === 0 || currentIndex === 1) {
          console.log(`[MQTT] Published ${currentIndex.toLocaleString()} rows. Current: ${topic} -> Speed: ${telemetryObj.speed} km/h, Temp: ${telemetryObj.engine.temperature}°C`);
        }
      } else {
        // Dry run console logger (limited to print every 50 steps to avoid scroll lock)
        if (currentIndex % 50 === 0 || currentIndex === 1) {
          console.log(`[DRY-RUN] Packet #${currentIndex} | Topic: ${topic}`);
          console.log(JSON.stringify(telemetryObj, null, 2));
          console.log('------------------------------------------------');
        }
      }
      
      setTimeout(sendNext, PUBLISH_INTERVAL_MS);
    }
    
    // Start loop
    sendNext();
  });
}
