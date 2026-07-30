import React from 'react';
import { useNavigate } from 'react-router-dom';

interface SidebarProps {
  activeView?: string;
  onSelectView?: (view: string) => void;
}

export default function Sidebar({ activeView = 'overview', onSelectView }: SidebarProps) {
  const navigate = useNavigate();
  const navItems = [
    { id: 'overview', label: 'Dashboard', icon: 'dashboard', fill: true },
    { id: 'assets', label: 'Assets', icon: 'inventory_2' },
    { id: 'utilization', label: 'Utilization', icon: 'bar_chart' },
    { id: 'operator', label: 'Operator', icon: 'badge' },
    { id: 'anomalies', label: 'AI Anomalies', icon: 'warning', badge: 'v4.2' },
    { id: 'telemetry', label: 'Live Telemetry', icon: 'sensors' },
    { id: 'fleet', label: 'Fleet Inventory', icon: 'construction' },
    { id: 'forecasting', label: 'Forecasting', icon: 'trending_up' },
    { id: 'optimization', label: 'Optimization', icon: 'insights' },
    { id: 'alerts', label: 'Alert Center', icon: 'notifications_active' },
    { id: 'analytics', label: 'Financial Analytics', icon: 'leaderboard' },
    { id: 'mllab', label: 'ML Isolation Lab', icon: 'science' },
    { id: 'settings', label: 'Platform Settings', icon: 'settings' },
  ];

  return (
    <aside className="h-screen w-64 fixed left-0 top-0 bg-surface-container-low border-r border-outline-variant flex flex-col py-6 px-4 gap-2 z-40">
      {/* Brand Header */}
      <div className="mb-6 px-2">
        <div className="font-headline-lg text-2xl font-black text-on-surface tracking-tight flex items-center gap-2">
          <span className="material-symbols-outlined text-3xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
            construction
          </span>
          Nexus
        </div>
        <p className="font-label-md text-[10px] uppercase text-on-surface-variant opacity-80 tracking-widest mt-0.5">Industrial Hub</p>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          const isActive = activeView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => { if (onSelectView) onSelectView(item.id); }}
              className={`flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-150 font-label-md text-xs uppercase cursor-pointer border ${
                isActive
                  ? 'bg-primary-container text-on-primary-container font-bold border-primary shadow-xs'
                  : 'text-on-surface-variant hover:bg-surface-container border-transparent font-semibold'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className="material-symbols-outlined text-lg"
                  style={{ fontVariationSettings: isActive && item.fill ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>

              {item.badge && (
                <span
                  className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                    isActive ? 'bg-surface text-primary' : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Rentals Ops shortcut */}
        <div className="mt-2 pt-2 border-t border-outline-variant/40">
          <button
            onClick={() => navigate('/rentals-ops')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-bold uppercase cursor-pointer border transition-all duration-150 text-[#F5C518] hover:bg-[#F5C518]/10 border-[#F5C518]/30"
          >
            <span className="material-symbols-outlined text-lg" style={{ color: '#F5C518' }}>assignment</span>
            Rental Ops
          </button>
        </div>
      </nav>

      {/* Profile Footer */}
      <div className="mt-auto p-3 bg-surface-container border border-outline-variant rounded-xl flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center font-black text-xs">
          MC
        </div>
        <div className="overflow-hidden">
          <p className="font-title-md text-xs font-bold text-on-surface leading-tight truncate">Marcus Chen</p>
          <p className="font-label-md text-[10px] uppercase text-on-surface-variant">Fleet Director</p>
        </div>
      </div>
    </aside>
  );
}
