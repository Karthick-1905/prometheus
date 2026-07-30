import { siteApi } from '../../api/platform';
import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import StatusBadge from '../../components/ui/StatusBadge';
import { EmptyState, FeedbackBanner, PageSkeleton } from '../../components/ui/Feedback';
import { useAsync } from '../../hooks/useAsync';

export default function SiteOperators() {
  const resource = useAsync(() => siteApi.assignments(), []);
  return (
    <div>
      <PageHeader title="Assignment Actors" subtitle="Users recorded on active equipment assignments" />
      {resource.error && <FeedbackBanner tone="error">{resource.error}</FeedbackBanner>}
      <Panel>
        {resource.loading ? <PageSkeleton rows={6} /> : !resource.data?.data.length ? <EmptyState title="No assignment actors" message="Operator attribution appears after an assignment or checkout is recorded." /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Actor user</th><th>Equipment</th><th>Site</th><th>Checked out</th><th>Status</th></tr></thead><tbody>{resource.data.data.map((item) => <tr key={item.assignmentId}><td><strong>User #{item.assignedBy ?? '—'}</strong></td><td>{item.equipmentName ?? item.equipmentId}</td><td>{item.siteName}</td><td>{item.checkoutTime ? new Date(item.checkoutTime).toLocaleString() : '—'}</td><td><StatusBadge status={item.status ?? 'UNKNOWN'} /></td></tr>)}</tbody></table></div>}
      </Panel>
      <p className="source-note">The backend does not currently expose a standalone operator roster endpoint; this view intentionally shows only actors present in assignment records.</p>
    </div>
  );
}
