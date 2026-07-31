import { Outlet } from 'react-router-dom';
import AppHeader from './AppHeader';
import AppSidebar from './AppSidebar';
import MobileBottomNav from './MobileBottomNav';
import InstallAppBanner from '../pwa/InstallAppBanner';

/**
 * Viewport-locked shell: sidebar + header stay put; only <main> scrolls.
 * Requires html/body/#root height: 100% and min-h-0 on flex children.
 */
export default function RoleLayout() {
  return (
    <div className="app-shell flex w-full h-full min-h-0 bg-surface text-on-surface">
      <div className="hidden md:block shrink-0">
        <AppSidebar />
      </div>

      <div className="flex-1 flex flex-col h-full min-h-0 min-w-0 md:ml-64">
        {/* <AppHeader /> */}
        <main
          id="app-scroll-main"
          className="app-scroll-main flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar latent-grid px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-8"
        >
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
        <MobileBottomNav />
        <InstallAppBanner />
      </div>
    </div>
  );
}
