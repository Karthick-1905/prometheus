import { useEffect, useState } from 'react';
import { systemApi } from '../../api/platform';
import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import { FeedbackBanner, PageSkeleton } from '../../components/ui/Feedback';
import { useAsync } from '../../hooks/useAsync';

const SETTINGS_KEY = 'cat_rental_preferences';
export default function SettingsPage() {
  const [compact, setCompact] = useState(() => localStorage.getItem(SETTINGS_KEY) === 'compact');
  const health = useAsync(() => systemApi.health(), []);
  useEffect(() => { localStorage.setItem(SETTINGS_KEY, compact ? 'compact' : 'comfortable'); document.documentElement.dataset.density = compact ? 'compact' : 'comfortable'; }, [compact]);
  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" subtitle="Local display preferences and live backend health" />
      <Panel title="Display preferences"><label className="setting-row"><span><strong>Compact tables</strong><small>Reduce row padding for high-density operational review.</small></span><input type="checkbox" checked={compact} onChange={(event) => setCompact(event.target.checked)} /></label></Panel>
      <Panel title="Service status" className="mt-4">{health.error && <FeedbackBanner tone="error">{health.error}</FeedbackBanner>}{health.loading ? <PageSkeleton rows={4} /> : <dl className="detail-grid">{Object.entries(health.data ?? {}).map(([key, value]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd></div>)}</dl>}</Panel>
    </div>
  );
}
