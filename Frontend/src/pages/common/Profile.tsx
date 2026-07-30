import { authApi } from '../../api/platform';
import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import { FeedbackBanner, PageSkeleton } from '../../components/ui/Feedback';
import { useRole } from '../../context/RoleContext';
import { getErrorMessage, useAsync } from '../../hooks/useAsync';
import { useState } from 'react';

export default function ProfilePage() {
  const { clearRole, refreshSession } = useRole();
  const resource = useAsync(() => authApi.me(), []);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const refresh = async () => {
    try {
      await refreshSession();
      await resource.reload();
      setMessage({ tone: 'success', text: 'Access token refreshed and identity revalidated.' });
    } catch (error) {
      setMessage({ tone: 'error', text: getErrorMessage(error) });
    }
  };
  const user = resource.data?.user;
  return (
    <div className="max-w-2xl">
      <PageHeader title="Profile & Access" subtitle="Backend-verified session identity and permissions" />
      {message && <FeedbackBanner tone={message.tone}>{message.text}</FeedbackBanner>}
      {resource.error && <FeedbackBanner tone="error">{resource.error}</FeedbackBanner>}
      <Panel>{resource.loading ? <PageSkeleton rows={6} /> : user && <><div className="profile-hero"><div>{user.actorId.slice(0, 2).toUpperCase()}</div><span><strong>{user.actorId}</strong><small>{user.role.replaceAll('_', ' ')}</small></span></div><dl className="detail-grid"><div><dt>Authentication</dt><dd>{user.authMode}</dd></div><div><dt>Company scope</dt><dd>{user.companyId ?? 'Not set'}</dd></div><div><dt>Dealer scope</dt><dd>{user.dealerId ?? 'Not set'}</dd></div><div><dt>Site scope</dt><dd>{user.siteId ?? 'All permitted sites'}</dd></div>{Object.entries(user.permissions).map(([permission, allowed]) => <div key={permission}><dt>{permission}</dt><dd>{allowed ? 'Allowed' : 'Not allowed'}</dd></div>)}</dl><div className="row-actions profile-actions"><button className="btn-primary" type="button" onClick={() => void refresh()}>Refresh session</button><button className="btn-secondary" type="button" onClick={clearRole}>Sign out</button></div></>}</Panel>
    </div>
  );
}
