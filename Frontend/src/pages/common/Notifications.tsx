import { alertApi } from '../../api/platform';
import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import StatusBadge from '../../components/ui/StatusBadge';
import { EmptyState, FeedbackBanner, PageSkeleton } from '../../components/ui/Feedback';
import { useAsync } from '../../hooks/useAsync';

export default function NotificationsPage() {
  const resource = useAsync(() => alertApi.list({ resolved: false, limit: 50 }), []);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Notifications" subtitle="Open operational alerts from the backend" actions={<button className="btn-secondary" type="button" onClick={() => void resource.reload()}>Refresh</button>} />
      {resource.error && <FeedbackBanner tone="error">{resource.error}</FeedbackBanner>}
      <Panel>{resource.loading ? <PageSkeleton rows={6} /> : !resource.data?.data.length ? <EmptyState title="No open notifications" message="New anomaly alerts will appear here automatically when you refresh." /> : <div className="data-list">{resource.data.data.map((alert) => <div className="notification-row" key={alert.alertId}><span className="material-symbols-outlined">notification_important</span><div><strong>{alert.description ?? alert.anomalyType}</strong><p>Equipment {alert.equipmentId} · {alert.detectedAt ? new Date(alert.detectedAt).toLocaleString() : 'Unknown time'}</p></div><StatusBadge status={alert.severity ?? 'INFO'} /></div>)}</div>}</Panel>
    </div>
  );
}
