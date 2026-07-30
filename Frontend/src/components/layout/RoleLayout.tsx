import { Outlet } from 'react-router-dom';
import { useRole } from '../../context/RoleContext';
import AppHeader from './AppHeader';
import AppSidebar from './AppSidebar';

export default function RoleLayout() {
  const { role } = useRole();
  const isOperator = role === 'operator';

  return (
    <div className="flex w-full min-h-screen bg-surface text-on-surface">
      {/* Desktop sidebar — hide on small screens for operator, show hamburger-less compact top nav via CSS */}
      <div className={`${isOperator ? 'hidden md:block' : 'hidden md:block'}`}>
        <AppSidebar />
      </div>

      <div className={`flex-1 flex flex-col min-h-screen ${isOperator ? 'md:ml-64' : 'md:ml-64'}`}>
        <AppHeader />
        {/* Mobile bottom nav for operator */}
        {isOperator && (
          <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface-container-lowest border-t border-outline-variant flex justify-around py-2 px-1">
            {[
              { to: '/operator/dashboard', icon: 'dashboard', label: 'Home' },
              { to: '/operator/scan', icon: 'qr_code_scanner', label: 'Scan' },
              { to: '/operator/assignment', icon: 'handyman', label: 'Job' },
              { to: '/operator/history', icon: 'history', label: 'History' },
            ].map((item) => (
              <a
                key={item.to}
                href={item.to}
                className="flex flex-col items-center gap-0.5 text-[10px] font-bold uppercase text-on-surface-variant px-2"
              >
                <span className="material-symbols-outlined text-xl">{item.icon}</span>
                {item.label}
              </a>
            ))}
          </nav>
        )}
        <main
          className={`flex-1 overflow-y-auto custom-scrollbar latent-grid px-4 sm:px-8 py-6 ${
            isOperator ? 'pb-24 md:pb-6' : ''
          }`}
        >
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
