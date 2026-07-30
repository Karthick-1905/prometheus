import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

// ── Mock Datasets ──
const FLEET_DATA = [
  { id: 'NX-8802', type: 'Excavator', status: 'WORKING', site: 'Mining Site S003', runtime: 452.4, idle: 12.5, fuel: 85.0, temp: 112.4, pressure: 42.1, vibration: 2.5, rate: '$1,200/day' },
  { id: 'NX-9124', type: 'Truck', status: 'WORKING', site: 'Quarry Site S001', runtime: 612.0, idle: 18.2, fuel: 68.5, temp: 98.0, pressure: 175.0, vibration: 3.1, rate: '$850/day' },
  { id: 'G-002', type: 'Generator', status: 'MAINTENANCE', site: 'Mining Site S003', runtime: 890.2, idle: 45.0, fuel: 42.0, temp: 85.0, pressure: 120.0, vibration: 12.4, rate: '$400/day' },
  { id: 'CAT-WL-1004', type: 'Wheel Loader', status: 'AVAILABLE', site: 'Const Site S002', runtime: 320.5, idle: 5.0, fuel: 92.0, temp: 78.0, pressure: 160.0, vibration: 1.8, rate: '$950/day' },
  { id: 'CAT-CR-1005', type: 'Crane 50T', status: 'WORKING', site: 'Port Facility P004', runtime: 154.0, idle: 8.4, fuel: 78.0, temp: 82.0, pressure: 180.0, vibration: 2.1, rate: '$2,100/day' },
];

const ASSETS_DATA = [
  { id: 'EX-12', model: '320 GC', make: 'CAT', serial: 'WKX11023', icon: 'excavator', type: 'Excavator', location: 'Western, Peoria, IL 60450', locTime: '01/25/2025; 06:03 AM CDT', serviceMeter: 1221, serviceUnit: 'Hours', serviceTime: '01/25/2025; 06:03 AM CDT', fuel: 72, status: 'WORKING', needsReview: false },
  { id: 'EX-01', model: '301.5', make: 'CAT', serial: 'QSX11511', icon: 'excavator', type: 'Mini Excavator', location: 'Western, Peoria, IL 60450', locTime: '01/25/2025; 06:32 AM CDT', serviceMeter: 908, serviceUnit: 'Hours', serviceTime: '01/25/2025; 06:32 AM CDT', fuel: 55, status: 'WORKING', needsReview: false },
  { id: 'DZ-02', model: 'D1', make: 'CAT', serial: 'WST21733', icon: 'dozer', type: 'Small Dozer', location: 'Western, Peoria, IL 60450', locTime: '01/25/2025; 07:01 AM CDT', serviceMeter: 43242, serviceUnit: 'Hours', serviceTime: '01/25/2025; 07:01 AM CDT', fuel: 88, status: 'WORKING', needsReview: false },
  { id: 'BL-10', model: '420', make: 'CAT', serial: 'A7200110', icon: 'loader', type: 'Backhoe Loader', location: 'Western, Peoria, IL 60450', locTime: '01/25/2025; 06:00 AM CDT', serviceMeter: 67933, serviceUnit: 'Hours', serviceTime: '01/25/2025; 06:00 AM CDT', fuel: 61, status: 'AVAILABLE', needsReview: false },
  { id: 'SKD-05', model: '265', make: 'CAT', serial: 'CW966641', icon: 'skid', type: 'Skid Steer', location: 'Western, Peoria, IL 60450', locTime: '01/25/2025; 07:01 AM CDT', serviceMeter: 186, serviceUnit: 'Hours', serviceTime: '01/25/2025; 07:01 AM CDT', fuel: 80, status: 'WORKING', needsReview: true },
  { id: 'PV-10', model: 'AP555', make: 'CAT', serial: 'H2600118', icon: 'paver', type: 'Asphalt Paver', location: 'Western, Peoria, IL 60450', locTime: '01/25/2025; 07:08 AM CDT', serviceMeter: 97, serviceUnit: 'Hours', serviceTime: '01/25/2025; 07:08 AM CDT', fuel: 23, status: 'WORKING', needsReview: false },
  { id: 'SKD-01', model: '272D3 XE', make: 'CAT', serial: 'CW911129', icon: 'skid', type: 'Skid Steer', location: 'Western, Peoria, IL 60450', locTime: '01/25/2025; 08:31 AM CDT', serviceMeter: 4671, serviceUnit: 'Hours', serviceTime: '01/25/2025; 08:31 AM CDT', fuel: 33, status: 'MAINTENANCE', needsReview: true },
  { id: 'TR-17', model: 'F150', make: 'FORD', serial: 'HSW01291', icon: 'truck', type: 'Pickup Truck', location: 'Western, Peoria, IL 60450', locTime: '01/25/2025; 06:00 AM CDT', serviceMeter: 2079, serviceUnit: 'Miles', serviceTime: '01/25/2025; 06:00 AM CDT', fuel: 71, status: 'WORKING', needsReview: false },
  { id: 'TR-01', model: 'F150', make: 'FORD', serial: 'HSW00677', icon: 'truck', type: 'Pickup Truck', location: null, locTime: '01/25/2025; 11:46 AM CDT', serviceMeter: 873, serviceUnit: 'Miles', serviceTime: '01/25/2025; 11:46 AM CDT', fuel: 49, status: 'AVAILABLE', needsReview: false },
  { id: 'CP-11', model: 'CB2.5', make: 'CAT', serial: 'WKX11023', icon: 'compactor', type: 'Compactor', location: null, locTime: '01/25/2025; 01:53 PM CDT', serviceMeter: 298, serviceUnit: 'Hours', serviceTime: '01/25/2025; 01:53 PM CDT', fuel: 92, status: 'AVAILABLE', needsReview: false },
  { id: 'CP-01', model: 'CB10', make: 'CAT', serial: 'TYW10237', icon: 'compactor', type: 'Compactor', location: null, locTime: '01/25/2025; 02:08 PM CDT', serviceMeter: 921, serviceUnit: 'Hours', serviceTime: '01/25/2025; 02:08 PM CDT', fuel: 65, status: 'WORKING', needsReview: false },
  { id: 'Mobile Gen-01', model: 'XQP30', make: 'CAT', serial: 'SFD00002', icon: 'generator', type: 'Generator', location: 'Western, Peoria, IL 60450', locTime: '01/25/2025; 06:00 AM CDT', serviceMeter: 4328, serviceUnit: 'Hours', serviceTime: '01/25/2025; 06:00 AM CDT', fuel: 18, status: 'WORKING', needsReview: false },
];

// ── Utilization Timeline Data ──
// Times are offset in minutes from midnight (0 = 12:00 AM)
// DAY_START = 6*60=360 (6AM), timeline shows 6AM–6PM = 720 min span
const UTILIZATION_ASSETS = [
  {
    id: '9M-1', model: '938M', make: 'CAT', serial: 'J3R07643', icon: 'loader',
    segments: [
      { type: 'working', start: 435, end: 465 }, // 7:15–7:45
      { type: 'idle', start: 465, end: 505 },     // 7:45–8:25
      { type: 'working', start: 505, end: 545 },
      { type: 'idle', start: 545, end: 553 },
      { type: 'working', start: 553, end: 600 },
      { type: 'idle', start: 600, end: 618 },     // 10:00–10:18
      { type: 'working', start: 618, end: 660 },
      { type: 'idle', start: 660, end: 680 },
      { type: 'working', start: 680, end: 720 },
      { type: 'idle', start: 720, end: 735 },
      { type: 'working', start: 735, end: 780 },
      { type: 'idle', start: 780, end: 798 },
    ],
  },
  {
    id: '9M-2', model: '926M', make: 'CAT', serial: 'LTE03698', icon: 'loader',
    segments: [
      { type: 'working', start: 445, end: 485 },
      { type: 'idle', start: 485, end: 503 },
      { type: 'working', start: 503, end: 558 },
      { type: 'idle', start: 558, end: 572 },
      { type: 'working', start: 572, end: 608 },
      { type: 'idle', start: 608, end: 625 },
      { type: 'working', start: 625, end: 672 },
      { type: 'idle', start: 672, end: 684 },
      { type: 'working', start: 684, end: 730 },
      { type: 'idle', start: 730, end: 744 },
      { type: 'working', start: 744, end: 800 },
    ],
  },
  {
    id: 'SK-1', model: '259D3', make: 'CAT', serial: 'TE901083', icon: 'skid',
    segments: [
      { type: 'working', start: 480, end: 520 },
      { type: 'idle', start: 520, end: 535 },
      { type: 'working', start: 535, end: 580 },
      { type: 'idle', start: 580, end: 595 },
      { type: 'working', start: 595, end: 635 },
      { type: 'idle', start: 635, end: 648 },
      { type: 'working', start: 648, end: 695 },
      { type: 'idle', start: 695, end: 710 },
      { type: 'working', start: 710, end: 752 },
      { type: 'idle', start: 752, end: 763 },
      { type: 'working', start: 763, end: 800 },
    ],
  },
  {
    id: 'TR-125', model: '324G', make: 'DEERE', serial: 'WT10039J7', icon: 'truck',
    segments: [
      { type: 'working', start: 490, end: 528 },
      { type: 'idle', start: 528, end: 544 },
      { type: 'working', start: 544, end: 590 },
      { type: 'idle', start: 590, end: 605 },
      { type: 'working', start: 605, end: 640 },
      { type: 'idle', start: 640, end: 655 },
      { type: 'working', start: 655, end: 698 },
      { type: 'idle', start: 698, end: 714 },
      { type: 'working', start: 714, end: 755 },
      { type: 'idle', start: 755, end: 768 },
      { type: 'working', start: 768, end: 805 },
    ],
  },
  {
    id: 'D5-01', model: 'D5', make: 'CAT', serial: 'RG0999912', icon: 'dozer',
    segments: [
      { type: 'working', start: 455, end: 500 },
      { type: 'idle', start: 500, end: 515 },
      { type: 'working', start: 515, end: 565 },
      { type: 'idle', start: 565, end: 578 },
      { type: 'working', start: 578, end: 625 },
      { type: 'idle', start: 625, end: 640 },
      { type: 'working', start: 640, end: 685 },
      { type: 'idle', start: 685, end: 700 },
      { type: 'working', start: 700, end: 748 },
    ],
  },
  {
    id: '320-1', model: '320 GX', make: 'CAT', serial: 'SYW10617', icon: 'excavator',
    segments: [
      { type: 'working', start: 465, end: 508 },
      { type: 'idle', start: 508, end: 523 },
      { type: 'working', start: 523, end: 572 },
      { type: 'idle', start: 572, end: 585 },
      { type: 'working', start: 585, end: 628 },
      { type: 'idle', start: 628, end: 643 },
      { type: 'working', start: 643, end: 690 },
      { type: 'idle', start: 690, end: 705 },
      { type: 'working', start: 705, end: 750 },
      { type: 'idle', start: 750, end: 763 },
      { type: 'working', start: 763, end: 808 },
    ],
  },
];

