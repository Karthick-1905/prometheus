import { useEffect, useState } from 'react';
import { systemApi } from '../../api/platform';
import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import { FeedbackBanner, PageSkeleton } from '../../components/ui/Feedback';
import { useAsync } from '../../hooks/useAsync';
import { usePwaInstall } from '../../hooks/usePwaInstall';

const SETTINGS_KEY = 'cat_rental_preferences';

export default function SettingsPage() {
  const [compact, setCompact] = useState(() => localStorage.getItem(SETTINGS_KEY) === 'compact');
  const health = useAsync(() => systemApi.health(), []);
  const { isStandalone, canPrompt, showIosTip, isIos, install, dismiss } = usePwaInstall();

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, compact ? 'compact' : 'comfortable');
    document.documentElement.dataset.density = compact ? 'compact' : 'comfortable';
  }, [compact]);

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Settings"
        subtitle="Display preferences, mobile app install, and backend health"
      />

      <Panel title="Mobile app (PWA)">
        {isStandalone ? (
          <p className="text-sm text-on-surface">
            Running as an installed app on this device. You can find{' '}
            <strong>CAT Rental</strong> on your home screen.
          </p>
        ) : (
          <div className="space-y-3 text-sm text-on-surface">
            <p className="text-on-surface-variant">
              Install this site as a mobile web app for full-screen use, home-screen icon, and
              faster relaunch (works offline for the app shell).
            </p>
            {canPrompt && (
              <button type="button" className="btn-primary" onClick={() => void install()}>
                Install on this device
              </button>
            )}
            {(showIosTip || isIos) && !canPrompt && (
              <ol className="list-decimal pl-5 space-y-1 text-on-surface-variant text-xs">
                <li>
                  Tap the <strong>Share</strong> button in Safari
                </li>
                <li>
                  Choose <strong>Add to Home Screen</strong>
                </li>
                <li>
                  Confirm <strong>Add</strong> — open from the home icon next time
                </li>
              </ol>
            )}
            {!canPrompt && !isIos && (
              <p className="text-xs text-on-surface-variant">
                On Android Chrome: open the browser menu → <strong>Install app</strong> /{' '}
                <strong>Add to Home screen</strong>. Use HTTPS (or localhost) for install to appear.
              </p>
            )}
            {(canPrompt || showIosTip) && (
              <button type="button" className="btn-secondary" onClick={dismiss}>
                Hide install tips
              </button>
            )}
          </div>
        )}
      </Panel>

      <Panel title="Display preferences" className="mt-4">
        <label className="setting-row">
          <span>
            <strong>Compact tables</strong>
            <small>Reduce row padding for high-density operational review.</small>
          </span>
          <input
            type="checkbox"
            checked={compact}
            onChange={(event) => setCompact(event.target.checked)}
          />
        </label>
      </Panel>

      <Panel title="Service status" className="mt-4">
        {health.error && <FeedbackBanner tone="error">{health.error}</FeedbackBanner>}
        {health.loading ? (
          <PageSkeleton rows={4} />
        ) : (
          <dl className="detail-grid">
            {Object.entries(health.data ?? {}).map(([key, value]) => (
              <div key={key}>
                <dt>{key.replaceAll('_', ' ')}</dt>
                <dd>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd>
              </div>
            ))}
          </dl>
        )}
      </Panel>
    </div>
  );
}
