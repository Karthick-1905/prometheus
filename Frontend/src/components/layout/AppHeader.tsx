import { Link } from 'react-router-dom';
import { useRole } from '../../context/RoleContext';

export default function AppHeader({ title, subtitle }: { title?: string; subtitle?: string }) {
  const { roleLabel } = useRole();

  return (
    <header className="flex justify-between items-center px-4 sm:px-8 w-full min-h-16 border-b border-outline-variant bg-surface/95 backdrop-blur sticky top-0 z-30">
      <div>
        {title ? (
          <>
            <h2 className="font-headline-lg text-base sm:text-lg font-bold text-primary tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">analytics</span>
              {title}
            </h2>
            {subtitle && (
              <p className="font-label-md text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">
                {subtitle}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm font-semibold text-on-surface-variant">{roleLabel} workspace</p>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <div className="hidden sm:flex items-center gap-2 bg-surface-container-low border border-outline-variant px-3 py-1 rounded text-xs font-semibold text-on-surface-variant">
          <span className="w-2 h-2 rounded-full bg-[#2E7D32] animate-pulse" />
          Mock mode
        </div>
        <Link
          to="/notifications"
          className="w-9 h-9 rounded-lg border border-outline-variant bg-surface-container flex items-center justify-center hover:bg-surface-container-high"
          title="Notifications"
        >
          <span className="material-symbols-outlined text-lg text-on-surface-variant">notifications</span>
        </Link>
        <Link
          to="/profile"
          className="w-9 h-9 rounded-lg border border-outline-variant bg-primary-container flex items-center justify-center font-black text-xs text-on-primary-container"
          title="Profile"
        >
          DU
        </Link>
      </div>
    </header>
  );
}
