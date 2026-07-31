import { useEffect, useMemo, useState } from 'react';
import { liveApi, telemetryApi } from '../../api/platform';
import type { StreamEvent } from '../../api/client';
import type { JsonRecord } from '../../api/types';
import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import { EmptyState, FeedbackBanner, PageSkeleton } from '../../components/ui/Feedback';
import { getErrorMessage, useAsync } from '../../hooks/useAsync';

type Channel = 'logs' | 'fleet' | 'alerts';

type LiveLog = {
  id?: string;
  type?: string;
  ts?: string;
  equipmentId?: string;
  equipmentType?: string;
  siteId?: string;
  message?: string;
  severity?: string;
  anomalyType?: string;
  stored?: boolean;
  redisPublished?: boolean;
  alertCount?: number;
  telemetry?: JsonRecord;
};

type GeofenceCoordinate = {
  equipmentId: string;
  internalEquipmentId?: number;
  equipmentType?: string;
  operatorId?: string | null;
  engineStatus?: string | null;
  latitude: number;
  longitude: number;
  siteId?: number | null;
  siteName?: string | null;
  status: string;
  isAtSite: boolean;
  isActive: boolean;
  isWorking: boolean;
  distanceMeters?: number | null;
  radiusMeters: number;
  observedAt?: string;
};

function asLog(data: unknown): LiveLog | null {
  if (!data || typeof data !== 'object') return null;
  return data as LiveLog;
}

function mergeGeofences(
  current: GeofenceCoordinate[],
  incoming: GeofenceCoordinate[],
): GeofenceCoordinate[] {
  const latest = new Map(current.map((item) => [item.equipmentId, item]));
  incoming.forEach((item) => latest.set(item.equipmentId, item));
  return [...latest.values()]
    .sort((left, right) => {
      const leftTime = new Date(left.observedAt ?? 0).getTime();
      const rightTime = new Date(right.observedAt ?? 0).getTime();
      return rightTime - leftTime;
    })
    .slice(0, 200);
}

function geofenceLabel(status: string) {
  if (status === 'ACTIVE_WORKING') return 'At site · working';
  if (status === 'AT_SITE_IDLE') return 'At site · engine off';
  if (status === 'OUTSIDE_SITE') return 'Outside site';
  if (status === 'SITE_COORDINATES_MISSING') return 'Site coordinates missing';
  if (status === 'LOCATION_INVALID') return 'Invalid coordinates';
  if (status === 'LOCATION_UNKNOWN') return 'Location unavailable';
  return 'Site unresolved';
}

function formatTime(ts?: string) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return ts;
  }
}

