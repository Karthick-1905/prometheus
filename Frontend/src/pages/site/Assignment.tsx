import { useState } from 'react';
import { fleetApi, siteApi } from '../../api/platform';
import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import StatusBadge from '../../components/ui/StatusBadge';
import { EmptyState, FeedbackBanner, PageSkeleton } from '../../components/ui/Feedback';
import { getErrorMessage, useAsync } from '../../hooks/useAsync';

export default function SiteAssignment() {
  const [form, setForm] = useState({ contractId: '', siteId: '' });
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const resource = useAsync(async () => {
    const [assignments, sites, unassigned] = await Promise.all([siteApi.assignments(), siteApi.sites(), fleetApi.unassigned()]);
    return { assignments: assignments.data, sites: sites.data, unassigned: unassigned.data };
  }, []);
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await siteApi.createAssignment({ contractId: Number(form.contractId), siteId: Number(form.siteId) });
      setMessage({ tone: 'success', text: 'Equipment assignment created and any previous active assignment closed.' });
      setForm({ contractId: '', siteId: '' });
      await resource.reload();
    } catch (error) {
      setMessage({ tone: 'error', text: getErrorMessage(error) });
    }
  };
  return (
    <div>
      <PageHeader title="Equipment Assignment" subtitle="Assign active rental contracts to a company site" />
      {message && <FeedbackBanner tone={message.tone} onDismiss={() => setMessage(null)}>{message.text}</FeedbackBanner>}
      {resource.error && <FeedbackBanner tone="error">{resource.error}</FeedbackBanner>}
      {resource.loading ? <PageSkeleton rows={7} /> : <div className="grid lg:grid-cols-[1fr_340px] gap-4">
        <Panel title="Active assignments">{!resource.data?.assignments.length ? <EmptyState title="No active assignments" message="Select an unassigned contract and target site to begin." /> : <div className="data-list">{resource.data.assignments.map((item) => <div className="data-list-row compact" key={item.assignmentId}><div><strong>{item.equipmentName ?? `Equipment ${item.equipmentId}`}</strong><span>{item.siteName} · Contract #{item.contractId}</span></div><StatusBadge status={item.status ?? 'UNKNOWN'} /></div>)}</div>}</Panel>
        <Panel title="Assign equipment"><form className="stack-form" onSubmit={create}><label className="field"><span>Unassigned rental</span><select value={form.contractId} onChange={(event) => setForm((current) => ({ ...current, contractId: event.target.value }))} required><option value="">Select contract</option>{resource.data?.unassigned.map((machine) => <option key={machine.contractId} value={machine.contractId}>{machine.equipmentName} · Contract #{machine.contractId}</option>)}</select></label><label className="field"><span>Target site</span><select value={form.siteId} onChange={(event) => setForm((current) => ({ ...current, siteId: event.target.value }))} required><option value="">Select site</option>{resource.data?.sites.map((site) => <option key={site.siteId} value={site.siteId}>{site.siteName}</option>)}</select></label><button className="btn-primary" type="submit">Create assignment</button></form></Panel>
      </div>}
    </div>
  );
}
