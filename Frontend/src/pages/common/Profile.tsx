import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import { useRole } from '../../context/RoleContext';
import { ROLE_LABELS } from '../../types/roles';

export default function ProfilePage() {
  const { role, roleLabel, clearRole } = useRole();
  return (
    <div className="max-w-lg">
      <PageHeader title="Profile" subtitle="Demo account" />
      <Panel>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center font-black text-xl">
            DU
          </div>
          <div>
            <p className="font-black text-lg">Demo User</p>
            <p className="text-sm text-on-surface-variant">{roleLabel}</p>
          </div>
        </div>
        <dl className="space-y-3 text-sm mb-6">
          <div className="flex justify-between">
            <dt className="text-on-surface-variant">Email</dt>
            <dd className="font-semibold">demo@cat-rental.local</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-on-surface-variant">Role key</dt>
            <dd className="font-mono text-xs">{role}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-on-surface-variant">Display</dt>
            <dd className="font-semibold">{role ? ROLE_LABELS[role] : '—'}</dd>
          </div>
        </dl>
        <button type="button" onClick={clearRole} className="btn-secondary w-full">
          Switch role
        </button>
      </Panel>
    </div>
  );
}
