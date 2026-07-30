/**
 * scripts/seed-rental-data.ts
 * ---------------------------
 * Generates 100 rental equipment records in the format matching the
 * sample dataset from docs/ps.txt, then seeds them into the Neon database
 * via Prisma. Also exports a feature-vector CSV for Isolation Forest training.
 *
 * Run:
 *   npx tsx scripts/seed-rental-data.ts
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// ─── Reference Data ──────────────────────────────────────────────────────────

const EQUIPMENT_TYPES = [
  'Excavator', 'Bulldozer', 'Crane', 'Grader',
  'Wheel Loader', 'Backhoe Loader', 'Compactor', 'Dump Truck',
  'Asphalt Paver', 'Skid Steer Loader',
];

const SITE_IDS = [
  'S001', 'S002', 'S003', 'S004', 'S005', 'S006',
  'S007', 'S008', 'S009', 'S010', null, null, // ~17% unassigned
];

const OPERATOR_IDS = [
  'OP101', 'OP102', 'OP103', 'OP106', 'OP114',
  'OP201', 'OP203', 'OP205', 'OP301', 'OP305',
  'OP401', 'OP402', null, null, // ~14% unassigned operators
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const rand = (min: number, max: number, decimals = 1): number =>
  parseFloat((Math.random() * (max - min) + min).toFixed(decimals));

const randInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const pick = <T>(arr: T[]): T =>
  arr[Math.floor(Math.random() * arr.length)];

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function fmtDate(d: Date): string {
  return d.toISOString().substring(0, 10);
}

// ─── Sample Dataset Record ────────────────────────────────────────────────────

interface RentalRecord {
  equipmentId: string;
  type: string;
  siteId: string | null;
  checkInDate: string;
  checkOutDate: string;
  engineHoursPerDay: number;
  idleHoursPerDay: number;
  rentalDays: number;
  lastOperatorId: string | null;
  // Derived — for anomaly labelling
  isAnomaly: boolean;
  anomalyReason: string;
}

// ─── Generate 100 Records ────────────────────────────────────────────────────

function generateDataset(): RentalRecord[] {
  const records: RentalRecord[] = [];
  const startPool = new Date('2025-01-01');

  // ── First 7 are the exact sample records from ps.txt ─────────────────────
  const seed7: Omit<RentalRecord, 'isAnomaly' | 'anomalyReason'>[] = [
    { equipmentId: 'EQX1001', type: 'Excavator',  siteId: 'S003', checkInDate: '2025-04-01', checkOutDate: '2025-04-16', engineHoursPerDay: 1.5, idleHoursPerDay: 10,  rentalDays: 15, lastOperatorId: 'OP101' },
    { equipmentId: 'EQX1002', type: 'Crane',      siteId: null,   checkInDate: '2025-03-10', checkOutDate: '2025-03-30', engineHoursPerDay: 0,   idleHoursPerDay: 11,  rentalDays: 20, lastOperatorId: null   },
    { equipmentId: 'EQX1003', type: 'Bulldozer',  siteId: 'S002', checkInDate: '2025-02-15', checkOutDate: '2025-03-11', engineHoursPerDay: 7.5, idleHoursPerDay: 0.5, rentalDays: 25, lastOperatorId: 'OP203' },
    { equipmentId: 'EQX1004', type: 'Excavator',  siteId: 'S004', checkInDate: '2025-05-05', checkOutDate: '2025-05-15', engineHoursPerDay: 2,   idleHoursPerDay: 9,   rentalDays: 10, lastOperatorId: 'OP106' },
    { equipmentId: 'EQX1005', type: 'Bulldozer',  siteId: 'S006', checkInDate: '2025-01-01', checkOutDate: '2025-01-31', engineHoursPerDay: 8,   idleHoursPerDay: 0,   rentalDays: 30, lastOperatorId: 'OP301' },
    { equipmentId: 'EQX1006', type: 'Grader',     siteId: 'S001', checkInDate: '2025-04-05', checkOutDate: '2025-04-23', engineHoursPerDay: 3,   idleHoursPerDay: 6,   rentalDays: 18, lastOperatorId: 'OP114' },
    { equipmentId: 'EQX1007', type: 'Excavator',  siteId: null,   checkInDate: '2025-03-20', checkOutDate: '2025-04-01', engineHoursPerDay: 0,   idleHoursPerDay: 12,  rentalDays: 12, lastOperatorId: null   },
  ];

  for (const r of seed7) {
    const isAnomaly = !r.siteId || !r.lastOperatorId || r.idleHoursPerDay > 9 || r.engineHoursPerDay === 0;
    records.push({
      ...r,
      isAnomaly,
      anomalyReason: !r.siteId
        ? 'Unassigned site'
        : !r.lastOperatorId
        ? 'No operator'
        : r.idleHoursPerDay > 9
        ? 'Excessive idle hours'
        : r.engineHoursPerDay === 0
        ? 'Zero engine hours (unused)'
        : '',
    });
  }

  // ── Generate remaining 93 records ────────────────────────────────────────
  for (let i = 8; i <= 100; i++) {
    const eqId = `EQX${1000 + i}`;
    const type = pick(EQUIPMENT_TYPES);
    const rentalDays = randInt(5, 45);
    const inDayOffset = randInt(0, 150); // days from Jan 1 2025
    const checkIn = addDays(startPool, inDayOffset);
    const checkOut = addDays(checkIn, rentalDays);

    // Inject ~18% anomalies in the synthetic batch
    const anomalyRoll = Math.random();
    let siteId = pick(SITE_IDS);
    let operatorId = pick(OPERATOR_IDS);
    let engineHrs = rand(2, 9);
    let idleHrs = rand(0.5, 4);
    let isAnomaly = false;
    let anomalyReason = '';

    if (anomalyRoll < 0.05) {
      // Unassigned site anomaly
      siteId = null;
      operatorId = null;
      engineHrs = 0;
      idleHrs = rand(10, 14);
      isAnomaly = true;
      anomalyReason = 'Unassigned site + no operator';
    } else if (anomalyRoll < 0.10) {
      // Excessive idle anomaly
      idleHrs = rand(9, 14);
      engineHrs = rand(0, 1.5);
      isAnomaly = true;
      anomalyReason = 'Excessive idle hours';
    } else if (anomalyRoll < 0.13) {
      // Fuel theft / abnormal pattern
      engineHrs = rand(1, 3);
      idleHrs = rand(0, 1);
      isAnomaly = true;
      anomalyReason = 'Low engine + low idle (suspected misuse or fuel theft pattern)';
    } else if (anomalyRoll < 0.17) {
      // No operator
      operatorId = null;
      isAnomaly = true;
      anomalyReason = 'Missing operator ID';
    } else {
      // Normal operation
      engineHrs = rand(4, 9);
      idleHrs = rand(0.5, 3);
    }

    records.push({
      equipmentId: eqId,
      type,
      siteId,
      checkInDate: fmtDate(checkIn),
      checkOutDate: fmtDate(checkOut),
      engineHoursPerDay: engineHrs,
      idleHoursPerDay: idleHrs,
      rentalDays,
      lastOperatorId: operatorId,
      isAnomaly,
      anomalyReason,
    });
  }

  return records;
}

// ─── Print Table ──────────────────────────────────────────────────────────────

function printTable(records: RentalRecord[]): void {
  const header = [
    'Equipment ID', 'Type', 'Site ID', 'Check-In', 'Check-Out',
    'Eng Hrs/Day', 'Idle Hrs/Day', 'Days', 'Operator ID', 'Anomaly', 'Reason',
  ].join('\t');

  console.log('\n' + '─'.repeat(130));
  console.log(header);
  console.log('─'.repeat(130));

  for (const r of records) {
    const row = [
      r.equipmentId,
      r.type.padEnd(18),
      (r.siteId ?? 'NULL').padEnd(6),
      r.checkInDate,
      r.checkOutDate,
      String(r.engineHoursPerDay).padEnd(11),
      String(r.idleHoursPerDay).padEnd(12),
      String(r.rentalDays).padEnd(5),
      (r.lastOperatorId ?? 'NULL').padEnd(10),
      r.isAnomaly ? '⚠ YES' : '✓ No ',
      r.anomalyReason,
    ].join('\t');
    console.log(row);
  }
  console.log('─'.repeat(130));

  const anomalyCount = records.filter((r) => r.isAnomaly).length;
  console.log(`\n📊 Total: ${records.length} records | Anomalies: ${anomalyCount} (${((anomalyCount / records.length) * 100).toFixed(1)}%)\n`);
}

// ─── Export CSV for Isolation Forest Training ─────────────────────────────────

function exportTrainingCSV(records: RentalRecord[]): string {
  const outPath = path.join(__dirname, '..', 'annomoly', 'training-data.csv');

  // Feature columns: engineHoursPerDay, idleHoursPerDay, rentalDays,
  //                  hasOperator (0/1), hasSite (0/1), idleRatio, isAnomaly
  const lines = [
    'equipmentId,type,engineHoursPerDay,idleHoursPerDay,rentalDays,hasOperator,hasSite,idleRatio,isAnomaly,anomalyReason',
  ];

  for (const r of records) {
    const idleRatio =
      r.engineHoursPerDay + r.idleHoursPerDay > 0
        ? (r.idleHoursPerDay / (r.engineHoursPerDay + r.idleHoursPerDay)).toFixed(4)
        : '1.0000';

    lines.push(
      [
        r.equipmentId,
        r.type,
        r.engineHoursPerDay,
        r.idleHoursPerDay,
        r.rentalDays,
        r.lastOperatorId ? 1 : 0,
        r.siteId ? 1 : 0,
        idleRatio,
        r.isAnomaly ? 1 : 0,
        `"${r.anomalyReason}"`,
      ].join(',')
    );
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
  return outPath;
}

// ─── Seed into Neon DB ────────────────────────────────────────────────────────

async function seedDatabase(records: RentalRecord[]): Promise<void> {
  console.log('\n🔌 Connecting to Neon DB...');

  // Upsert 1 company + 1 dealer as parent records
  const company = await prisma.company.upsert({
    where: { companyId: 1 },
    update: {},
    create: { companyId: 1, companyName: 'Infrastructure India Pvt Ltd', email: 'admin@infra-india.com' },
  });

  const dealer = await prisma.dealer.upsert({
    where: { dealerId: 1 },
    update: {},
    create: { dealerId: 1, dealerName: 'CAT Authorized Dealer - Chennai' },
  });

  const user = await prisma.user.upsert({
    where: { userId: 1 },
    update: {},
    create: { userId: 1, companyId: company.companyId, name: 'Fleet Manager', role: 'FLEET_MANAGER' },
  });

  let seeded = 0;
  let skipped = 0;

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const eqNum = 1001 + i;

    try {
      // Upsert Equipment
      const equipment = await prisma.equipment.upsert({
        where: { equipmentId: eqNum },
        update: { equipmentType: r.type, status: r.siteId ? 'RENTED' : 'AVAILABLE' },
        create: {
          equipmentId: eqNum,
          dealerId: dealer.dealerId,
          equipmentType: r.type,
          equipmentName: `${r.type} ${r.equipmentId}`,
          serialNumber: r.equipmentId,
          status: r.siteId ? 'RENTED' : 'AVAILABLE',
        },
      });

      // Upsert or find project site
      let siteId: number | null = null;
      if (r.siteId) {
        const siteNum = parseInt(r.siteId.replace('S', '')) || (i % 10) + 1;
        const site = await prisma.projectSite.upsert({
          where: { siteId: siteNum },
          update: {},
          create: {
            siteId: siteNum,
            companyId: company.companyId,
            siteName: `Project Site ${r.siteId}`,
            status: 'ACTIVE',
          },
        });
        siteId = site.siteId;
      }

      // Create RentalContract
      const contract = await prisma.rentalContract.create({
        data: {
          dealerId: dealer.dealerId,
          companyId: company.companyId,
          equipmentId: equipment.equipmentId,
          rentalStart: new Date(r.checkInDate),
          expectedReturn: new Date(r.checkOutDate),
          rentalStatus: 'COMPLETED',
          actualReturn: new Date(r.checkOutDate),
        },
      });

      // Create EquipmentAssignment if we have a site
      if (siteId !== null) {
        const assignment = await prisma.equipmentAssignment.create({
          data: {
            contractId: contract.contractId,
            siteId,
            assignedBy: user.userId,
            checkedOutBy: user.userId,
            checkoutTime: new Date(r.checkInDate),
            checkinTime: new Date(r.checkOutDate),
            status: 'RETURNED',
          },
        });

        // Create UsageLogs — one per rental day (aggregated)
        await prisma.usageLog.create({
          data: {
            assignmentId: assignment.assignmentId,
            runtimeHours: r.engineHoursPerDay * r.rentalDays,
            idleHours: r.idleHoursPerDay * r.rentalDays,
            fuelConsumed: r.engineHoursPerDay * r.rentalDays * 2.5, // ~2.5L/hr avg
            recordedAt: new Date(r.checkOutDate),
          },
        });
      }

      seeded++;
      if (seeded % 10 === 0) {
        process.stdout.write(`  ✓ Seeded ${seeded}/${records.length} records...\r`);
      }
    } catch (err: any) {
      skipped++;
      console.warn(`  ⚠ Skipped ${r.equipmentId}: ${err.message}`);
    }
  }

  console.log(`\n✅ Database seeding complete: ${seeded} seeded, ${skipped} skipped.`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═'.repeat(60));
  console.log('  CAT Fleet — Rental Data Generator & DB Seeder');
  console.log('  100 Equipment Records + Isolation Forest Training CSV');
  console.log('═'.repeat(60));

  const records = generateDataset();

  // 1. Print the table
  printTable(records);

  // 2. Export training CSV
  const csvPath = exportTrainingCSV(records);
  console.log(`📁 Training CSV exported: ${csvPath}`);

  // 3. Seed database
  await seedDatabase(records);

  await prisma.$disconnect();
  console.log('\n🎯 Next steps:');
  console.log('   1. Run: npx tsx scripts/train-isolation-forest.ts');
  console.log('      → Trains the Isolation Forest model on the 100 records');
  console.log('      → Saves model to: annomoly/isolation-forest.json');
  console.log('   2. Start the ingestion service: npm run ingest');
  console.log('      → Isolation Forest auto-loads model on startup');
  console.log('      → Every MQTT packet scored in real-time after rule-based checks');
  console.log('   3. Start the dashboard: npm run dev → http://localhost:3000\n');
}

main().catch((err) => {
  console.error('Seeder failed:', err);
  process.exit(1);
});
