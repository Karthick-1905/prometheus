import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  notificationsApi,
  type AppNotification,
} from '../../api/platform';
import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import StatusBadge from '../../components/ui/StatusBadge';
import { EmptyState, FeedbackBanner, PageSkeleton } from '../../components/ui/Feedback';
import { getErrorMessage, useAsync } from '../../hooks/useAsync';

function typeLabel(type: string) {
  switch (type) {
    case 'RENTAL_ENDING_SOON':
      return 'Ending soon';
    case 'RENTAL_OVERDUE':
      return 'Overdue';
    case 'SITE_BOOKED':
      return 'Site booking';
    case 'RENTAL_EXTENDED':
      return 'Extended';
    default:
      return type.replaceAll('_', ' ').toLowerCase();
  }
}

function typeIcon(type: string) {
  switch (type) {
    case 'RENTAL_ENDING_SOON':
      return 'event_upcoming';
    case 'RENTAL_OVERDUE':
      return 'event_busy';
    case 'SITE_BOOKED':
      return 'location_on';
    case 'RENTAL_EXTENDED':
      return 'event_available';
    default:
      return 'notifications';
  }
}

function severityStatus(severity: string) {
  const s = (severity || 'INFO').toUpperCase();
  if (s === 'CRITICAL' || s === 'WARNING' || s === 'INFO') return s;
  return 'INFO';
}

function relativeTime(value?: string | null) {
  if (!value) return '—';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '—';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return new Date(value).toLocaleString();
}

export default function NotificationsPage() {
  const [params, setParams] = useSearchParams();
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const resource = useAsync(async () => {
    // Refresh rental events so ending-soon / overdue appear without a cron job
    await notificationsApi.scan(3, true).catch(() => null);
    return notificationsApi.list(false, 100);
  }, []);

  const items = resource.data?.data ?? [];
  const unread = resource.data?.meta?.unread ?? items.filter((n) => !n.isRead).length;

  const visible = useMemo(() => {
    if (filter === 'unread') return items.filter((n) => !n.isRead);
    return items;
  }, [items, filter]);

  // Deep-link from email: /notifications?extend=123
  useEffect(() => {
    const extendId = params.get('extend');
    if (!extendId || resource.loading) return;
    const contractId = Number(extendId);
    if (!Number.isFinite(contractId)) return;

    let cancelled = false;
    (async () => {
      setActionError(null);
      try {
        const result = await notificationsApi.extendContract(contractId, 7);
        if (cancelled) return;
        const name = String(result.data?.equipmentName ?? `Contract #${contractId}`);
        setNotice(`${name} extended by 7 days. New return: ${String(result.data?.expectedReturn ?? 'updated')}.`);
        setParams({}, { replace: true });
        await resource.reload();
      } catch (error) {
        if (!cancelled) setActionError(getErrorMessage(error));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, resource.loading]);

  const markRead = async (n: AppNotification) => {
    if (n.isRead) return;
    setBusyId(n.notificationId);
    setActionError(null);
    try {
      await notificationsApi.markRead(n.notificationId);
      await resource.reload();
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const markAll = async () => {
    setActionError(null);
    try {
      await notificationsApi.markAllRead();
      setNotice('All notifications marked as read.');
      await resource.reload();
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  };

  const extend = async (n: AppNotification) => {
    if (!n.contractId) return;
    setBusyId(n.notificationId);
    setActionError(null);
    try {
      const result = await notificationsApi.extendContract(n.contractId, 7);
      setNotice(
        `${String(result.data?.equipmentName ?? 'Rental')} extended by 7 days (return ${String(result.data?.expectedReturn ?? 'updated')}).`,
      );
      await notificationsApi.markRead(n.notificationId).catch(() => null);
      await resource.reload();
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const rescan = async () => {
    setActionError(null);
    try {
      const result = await notificationsApi.scan(3, true);
      const created = (result.data?.created ?? {}) as Record<string, number>;
      setNotice(
        `Scan complete — ending soon: ${created.endingSoon ?? 0}, overdue: ${created.overdue ?? 0}, emails: ${created.emails ?? 0}.`,
      );
      await resource.reload();
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  };

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Notifications"
        subtitle="Rental end dates, overdue machines, and site bookings"
        actions={
          <>
            <button className="btn-secondary" type="button" onClick={() => void rescan()}>
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                sync
              </span>
              Check rentals
            </button>
            <button
              className="btn-secondary"
              type="button"
              onClick={() => void markAll()}
              disabled={unread === 0}
            >
              Mark all read
            </button>
            <button className="btn-secondary" type="button" onClick={() => void resource.reload()}>
              Refresh
            </button>
          </>
        }
      />

      {notice && (
        <FeedbackBanner tone="success" onDismiss={() => setNotice(null)}>
          {notice}
        </FeedbackBanner>
      )}
      {(resource.error || actionError) && (
        <FeedbackBanner tone="error" onDismiss={() => setActionError(null)}>
          {resource.error ?? actionError}
        </FeedbackBanner>
      )}

      <div className="toolbar" style={{ marginBottom: 16 }}>
        <div className="segmented" style={{ marginBottom: 0 }}>
          <button
            type="button"
            className={filter === 'all' ? 'is-active' : ''}
            onClick={() => setFilter('all')}
          >
            All ({items.length})
          </button>
          <button
            type="button"
            className={filter === 'unread' ? 'is-active' : ''}
            onClick={() => setFilter('unread')}
          >
            Unread ({unread})
          </button>
        </div>
        <div className="toolbar-summary">
          <strong>{unread}</strong>
          <span>unread</span>
        </div>
      </div>

      <Panel>
        {resource.loading && !resource.data ? (
          <PageSkeleton rows={6} />
        ) : visible.length === 0 ? (
          <EmptyState
            title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            message="Rental ending soon, overdue returns, and site bookings appear here. Use Check rentals to scan contracts."
          />
        ) : (
          <div className="data-list">
            {visible.map((n) => {
              const canExtend =
                Boolean(n.contractId) &&
                (n.type === 'RENTAL_ENDING_SOON' || n.type === 'RENTAL_OVERDUE');
              return (
                <article
                  key={n.notificationId}
                  className={`notification-row ${n.isRead ? 'is-read' : 'is-unread'}`}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    {typeIcon(n.type)}
                  </span>
                  <div className="notification-body">
                    <div className="notification-meta">
                      <StatusBadge status={severityStatus(n.severity)} />
                      <span className="notification-type">{typeLabel(n.type)}</span>
                      <time>{relativeTime(n.createdAt)}</time>
                    </div>
                    <strong>{n.title}</strong>
                    <p>{n.body}</p>
                    <div className="notification-actions">
                      {canExtend && (
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={busyId === n.notificationId}
                          onClick={() => void extend(n)}
                        >
                          Extend 7 days
                        </button>
                      )}
                      {!n.isRead && (
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={busyId === n.notificationId}
                          onClick={() => void markRead(n)}
                        >
                          Mark read
                        </button>
                      )}
                      {n.emailStatus && (
                        <span className="notification-email">
                          Mail: {n.emailStatus.toLowerCase()}
                          {n.recipientEmail ? ` · ${n.recipientEmail}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
