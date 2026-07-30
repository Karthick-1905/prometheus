import { siteApi } from '../../api/platform';
import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import StatusBadge from '../../components/ui/StatusBadge';
import { EmptyState, FeedbackBanner, PageSkeleton } from '../../components/ui/Feedback';
import { useAsync } from '../../hooks/useAsync';

export default function OperatorCurrentAssignment() {
  const resource = useAsync(() => siteApi.activeCheckouts(), []);
  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="Current Assignments" subtitle="Active equipment checkouts in your scoped sites" actions={<button className="btn-secondary" type="button" onClick={() => void resource.reload()}>Refresh</button>} />
      {resource.error && <FeedbackBanner tone="error">{resource.error}</FeedbackBanner>}
      <Panel>{resource.loading ? <PageSkeleton rows={5} /> : !resource.data?.data.length ? <EmptyState title="No current assignment" message="Scan an equipment identifier and check it out to a site." /> : <div className="data-list">{resource.data.data.map((item) => <article className="assignment-ticket" key={item.assignmentId}><header><div><h3>{item.equipmentName ?? `Equipment ${item.equipmentId}`}</h3><p>{item.equipmentType} · Contract #{item.contractId}</p></div><StatusBadge status={item.status ?? 'UNKNOWN'} /></header><dl><div><dt>Site</dt><dd>{item.siteName}</dd></div><div><dt>Checked out</dt><dd>{item.checkoutTime ? new Date(item.checkoutTime).toLocaleString() : '—'}</dd></div><div><dt>Assignment</dt><dd>#{item.assignmentId}</dd></div></dl></article>)}</div>}</Panel>
    </div>
  );
}
