import { siteApi } from '../../api/platform';
import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import StatusBadge from '../../components/ui/StatusBadge';
import { EmptyState, FeedbackBanner, PageSkeleton } from '../../components/ui/Feedback';
import { useAsync } from '../../hooks/useAsync';

export default function SiteOperators() {
  const resource = useAsync(() => siteApi.operators(), []);
  return (
    <div>
      <PageHeader title="Operator Roster" subtitle="Site personnel availability and active equipment responsibility" />
      {resource.error && <FeedbackBanner tone="error">{resource.error}</FeedbackBanner>}
      <Panel>
        {resource.loading ? <PageSkeleton rows={6} /> : !resource.data?.data.length ? <EmptyState title="No operators found" message="Add site personnel to the company user directory before assigning equipment." /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Operator</th><th>Contact</th><th>Equipment</th><th>Site</th><th>Checked out</th><th>Availability</th></tr></thead><tbody>{resource.data.data.map((item) => <tr key={item.userId}><td><strong>{item.name ?? item.operatorId}</strong><small>{item.operatorId} · {item.role?.replaceAll('_', ' ') ?? 'Site personnel'}</small></td><td>{item.email ?? '—'}</td><td>{item.equipmentName ?? 'No active equipment'}</td><td>{item.siteName ?? '—'}</td><td>{item.checkedOutAt ? new Date(item.checkedOutAt).toLocaleString() : '—'}</td><td><StatusBadge status={item.availability} /></td></tr>)}</tbody></table></div>}
      </Panel>
      <p className="source-note">Operator IDs are stable user-directory identifiers. Active responsibility is derived from the latest open checkout.</p>
    </div>
  );
}