const INITIAL_ALERTS = [
  { id: 101, eqId: 'NX-8802', type: 'Hydraulic Failure Risk', severity: 'CRITICAL', prob: '89.2%', desc: 'Deviation detected in Oil Pressure vs. RPM baseline.', time: '09:42:15', rec: 'Immediate shutdown and seal replacement within 12 operating hours.' },
  { id: 102, eqId: 'NX-9124', type: 'Thermal Anomaly', severity: 'WARNING', prob: '74.5%', desc: 'Bearing temperature +15°C above expected operating curve.', time: '09:38:02', rec: 'Inspect engine coolant levels and bearing lubrication.' },
  { id: 103, eqId: 'G-002', type: 'Sensor Drift', severity: 'INFO', prob: '45.0%', desc: 'Vibration sensor SN-442 reporting inconsistent null-state values.', time: '09:12:44', rec: 'Recalibrate sensor node SN-442 during next service.' },
];

export default function Cockpit() {
  const [activeView, setActiveView] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [alerts, setAlerts] = useState(INITIAL_ALERTS);
  const [alertFilter, setAlertFilter] = useState('ALL');
  const [selectedAssetId, setSelectedAssetId] = useState('NX-8802');
  const [refreshing, setRefreshing] = useState(false);

  // ML Lab State
  const [mlHours, setMlHours] = useState(20.95);
  const [mlIdle, setMlIdle] = useState(3.13);
  const [mlDays, setMlDays] = useState(25);
  const [mlOperator, setMlOperator] = useState(1);
  const [mlSite, setMlSite] = useState(1);
  const [mlResult, setMlResult] = useState<any>(null);

  // Simulator Form State
  const [simEqId, setSimEqId] = useState('NX-8802');
  const [simTemp, setSimTemp] = useState(112.4);
  const [simPressure, setSimPressure] = useState(42.1);
  const [simVibration, setSimVibration] = useState(2.5);
  const [simSuccess, setSimSuccess] = useState(false);

  // Utilization Timeline State
  const [tooltip, setTooltip] = useState<{ asset: string; type: string; start: number; end: number; x: number; y: number } | null>(null);
  const [utilDate] = useState('Today (01/25/2024)');
  const DAY_START = 360; // 6:00 AM in minutes
  const DAY_SPAN = 600;  // 6AM to 5PM = 10 hours

  function minsToLabel(mins: number) {
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  }

  // Operator Page State
  const [operatorTab, setOperatorTab] = useState<'summary'|'utilization'|'operations'|'safety'|'find'>('summary');
  const [operatorSort, setOperatorSort] = useState<'asc'|'desc'>('asc');
  const [keyTypePopover, setKeyTypePopover] = useState<number | null>(null);
  const OPERATOR_DATA = [
    { id: 1, name: 'Paulette Rowe', opId: 'OPRID878', assets: 8,  keys: ['Passcode'], syncStatus: 'synced',  updatedBy: 'Song Bong', updatedAt: '06/12/2024; 11:11 PM CST', inducedScore: 218, inducedLevel: 'HIGH' },
    { id: 2, name: 'Paulette Rowe', opId: 'OPRID878', assets: 2,  keys: ['Bluetooth'], syncStatus: 'failed',  updatedBy: 'Song Bong', updatedAt: '06/12/2024; 11:11 PM CST', inducedScore: 18,  inducedLevel: 'HIGH' },
    { id: 3, name: 'Paulette Rowe', opId: 'OPRID878', assets: 2,  keys: ['RFID'],      syncStatus: 'failed',  updatedBy: 'Song Bong', updatedAt: '06/12/2024; 11:11 PM CST', inducedScore: 18,  inducedLevel: 'HIGH' },
    { id: 4, name: 'Paulette Rowe', opId: 'OPRID878', assets: 2,  keys: ['Bluetooth'], syncStatus: 'pending', updatedBy: 'Song Bong', updatedAt: '06/12/2024; 11:11 PM CST', inducedScore: 18,  inducedLevel: 'HIGH' },
    { id: 5, name: 'Marcus Webb',   opId: 'OPRID441', assets: 5,  keys: ['Passcode', 'RFID'], syncStatus: 'synced', updatedBy: 'Admin User', updatedAt: '06/10/2024; 08:00 AM CST', inducedScore: 42, inducedLevel: 'MEDIUM' },
    { id: 6, name: 'Diana Cortez',  opId: 'OPRID229', assets: 12, keys: ['Bluetooth', 'Passcode'], syncStatus: 'synced', updatedBy: 'Song Bong', updatedAt: '06/11/2024; 05:30 PM CST', inducedScore: 311, inducedLevel: 'HIGH' },
    { id: 7, name: 'Ahmed Karimi',  opId: 'OPRID553', assets: 3,  keys: ['RFID'],      syncStatus: 'pending', updatedBy: 'Admin User', updatedAt: '06/09/2024; 03:15 PM CST', inducedScore: 7,  inducedLevel: 'LOW' },
  ];
  const sortedOperators = [...OPERATOR_DATA].sort((a, b) =>
    operatorSort === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
  );

  // Threshold Settings State
  const [tempThreshold, setTempThreshold] = useState(105);
  const [pressureThreshold, setPressureThreshold] = useState(50);
  const [vibrationThreshold, setVibrationThreshold] = useState(5);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const resolveAlert = (alertId: number) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  const handleRunMlPredict = () => {
    const isAnomaly = mlHours < 10 || mlIdle > 8 || mlOperator === 0 || mlSite === 0;
    const score = isAnomaly ? 0.892 : 0.12;
    setMlResult({
      isAnomaly,
      score,
      confidence: isAnomaly ? 'HIGH' : 'LOW',
      message: isAnomaly ? 'Outlier detected: Abnormal usage vector vs training baseline' : 'Normal rental usage profile',
    });
  };

  const handleSimulateIngest = (e: React.FormEvent) => {
    e.preventDefault();
    setSimSuccess(true);
    setTimeout(() => setSimSuccess(false), 3000);
  };

  const filteredAlerts = alerts.filter((a) => alertFilter === 'ALL' || a.severity === alertFilter);
  const criticalAlerts = alerts.filter((a) => a.severity === 'CRITICAL');

  return (
    <div className="bg-surface text-on-surface min-h-screen flex overflow-hidden w-full font-sans">
      <Sidebar activeView={activeView} onSelectView={setActiveView} />

      <main className="flex-1 ml-64 flex flex-col h-screen overflow-hidden">
        <Header
          title={
            activeView === 'overview' ? 'Fleet Overview Dashboard' :
            activeView === 'anomalies' ? 'AI Anomaly Detection' :
            activeView === 'telemetry' ? 'Live Telemetry Stream' :
            activeView === 'fleet' ? 'Fleet Inventory Catalog' :
            activeView === 'forecasting' ? 'Demand Forecasting' :
            activeView === 'optimization' ? 'Fleet Optimization' :
            activeView === 'alerts' ? 'Alert Center' :
            activeView === 'analytics' ? 'Financial Analytics' :
            activeView === 'mllab' ? 'Isolation Forest ML Lab' :
            activeView === 'assets' ? 'Assets Registry' :
            activeView === 'utilization' ? 'Fleet Utilization Timeline' :
            activeView === 'operator' ? 'Operator Management' :
            'Platform Settings'
          }
          subtitle="Nexus Fleet Industrial Hub"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />

        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-gutter custom-scrollbar">

          {/* ─── VIEW 1: CENTRAL OVERVIEW DASHBOARD ─── */}
          {activeView === 'overview' && (
            <div className="flex flex-col gap-6">
              {/* KPI Cards Grid */}
              <div className="grid grid-cols-5 gap-4">
                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-xs">
                  <p className="font-label-md text-[10px] uppercase text-on-surface-variant">Total Fleet Units</p>
                  <p className="font-title-md text-2xl font-black text-on-surface mt-1">48 Units</p>
                  <span className="text-[10px] text-[#2E7D32] font-bold">100% Operational Readiness</span>
                </div>

                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-xs">
                  <p className="font-label-md text-[10px] uppercase text-on-surface-variant">Active Machinery</p>
                  <p className="font-title-md text-2xl font-black text-primary mt-1">38 Working</p>
                  <span className="text-[10px] text-on-surface-variant font-bold">8 Available · 2 Maintenance</span>
                </div>

                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-xs">
                  <p className="font-label-md text-[10px] uppercase text-on-surface-variant">Critical Anomalies</p>
                  <p className="font-title-md text-2xl font-black text-error mt-1">{criticalAlerts.length} Critical</p>
                  <span className="text-[10px] text-error font-bold">Requires Action</span>
                </div>

                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-xs">
                  <p className="font-label-md text-[10px] uppercase text-on-surface-variant">Fleet Utilization</p>
                  <p className="font-title-md text-2xl font-black text-tertiary mt-1">84.2%</p>
                  <span className="text-[10px] text-[#2E7D32] font-bold">+4.1% vs Target</span>
                </div>

                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-xs">
                  <p className="font-label-md text-[10px] uppercase text-on-surface-variant">Net Rental Revenue</p>
                  <p className="font-title-md text-2xl font-black text-on-surface mt-1">$284,500</p>
                  <span className="text-[10px] text-[#2E7D32] font-bold">MTD Target Exceeded</span>
                </div>
              </div>

              {/* Central Dashboard Analytics Grid */}
              <div className="grid grid-cols-12 gap-6">
                {/* Fleet Health Breakdown */}
                <div className="col-span-8 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-xs flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-title-md text-base font-bold text-on-surface">Fleet Category Utilization & Health</h3>
                      <p className="text-xs text-on-surface-variant">Real-time status breakdown across active deployment sites</p>
                    </div>
                    <button onClick={() => setActiveView('anomalies')} className="bg-primary-container text-on-primary-container px-3 py-1.5 rounded-lg text-xs font-bold uppercase cursor-pointer">
                      Inspect Anomalies →
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-2">
                    <div className="bg-surface-container p-4 rounded-xl border border-outline-variant">
                      <p className="text-xs font-bold text-on-surface-variant uppercase">Excavators (16)</p>
                      <p className="text-xl font-black text-primary mt-1">94% Active</p>
                      <div className="w-full bg-surface-container-high h-2 rounded-full mt-2 overflow-hidden">
                        <div className="bg-primary h-full w-[94%]" />
                      </div>
                    </div>

                    <div className="bg-surface-container p-4 rounded-xl border border-outline-variant">
                      <p className="text-xs font-bold text-on-surface-variant uppercase">Bulldozers (12)</p>
                      <p className="text-xl font-black text-tertiary mt-1">82% Active</p>
                      <div className="w-full bg-surface-container-high h-2 rounded-full mt-2 overflow-hidden">
                        <div className="bg-tertiary h-full w-[82%]" />
                      </div>
                    </div>

                    <div className="bg-surface-container p-4 rounded-xl border border-outline-variant">
                      <p className="text-xs font-bold text-on-surface-variant uppercase">Dump Trucks (20)</p>
                      <p className="text-xl font-black text-on-surface mt-1">78% Active</p>
                      <div className="w-full bg-surface-container-high h-2 rounded-full mt-2 overflow-hidden">
                        <div className="bg-on-surface h-full w-[78%]" />
                      </div>
                    </div>
                  </div>

                  {/* Active Telemetry Stream Summary */}
                  <div className="bg-surface-container p-4 rounded-xl border border-outline-variant flex justify-between items-center mt-2">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full bg-[#2E7D32] animate-pulse" />
                      <div>
                        <p className="text-xs font-bold text-on-surface">MQTT Broker Real-time Pipeline Active</p>
                        <p className="text-[10px] text-on-surface-variant">Throughput: 12,402 msg/s · Latency: 14ms</p>
                      </div>
                    </div>
                    <button onClick={() => setActiveView('telemetry')} className="text-primary text-xs font-bold uppercase cursor-pointer hover:underline">
                      View Stream →
                    </button>
                  </div>
                </div>

                {/* Recent Alert Feed */}
                <div className="col-span-4 bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-xs flex flex-col gap-3">
                  <div className="flex justify-between items-center border-b border-outline-variant pb-3">
                    <h3 className="font-title-md text-xs font-bold uppercase">Recent Anomalies</h3>
                    <span className="bg-error-container text-on-error-container text-[10px] font-black px-2 py-0.5 rounded">
                      {alerts.length} Active
                    </span>
                  </div>

                  <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[260px] custom-scrollbar">
                    {alerts.map((a) => (
                      <div key={a.id} className="p-3 border border-outline-variant bg-surface-container-low rounded-lg text-xs">
                        <div className="flex justify-between items-start mb-1">
                          <span className={`font-bold text-[11px] uppercase ${a.severity === 'CRITICAL' ? 'text-error' : 'text-tertiary'}`}>
                            {a.type}
                          </span>
                          <span className="text-[10px] text-on-surface-variant font-mono">{a.time}</span>
                        </div>
                        <p className="font-bold text-on-surface mb-0.5">{a.eqId}</p>
                        <p className="text-[11px] text-on-surface-variant leading-snug">{a.desc}</p>
                      </div>
                    ))}
                  </div>

                  <button onClick={() => setActiveView('alerts')} className="w-full bg-surface-container py-2 rounded text-xs font-bold uppercase border border-outline-variant cursor-pointer text-on-surface hover:bg-surface-container-high">
                    Open Alert Center →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── VIEW 2: AI ANOMALY DETECTION (Screen 59b447f01e044955a63d37ab426d9cba) ─── */}
          {activeView === 'anomalies' && (
            <>
              {/* Telemetry Pipeline Architecture Header */}
              <div className="bg-surface-container border border-outline-variant rounded-xl p-6 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-label-md text-[10px] uppercase text-primary mb-1">Architecture Status</span>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1 bg-surface-container-lowest border border-outline-variant rounded">
                      <span className="w-2 h-2 rounded-full bg-[#2E7D32]" />
                      <span className="font-label-md text-[12px] uppercase">MQTT Broker</span>
                    </div>
                    <div className="text-outline-variant">
                      <span className="material-symbols-outlined">arrow_forward</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-surface-container-lowest border border-outline-variant rounded">
                      <span className="w-2 h-2 rounded-full bg-[#2E7D32]" />
                      <span className="font-label-md text-[12px] uppercase">Rule Engine</span>
                    </div>
                    <div className="text-outline-variant">
                      <span className="material-symbols-outlined">arrow_forward</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-primary-container border border-primary rounded">
                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      <span className="font-label-md text-[12px] uppercase font-bold text-on-primary-container">Anomaly Engine v4.2</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="text-right">
                    <p className="font-label-md text-[10px] uppercase text-on-surface-variant">Throughput</p>
                    <p className="font-title-md text-xl font-bold">12,402 msg/s</p>
                  </div>
                  <div className="text-right border-l border-outline-variant pl-4">
                    <p className="font-label-md text-[10px] uppercase text-on-surface-variant">Latency</p>
                    <p className="font-title-md text-xl font-bold text-tertiary">14ms</p>
                  </div>
                </div>
              </div>

              {/* Dimensional Latent Space Visualization & Detection Log */}
              <div className="grid grid-cols-12 gap-gutter flex-1 min-h-[500px]">
                <div className="col-span-8 bg-surface-container-lowest border border-outline-variant rounded-xl relative overflow-hidden flex flex-col">
                  <div className="absolute top-4 left-6 z-10">
                    <h3 className="font-title-md text-lg font-bold flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">bubble_chart</span>
                      Dimensional Latent Space
                    </h3>
                    <p className="font-label-md text-[11px] text-on-surface-variant uppercase mt-1">Stochastic Neighbor Embedding Visualization</p>
                  </div>

                  <div className="latent-grid w-full h-full relative flex items-center justify-center p-12">
                    <div className="relative w-full h-full opacity-80">
                      <div className="absolute top-[20%] left-[30%] w-32 h-32 bg-primary/10 rounded-full blur-xl" />
                      <div className="absolute bottom-[30%] right-[25%] w-40 h-40 bg-tertiary/10 rounded-full blur-xl" />

                      <div className="absolute top-[25%] left-[32%] w-2 h-2 rounded-full bg-primary" />
                      <div className="absolute top-[22%] left-[35%] w-2 h-2 rounded-full bg-primary" />
                      <div className="absolute top-[28%] left-[38%] w-2 h-2 rounded-full bg-primary" />
                      <div className="absolute top-[40%] left-[45%] w-2 h-2 rounded-full bg-tertiary" />
                      <div className="absolute bottom-[35%] right-[28%] w-2 h-2 rounded-full bg-tertiary" />

                      <div className="absolute top-[60%] left-[15%] group cursor-pointer" onClick={() => setSelectedAssetId('NX-8802')}>
                        <div className="w-4 h-4 rounded-full bg-error animate-ping absolute opacity-75" />
                        <div className="w-4 h-4 rounded-full bg-error relative border-2 border-white shadow-lg" />
                        <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-[#353024] text-[#faf0de] text-[10px] px-2 py-1 rounded whitespace-nowrap opacity-100 shadow-md">
                          Asset NX-8802 (Pressure)
                        </div>
                      </div>

                      <div className="absolute top-[15%] right-[15%] group cursor-pointer" onClick={() => setSelectedAssetId('NX-9124')}>
                        <div className="w-4 h-4 rounded-full bg-error animate-ping absolute opacity-75" />
                        <div className="w-4 h-4 rounded-full bg-error relative border-2 border-white shadow-lg" />
                        <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-[#353024] text-[#faf0de] text-[10px] px-2 py-1 rounded whitespace-nowrap opacity-100 shadow-md">
                          Asset NX-9124 (Temp)
                        </div>
                      </div>

                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 font-label-md text-[10px] text-outline uppercase tracking-widest">Dimension Alpha (Temporal)</div>
                      <div className="absolute left-4 top-1/2 -rotate-90 origin-left -translate-y-1/2 font-label-md text-[10px] text-outline uppercase tracking-widest">Dimension Beta (Mechanical)</div>
                    </div>
                  </div>

                  <div className="absolute bottom-4 right-6 flex gap-2">
                    <button className="bg-surface-container px-3 py-1.5 rounded text-[11px] font-bold uppercase border border-outline-variant hover:bg-surface-container-high cursor-pointer">2D View</button>
                    <button className="bg-surface-container px-3 py-1.5 rounded text-[11px] font-bold uppercase border border-outline-variant hover:bg-surface-container-high cursor-pointer">3D Mesh</button>
                    <button className="bg-primary-container px-3 py-1.5 rounded text-[11px] font-bold uppercase border border-primary text-on-primary-container cursor-pointer">Latent Legend</button>
                  </div>
                </div>

                <div className="col-span-4 bg-surface-container-lowest border border-outline-variant rounded-xl flex flex-col overflow-hidden">
                  <div className="p-4 border-b border-outline-variant flex justify-between items-center">
                    <h3 className="font-title-md text-sm font-bold uppercase tracking-tight">Detection Log</h3>
                    <span className="bg-error-container text-on-error-container text-[10px] font-black px-2 py-0.5 rounded">
                      {criticalAlerts.length || 2} CRITICAL
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-3">
                    {alerts.map((a) => (
                      <div
                        key={a.id}
                        onClick={() => setSelectedAssetId(a.eqId)}
                        className={`p-3 border rounded-lg cursor-pointer transition-all ${
                          a.severity === 'CRITICAL' ? 'border-error bg-error-container/10 hover:bg-error-container/20' : 'border-outline-variant hover:bg-surface-container'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className={`font-label-md text-[11px] font-bold uppercase ${a.severity === 'CRITICAL' ? 'text-error' : 'text-tertiary'}`}>
                            {a.type}
                          </span>
                          <span className="font-label-md text-[10px] text-on-surface-variant">{a.time}</span>
                        </div>
                        <p className="font-body-md text-sm font-bold mb-1">Asset: {a.eqId}</p>
                        <p className="font-body-md text-[12px] text-on-surface-variant mb-2">{a.desc}</p>
                        <button
                          onClick={(e) => { e.stopPropagation(); resolveAlert(a.id); }}
                          className="bg-primary-container text-on-primary-container px-2 py-0.5 rounded text-[10px] font-bold uppercase cursor-pointer hover:opacity-90"
                        >
                          Resolve Alert
                        </button>
                      </div>
                    ))}
                  </div>

                  <button className="m-4 bg-surface-container py-2 rounded font-label-md text-[12px] uppercase font-bold border border-outline-variant hover:bg-surface-container-high cursor-pointer">
                    Export Log Archive
                  </button>
                </div>
              </div>

              {/* Detail View Section */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-surface-container border border-outline-variant rounded flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary text-3xl">construction</span>
                    </div>
                    <div>
                      <h3 className="font-title-md text-xl font-bold">In-Depth Analysis: {selectedAssetId}</h3>
                      <p className="font-label-md text-[12px] text-on-surface-variant uppercase">Last Update: Real-time Streaming</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-[#ED6C02] text-white font-label-md text-[10px] rounded uppercase font-bold">
                    Predictive Maintenance Required
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-8">
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-end">
                      <span className="font-label-md text-[12px] uppercase text-on-surface-variant">Engine Temperature (°C)</span>
                      <span className="font-title-md text-lg font-black text-on-surface">112.4</span>
                    </div>
                    <div className="h-24 flex items-end gap-1">
                      <div className="flex-1 bg-primary/20 h-[60%] rounded-t-sm" />
                      <div className="flex-1 bg-primary/20 h-[65%] rounded-t-sm" />
                      <div className="flex-1 bg-primary/20 h-[70%] rounded-t-sm" />
                      <div className="flex-1 bg-primary/20 h-[68%] rounded-t-sm" />
                      <div className="flex-1 bg-primary/20 h-[75%] rounded-t-sm" />
                      <div className="flex-1 bg-[#ED6C02] h-[85%] rounded-t-sm" />
                      <div className="flex-1 bg-[#ba1a1a] h-[95%] rounded-t-sm animate-pulse" />
                      <div className="flex-1 bg-[#ba1a1a] h-[92%] rounded-t-sm" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-end">
                      <span className="font-label-md text-[12px] uppercase text-on-surface-variant">Core RPM (x1000)</span>
                      <span className="font-title-md text-lg font-black text-on-surface">18.2</span>
                    </div>
                    <div className="h-24 flex items-end gap-1">
                      <div className="flex-1 bg-tertiary/20 h-[80%] rounded-t-sm" />
                      <div className="flex-1 bg-tertiary/20 h-[82%] rounded-t-sm" />
                      <div className="flex-1 bg-tertiary/20 h-[78%] rounded-t-sm" />
                      <div className="flex-1 bg-tertiary/20 h-[80%] rounded-t-sm" />
                      <div className="flex-1 bg-tertiary/20 h-[81%] rounded-t-sm" />
                      <div className="flex-1 bg-tertiary/20 h-[79%] rounded-t-sm" />
                      <div className="flex-1 bg-tertiary/20 h-[82%] rounded-t-sm" />
                      <div className="flex-1 bg-tertiary/20 h-[80%] rounded-t-sm" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-end">
                      <span className="font-label-md text-[12px] uppercase text-on-surface-variant">Oil Pressure (PSI)</span>
                      <span className="font-title-md text-lg font-black text-error">42.1</span>
                    </div>
                    <div className="h-24 flex items-end gap-1">
                      <div className="flex-1 bg-on-surface-variant/20 h-[90%] rounded-t-sm" />
                      <div className="flex-1 bg-on-surface-variant/20 h-[88%] rounded-t-sm" />
                      <div className="flex-1 bg-on-surface-variant/20 h-[85%] rounded-t-sm" />
                      <div className="flex-1 bg-[#ba1a1a] h-[60%] rounded-t-sm" />
                      <div className="flex-1 bg-[#ba1a1a] h-[55%] rounded-t-sm" />
                      <div className="flex-1 bg-[#ba1a1a] h-[50%] rounded-t-sm" />
                      <div className="flex-1 bg-[#ba1a1a] h-[45%] rounded-t-sm animate-pulse" />
                      <div className="flex-1 bg-[#ba1a1a] h-[40%] rounded-t-sm" />
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Recommendation Banner */}
              <div className="bg-primary-container text-on-primary-container p-6 rounded-xl border-2 border-primary flex items-center justify-between shadow-lg mb-4">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-full flex items-center justify-center border border-white/50">
                    <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
                  </div>
                  <div>
                    <h4 className="font-title-md text-lg font-black uppercase">AI Intervention Recommendation</h4>
                    <p className="font-body-md text-on-primary-fixed-variant max-w-2xl mt-1">
                      Based on latent space deviation, <strong>{selectedAssetId}</strong> is exhibiting symptoms of early-stage hydraulic pump cavitation. Recommend immediate shutdown and seal replacement within 12 operating hours.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button className="bg-on-primary-container text-white px-6 py-3 rounded-xl font-bold uppercase text-[12px] hover:opacity-90 transition-all cursor-pointer">
                    Schedule Repair
                  </button>
                  <button className="bg-transparent border-2 border-on-primary-container text-on-primary-container px-6 py-3 rounded-xl font-bold uppercase text-[12px] hover:bg-on-primary-container hover:text-white transition-all cursor-pointer">
                    Ignore Alert
                  </button>
                </div>
              </div>

              {/* Simulator */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-xs flex flex-col gap-4">
                <h3 className="font-title-md text-base font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">tune</span>
                  Telemetry Payload Ingestion Simulator
                </h3>

                <form onSubmit={handleSimulateIngest} className="grid grid-cols-4 gap-4 text-xs">
                  <div>
                    <label className="font-bold block mb-1 text-on-surface-variant">Equipment ID</label>
                    <input type="text" value={simEqId} onChange={(e) => setSimEqId(e.target.value)} className="w-full p-2 border border-outline-variant bg-surface-container-low rounded focus:outline-none" />
                  </div>
                  <div>
                    <label className="font-bold block mb-1 text-on-surface-variant">Engine Temp (°C)</label>
                    <input type="number" value={simTemp} onChange={(e) => setSimTemp(Number(e.target.value))} className="w-full p-2 border border-outline-variant bg-surface-container-low rounded focus:outline-none" />
                  </div>
                  <div>
                    <label className="font-bold block mb-1 text-on-surface-variant">Oil Pressure (PSI)</label>
                    <input type="number" value={simPressure} onChange={(e) => setSimPressure(Number(e.target.value))} className="w-full p-2 border border-outline-variant bg-surface-container-low rounded focus:outline-none" />
                  </div>
                  <div>
                    <label className="font-bold block mb-1 text-on-surface-variant">Vibration Level</label>
                    <input type="number" value={simVibration} onChange={(e) => setSimVibration(Number(e.target.value))} className="w-full p-2 border border-outline-variant bg-surface-container-low rounded focus:outline-none" />
                  </div>

                  <div className="col-span-4 flex justify-between items-center pt-2">
                    <p className="text-[11px] text-on-surface-variant">
                      *Publishes telemetry packet to MQTT topic telemetry/CAT-EX-1001 for real-time rule evaluation.
                    </p>
                    <button type="submit" className="bg-primary text-white px-6 py-2.5 rounded-lg font-bold uppercase text-xs hover:opacity-90 cursor-pointer shadow-xs">
                      Ingest Telemetry Payload
                    </button>
                  </div>
                </form>

                {simSuccess && (
                  <div className="bg-[#2E7D32]/10 border border-[#2E7D32]/30 text-[#2E7D32] p-3 rounded-lg text-xs font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    Telemetry payload ingested successfully. Pipeline status updated.
                  </div>
                )}
              </div>
            </>
          )}

          {/* ─── VIEW 3: LIVE TELEMETRY STREAM ─── */}
          {activeView === 'telemetry' && (
            <div className="flex flex-col gap-6">
              <div className="bg-surface-container border border-outline-variant rounded-xl p-5 flex justify-between items-center shadow-xs">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-[#2E7D32] animate-pulse" />
                  <div>
                    <h4 className="font-title-md text-sm font-bold text-on-surface">MQTT Streaming Broker Feed</h4>
                    <p className="text-xs text-on-surface-variant">Active topic: telemetry/# · Connection: WebSockets</p>
                  </div>
                </div>
                <div className="text-xs font-bold text-on-surface-variant">Throughput: 12,402 msg/s</div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {FLEET_DATA.map((eq) => (
                  <div key={eq.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-xs flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-title-md text-sm font-bold text-primary">{eq.id} Telemetry Stream</h4>
                      <span className="bg-[#2E7D32]/10 text-[#2E7D32] px-2.5 py-1 rounded text-[10px] font-bold uppercase">
                        ONLINE
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant">
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase block">Runtime</span>
                        <span className="text-sm font-black">{eq.runtime} hrs</span>
                      </div>
                      <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant">
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase block">Fuel Level</span>
                        <span className="text-sm font-black">{eq.fuel}%</span>
                      </div>
                      <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant">
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase block">Temp</span>
                        <span className="text-sm font-black">{eq.temp}°C</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── VIEW 4: FLEET MACHINERY INVENTORY ─── */}
          {activeView === 'fleet' && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-container-low text-on-surface-variant border-b border-outline-variant uppercase font-bold text-[11px]">
                  <tr>
                    <th className="p-4">Unit ID</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Site Location</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Daily Rate</th>
                    <th className="p-4">Runtime</th>
                    <th className="p-4">Fuel Level</th>
                    <th className="p-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40">
                  {FLEET_DATA.map((eq) => (
                    <tr key={eq.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="p-4 font-bold text-primary">{eq.id}</td>
                      <td className="p-4 font-bold text-on-surface">{eq.type}</td>
                      <td className="p-4 text-on-surface-variant">{eq.site}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase ${
                          eq.status === 'WORKING' ? 'bg-primary-container text-on-primary-container' : 'bg-error-container text-on-error-container'
                        }`}>
                          {eq.status}
                        </span>
                      </td>
                      <td className="p-4 font-bold">{eq.rate}</td>
                      <td className="p-4 font-bold">{eq.runtime} hrs</td>
                      <td className="p-4 font-bold">{eq.fuel}%</td>
                      <td className="p-4">
                        <button
                          onClick={() => { setSelectedAssetId(eq.id); setActiveView('anomalies'); }}
                          className="text-primary font-bold uppercase text-[10px] cursor-pointer hover:underline"
                        >
                          Telemetry →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ─── VIEW 5: DEMAND FORECASTING ─── */}
          {activeView === 'forecasting' && (
            <div className="flex flex-col gap-6">
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-xs">
                <h3 className="font-title-md text-base font-bold text-on-surface mb-1">AI Machine Demand Projections (Q3/Q4)</h3>
                <p className="text-xs text-on-surface-variant mb-4">Predictive fleet utilization forecasted via historical rental cycles & site contract pipelines.</p>

                <div className="grid grid-cols-3 gap-6">
                  <div className="bg-surface-container p-4 rounded-xl border border-outline-variant">
                    <span className="text-xs font-bold text-on-surface-variant uppercase">Excavators Demand</span>
                    <p className="text-2xl font-black text-primary mt-1">+18.5% Growth</p>
                    <p className="text-[11px] text-on-surface-variant mt-2">Recommended: Acquire 4 additional 30T excavator units to avoid capacity deficit.</p>
                  </div>
                  <div className="bg-surface-container p-4 rounded-xl border border-outline-variant">
                    <span className="text-xs font-bold text-on-surface-variant uppercase">Dump Trucks Demand</span>
                    <p className="text-2xl font-black text-tertiary mt-1">+12.2% Growth</p>
                    <p className="text-[11px] text-on-surface-variant mt-2">Recommended: Reallocate 3 units from Site S001 to Site S003 mining extension.</p>
                  </div>
                  <div className="bg-surface-container p-4 rounded-xl border border-outline-variant">
                    <span className="text-xs font-bold text-on-surface-variant uppercase">Bulldozers Demand</span>
                    <p className="text-2xl font-black text-on-surface mt-1">Stable (84% Optimal)</p>
                    <p className="text-[11px] text-on-surface-variant mt-2">Recommended: Maintain preventive maintenance schedule for all 12 units.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── VIEW 6: FLEET OPTIMIZATION ─── */}
          {activeView === 'optimization' && (
            <div className="flex flex-col gap-6">
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-xs">
                <h3 className="font-title-md text-base font-bold text-on-surface mb-1">Fleet Fuel & Dispatch Efficiency Score</h3>
                <p className="text-xs text-on-surface-variant mb-4">Optimization recommendations to reduce idle hours and lower fuel consumption.</p>

                <div className="grid grid-cols-3 gap-6">
                  <div className="bg-surface-container p-4 rounded-xl border border-outline-variant">
                    <span className="text-xs font-bold text-on-surface-variant uppercase">Fuel Efficiency Score</span>
                    <p className="text-3xl font-black text-[#2E7D32] mt-1">92.4 / 100</p>
                    <p className="text-[11px] text-on-surface-variant mt-2">Estimated $14,200 saved monthly via automated idle shutdown rules.</p>
                  </div>
                  <div className="bg-surface-container p-4 rounded-xl border border-outline-variant">
                    <span className="text-xs font-bold text-on-surface-variant uppercase">Idle Reduction Target</span>
                    <p className="text-3xl font-black text-primary mt-1">-14.8% Idle</p>
                    <p className="text-[11px] text-on-surface-variant mt-2">Automated 10-min idle cutoff active across 38 working units.</p>
                  </div>
                  <div className="bg-surface-container p-4 rounded-xl border border-outline-variant">
                    <span className="text-xs font-bold text-on-surface-variant uppercase">Dispatch Efficiency</span>
                    <p className="text-3xl font-black text-tertiary mt-1">96.1%</p>
                    <p className="text-[11px] text-on-surface-variant mt-2">Route optimization reduced machine transport transit time by 42 mins/trip.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── VIEW 7: ALERT CENTER ─── */}
          {activeView === 'alerts' && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-xs flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-title-md text-base font-bold text-on-surface">Centralized Alert & Escalation Hub</h3>
                  <p className="text-xs text-on-surface-variant">Active telemetry rule alerts, anomaly notifications, and resolution triggers</p>
                </div>
                <div className="flex gap-2">
                  {['ALL', 'CRITICAL', 'WARNING', 'INFO'].map((sev) => (
                    <button
                      key={sev}
                      onClick={() => setAlertFilter(sev)}
                      className={`px-3 py-1 rounded text-xs font-bold uppercase cursor-pointer border ${
                        alertFilter === sev ? 'bg-primary-container text-on-primary-container border-primary' : 'bg-surface-container text-on-surface-variant border-outline-variant'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {filteredAlerts.map((a) => (
                  <div key={a.id} className="bg-surface-container p-4 rounded-xl border border-outline-variant flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          a.severity === 'CRITICAL' ? 'bg-error-container text-on-error-container' : 'bg-primary-container text-on-primary-container'
                        }`}>
                          {a.severity}
                        </span>
                        <h4 className="font-title-md text-sm font-bold text-on-surface">{a.type} — Asset {a.eqId}</h4>
                        <span className="text-xs text-on-surface-variant font-mono">{a.time}</span>
                      </div>
                      <p className="text-xs text-on-surface-variant mb-1">{a.desc}</p>
                      <p className="text-xs font-bold text-primary">Recommendation: {a.rec}</p>
                    </div>

                    <button
                      onClick={() => resolveAlert(a.id)}
                      className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold uppercase cursor-pointer hover:opacity-90 shadow-xs"
                    >
                      Resolve
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── VIEW 8: FINANCIAL ANALYTICS ─── */}
          {activeView === 'analytics' && (
            <div className="flex flex-col gap-6">
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-xs">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-title-md text-base font-bold text-on-surface">Fleet Financial Analytics & Revenue ROI</h3>
                    <p className="text-xs text-on-surface-variant">Monthly rental yield, downtime loss prevention, and site profitability</p>
                  </div>
                  <button className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold uppercase cursor-pointer hover:opacity-90 shadow-xs">
                    Export Financial Report (CSV)
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-surface-container p-4 rounded-xl border border-outline-variant">
                    <span className="text-xs font-bold text-on-surface-variant uppercase">Gross Rental Revenue</span>
                    <p className="text-2xl font-black text-on-surface mt-1">$284,500</p>
                    <span className="text-[10px] text-[#2E7D32] font-bold">+8.4% vs last month</span>
                  </div>
                  <div className="bg-surface-container p-4 rounded-xl border border-outline-variant">
                    <span className="text-xs font-bold text-on-surface-variant uppercase">Prevented Failure Loss</span>
                    <p className="text-2xl font-black text-[#2E7D32] mt-1">$48,200</p>
                    <span className="text-[10px] text-[#2E7D32] font-bold">Saved by AI Anomaly Engine</span>
                  </div>
                  <div className="bg-surface-container p-4 rounded-xl border border-outline-variant">
                    <span className="text-xs font-bold text-on-surface-variant uppercase">Maintenance Downtime Cost</span>
                    <p className="text-2xl font-black text-error mt-1">$6,400</p>
                    <span className="text-[10px] text-error font-bold">-32% vs historical average</span>
                  </div>
                  <div className="bg-surface-container p-4 rounded-xl border border-outline-variant">
                    <span className="text-xs font-bold text-on-surface-variant uppercase">Net ROI Margin</span>
                    <p className="text-2xl font-black text-primary mt-1">34.8%</p>
                    <span className="text-[10px] text-[#2E7D32] font-bold">Industry Benchmark Exceeded</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── VIEW 9: ML ISOLATION FOREST LAB ─── */}
          {activeView === 'mllab' && (
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-7 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-xs flex flex-col gap-4">
                <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">science</span>
                  6-Feature Isolation Forest Vector Playground
                </h3>
                <p className="text-xs text-on-surface-variant">Score rental usage vectors against trained scikit-learn model.</p>

                <div className="grid grid-cols-2 gap-4 text-xs mt-2">
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="font-bold text-on-surface-variant">Engine Hrs / Day</label>
                      <span className="font-bold text-primary">{mlHours.toFixed(1)}</span>
                    </div>
                    <input type="range" min={0} max={30} step={0.1} value={mlHours} onChange={(e) => setMlHours(Number(e.target.value))} className="w-full accent-primary" />
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="font-bold text-on-surface-variant">Idle Hrs / Day</label>
                      <span className="font-bold text-primary">{mlIdle.toFixed(1)}</span>
                    </div>
                    <input type="range" min={0} max={20} step={0.1} value={mlIdle} onChange={(e) => setMlIdle(Number(e.target.value))} className="w-full accent-primary" />
                  </div>

                  <div>
                    <label className="font-bold text-on-surface-variant block mb-1">Has Operator</label>
                    <select value={mlOperator} onChange={(e) => setMlOperator(Number(e.target.value))} className="w-full p-2 bg-surface-container-low border border-outline-variant rounded-lg text-on-surface">
                      <option value={1}>Yes (1)</option>
                      <option value={0}>No (0)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-on-surface-variant block mb-1">Has Site</label>
                    <select value={mlSite} onChange={(e) => setMlSite(Number(e.target.value))} className="w-full p-2 bg-surface-container-low border border-outline-variant rounded-lg text-on-surface">
                      <option value={1}>Yes (1)</option>
                      <option value={0}>No (0)</option>
                    </select>
                  </div>

                  <div className="col-span-2 pt-2">
                    <button onClick={handleRunMlPredict} className="w-full bg-primary text-white py-2.5 rounded-xl font-bold uppercase text-xs cursor-pointer hover:opacity-90 shadow-xs">
                      Score Feature Vector
                    </button>
                  </div>
                </div>
              </div>

              {/* ML Result Box */}
              <div className="col-span-5 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-xs flex flex-col gap-4 items-center justify-center">
                <h4 className="text-xs font-bold uppercase text-on-surface-variant">Model Score Output</h4>
                {mlResult ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className={`w-24 h-24 rounded-full border-4 flex flex-col items-center justify-center ${
                      mlResult.isAnomaly ? 'border-error bg-error-container text-error' : 'border-[#2E7D32] bg-[#2E7D32]/10 text-[#2E7D32]'
                    }`}>
                      <span className="text-2xl font-black">{Math.round(mlResult.score * 100)}%</span>
                      <span className="text-[9px] uppercase font-bold">Anomaly %</span>
                    </div>
                    <span className={`px-3 py-1 rounded text-xs font-black uppercase ${
                      mlResult.isAnomaly ? 'bg-error text-white' : 'bg-[#2E7D32] text-white'
                    }`}>
                      {mlResult.isAnomaly ? 'ANOMALY DETECTED' : 'NORMAL PATTERN'}
                    </span>
                    <p className="text-xs text-center text-on-surface-variant font-medium">{mlResult.message}</p>
                  </div>
                ) : (
                  <p className="text-xs text-on-surface-variant text-center">Adjust feature sliders and click Score Feature Vector.</p>
                )}
              </div>
            </div>
          )}

          {/* ─── VIEW 10: PLATFORM SETTINGS ─── */}
          {activeView === 'settings' && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-xs flex flex-col gap-6">
              <div>
                <h3 className="font-title-md text-base font-bold text-on-surface">Platform Rule Thresholds & Profile Settings</h3>
                <p className="text-xs text-on-surface-variant">Configure real-time anomaly engine trigger sensitivity and operator preferences</p>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div className="bg-surface-container p-4 rounded-xl border border-outline-variant flex flex-col gap-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase">Engine Temp Threshold (°C)</label>
                  <span className="text-xl font-black text-primary">{tempThreshold}°C</span>
                  <input type="range" min={80} max={140} value={tempThreshold} onChange={(e) => setTempThreshold(Number(e.target.value))} className="accent-primary" />
                </div>

                <div className="bg-surface-container p-4 rounded-xl border border-outline-variant flex flex-col gap-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase">Min Oil Pressure Threshold (PSI)</label>
                  <span className="text-xl font-black text-error">{pressureThreshold} PSI</span>
                  <input type="range" min={20} max={100} value={pressureThreshold} onChange={(e) => setPressureThreshold(Number(e.target.value))} className="accent-primary" />
                </div>

                <div className="bg-surface-container p-4 rounded-xl border border-outline-variant flex flex-col gap-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase">Vibration Risk Level</label>
                  <span className="text-xl font-black text-tertiary">{vibrationThreshold}.0 Scale</span>
                  <input type="range" min={1} max={10} value={vibrationThreshold} onChange={(e) => setVibrationThreshold(Number(e.target.value))} className="accent-primary" />
                </div>
              </div>
            </div>
          )}

          {/* ─── VIEW: VISIONLINK ASSETS REGISTRY ─── */}
          {activeView === 'assets' && (
            <div className="flex flex-col gap-4">
              {/* Toolbar */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-surface-container-lowest border border-outline-variant px-3 py-2 rounded-lg">
                    <span className="material-symbols-outlined text-on-surface-variant text-sm">search</span>
                    <input
                      type="text"
                      placeholder="Find asset"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-transparent border-none focus:outline-none text-xs w-48 text-on-surface placeholder:text-on-surface-variant"
                    />
                  </div>
                  <span className="text-xs text-on-surface-variant font-bold">
                    1 – {Math.min(ASSETS_DATA.length, 100)} of {ASSETS_DATA.length} assets
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest hover:bg-surface-container text-xs font-bold uppercase text-on-surface-variant cursor-pointer">
                    <span className="material-symbols-outlined text-sm">filter_list</span>
                    Filters
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest hover:bg-surface-container text-xs font-bold uppercase text-on-surface-variant cursor-pointer">
                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest hover:bg-surface-container text-xs font-bold uppercase text-on-surface-variant cursor-pointer">
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </button>
                </div>
              </div>

              {/* Assets Table */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-surface-container-low border-b border-outline-variant">
                    <tr>
                      <th className="p-3 w-8">
                        <input type="checkbox" className="accent-primary" />
                      </th>
                      <th className="p-3 font-bold uppercase text-on-surface-variant text-[11px]">
                        <button className="flex items-center gap-1 cursor-pointer hover:text-on-surface">
                          Asset
                          <span className="material-symbols-outlined text-sm">unfold_more</span>
                        </button>
                      </th>
                      <th className="p-3 font-bold uppercase text-on-surface-variant text-[11px]">
                        <button className="flex items-center gap-1 cursor-pointer hover:text-on-surface">
                          Last Known Location
                          <span className="material-symbols-outlined text-sm">unfold_more</span>
                        </button>
                      </th>
                      <th className="p-3 font-bold uppercase text-on-surface-variant text-[11px]">
                        <button className="flex items-center gap-1 cursor-pointer hover:text-on-surface">
                          Last Known Service Meter
                          <span className="material-symbols-outlined text-sm">unfold_more</span>
                        </button>
                      </th>
                      <th className="p-3 font-bold uppercase text-on-surface-variant text-[11px]">
                        <button className="flex items-center gap-1 cursor-pointer hover:text-on-surface">
                          Fuel Level
                          <span className="material-symbols-outlined text-sm">unfold_more</span>
                        </button>
                      </th>
                      <th className="p-3 font-bold uppercase text-on-surface-variant text-[11px]">Status</th>
                      <th className="p-3 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30">
                    {ASSETS_DATA
                      .filter((a) =>
                        !searchQuery ||
                        a.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        a.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        a.type.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((asset) => (
                        <tr
                          key={asset.id}
                          className={`hover:bg-surface-container-low/60 transition-colors cursor-pointer ${
                            asset.id === selectedAssetId ? 'bg-primary-container/20' : ''
                          }`}
                          onClick={() => setSelectedAssetId(asset.id)}
                        >
                          {/* Checkbox */}
                          <td className="p-3" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" className="accent-primary" />
                          </td>

                          {/* Asset Info */}
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              {/* Asset Icon Thumbnail */}
                              <div className="w-12 h-10 bg-surface-container rounded border border-outline-variant flex items-center justify-center flex-shrink-0">
                                <span className="material-symbols-outlined text-primary text-xl">
                                  {asset.icon === 'excavator' ? 'construction' :
                                   asset.icon === 'dozer' ? 'front_loader' :
                                   asset.icon === 'loader' ? 'front_loader' :
                                   asset.icon === 'skid' ? 'agriculture' :
                                   asset.icon === 'paver' ? 'road' :
                                   asset.icon === 'truck' ? 'local_shipping' :
                                   asset.icon === 'compactor' ? 'roller_skating' :
                                   asset.icon === 'generator' ? 'bolt' : 'construction'}
                                </span>
                              </div>
                              <div>
                                <p className="font-black text-sm text-on-surface flex items-center gap-1.5">
                                  {asset.id}
                                  {asset.needsReview && (
                                    <span className="w-2 h-2 rounded-full bg-[#ED6C02] inline-block" title="Needs Review" />
                                  )}
                                </p>
                                <p className="text-[11px] text-on-surface-variant font-semibold">
                                  {asset.model} · {asset.make} · {asset.serial}
                                </p>
                                <p className="text-[10px] text-on-surface-variant opacity-70">{asset.type}</p>
                              </div>
                            </div>
                          </td>

                          {/* Location */}
                          <td className="p-3">
                            {asset.location ? (
                              <div>
                                <p className="text-xs font-bold text-primary truncate max-w-[180px]">{asset.location}</p>
                                <p className="text-[10px] text-on-surface-variant">{asset.locTime}</p>
                              </div>
                            ) : (
                              <span className="text-[11px] text-on-surface-variant italic">Location unavailable</span>
                            )}
                          </td>

                          {/* Service Meter */}
                          <td className="p-3">
                            <div>
                              <p className="text-sm font-black text-on-surface tabular-nums">
                                {asset.serviceMeter.toLocaleString()}
                              </p>
                              <p className="text-[10px] text-on-surface-variant font-semibold">{asset.serviceUnit}</p>
                              <p className="text-[10px] text-on-surface-variant opacity-70">{asset.serviceTime}</p>
                            </div>
                          </td>

                          {/* Fuel Level */}
                          <td className="p-3">
                            <div className="flex items-center gap-2 min-w-[100px]">
                              <div className="flex-1 h-2 bg-surface-container-high rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    asset.fuel > 60 ? 'bg-[#2E7D32]' :
                                    asset.fuel > 30 ? 'bg-[#ED6C02]' : 'bg-error'
                                  }`}
                                  style={{ width: `${asset.fuel}%` }}
                                />
                              </div>
                              <span className={`text-xs font-black w-8 text-right ${
                                asset.fuel > 60 ? 'text-[#2E7D32]' :
                                asset.fuel > 30 ? 'text-[#ED6C02]' : 'text-error'
                              }`}>
                                {asset.fuel}%
                              </span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="p-3">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                              asset.status === 'WORKING' ? 'bg-primary-container text-on-primary-container' :
                              asset.status === 'MAINTENANCE' ? 'bg-error-container text-on-error-container' :
                              'bg-surface-container-high text-on-surface-variant'
                            }`}>
                              {asset.status}
                            </span>
                          </td>

                          {/* Actions Menu */}
                          <td className="p-3" onClick={(e) => e.stopPropagation()}>
                            <button className="w-7 h-7 rounded-lg hover:bg-surface-container flex items-center justify-center cursor-pointer text-on-surface-variant">
                              <span className="material-symbols-outlined text-sm">more_vert</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Summary bar */}
              <div className="flex items-center justify-between text-xs text-on-surface-variant px-1">
                <span>
                  {ASSETS_DATA.filter((a) => a.status === 'WORKING').length} Working ·{' '}
                  {ASSETS_DATA.filter((a) => a.status === 'AVAILABLE').length} Available ·{' '}
                  {ASSETS_DATA.filter((a) => a.status === 'MAINTENANCE').length} Maintenance ·{' '}
                  {ASSETS_DATA.filter((a) => a.needsReview).length} Needs Review
                </span>
                <span className="font-bold">{ASSETS_DATA.length} total assets</span>
              </div>
            </div>
          )}

          {/* ─── VIEW: UTILIZATION TIMELINE GANTT ─── */}
          {activeView === 'utilization' && (
            <div className="flex flex-col gap-0 relative">

              {/* Toolbar: Date Picker + Zoom + Pagination */}
              <div className="flex items-center justify-between mb-4">
                <button className="flex items-center gap-2 px-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container cursor-pointer">
                  <span className="material-symbols-outlined text-sm">calendar_today</span>
                  {utilDate}
                  <span className="material-symbols-outlined text-sm">expand_more</span>
                </button>

                <div className="flex items-center gap-2">
                  <button className="w-8 h-8 flex items-center justify-center border border-outline-variant rounded-lg bg-surface-container-lowest hover:bg-surface-container cursor-pointer">
                    <span className="material-symbols-outlined text-sm">zoom_in</span>
                  </button>
                  <button className="w-8 h-8 flex items-center justify-center border border-outline-variant rounded-lg bg-surface-container-lowest hover:bg-surface-container cursor-pointer">
                    <span className="material-symbols-outlined text-sm">zoom_out</span>
                  </button>
                  <span className="text-xs font-bold text-on-surface-variant px-2">1 – 6 of 6</span>
                  <button className="w-8 h-8 flex items-center justify-center border border-outline-variant rounded-lg bg-surface-container-lowest hover:bg-surface-container cursor-pointer">
                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                  </button>
                  <button className="w-8 h-8 flex items-center justify-center border border-outline-variant rounded-lg bg-surface-container-lowest hover:bg-surface-container cursor-pointer">
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </button>
                  <button className="w-8 h-8 flex items-center justify-center border border-outline-variant rounded-lg bg-surface-container-lowest hover:bg-surface-container cursor-pointer">
                    <span className="material-symbols-outlined text-sm">photo_camera</span>
                  </button>
                  <button className="w-8 h-8 flex items-center justify-center border border-outline-variant rounded-lg bg-surface-container-lowest hover:bg-surface-container cursor-pointer">
                    <span className="material-symbols-outlined text-sm">download</span>
                  </button>
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-3 rounded-sm bg-[#26A69A]" />
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase">Working</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-3 rounded-sm bg-[#F57C00]" />
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase">Idle</span>
                </div>
              </div>

              {/* Gantt Chart Container */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-xs">

                {/* Time Header Row */}
                <div className="flex border-b border-outline-variant">
                  {/* Asset column header */}
                  <div className="w-56 flex-shrink-0 px-4 py-2.5 border-r border-outline-variant bg-surface-container-low">
                    <button className="flex items-center gap-1 text-[11px] font-bold uppercase text-on-surface-variant cursor-pointer hover:text-on-surface">
                      Asset
                      <span className="material-symbols-outlined text-xs">unfold_more</span>
                    </button>
                  </div>

                  {/* Time labels strip */}
                  <div className="flex-1 relative bg-surface-container-low">
                    <div className="flex" style={{ height: '36px' }}>
                      {[6, 8, 10, 12, 14, 16].map((hour) => {
                        const pct = ((hour * 60 - DAY_START) / DAY_SPAN) * 100;
                        return (
                          <div
                            key={hour}
                            className="absolute top-0 h-full flex items-center"
                            style={{ left: `${pct}%` }}
                          >
                            <div className="h-full w-px bg-outline-variant" />
                            <span className="pl-1.5 text-[11px] font-bold text-on-surface-variant">
                              {hour === 12 ? '12PM' : hour < 12 ? `${hour}AM` : `${hour - 12}PM`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Asset Rows */}
                {UTILIZATION_ASSETS.map((asset, rowIdx) => (
                  <div
                    key={asset.id}
                    className={`flex border-b border-outline-variant/50 hover:bg-surface-container-low/40 transition-colors ${
                      rowIdx % 2 === 1 ? 'bg-surface-container-low/20' : ''
                    }`}
                    style={{ height: '56px' }}
                  >
                    {/* Asset Label */}
                    <div className="w-56 flex-shrink-0 px-3 border-r border-outline-variant flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-primary text-lg flex-shrink-0">
                        {asset.icon === 'loader' ? 'front_loader' :
                         asset.icon === 'skid' ? 'agriculture' :
                         asset.icon === 'truck' ? 'local_shipping' :
                         asset.icon === 'dozer' ? 'front_loader' :
                         'construction'}
                      </span>
                      <div className="overflow-hidden">
                        <p className="font-black text-xs text-on-surface leading-tight truncate">{asset.id}</p>
                        <p className="text-[10px] text-on-surface-variant truncate">
                          {asset.model} · {asset.make} · {asset.serial}
                        </p>
                      </div>
                    </div>

                    {/* Timeline Track */}
                    <div className="flex-1 relative flex items-center" style={{ padding: '8px 0' }}>
                      {/* Vertical time gridlines */}
                      {[6, 8, 10, 12, 14, 16].map((hour) => (
                        <div
                          key={hour}
                          className="absolute top-0 h-full w-px bg-outline-variant/40 pointer-events-none"
                          style={{ left: `${((hour * 60 - DAY_START) / DAY_SPAN) * 100}%` }}
                        />
                      ))}

                      {/* Segment Bars */}
                      {asset.segments.map((seg, segIdx) => {
                        const leftPct = Math.max(0, ((seg.start - DAY_START) / DAY_SPAN) * 100);
                        const widthPct = Math.min(100 - leftPct, ((seg.end - seg.start) / DAY_SPAN) * 100);
                        if (widthPct <= 0) return null;

                        const isIdle = seg.type === 'idle';
                        return (
                          <div
                            key={segIdx}
                            className="absolute cursor-pointer rounded-sm transition-opacity hover:opacity-80"
                            style={{
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                              height: '28px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              backgroundColor: isIdle ? '#F57C00' : '#26A69A',
                              border: `1.5px solid ${isIdle ? '#E65100' : '#00796B'}`,
                            }}
                            onMouseEnter={(e) => {
                              const rect = (e.target as HTMLElement).getBoundingClientRect();
                              setTooltip({
                                asset: asset.id,
                                type: isIdle ? 'Idle' : 'Working',
                                start: seg.start,
                                end: seg.end,
                                x: rect.left,
                                y: rect.top,
                              });
                            }}
                            onMouseLeave={() => setTooltip(null)}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Tooltip */}
              {tooltip && (
                <div
                  className="fixed z-50 bg-white border border-outline-variant rounded-xl shadow-xl p-4 min-w-[200px]"
                  style={{ top: tooltip.y - 140, left: tooltip.x + 8 }}
                  onMouseEnter={() => {}}
                >
                  <p className="font-black text-base text-on-surface mb-2">{tooltip.type}</p>
                  <div className="flex flex-col gap-1 text-xs">
                    <div className="flex justify-between gap-4">
                      <span className="text-on-surface-variant font-semibold">Started:</span>
                      <span className="font-black text-on-surface">{minsToLabel(tooltip.start)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-on-surface-variant font-semibold">Ended:</span>
                      <span className="font-black text-on-surface">{minsToLabel(tooltip.end)}</span>
                    </div>
                    <div className="flex justify-between gap-4 border-t border-outline-variant pt-1 mt-1">
                      <span className="text-on-surface-variant font-semibold">Duration:</span>
                      <span className="font-black text-on-surface">
                        {tooltip.end - tooltip.start >= 60
                          ? `${Math.floor((tooltip.end - tooltip.start) / 60)}h ${(tooltip.end - tooltip.start) % 60}m`
                          : `${tooltip.end - tooltip.start} minutes`}
                      </span>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ─── VIEW: OPERATOR MANAGEMENT ─── */}
          {activeView === 'operator' && (
            <div className="flex flex-col gap-0 h-full" onClick={() => setKeyTypePopover(null)}>

              {/* Tab Bar */}
              <div className="flex border-b border-outline-variant mb-4 gap-0">
                {(['summary','utilization','operations','safety','find'] as const).map((tabKey) => {
                  const tabInfo: Record<string, string> = {
                    summary: 'Summary', utilization: 'Utilization',
                    operations: 'Asset Operations', safety: 'Safety', find: 'Find Operator',
                  };
                  return (
                    <button
                      key={tabKey}
                      onClick={() => setOperatorTab(tabKey)}
                      className={`flex items-center gap-1.5 px-5 py-3 text-xs font-bold cursor-pointer border-b-2 transition-colors ${
                        operatorTab === tabKey
                          ? 'border-primary text-primary'
                          : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant'
                      }`}
                    >
                      {tabKey === 'find' && <span className="material-symbols-outlined text-sm">search</span>}
                      {tabInfo[tabKey]}
                    </button>
                  );
                })}
              </div>

              {/* Summary Tab Content */}
              {operatorTab === 'summary' && (
                <div className="flex flex-col gap-4">

                  {/* Toolbar */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-on-surface-variant font-semibold">Sort Operators by</span>
                      <button
                        onClick={() => setOperatorSort(operatorSort === 'asc' ? 'desc' : 'asc')}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest hover:bg-surface-container text-xs font-bold text-on-surface cursor-pointer"
                      >
                        {operatorSort === 'asc' ? 'A to Z' : 'Z to A'}
                        <span className="material-symbols-outlined text-sm">expand_more</span>
                      </button>
                    </div>
                    <button className="flex items-center gap-2 px-3 py-1.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container cursor-pointer">
                      <span className="material-symbols-outlined text-sm">calendar_today</span>
                      Last 7 Days (11/04/2020 – 17/0...)
                    </button>
                  </div>

                  {/* Operator Table */}
                  <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-surface-container-low border-b border-outline-variant">
                        <tr>
                          <th className="p-3 font-bold uppercase text-on-surface-variant text-[11px]">
                            <button
                              onClick={() => setOperatorSort(operatorSort === 'asc' ? 'desc' : 'asc')}
                              className="flex items-center gap-1 cursor-pointer hover:text-on-surface"
                            >
                              <span className="material-symbols-outlined text-xs">arrow_upward</span>
                              Operators
                              <span className="material-symbols-outlined text-xs">expand_more</span>
                            </button>
                          </th>
                          <th className="p-3 font-bold uppercase text-on-surface-variant text-[11px]">
                            #Assets
                          </th>
                          <th className="p-3 font-bold uppercase text-on-surface-variant text-[11px]">
                            Key Type
                          </th>
                          <th className="p-3 font-bold uppercase text-on-surface-variant text-[11px]">
                            <div className="flex items-center gap-1">
                              Sync Status
                              <span className="material-symbols-outlined text-xs text-on-surface-variant">info</span>
                            </div>
                          </th>
                          <th className="p-3 font-bold uppercase text-on-surface-variant text-[11px]">Updated by</th>
                          <th className="p-3 font-bold uppercase text-on-surface-variant text-[11px]">Operator Induced</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/30">
                        {sortedOperators.map((op) => (
                          <tr key={op.id} className="hover:bg-surface-container-low/50 transition-colors">

                            {/* Operator */}
                            <td className="p-3">
                              <p className="font-bold text-sm text-on-surface">{op.name}</p>
                              <p className="text-[10px] text-on-surface-variant">{op.opId}</p>
                            </td>

                            {/* #Assets */}
                            <td className="p-3">
                              <span className="font-black text-sm text-primary">{op.assets}</span>
                            </td>

                            {/* Key Type with popover */}
                            <td className="p-3 relative">
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="text-xs font-bold text-on-surface">{op.keys[0]}</span>
                                {op.keys.length > 1 && (
                                  <button
                                    className="text-[10px] font-black text-primary cursor-pointer hover:underline relative"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setKeyTypePopover(keyTypePopover === op.id ? null : op.id);
                                    }}
                                  >
                                    +{op.keys.length - 1}
                                    {keyTypePopover === op.id && (
                                      <div
                                        className="absolute top-6 left-0 z-40 bg-white border border-outline-variant rounded-xl shadow-xl p-3 min-w-[120px]"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {op.keys.slice(1).map((k) => (
                                          <p key={k} className="text-xs font-bold text-on-surface py-1 px-2 hover:bg-surface-container rounded cursor-default">{k}</p>
                                        ))}
                                      </div>
                                    )}
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* Sync Status */}
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold ${
                                  op.syncStatus === 'synced' ? 'text-[#2E7D32]' :
                                  op.syncStatus === 'failed' ? 'text-error' :
                                  'text-[#ED6C02]'
                                }`}>
                                  {op.syncStatus === 'synced' ? 'Synced' :
                                   op.syncStatus === 'failed' ? 'Failed' : 'Pending'}
                                </span>
                                {op.syncStatus === 'failed' && (
                                  <button className="text-xs font-black text-primary hover:underline cursor-pointer">Retry</button>
                                )}
                              </div>
                            </td>

                            {/* Updated By */}
                            <td className="p-3">
                              <p className="text-xs font-bold text-on-surface">{op.updatedBy}</p>
                              <p className="text-[10px] text-on-surface-variant">{op.updatedAt}</p>
                            </td>

                            {/* Operator Induced */}
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                  op.inducedLevel === 'HIGH' ? 'bg-error' :
                                  op.inducedLevel === 'MEDIUM' ? 'bg-[#ED6C02]' : 'bg-[#2E7D32]'
                                }`} />
                                <span className="text-xs font-black text-on-surface">
                                  {op.inducedScore} {op.inducedLevel}
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer summary */}
                  <div className="flex items-center justify-between text-xs text-on-surface-variant px-1">
                    <span>
                      {OPERATOR_DATA.filter((o) => o.syncStatus === 'synced').length} Synced ·{' '}
                      {OPERATOR_DATA.filter((o) => o.syncStatus === 'failed').length} Failed ·{' '}
                      {OPERATOR_DATA.filter((o) => o.syncStatus === 'pending').length} Pending
                    </span>
                    <span className="font-bold">{OPERATOR_DATA.length} total operators</span>
                  </div>
                </div>
              )}

              {/* Other tabs — placeholder panels */}
              {operatorTab !== 'summary' && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-5xl opacity-30">
                    {operatorTab === 'utilization' ? 'bar_chart' :
                     operatorTab === 'operations' ? 'engineering' :
                     operatorTab === 'safety' ? 'health_and_safety' :
                     'person_search'}
                  </span>
                  <p className="text-sm font-bold">
                    {operatorTab === 'utilization' ? 'Utilization' :
                     operatorTab === 'operations' ? 'Asset Operations' :
                     operatorTab === 'safety' ? 'Safety' : 'Find Operator'} view
                  </p>
                  <p className="text-xs opacity-60">Coming soon — select an operator from Summary to drill in</p>
                </div>
              )}

            </div>
          )}

        </div>
      </main>
    </div>
  );
}
