import { Outlet } from 'react-router-dom';
import AppHeader from './AppHeader';
import AppSidebar from './AppSidebar';
import MobileBottomNav from './MobileBottomNav';
import InstallAppBanner from '../pwa/InstallAppBanner';

export default function RoleLayout() {
  return (
    <div className="flex w-full min-h-[100dvh] bg-surface text-on-surface">
      <div className="hidden md:block">
        <AppSidebar />
      </div>

      <div className="flex-1 flex flex-col min-h-[100dvh] md:ml-64 min-w-0">
        <AppHeader />
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar latent-grid px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-6"
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
