const fs = require('fs');
const path = require('path');

console.log('Starting Caterpillar Rental Fleet Telemetry Generator...');

// Constants
const SIMULATION_DAYS = 90;
const EQUIPMENT_COUNT = 100; // Generate exactly 100 unique equipment
const SITE_COUNT = 25; // 25 sites
const DEALER_COUNT = 10; // 10 dealers
const OPERATOR_COUNT = 350; // 350 operators
const START_DATE = new Date('2026-05-02T00:00:00Z'); // Start date (90 days before July 30, 2026)

const OUTPUT_PATH = path.join(__dirname, '..', 'pipeline', 'telemetry.csv');

// Equipment Types
const EQUIPMENT_TYPES = [
  'Excavator',
  'Bulldozer',
  'Motor Grader',
  'Wheel Loader',
  'Backhoe Loader',
  'Skid Steer Loader',
  'Crane',
  'Asphalt Paver',
  'Compactor',
  'Dump Truck'
];

const TYPE_CODES = {
  'Excavator': 'EX',
  'Bulldozer': 'BD',
  'Motor Grader': 'MG',
  'Wheel Loader': 'WL',
  'Backhoe Loader': 'BL',
  'Skid Steer Loader': 'SL',
  'Crane': 'CR',
  'Asphalt Paver': 'AP',
  'Compactor': 'CO',
  'Dump Truck': 'DT'
};

// Cities and coordinates in India
const CITIES = [
  { city: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707 },
  { city: 'Bangalore', state: 'Karnataka', lat: 12.9716, lng: 77.5946 },
  { city: 'Hyderabad', state: 'Telangana', lat: 17.3850, lng: 78.4867 },
  { city: 'Coimbatore', state: 'Tamil Nadu', lat: 11.0168, lng: 76.9558 },
  { city: 'Mumbai', state: 'Maharashtra', lat: 19.0760, lng: 72.8777 },
  { city: 'Kochi', state: 'Kerala', lat: 9.9312, lng: 76.2673 },
  { city: 'Delhi', state: 'Delhi', lat: 28.6139, lng: 77.2090 },
  { city: 'Pune', state: 'Maharashtra', lat: 18.5204, lng: 73.8567 },
  { city: 'Kolkata', state: 'West Bengal', lat: 22.5726, lng: 88.3639 },
  { city: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lng: 72.5714 }
];

// Helper to get random item
const randItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randRange = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Generate reference collections
const dealers = [];
for (let i = 1; i <= DEALER_COUNT; i++) {
  const cityData = CITIES[i - 1];
  dealers.push({
    id: `CAT-DL-${1000 + i}`,
    name: `Authorized Dealer ${i} - ${cityData.city}`,
    city: cityData.city,
    state: cityData.state,
    lat: cityData.lat,
    lng: cityData.lng
  });
}

const sites = [];
const projectNames = [
  'Metro Rail Expansion', 'Peripheral Ring Road Bypass', 'Mega IT Tech Park',
  'Highway Corridor Leveling', 'Bridge Flyover Infrastructure', 'Container Port Terminal',
  'Industrial SEZ Site Development', 'Airport Runway Expansion', 'River Water Grid Project',
  'Smart City Sewage Construction'
];
for (let i = 1; i <= SITE_COUNT; i++) {
  const baseCity = CITIES[i % CITIES.length];
  // Create site boundary center
  sites.push({
    id: `S${String(100 + i)}`,
    name: `${baseCity.city} ${projectNames[i % projectNames.length]}`,
    city: baseCity.city,
    state: baseCity.state,
    lat: baseCity.lat + (Math.random() - 0.5) * 0.15,
    lng: baseCity.lng + (Math.random() - 0.5) * 0.15
  });
}

