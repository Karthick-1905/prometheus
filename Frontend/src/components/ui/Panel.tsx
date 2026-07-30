export default function Panel({
  title,
  children,
  action,
  className = '',
}: {
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/60">
          {title && (
            <h3 className="font-title-md text-sm font-bold text-on-surface uppercase tracking-wide">
              {title}
            </h3>
          )}
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}
