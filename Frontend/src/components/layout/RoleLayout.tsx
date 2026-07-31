import { useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import AppHeader from './AppHeader';
import AppSidebar from './AppSidebar';
import MobileBottomNav from './MobileBottomNav';
import InstallAppBanner from '../pwa/InstallAppBanner';
import CachedOutlet from './CachedOutlet';

/**
 * Viewport-locked shell: sidebar + header stay put; only <main> scrolls.
 * Requires html/body/#root height: 100% and min-h-0 on flex children.
 */
export default function RoleLayout() {
  const { pathname } = useLocation();
  const scrollPositions = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const main = document.getElementById('app-scroll-main');
    main?.scrollTo({ top: scrollPositions.current.get(pathname) ?? 0 });
    main?.focus({ preventScroll: true });

    return () => {
      if (main) scrollPositions.current.set(pathname, main.scrollTop);
    };
  }, [pathname]);

  return (
    <div className="app-shell flex w-full h-full min-h-0 bg-surface text-on-surface">
      <a
        href="#app-scroll-main"
        className="fixed left-3 top-3 z-50 -translate-y-20 rounded-lg bg-on-surface px-4 py-2 text-sm font-bold text-surface-container-lowest transition-transform focus:translate-y-0"
      >
        Skip to main content
      </a>
      <div className="hidden md:block shrink-0">
        <AppSidebar />
      </div>

      <div className="flex-1 flex flex-col h-full min-h-0 min-w-0 md:ml-64">
        {/* <AppHeader /> */}
        <main
          id="app-scroll-main"
          tabIndex={-1}
          className="app-scroll-main flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar latent-grid px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-8"
        >
          <div className="max-w-7xl mx-auto w-full">
            <CachedOutlet />
          </div>
        </main>
        <MobileBottomNav />
        <InstallAppBanner />
      </div>
    </div>
  );
}
