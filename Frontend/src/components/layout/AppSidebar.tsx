import { NavLink } from 'react-router-dom';
import { useRole } from '../../context/RoleContext';
import { COMMON_NAV, ROLE_LABELS, ROLE_NAV } from '../../types/roles';
import { readApiSession } from '../../api/client';

export default function AppSidebar() {
  const { role, roleLabel, user, clearRole } = useRole();
  if (!role) return null;

  const items = ROLE_NAV[role];
  const actor = user?.actorId ?? readApiSession()?.actorId ?? 'User';

  return (
    <aside className="h-full max-h-[100dvh] w-64 shrink-0 fixed left-0 top-0 bg-surface-container-low border-r border-outline-variant flex flex-col py-6 px-4 gap-2 z-40">
      <div className="mb-4 px-2">
        <div className="font-headline-lg text-2xl font-black text-on-surface tracking-tight flex items-center gap-2">
          <span
            className="material-symbols-outlined text-3xl text-primary"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            construction
          </span>
          CAT Rental
        </div>
        <p className="font-label-md text-[10px] uppercase text-on-surface-variant tracking-widest mt-0.5">
          Smart Tracking
        </p>
      </div>

      {/* <div className="mx-1 mb-2 px-3 py-2 rounded-lg bg-primary-container/40 border border-primary/20">
        <p className="text-[10px] uppercase font-bold text-on-surface-variant">Active role</p>
        <p className="text-xs font-black text-on-primary-container">{roleLabel}</p>
      </div> */}

      <nav className="flex-1 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar-link flex items-center gap-3 px-4 py-3 rounded-lg font-label-md text-xs uppercase border ${isActive
                ? 'bg-primary-container text-on-primary-container font-bold border-primary shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container border-transparent font-semibold'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className="material-symbols-outlined text-lg"
                  style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}

        <div className="mt-3 pt-3 border-t border-outline-variant/50 flex flex-col gap-1">
          <p className="px-4 text-[9px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">
            Account
          </p>
          {COMMON_NAV.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `sidebar-link flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs uppercase border ${isActive
                  ? 'bg-surface-container-high text-on-surface font-bold border-outline-variant'
                  : 'text-on-surface-variant hover:bg-surface-container border-transparent font-semibold'
                }`
              }
            >
              <span className="material-symbols-outlined text-lg">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <button
        type="button"
        onClick={clearRole}
        className="mt-2 flex items-center gap-2 px-4 py-3 rounded-lg border border-outline-variant text-xs font-bold uppercase text-on-surface-variant hover:bg-error-container hover:text-on-error-container hover:border-error/30 transition-colors cursor-pointer"
      >
        <span className="material-symbols-outlined text-lg">logout</span>
        Switch role
      </button>

      <div className="p-3 bg-surface-container border border-outline-variant rounded-xl flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center font-black text-xs">
          {ROLE_LABELS[role].slice(0, 2).toUpperCase()}
        </div>
        <div className="overflow-hidden">
          <p className="font-title-md text-xs font-bold text-on-surface leading-tight truncate">
            {actor}
          </p>
          <p className="font-label-md text-[10px] uppercase text-on-surface-variant">
            {ROLE_LABELS[role]}
          </p>
        </div>
      </div>
    </aside>
  );
}
