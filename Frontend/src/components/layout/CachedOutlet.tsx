import { useRef } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';

/**
 * Keeps every visited route mounted for the lifetime of the authenticated shell.
 *
 * React Router normally unmounts a page when another route is opened. Keeping
 * the route element mounted preserves its fetched data and local UI state, so
 * returning to it is instant and does not repeat its mount-time API requests.
 */
export default function CachedOutlet() {
  const outlet = useOutlet();
  const { pathname } = useLocation();
  const pages = useRef(new Map<string, React.ReactNode>());

  if (outlet) pages.current.set(pathname, outlet);

  return (
    <>
      {[...pages.current.entries()].map(([path, page]) => {
        const active = path === pathname;
        return (
          <div
            key={path}
            hidden={!active}
            aria-hidden={!active || undefined}
            className="w-full"
          >
            {page}
          </div>
        );
      })}
    </>
  );
}
