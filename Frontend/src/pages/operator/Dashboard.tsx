import { Link } from 'react-router-dom';
import { siteApi } from '../../api/platform';
import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import StatCard from '../../components/ui/StatCard';
import { FeedbackBanner, PageSkeleton } from '../../components/ui/Feedback';
import { useAsync } from '../../hooks/useAsync';

export default function OperatorDashboard() {
  const resource = useAsync(async () => {
    const [sites, assignments] = await Promise.all([siteApi.sites(), siteApi.activeCheckouts()]);
    return { sites: sites.data, assignments: assignments.data };
  }, []);
  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader title="Operator Home" subtitle="Live site and equipment assignment status" />
      {resource.error && <FeedbackBanner tone="error">{resource.error}</FeedbackBanner>}
      {resource.loading ? <PageSkeleton rows={6} /> : <div className="dashboard-content"><div className="grid grid-cols-2 gap-3 mb-6"><StatCard label="Active assignments" value={resource.data?.assignments.length ?? 0} icon="precision_manufacturing" /><StatCard label="Company sites" value={resource.data?.sites.length ?? 0} icon="domain" /></div><Panel title="Quick actions"><div className="quick-actions"><Link to="/operator/scan"><span className="material-symbols-outlined">qr_code_scanner</span><strong>Scan equipment</strong><small>Verify QR or RFID and record movement</small></Link><Link to="/operator/assignment"><span className="material-symbols-outlined">handyman</span><strong>Current assignments</strong><small>Review active equipment checkouts</small></Link></div></Panel></div>}
    </div>
  );
}
