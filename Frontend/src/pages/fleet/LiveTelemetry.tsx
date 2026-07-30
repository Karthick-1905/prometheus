import { useEffect, useState } from 'react';
import { liveApi, telemetryApi } from '../../api/platform';
import type { StreamEvent } from '../../api/client';
import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import { EmptyState, FeedbackBanner, PageSkeleton } from '../../components/ui/Feedback';
import { getErrorMessage, useAsync } from '../../hooks/useAsync';

type Channel = 'fleet' | 'logs' | 'alerts';

export default function FleetLiveTelemetry() {
  const [channel, setChannel] = useState<Channel>('fleet');
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const snapshot = useAsync(() => telemetryApi.snapshot(), []);

  useEffect(() => {
    const controller = new AbortController();
    setEvents([]);
    setStreamError(null);
    setConnected(true);
    liveApi[channel](
      (event) => {
        setEvents((current) => [event, ...current].slice(0, 80));
        if (event.event === 'error') setStreamError(String((event.data as { message?: string })?.message ?? 'Live stream error'));
      },
      controller.signal,
    )
      .catch((error) => {
        if (!controller.signal.aborted) setStreamError(getErrorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setConnected(false);
      });
    return () => controller.abort();
  }, [channel]);

  return (
    <div>
      <PageHeader title="Live Telemetry" subtitle="Authenticated server-sent fleet, event-log, and alert channels" />
      <div className="segmented" role="tablist" aria-label="Live stream channel">
        {(['fleet', 'logs', 'alerts'] as Channel[]).map((value) => <button key={value} type="button" role="tab" aria-selected={channel === value} className={channel === value ? 'is-active' : ''} onClick={() => setChannel(value)}>{value === 'fleet' ? 'Fleet snapshots' : value === 'logs' ? 'Activity logs' : 'Open alerts'}</button>)}
        <span className={`connection ${connected ? 'is-live' : ''}`}><i />{connected ? 'Connected' : 'Stream ended'}</span>
      </div>
      {streamError && <FeedbackBanner tone="error">{streamError}</FeedbackBanner>}
      <div className="grid lg:grid-cols-[1.25fr_.75fr] gap-4">
        <Panel title="Live event feed">
          {!events.length ? <PageSkeleton rows={5} /> : <div className="event-feed">{events.map((event, index) => <article key={`${event.id}-${event.event}-${index}`}><header><strong>{event.event}</strong><time>Event {event.id ?? '—'}</time></header><pre>{JSON.stringify(event.data, null, 2)}</pre></article>)}</div>}
        </Panel>
        <Panel title="Compatibility telemetry snapshot">
          {snapshot.error && <FeedbackBanner tone="error">{snapshot.error}</FeedbackBanner>}
          {snapshot.loading ? <PageSkeleton rows={5} /> : !snapshot.data?.snapshot.length ? <EmptyState title="No snapshot data" message="The legacy telemetry snapshot has no equipment samples yet." /> : <div className="data-list">{snapshot.data.snapshot.slice(0, 20).map((row, index) => <div className="data-list-row compact" key={String(row.equipmentId ?? index)}><div><strong>Equipment {String(row.equipmentId ?? '—')}</strong><span>{String(row.siteName ?? 'Unassigned')}</span></div><span>{String(row.fuelLevel ?? '—')}% fuel</span></div>)}</div>}
        </Panel>
      </div>
    </div>
  );
}
