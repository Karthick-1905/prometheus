import { useState } from 'react';
import { dealerApi } from '../../api/platform';
import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import StatusBadge from '../../components/ui/StatusBadge';
import { EmptyState, FeedbackBanner, PageSkeleton } from '../../components/ui/Feedback';
import { getErrorMessage, useAsync } from '../../hooks/useAsync';

export default function DealerRentalOps() {
  const [status, setStatus] = useState('');
  const [form, setForm] = useState({ companyId: '1', equipmentId: '', rentalStart: new Date().toISOString().slice(0, 16), expectedReturn: '' });
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const resource = useAsync(() => dealerApi.contracts(status || undefined, 500), [status]);
  const equipment = useAsync(() => dealerApi.equipment({ status: 'AVAILABLE', limit: 500 }), []);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await dealerApi.createContract({ companyId: Number(form.companyId), equipmentId: Number(form.equipmentId), rentalStart: new Date(form.rentalStart).toISOString(), expectedReturn: new Date(form.expectedReturn).toISOString() });
      setMessage({ tone: 'success', text: 'Rental contract created and equipment marked rented.' });
      setForm((current) => ({ ...current, equipmentId: '', expectedReturn: '' }));
      await Promise.all([resource.reload(), equipment.reload()]);
    } catch (error) {
      setMessage({ tone: 'error', text: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const complete = async (contractId: number) => {
    if (!window.confirm(`Complete contract #${contractId} and return its equipment to available inventory?`)) return;
    try {
      await dealerApi.completeContract(contractId);
      setMessage({ tone: 'success', text: `Contract #${contractId} completed.` });
      await Promise.all([resource.reload(), equipment.reload()]);
    } catch (error) {
      setMessage({ tone: 'error', text: getErrorMessage(error) });
    }
  };

  return (
    <div>
      <PageHeader title="Rental Operations" subtitle="Create and complete dealer rental contracts" />
      {message && <FeedbackBanner tone={message.tone} onDismiss={() => setMessage(null)}>{message.text}</FeedbackBanner>}
      <div className="grid lg:grid-cols-[1fr_340px] gap-4">
        <Panel title="Contracts">
          <label className="field compact-filter"><span>Status filter</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All contracts</option>{['ACTIVE', 'OVERDUE', 'COMPLETED'].map((value) => <option key={value}>{value}</option>)}</select></label>
          {resource.error && <FeedbackBanner tone="error">{resource.error}</FeedbackBanner>}
          {resource.loading ? <PageSkeleton rows={6} /> : !resource.data?.data.length ? <EmptyState title="No contracts found" message="Create a contract or change the status filter." /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Contract</th><th>Customer</th><th>Equipment</th><th>Dates</th><th>Status</th><th /></tr></thead><tbody>{resource.data.data.map((contract) => <tr key={contract.contractId}><td><strong>#{contract.contractId}</strong></td><td>{contract.companyName ?? `Company ${contract.companyId}`}</td><td><strong>{contract.equipmentName}</strong><small>{contract.equipmentType}</small></td><td>{contract.rentalStart ? new Date(contract.rentalStart).toLocaleDateString() : '—'}<small>Due {contract.expectedReturn ? new Date(contract.expectedReturn).toLocaleDateString() : '—'}</small></td><td><StatusBadge status={contract.rentalStatus ?? 'UNKNOWN'} /></td><td>{contract.rentalStatus !== 'COMPLETED' && <button className="btn-primary" type="button" onClick={() => void complete(contract.contractId)}>Complete return</button>}</td></tr>)}</tbody></table></div>}
        </Panel>
        <Panel title="New rental">
          <form className="stack-form" onSubmit={create}>
            <label className="field"><span>Customer company ID</span><input type="number" min={1} value={form.companyId} onChange={(event) => setForm((current) => ({ ...current, companyId: event.target.value }))} required /></label>
            <label className="field"><span>Available equipment</span><select value={form.equipmentId} onChange={(event) => setForm((current) => ({ ...current, equipmentId: event.target.value }))} required><option value="">Select equipment</option>{equipment.data?.data.map((item) => <option value={item.equipmentId} key={item.equipmentId}>{item.equipmentName} · #{item.equipmentId}</option>)}</select></label>
            <label className="field"><span>Rental start</span><input type="datetime-local" value={form.rentalStart} onChange={(event) => setForm((current) => ({ ...current, rentalStart: event.target.value }))} required /></label>
            <label className="field"><span>Expected return</span><input type="datetime-local" value={form.expectedReturn} onChange={(event) => setForm((current) => ({ ...current, expectedReturn: event.target.value }))} required /></label>
            <button className="btn-primary" type="submit" disabled={saving || !form.equipmentId}>{saving ? 'Creating…' : 'Create contract'}</button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