const operators = [];
const firstNames = ['Amit', 'Rajesh', 'Suresh', 'Vijay', 'Rahul', 'Karan', 'Sunil', 'Arun', 'Deepak', 'Sanjay', 'Manish', 'Karthik', 'Pranav', 'Ramesh', 'Harish', 'Anil', 'Vikram', 'Ajay'];
const lastNames = ['Kumar', 'Sharma', 'Singh', 'Patel', 'Reddy', 'Nair', 'Verma', 'Gupta', 'Rao', 'Joshi', 'Mehta', 'Subramanian'];
const shifts = ['Morning', 'Evening', 'Night'];

for (let i = 1; i <= OPERATOR_COUNT; i++) {
  const exp = randInt(2, 15);
  operators.push({
    id: `OP${1000 + i}`,
    name: `${randItem(firstNames)} ${randItem(lastNames)}`,
    license: `DL-IND-${2020 + (i % 6)}-${String(100000 + i)}`,
    experience: `${exp} Years`,
    shift: shifts[i % shifts.length] // Assign shift deterministically
  });
}

const equipment = [];
for (let i = 0; i < EQUIPMENT_COUNT; i++) {
  const type = EQUIPMENT_TYPES[i % EQUIPMENT_TYPES.length];
  const code = TYPE_CODES[type];
  const eqId = `CAT-${code}-${1001 + i}`;
  const dealer = dealers[i % dealers.length];
  
  equipment.push({
    id: eqId,
    type,
    dealerId: dealer.id,
    baseLat: dealer.lat,
    baseLng: dealer.lng,
    fuelCapacity: randInt(150, 400), // Fuel tank size in liters
    avgFuelConsumptionRate: randRange(12, 28) // Liters per working hour
  });
}

console.log(`Entities initialized: ${dealers.length} Dealers, ${sites.length} Sites, ${operators.length} Operators, ${equipment.length} Equipment.`);

// Pre-generate contracts for the 90 day simulation blocks
// We divide the 90 day window into 3 consecutive rental blocks
const contracts = [];
equipment.forEach(eq => {
  const eqContracts = [];
  
  // Block 1: Day 1 to Day 26
  if (Math.random() < 0.85) { // 85% chance of rental
    eqContracts.push({
      startDay: 1,
      endDay: 26,
      site: randItem(sites),
      operator: randItem(operators),
      customer: 'Infrastructure India Pvt Ltd'
    });
  }
  
  // Block 2: Day 30 to Day 56
  if (Math.random() < 0.85) {
    eqContracts.push({
      startDay: 30,
      endDay: 56,
      site: randItem(sites),
      operator: randItem(operators),
      customer: 'L&T Construction Heavy Division'
    });
  }

  // Block 3: Day 60 to Day 85
  if (Math.random() < 0.85) {
    // For expired rental anomaly simulation, some contracts extend past Day 85 to Day 92 (beyond simulation end Day 90)
    const extendsPast = Math.random() < 0.08; // 8% chance of expired contract anomaly
    eqContracts.push({
      startDay: 60,
      endDay: extendsPast ? 84 : 85,
      actualWorkEndDay: extendsPast ? 90 : 85, // Continues working post-expiry
      site: randItem(sites),
      operator: randItem(operators),
      customer: 'TATA Projects Ltd',
      isExpiredAnomaly: extendsPast
    });
  }

  contracts[eq.id] = eqContracts;
});

// Create Write Stream
if (!fs.existsSync(path.dirname(OUTPUT_PATH))) {
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
}
const writeStream = fs.createWriteStream(OUTPUT_PATH, 'utf-8');

// Write CSV Header
const CSV_HEADER_LINE = [
  'Timestamp',
  'EquipmentID',
  'EquipmentType',
  'DealerID',
  'SiteID',
  'OperatorID',
  'Latitude',
  'Longitude',
  'EngineStatus',
  'Speed',
  'EngineHours',
  'IdleHours',
  'FuelLevel',
  'FuelConsumed',
  'HydraulicPressure',
  'EngineTemperature',
  'BatteryVoltage',
  'VibrationLevel',
  'LoadPercentage',
  'RentalStatus'
].join(',');

writeStream.write(CSV_HEADER_LINE + '\n');

