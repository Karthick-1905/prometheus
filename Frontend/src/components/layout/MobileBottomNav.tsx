import { NavLink } from 'react-router-dom';
import { useRole } from '../../context/RoleContext';
import { ROLE_NAV, type NavItem } from '../../types/roles';

/** Pick up to 4 primary destinations for thumb-friendly bottom nav. */
function mobileItems(items: NavItem[]): NavItem[] {
  if (items.length <= 4) return items;
  // Prefer first 3 core pages + last (often important secondary)
  return [...items.slice(0, 3), items[items.length - 1]];
}

export default function MobileBottomNav() {
  const { role } = useRole();
  if (!role) return null;

  const items = mobileItems(ROLE_NAV[role]);

  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant bg-surface-container-lowest/95 backdrop-blur supports-[backdrop-filter]:bg-surface-container-lowest/90"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Primary"
    >
      <div className="flex justify-around items-stretch min-h-[56px] px-1 pt-1">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `mobile-nav-link flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-lg min-w-0 touch-manipulation ${
                isActive
                  ? 'text-on-primary-container bg-primary-container/80 font-black'
                  : 'text-on-surface-variant font-semibold'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className="material-symbols-outlined text-[22px]"
                  style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {item.icon}
                </span>
                <span className="text-[9px] uppercase tracking-wide truncate max-w-full leading-tight px-0.5">
                  {item.label.split(' ')[0]}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
