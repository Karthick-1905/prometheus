import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import Panel from '../../components/ui/Panel';
import { Link } from 'react-router-dom';
import { operatorProfile } from '../../mock/data';

export default function OperatorDashboard() {
  const p = operatorProfile;
  return (
    <div className="max-w-lg mx-auto md:max-w-none">
      <PageHeader title="Operator Home" subtitle={`Welcome, ${p.name}`} />
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard label="Assigned Equipment" value={p.assignedEquipment} icon="precision_manufacturing" />
        <StatCard label="Current Site" value={p.site.split(' ')[0]} icon="domain" hint={p.site} />
        <StatCard label="Shift" value="Day" icon="schedule" hint={p.shift} />
        <StatCard label="Working Hours" value={`${p.workingHours} h`} icon="timer" accent="success" />
      </div>
      <Panel title="Quick actions">
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/operator/scan"
            className="flex flex-col items-center gap-2 p-5 rounded-xl bg-primary-container text-on-primary-container font-bold border border-primary"
          >
            <span className="material-symbols-outlined text-3xl">qr_code_scanner</span>
            Scan QR
          </Link>
          <Link
            to="/operator/assignment"
            className="flex flex-col items-center gap-2 p-5 rounded-xl bg-surface-container border border-outline-variant font-bold text-on-surface"
          >
            <span className="material-symbols-outlined text-3xl text-primary">handyman</span>
            My assignment
          </Link>
        </div>
      </Panel>
    </div>
  );
}