// Running states for each equipment
const eqStates = {};
equipment.forEach(eq => {
  eqStates[eq.id] = {
    engineHours: randRange(150.0, 1800.0),
    idleHours: randRange(30.0, 350.0),
    fuelLevel: randRange(60.0, 100.0),
    fuelConsumed: 0.0,
    lat: eq.baseLat,
    lng: eq.baseLng,
    temp: randRange(20, 28),
    battery: 12.6,
    maintenanceDaysLeft: 0,
    isExcessiveIdling: false,
    excessiveIdleStepCount: 0
  };
});

let totalRowsWritten = 0;
let anomalyCount = 0;

// Execute simulation Day by Day to keep memory profile low
async function runSimulation() {
  console.log(`Writing telemetry to: ${OUTPUT_PATH}`);
  
  for (let day = 0; day < SIMULATION_DAYS; day++) {
    let dayRows = [];
    
    // Simulate 288 intervals of 5 minutes in a day
    for (let step = 0; step < 288; step++) {
      const stepMinutes = step * 5;
      const currentStepTime = new Date(START_DATE.getTime() + day * 24 * 3600 * 1000 + stepMinutes * 60 * 1000);
      const timestampStr = currentStepTime.toISOString().replace('T', ' ').substring(0, 16);
      
      const hour = Math.floor(stepMinutes / 60);
      const minute = stepMinutes % 60;

      equipment.forEach(eq => {
        const state = eqStates[eq.id];
        
        // Find active contract for this day
        const activeContract = contracts[eq.id].find(c => {
          if (c.isExpiredAnomaly) {
            // Under expired rental anomaly, it works up to actualWorkEndDay
            return day >= c.startDay && day <= c.actualWorkEndDay;
          }
          return day >= c.startDay && day <= c.endDay;
        });

        // 1. Determine machine state
        let rentalStatus = 'Available';
        let siteId = 'NULL';
        let operatorId = 'NULL';
        let opShift = null;

        // Periodic maintenance trigger (2% chance each available day, lasts 2 days)
        if (!activeContract && state.maintenanceDaysLeft === 0 && Math.random() < 0.015) {
          state.maintenanceDaysLeft = 2;
        }

        if (state.maintenanceDaysLeft > 0) {
          rentalStatus = 'Maintenance';
          if (step === 287) {
            // Decrement maintenance days at the end of the day
            state.maintenanceDaysLeft--;
          }
        } else if (activeContract) {
          siteId = activeContract.site.id;
          operatorId = activeContract.operator.id;
          opShift = activeContract.operator.shift;
          rentalStatus = 'Assigned';
          
          if (activeContract.isExpiredAnomaly && day > activeContract.endDay) {
            rentalStatus = 'Overdue';
          }
        }

        // Determine if within shift working hours
        let isShiftHours = false;
        if (opShift === 'Morning') {
          // Morning: 08:00 to 16:00
          isShiftHours = hour >= 8 && hour < 16;
        } else if (opShift === 'Evening') {
          // Evening: 16:00 to 00:00 (midnight)
          isShiftHours = hour >= 16 && hour < 24;
        } else if (opShift === 'Night') {
          // Night: 00:00 to 08:00
          isShiftHours = hour >= 0 && hour < 8;
        }

        // Determine operational mode
        let mode = 'OFF'; // Engine status OFF
        if (rentalStatus === 'Maintenance') {
          mode = 'OFF';
        } else if (activeContract && isShiftHours) {
          // Inside shift: working, break, or idle
          // Determine lunch/dinner breaks (1 hour in middle of shift)
          let isBreakTime = false;
          if (opShift === 'Morning' && hour === 12) isBreakTime = true;
          if (opShift === 'Evening' && hour === 20) isBreakTime = true;
          if (opShift === 'Night' && hour === 4) isBreakTime = true;

          if (isBreakTime) {
            mode = 'OFF'; // Engine shutdown during breaks
          } else {
            // 85% normal working, 15% idling
            mode = Math.random() < 0.85 ? 'WORKING' : 'IDLE';
          }
        }

        // 2. Physics simulation calculations (5-minute step)
        let engineStatus = 'OFF';
        let speed = 0;
        let hydraulicPressure = 0;
        let vibration = 0;
        let load = 0;
        let fuelBurned = 0;

        // Base lat/lng is site center or dealer center
        const targetLat = activeContract ? activeContract.site.lat : eq.baseLat;
        const targetLng = activeContract ? activeContract.site.lng : eq.baseLng;

        if (mode === 'WORKING') {
          engineStatus = 'ON';
          rentalStatus = rentalStatus === 'Overdue' ? 'Overdue' : 'Working';
          speed = randInt(8, 26); // 8-26 km/h
          hydraulicPressure = randInt(130, 185); // bar
          vibration = randRange(2.5, 6.5); // mm/s
          load = randInt(55, 85); // %
          
          // Cool engine to operational bounds
          if (state.temp < 80) state.temp += randRange(1.5, 3.5);
          else state.temp = randRange(82, 94);

          // Update cumulative hours
          state.engineHours += 5 / 60; // +0.0833 hrs

          // Fuel consumption (Working)
          // Average fuel burned in 5 mins: (rate / 12) liters
          fuelBurned = (eq.avgFuelConsumptionRate / 12) * randRange(0.85, 1.15);
          state.fuelLevel -= (fuelBurned / eq.fuelCapacity) * 100;
          state.fuelConsumed += fuelBurned;

          // Battery charging
          state.battery = randRange(13.6, 14.1);

          // Lat/lng drift (machine moves within site boundaries)
          state.lat += (Math.random() - 0.5) * 0.0004;
          state.lng += (Math.random() - 0.5) * 0.0004;

        } else if (mode === 'IDLE') {
          engineStatus = 'ON';
          rentalStatus = rentalStatus === 'Overdue' ? 'Overdue' : 'Idle';
          speed = 0;
          hydraulicPressure = randInt(25, 45); // bar
          vibration = randRange(1.0, 2.0); // mm/s
          load = randInt(10, 18); // %

          if (state.temp < 70) state.temp += randRange(1.0, 2.5);
          else state.temp = randRange(70, 76);

          state.engineHours += 5 / 60;
          state.idleHours += 5 / 60;

          // Fuel consumption (Idling is 12% of working consumption)
          fuelBurned = (eq.avgFuelConsumptionRate * 0.12 / 12) * randRange(0.9, 1.1);
          state.fuelLevel -= (fuelBurned / eq.fuelCapacity) * 100;
          state.fuelConsumed += fuelBurned;
          state.battery = randRange(13.2, 13.7);

          // Minimal coordinate drift (GPS noise only)
          state.lat += (Math.random() - 0.5) * 0.00003;
          state.lng += (Math.random() - 0.5) * 0.00003;

        } else {
          // OFF (night shutdown, breaks, maintenance, available)
          engineStatus = 'OFF';
          speed = 0;
          hydraulicPressure = 0;
          vibration = 0;
          load = 0;
          
          // Cool down to ambient
          if (state.temp > 30) state.temp -= randRange(1.0, 2.5);
          else state.temp = randRange(22, 28);

          state.battery = randRange(12.3, 12.6);

          // Snap slowly back to target coordinates (site center or dealer yard)
          state.lat = state.lat * 0.95 + targetLat * 0.05;
          state.lng = state.lng * 0.95 + targetLng * 0.05;
        }

        // Automatic refueling trigger
        if (state.fuelLevel < 12) {
          state.fuelLevel = 100.0; // Refueled!
        }

        // Ensure variables stay inside realistic limits
        state.fuelLevel = Math.max(0.0, Math.min(100.0, state.fuelLevel));
        state.engineHours = Math.round(state.engineHours * 100) / 100;
        state.idleHours = Math.round(state.idleHours * 100) / 100;
        state.fuelConsumed = Math.round(state.fuelConsumed * 10) / 10;

        // 3. Inject Anomalies (~5% chance on active working engines)
        let isAnomalyRow = false;
        let anomalyOperatorId = operatorId;
        let anomalyFuelLevel = state.fuelLevel;
        let anomalyLat = state.lat;
        let anomalyLng = state.lng;
        let anomalyTemp = state.temp;
        let anomalyVibration = vibration;
        let anomalyLoad = load;
        let anomalyStatus = rentalStatus;

        if (Math.random() < 0.05) { // exactly 5% overall anomaly rate
          isAnomalyRow = true;
          anomalyCount++;
          
          const anomalyType = randInt(1, 10);
          switch(anomalyType) {
            case 1: // Unassigned Operator Anomaly
              engineStatus = 'ON';
              anomalyOperatorId = 'NULL';
              break;
            case 2: // Fuel Leak / Fuel Theft Anomaly
              anomalyFuelLevel = Math.max(0.0, state.fuelLevel - randRange(12.0, 20.0));
              break;
            case 3: // Geofence Violation Anomaly
              anomalyLat += (Math.random() > 0.5 ? 1 : -1) * randRange(0.2, 0.4);
              anomalyLng += (Math.random() > 0.5 ? 1 : -1) * randRange(0.2, 0.4);
              break;
            case 4: // High Engine Temperature Overheat
              engineStatus = 'ON';
              anomalyTemp = randRange(106.0, 118.0);
              break;
            case 5: // Excessive Idle Hours spike
              engineStatus = 'ON';
              state.idleHours += 1.5;
              anomalyStatus = 'Idle';
              break;
            case 6: // Severe Vibration Anomaly
              engineStatus = 'ON';
              anomalyVibration = randRange(16.0, 26.5);
              anomalyLoad = randInt(90, 100);
              break;
            case 7: // Expired Rental Anomaly
              engineStatus = 'ON';
              anomalyStatus = 'Overdue';
              break;
            case 8: // Missing GPS Coordinates
              anomalyLat = 'NULL';
              anomalyLng = 'NULL';
              break;
            case 9: // Low Battery Voltage Anomaly
              state.battery = randRange(9.2, 10.8);
              break;
            case 10: // Severe engine hours jump (tampering)
              state.engineHours += 10.0;
              break;
          }
        }

        // Format CSV row
        const row = [
          timestampStr,
          eq.id,
          eq.type,
          eq.dealerId,
          siteId,
          anomalyOperatorId,
          anomalyLat === 'NULL' ? '' : (typeof anomalyLat === 'number' ? anomalyLat.toFixed(5) : anomalyLat),
          anomalyLng === 'NULL' ? '' : (typeof anomalyLng === 'number' ? anomalyLng.toFixed(5) : anomalyLng),
          engineStatus,
          speed,
          state.engineHours.toFixed(2),
          state.idleHours.toFixed(2),
          anomalyFuelLevel.toFixed(1),
          state.fuelConsumed.toFixed(1),
          hydraulicPressure,
          Math.round(anomalyTemp),
          state.battery.toFixed(1),
          anomalyVibration.toFixed(2),
          anomalyLoad,
          anomalyStatus
        ].join(',');

        dayRows.push(row);

        // Duplicate Packet Anomaly (1% chance when anomaly is triggered)
        if (isAnomalyRow && Math.random() < 0.15) {
          dayRows.push(row);
          totalRowsWritten++;
        }
        
        totalRowsWritten++;
      });
    }

    // Write day chunk to CSV
    writeStream.write(dayRows.join('\n') + '\n');

    // Report Progress
    if ((day + 1) % 10 === 0) {
      console.log(`Simulation Day ${day + 1}/${SIMULATION_DAYS} completed. Logs written: ${totalRowsWritten.toLocaleString()}`);
    }
  }

  writeStream.end();
  console.log('--- Telemetry Generation Complete ---');
  console.log(`File: ${OUTPUT_PATH}`);
  console.log(`Total Rows Generated: ${totalRowsWritten.toLocaleString()}`);
  console.log(`Anomalous Records Injected: ${anomalyCount.toLocaleString()} (~${((anomalyCount / totalRowsWritten) * 100).toFixed(2)}%)`);
}

runSimulation();
