import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useRole } from '../../context/RoleContext';
import { COMMON_NAV, ROLE_NAV } from '../../types/roles';
import { readApiSession } from '../../api/client';

export default function AppHeader({ title, subtitle }: { title?: string; subtitle?: string }) {
  const { role, roleLabel, user } = useRole();
  const [open, setOpen] = useState(false);
  const items = role ? ROLE_NAV[role] : [];
  const actor = user?.actorId ?? readApiSession()?.actorId ?? 'User';

  return (
    <header
      className="sticky top-0 z-30 border-b border-outline-variant bg-surface/95 backdrop-blur"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="flex justify-between items-center px-3 sm:px-8 w-full min-h-14 sm:min-h-16">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="motion-control md:hidden w-9 h-9 rounded-lg border border-outline-variant bg-surface-container flex items-center justify-center cursor-pointer"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            <span className={`menu-icon material-symbols-outlined ${open ? 'is-open' : ''}`}>{open ? 'close' : 'menu'}</span>
          </button>
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
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="connection-status hidden sm:flex items-center gap-2 bg-surface-container-low border border-outline-variant px-3 py-1 rounded text-xs font-semibold text-on-surface-variant">
            <span className="connection-dot w-2 h-2 rounded-full bg-[#2E7D32]" />
            API connected
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
            {actor.slice(0, 2).toUpperCase()}
          </Link>
        </div>
      </div>

      {open && (
        <nav className="mobile-menu md:hidden border-t border-outline-variant bg-surface-container-low px-3 py-2 flex flex-col gap-1 max-h-[60vh] overflow-y-auto">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold uppercase ${
                  isActive ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant'
                }`
              }
            >
              <span className="material-symbols-outlined text-lg">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
          <div className="border-t border-outline-variant/50 my-1" />
          {COMMON_NAV.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-lg">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}

