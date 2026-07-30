import { useState } from 'react';
import { dealerApi } from '../../api/platform';
import type { Equipment } from '../../api/types';
import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import StatusBadge from '../../components/ui/StatusBadge';
import { EmptyState, FeedbackBanner, PageSkeleton } from '../../components/ui/Feedback';
import { getErrorMessage, useAsync } from '../../hooks/useAsync';

const blank = { equipmentName: '', equipmentType: 'Excavator', model: '', serialNumber: '', dailyRentalCost: '', status: 'AVAILABLE' };

export default function DealerInventory() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [detail, setDetail] = useState<Equipment | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const resource = useAsync(() => dealerApi.equipment({ q: query, status: status || undefined, limit: 500 }), [query, status]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const body = { ...form, dailyRentalCost: form.dailyRentalCost ? Number(form.dailyRentalCost) : null };
    try {
      if (editing) await dealerApi.updateEquipment(editing.equipmentId, body);
      else await dealerApi.createEquipment(body);
      setMessage({ tone: 'success', text: editing ? 'Equipment changes saved.' : 'Equipment added to dealer inventory.' });
      setEditing(null);
      setForm(blank);
      await resource.reload();
    } catch (error) {
      setMessage({ tone: 'error', text: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const edit = (equipment: Equipment) => {
    setEditing(equipment);
    setForm({ equipmentName: equipment.equipmentName, equipmentType: equipment.equipmentType, model: equipment.model ?? '', serialNumber: equipment.serialNumber ?? '', dailyRentalCost: equipment.dailyRentalCost?.toString() ?? '', status: equipment.status ?? 'AVAILABLE' });
  };

  const inspect = async (equipmentId: number) => {
    setMessage(null);
    try {
      setDetail((await dealerApi.equipmentDetail(equipmentId)).data);
    } catch (error) {
      setMessage({ tone: 'error', text: getErrorMessage(error) });
    }
  };

  const rotate = async (equipment: Equipment) => {
    if (!window.confirm(`Rotate the QR code for ${equipment.equipmentName}? The previous code will stop working.`)) return;
    try {
      const result = await dealerApi.rotateQr(equipment.equipmentId);
      setMessage({ tone: 'success', text: `QR rotated. New code: ${String(result.data.qrCode)}` });
      await resource.reload();
    } catch (error) {
      setMessage({ tone: 'error', text: getErrorMessage(error) });
    }
  };

  return (
    <div>
      <PageHeader title="Equipment Inventory" subtitle="Create, filter, inspect, update, and rotate equipment identifiers" />
      {message && <FeedbackBanner tone={message.tone} onDismiss={() => setMessage(null)}>{message.text}</FeedbackBanner>}
      <div className="toolbar">
        <label className="field"><span>Search</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, type, serial, or QR" /></label>
        <label className="field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{['AVAILABLE', 'RENTED', 'MAINTENANCE'].map((value) => <option key={value}>{value}</option>)}</select></label>
      </div>
      <div className="grid lg:grid-cols-[1fr_340px] gap-4">
        <Panel>
          {resource.error && <FeedbackBanner tone="error">{resource.error}</FeedbackBanner>}
          {resource.loading ? <PageSkeleton rows={7} /> : !resource.data?.data.length ? <EmptyState title="No equipment found" message="Adjust the filters or add the first inventory item." /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Equipment</th><th>Model / serial</th><th>Status</th><th>Daily rate</th><th>Identifiers</th><th /></tr></thead><tbody>{resource.data.data.map((equipment) => <tr key={equipment.equipmentId}><td><strong>{equipment.equipmentName}</strong><small>#{equipment.equipmentId} · {equipment.equipmentType}</small></td><td>{equipment.model ?? '—'}<small>{equipment.serialNumber ?? 'No serial'}</small></td><td><StatusBadge status={equipment.status ?? 'UNKNOWN'} /></td><td>{equipment.dailyRentalCost == null ? '—' : `₹${equipment.dailyRentalCost.toLocaleString()}`}</td><td><small>{equipment.qrCode ?? 'No QR'}<br />{equipment.rfidTag ?? 'No RFID'}</small></td><td><div className="row-actions"><button className="btn-secondary" type="button" onClick={() => void inspect(equipment.equipmentId)}>View</button><button className="btn-secondary" type="button" onClick={() => edit(equipment)}>Edit</button><button className="btn-secondary" type="button" onClick={() => void rotate(equipment)}>Rotate QR</button></div></td></tr>)}</tbody></table></div>}
        </Panel>
        <Panel title={editing ? `Edit #${editing.equipmentId}` : 'Add equipment'}>
          <form className="stack-form" onSubmit={submit}>
            {Object.entries({ equipmentName: 'Equipment name', equipmentType: 'Equipment type', model: 'Model', serialNumber: 'Serial number', dailyRentalCost: 'Daily rental cost' }).map(([key, label]) => <label className="field" key={key}><span>{label}</span><input type={key === 'dailyRentalCost' ? 'number' : 'text'} required={key === 'equipmentName' || key === 'equipmentType'} value={form[key as keyof typeof form]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></label>)}
            <label className="field"><span>Status</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>{['AVAILABLE', 'RENTED', 'MAINTENANCE'].map((value) => <option key={value}>{value}</option>)}</select></label>
            <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add equipment'}</button>
            {editing && <button className="btn-secondary" type="button" onClick={() => { setEditing(null); setForm(blank); }}>Cancel edit</button>}
          </form>
        </Panel>
      </div>
      {detail && <div className="drawer-backdrop" onMouseDown={() => setDetail(null)}><aside className="detail-drawer" onMouseDown={(event) => event.stopPropagation()}><header><div><h2>{detail.equipmentName}</h2><p>{detail.equipmentType} · #{detail.equipmentId}</p></div><button type="button" onClick={() => setDetail(null)} aria-label="Close"><span className="material-symbols-outlined">close</span></button></header><dl className="detail-grid">{Object.entries(detail).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value == null ? '—' : String(value)}</dd></div>)}</dl></aside></div>}
    </div>
  );
}
