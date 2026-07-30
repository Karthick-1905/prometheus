import { fleetApi } from '../../api/platform';
import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import { EmptyState, FeedbackBanner, PageSkeleton } from '../../components/ui/Feedback';
import { useAsync } from '../../hooks/useAsync';

export default function OperatorActivityHistory() {
  const resource = useAsync(() => fleetApi.logs(undefined, 100), []);
  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader title="Activity History" subtitle="Scoped telemetry and alert activity from the backend event log" />
      {resource.error && <FeedbackBanner tone="error">{resource.error}</FeedbackBanner>}
      <Panel>{resource.loading ? <PageSkeleton rows={7} /> : !resource.data?.data.length ? <EmptyState title="No recent activity" message="Telemetry and anomaly events will appear here as equipment reports." /> : <div className="event-timeline">{resource.data.data.map((item, index) => <article key={String(item.id ?? index)}><span className="material-symbols-outlined">{String(item.type).startsWith('ALERT') ? 'warning' : 'sensors'}</span><div><strong>{String(item.type ?? 'Activity')}</strong><p>{String(item.message ?? '')}</p><time>{item.ts ? new Date(String(item.ts)).toLocaleString() : 'Unknown time'}</time></div></article>)}</div>}</Panel>
    </div>
  );
}
