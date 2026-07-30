import { useEffect, useState } from 'react';
import { siteApi } from '../../api/platform';
import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import StatusBadge from '../../components/ui/StatusBadge';
import { EmptyState, FeedbackBanner, PageSkeleton } from '../../components/ui/Feedback';
import { useAsync } from '../../hooks/useAsync';

export default function SiteEquipmentPage() {
  const [siteId, setSiteId] = useState<number | null>(null);
  const sites = useAsync(() => siteApi.sites(), []);
  useEffect(() => { if (siteId == null && sites.data?.data.length) setSiteId(sites.data.data[0].siteId); }, [sites.data, siteId]);
  const resource = useAsync(async () => {
    if (siteId == null) return { equipment: [], checkouts: [] };
    const [equipment, checkouts] = await Promise.all([siteApi.equipment(siteId), siteApi.activeCheckouts(siteId)]);
    return { equipment: equipment.data, checkouts: checkouts.data };
  }, [siteId]);
  return (
    <div>
      <PageHeader title="Site Equipment" subtitle="Authoritative equipment and active checkout views" />
      <div className="toolbar"><label className="field"><span>Site</span><select value={siteId ?? ''} onChange={(event) => setSiteId(Number(event.target.value))}><option value="">Select site</option>{sites.data?.data.map((site) => <option value={site.siteId} key={site.siteId}>{site.siteName}</option>)}</select></label><div className="toolbar-summary"><strong>{resource.data?.equipment.length ?? 0}</strong><span>assigned equipment</span></div><div className="toolbar-summary"><strong>{resource.data?.checkouts.length ?? 0}</strong><span>active checkouts</span></div></div>
      {(sites.error || resource.error) && <FeedbackBanner tone="error">{sites.error ?? resource.error}</FeedbackBanner>}
      {resource.loading ? <PageSkeleton rows={7} /> : <Panel>{!resource.data?.equipment.length ? <EmptyState title="No equipment on this site" message="Use Equipment Assignment or Scan QR to check out a rented machine." /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Equipment</th><th>Contract</th><th>Checkout</th><th>Assigned by</th><th>Status</th></tr></thead><tbody>{resource.data.equipment.map((item) => <tr key={item.assignmentId}><td><strong>{item.equipmentName ?? `Equipment ${item.equipmentId}`}</strong><small>{item.equipmentType}</small></td><td>#{item.contractId}</td><td>{item.checkoutTime ? new Date(item.checkoutTime).toLocaleString() : '—'}</td><td>{item.assignedBy ?? '—'}</td><td><StatusBadge status={item.status ?? 'UNKNOWN'} /></td></tr>)}</tbody></table></div>}</Panel>}
    </div>
  );
}
