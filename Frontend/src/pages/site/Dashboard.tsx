import { useEffect, useState } from 'react';
import { liveApi, siteApi } from '../../api/platform';
import type { StreamEvent } from '../../api/client';
import type { Site } from '../../api/types';
import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import StatCard from '../../components/ui/StatCard';
import StatusBadge from '../../components/ui/StatusBadge';
import { EmptyState, FeedbackBanner, PageSkeleton } from '../../components/ui/Feedback';
import { getErrorMessage, useAsync } from '../../hooks/useAsync';

export default function SiteDashboard() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState({
    siteName: '',
    location: '',
    latitude: '',
    longitude: '',
    status: 'ACTIVE',
  });
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [live, setLive] = useState<StreamEvent[]>([]);
  const sites = useAsync(() => siteApi.sites(), []);

  useEffect(() => {
    if (selectedId == null && sites.data?.data.length) setSelectedId(sites.data.data[0].siteId);
  }, [sites.data, selectedId]);

  const site = useAsync(async () => {
    if (selectedId == null) return null;
    const [detail, summary] = await Promise.all([siteApi.site(selectedId), siteApi.summary(selectedId)]);
    return { detail: detail.data, summary: summary.data };
  }, [selectedId]);

  useEffect(() => {
    if (selectedId == null) return;
    const controller = new AbortController();
    setLive([]);
    liveApi.site(selectedId, (event) => setLive((current) => [event, ...current].slice(0, 8)), controller.signal).catch((error) => {
      if (!controller.signal.aborted) setMessage({ tone: 'error', text: getErrorMessage(error) });
    });
    return () => controller.abort();
  }, [selectedId]);

  const createSite = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const created = await siteApi.createSite({
        ...form,
        latitude: form.latitude === '' ? null : Number(form.latitude),
        longitude: form.longitude === '' ? null : Number(form.longitude),
      });
      setMessage({ tone: 'success', text: `${created.data.siteName} created.` });
      setForm({
        siteName: '',
        location: '',
        latitude: '',
        longitude: '',
        status: 'ACTIVE',
      });
      await sites.reload();
      setSelectedId(created.data.siteId);
    } catch (error) {
      setMessage({ tone: 'error', text: getErrorMessage(error) });
    }
  };

  const summary = site.data?.summary;
  return (
    <div>
      <PageHeader title="Site Manager Dashboard" subtitle="Site scope, active assignments, and authenticated live equipment status" />
      {message && <FeedbackBanner tone={message.tone} onDismiss={() => setMessage(null)}>{message.text}</FeedbackBanner>}
      <div className="toolbar">
        <label className="field"><span>Active site</span><select value={selectedId ?? ''} onChange={(event) => setSelectedId(Number(event.target.value))}><option value="">Select a site</option>{sites.data?.data.map((item) => <option value={item.siteId} key={item.siteId}>{item.siteName}</option>)}</select></label>
      </div>
      {(sites.error || site.error) && <FeedbackBanner tone="error">{sites.error ?? site.error}</FeedbackBanner>}
      {sites.loading || site.loading ? <PageSkeleton rows={7} /> : (
        <div className="dashboard-content">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard label="Active assignments" value={summary?.activeAssignments ?? 0} icon="assignment" />
            <StatCard label="Live working" value={Number(summary?.liveWorking ?? 0)} icon="play_circle" accent="success" />
            <StatCard label="Live updates" value={live.length} icon="sensors" />
            <StatCard label="Site status" value={summary?.status ?? '—'} icon="domain" />
          </div>
          <div className="grid lg:grid-cols-[1.2fr_.8fr] gap-4">
            <Panel title={summary?.siteName ?? 'Site equipment'}>
              {!summary?.equipment.length ? <EmptyState title="No equipment assigned" message="Create an assignment or check equipment out to this site." /> : <div className="data-list">{summary.equipment.map((assignment) => <div className="data-list-row compact" key={assignment.assignmentId}><div><strong>{assignment.equipmentName ?? `Equipment ${assignment.equipmentId}`}</strong><span>Contract #{assignment.contractId} · checked out {assignment.checkoutTime ? new Date(assignment.checkoutTime).toLocaleString() : '—'}</span></div><StatusBadge status={assignment.status ?? 'UNKNOWN'} /></div>)}</div>}
            </Panel>
            <Panel title="Create site">
              <form className="stack-form" onSubmit={createSite}>
                <label className="field"><span>Site name</span><input value={form.siteName} onChange={(event) => setForm((current) => ({ ...current, siteName: event.target.value }))} required /></label>
                <label className="field"><span>Location label</span><input value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} placeholder="North Pit" /></label>
                <div className="form-grid-2">
                  <label className="field"><span>Latitude</span><input type="number" step="0.000001" min="-90" max="90" value={form.latitude} onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value }))} placeholder="37.774900" required /></label>
                  <label className="field"><span>Longitude</span><input type="number" step="0.000001" min="-180" max="180" value={form.longitude} onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value }))} placeholder="-122.419400" required /></label>
                </div>
                <p className="field-hint">Live machinery coordinates inside the configured radius are marked at this site.</p>
                <label className="field"><span>Status</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option>ACTIVE</option><option>ON_HOLD</option><option>COMPLETED</option></select></label>
                <button className="btn-primary" type="submit">Create site</button>
              </form>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