export default function FleetLiveTelemetry() {
  const [channel, setChannel] = useState<Channel>('logs');
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [liveLogs, setLiveLogs] = useState<LiveLog[]>([]);
  const [connected, setConnected] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [redisInfo, setRedisInfo] = useState<JsonRecord | null>(null);
  const [filterEq, setFilterEq] = useState('');
  const [geofences, setGeofences] = useState<GeofenceCoordinate[]>([]);
  const [geofenceConnected, setGeofenceConnected] = useState(false);
  const [geofenceError, setGeofenceError] = useState<string | null>(null);
  const snapshot = useAsync(() => telemetryApi.snapshot(), []);
  const redisStatus = useAsync(() => liveApi.redisStatus(), []);

  useEffect(() => {
    if (redisStatus.data?.data) setRedisInfo(redisStatus.data.data as JsonRecord);
  }, [redisStatus.data]);

  useEffect(() => {
    const controller = new AbortController();
    setEvents([]);
    setLiveLogs([]);
    setStreamError(null);
    setConnected(true);

    const onEvent = (event: StreamEvent) => {
      setEvents((current) => [event, ...current].slice(0, 120));

      if (event.event === 'error') {
        setStreamError(
          String((event.data as { message?: string })?.message ?? 'Live stream error'),
        );
        return;
      }

      if (event.event === 'stream.ready') {
        const data = event.data as { redis?: JsonRecord };
        if (data?.redis) setRedisInfo(data.redis);
        return;
      }

      if (event.event === 'log.history') {
        const batch = (event.data as { logs?: LiveLog[] })?.logs ?? [];
        setLiveLogs(batch.slice().reverse().slice(0, 100));
        return;
      }

      if (event.event === 'log.append') {
        const log = asLog(event.data);
        if (log) setLiveLogs((curr) => [log, ...curr].slice(0, 120));
        return;
      }

      if (event.event === 'log.batch') {
        const batch = (event.data as { logs?: LiveLog[] })?.logs ?? [];
        setLiveLogs((curr) => [...batch, ...curr].slice(0, 120));
      }
    };

    const run =
      channel === 'logs'
        ? liveApi.logs(onEvent, controller.signal, {
            equipmentId: filterEq.trim() || undefined,
            maxSeconds: 300,
          })
        : channel === 'fleet'
          ? liveApi.fleet(onEvent, controller.signal)
          : liveApi.alerts(onEvent, controller.signal);

    run
      .catch((error) => {
        if (!controller.signal.aborted) setStreamError(getErrorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setConnected(false);
      });

    return () => controller.abort();
  }, [channel, filterEq]);

  useEffect(() => {
    const controller = new AbortController();
    setGeofenceError(null);
    const onEvent = (event: StreamEvent) => {
      if (event.event === 'geofence.ready') {
        setGeofenceConnected(true);
        return;
      }
      if (event.event === 'error') {
        setGeofenceError(
          String((event.data as { message?: string })?.message ?? 'Geofence stream error'),
        );
        return;
      }
      if (event.event === 'geofence.snapshot' || event.event === 'geofence.batch') {
        const coordinates =
          (event.data as { coordinates?: GeofenceCoordinate[] })?.coordinates ?? [];
        setGeofences((current) => mergeGeofences(current, coordinates));
      }
    };
    liveApi
      .geofences(onEvent, controller.signal, 300)
      .catch((error) => {
        if (!controller.signal.aborted) setGeofenceError(getErrorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setGeofenceConnected(false);
      });
    return () => controller.abort();
  }, []);

  const stats = useMemo(() => {
    const telemetry = liveLogs.filter((l) => l.type === 'TELEMETRY_RECEIVED').length;
    const alerts = liveLogs.filter((l) => l.type === 'ALERT_RAISED').length;
    const machines = new Set(liveLogs.map((l) => l.equipmentId).filter(Boolean)).size;
    return { telemetry, alerts, machines, total: liveLogs.length };
  }, [liveLogs]);
  const geofenceStats = useMemo(
    () => ({
      working: geofences.filter((item) => item.status === 'ACTIVE_WORKING').length,
      atSite: geofences.filter((item) => item.isAtSite).length,
      outside: geofences.filter((item) => item.status === 'OUTSIDE_SITE').length,
      unknown: geofences.filter((item) => !item.isAtSite && item.status !== 'OUTSIDE_SITE').length,
    }),
    [geofences],
  );
  const visibleGeofences = useMemo(
    () =>
      filterEq.trim()
        ? geofences.filter((item) => item.equipmentId.includes(filterEq.trim()))
        : geofences,
    [filterEq, geofences],
  );

  return (
    <div>
      <PageHeader
        title="Live Telemetry & Logs"
        subtitle="Machinery packets published by ingestion → Redis → SSE into this view"
      />

      <div className="live-toolbar">
        <div className="segmented" role="tablist" aria-label="Live stream channel">
          {(
            [
              ['logs', 'Live logs (Redis)'],
              ['fleet', 'Fleet snapshots'],
              ['alerts', 'Open alerts'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={channel === value}
              className={channel === value ? 'is-active' : ''}
              onClick={() => setChannel(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <span className={`connection ${connected ? 'is-live' : ''}`}>
          <i />
          {connected ? 'Connected' : 'Stream ended — switch channel or refresh'}
        </span>
      </div>

      {channel === 'logs' && (
        <div className="live-meta-row">
          <div className={`redis-pill ${redisInfo?.ok ? 'is-ok' : 'is-down'}`}>
            Redis {redisInfo?.ok ? 'online' : 'offline'}
            {redisInfo?.channel ? ` · ${String(redisInfo.channel)}` : ''}
            {redisInfo?.recentCount != null ? ` · buffer ${String(redisInfo.recentCount)}` : ''}
          </div>
          <label className="live-filter">
            Equipment filter
            <input
              value={filterEq}
              onChange={(e) => setFilterEq(e.target.value)}
              placeholder="e.g. 12"
              inputMode="numeric"
            />
          </label>
          <div className="live-stats">
            <span>{stats.total} events</span>
            <span>{stats.telemetry} telemetry</span>
            <span>{stats.alerts} alerts</span>
            <span>{stats.machines} machines</span>
          </div>
        </div>
      )}

      {streamError && <FeedbackBanner tone="error">{streamError}</FeedbackBanner>}
      {geofenceError && <FeedbackBanner tone="warning">{geofenceError}</FeedbackBanner>}
      {!redisInfo?.ok && channel === 'logs' && (
        <FeedbackBanner tone="warning">
          Redis is offline. Start it with <code>cd Backend && make up</code>, then run{' '}
          <code>make run-live-logs</code> (or MQTT publisher + subscriber) so ingestion publishes
          live events.
        </FeedbackBanner>
      )}

      <div className="grid lg:grid-cols-[1.35fr_.65fr] gap-4">
        <Panel
          title={
            channel === 'logs'
              ? 'Machine live log stream'
              : channel === 'fleet'
                ? 'Fleet snapshot events'
                : 'Alert stream'
          }
        >
          {channel === 'logs' ? (
            !liveLogs.length ? (
              connected ? (
                <PageSkeleton rows={6} />
              ) : (
                <EmptyState
                  title="No live logs yet"
                  message="Start Redis + the live log publisher (or MQTT pipeline). New telemetry will appear here within a second."
                />
              )
            ) : (
              <div className="live-log-feed" aria-live="polite">
                {liveLogs.map((log, index) => (
                  <article
                    key={`${log.id ?? index}-${log.ts ?? index}`}
                    className={`live-log-card type-${(log.type ?? 'event').toLowerCase()}`}
                  >
                    <header>
                      <div className="live-log-badges">
                        <span className="badge-type">{log.type ?? 'EVENT'}</span>
                        {log.severity && (
                          <span className={`badge-sev sev-${log.severity.toLowerCase()}`}>
                            {log.severity}
                          </span>
                        )}
                        {log.stored === false && <span className="badge-warn">not stored</span>}
                      </div>
                      <time>{formatTime(log.ts)}</time>
                    </header>
                    <div className="live-log-body">
                      <strong>
                        EQ {log.equipmentId ?? '—'}
                        {log.equipmentType ? ` · ${log.equipmentType}` : ''}
                        {log.siteId ? ` · site ${log.siteId}` : ''}
                      </strong>
                      <p>{log.message ?? log.anomalyType ?? '—'}</p>
                      {log.telemetry && (
                        <div className="live-tel-chips">
                          {log.telemetry.engineStatus != null && (
                            <span>Engine {String(log.telemetry.engineStatus)}</span>
                          )}
                          {log.telemetry.engineTemperature != null && (
                            <span>{String(log.telemetry.engineTemperature)}°C</span>
                          )}
                          {log.telemetry.fuelLevel != null && (
                            <span>Fuel {String(log.telemetry.fuelLevel)}%</span>
                          )}
                          {log.telemetry.speed != null && (
                            <span>{String(log.telemetry.speed)} km/h</span>
                          )}
                          {log.telemetry.loadPercentage != null && (
                            <span>Load {String(log.telemetry.loadPercentage)}%</span>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )
          ) : !events.length ? (
            <PageSkeleton rows={5} />
          ) : (
            <div className="event-feed">
              {events.map((event, index) => (
                <article key={`${event.id}-${event.event}-${index}`}>
                  <header>
                    <strong>{event.event}</strong>
                    <time>Event {event.id ?? '—'}</time>
                  </header>
                  <pre>{JSON.stringify(event.data, null, 2)}</pre>
                </article>
              ))}
            </div>
          )}
        </Panel>

        <div className="stack-panels">
          <Panel title="Live site presence">
            <div className="geofence-panel-head">
              <span className={`connection ${geofenceConnected ? 'is-live' : ''}`}>
                <i />
                {geofenceConnected ? 'Geofence stream live' : 'Geofence stream ended'}
              </span>
              <span className="geofence-radius">
                {Math.round(geofences[0]?.radiusMeters ?? 250)} m site radius
              </span>
            </div>
            <div className="geofence-summary" aria-label="Live geofence summary">
              <div><strong>{geofenceStats.working}</strong><span>Working</span></div>
              <div><strong>{geofenceStats.atSite}</strong><span>At site</span></div>
              <div><strong>{geofenceStats.outside}</strong><span>Outside</span></div>
              <div><strong>{geofenceStats.unknown}</strong><span>Unknown</span></div>
            </div>
            {!visibleGeofences.length ? (
              geofenceConnected ? (
                <PageSkeleton rows={4} />
              ) : (
                <EmptyState
                  title="No coordinate batches yet"
                  message="Ingest telemetry with a site ID and GPS coordinates to start live presence checks."
                />
              )
            ) : (
              <div className="geofence-list" aria-live="polite">
                {visibleGeofences.slice(0, 20).map((item) => (
                  <article className="geofence-row" key={item.equipmentId}>
                    <div className={`geofence-state state-${item.status.toLowerCase()}`}>
                      <i aria-hidden="true" />
                      <span>{geofenceLabel(item.status)}</span>
                    </div>
                    <div className="geofence-machine">
                      <strong>
                        EQ {item.equipmentId}
                        {item.equipmentType ? ` · ${item.equipmentType}` : ''}
                      </strong>
                      <span>{item.siteName ?? 'No assigned site'}</span>
                    </div>
                    <dl>
                      <div>
                        <dt>Distance</dt>
                        <dd>
                          {item.distanceMeters == null
                            ? '—'
                            : `${Math.round(item.distanceMeters)} m`}
                        </dd>
                      </div>
                      <div>
                        <dt>Coordinates</dt>
                        <dd>{item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}</dd>
                      </div>
                    </dl>
                    <time>{formatTime(item.observedAt)}</time>
                  </article>
                ))}
              </div>
            )}
          </Panel>
          <Panel title="How live logs flow">
            <ol className="howto-list">
              <li>
                <code>make up</code> — Redis on :6380
              </li>
              <li>
                <code>make run-api</code> — FastAPI SSE
              </li>
              <li>
                <code>make run-live-logs</code> — demo publisher → ingestion → Redis
              </li>
              <li>
                Or MQTT: <code>make run-subscriber</code> + <code>make run-publisher</code>
              </li>
            </ol>
          </Panel>
          <Panel title="Legacy telemetry snapshot">
            {snapshot.error && <FeedbackBanner tone="error">{snapshot.error}</FeedbackBanner>}
            {snapshot.loading ? (
              <PageSkeleton rows={5} />
            ) : !snapshot.data?.snapshot.length ? (
              <EmptyState
                title="No snapshot data"
                message="The legacy telemetry snapshot has no equipment samples yet."
              />
            ) : (
              <div className="data-list">
                {snapshot.data.snapshot.slice(0, 16).map((row, index) => (
                  <div className="data-list-row compact" key={String(row.equipmentId ?? index)}>
                    <div>
                      <strong>Equipment {String(row.equipmentId ?? '—')}</strong>
                      <span>{String(row.siteName ?? 'Unassigned')}</span>
                    </div>
                    <span>{String(row.fuelLevel ?? '—')}% fuel</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
