export function FeedbackBanner({
  tone,
  children,
  onDismiss,
}: {
  tone: 'success' | 'error' | 'warning' | 'info';
  children: React.ReactNode;
  onDismiss?: () => void;
}) {
  const icon = {
    success: 'check_circle',
    error: 'error',
    warning: 'warning',
    info: 'info',
  }[tone];
  return (
    <div className={`feedback feedback-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
      <div>{children}</div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss message">
          <span className="material-symbols-outlined" aria-hidden="true">close</span>
        </button>
      )}
    </div>
  );
}

export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="skeleton-stack" aria-busy="true" aria-label="Loading content">
      {Array.from({ length: rows }, (_, index) => (
        <div className="skeleton-line" key={index} style={{ width: `${100 - index * 7}%` }} />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="material-symbols-outlined" aria-hidden="true">inventory_2</span>
      <h3>{title}</h3>
      <p>{message}</p>
      {action}
    </div>
  );
}
