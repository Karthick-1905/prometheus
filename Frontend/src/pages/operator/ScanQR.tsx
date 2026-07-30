import { useState } from 'react';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import { mockScanResult } from '../../mock/data';

export default function OperatorScanQR() {
  const [scanned, setScanned] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2000);
  };

  return (
    <div className="max-w-md mx-auto">
      <PageHeader title="Scan QR" subtitle="Camera integration later — mock scan" />
      {toast && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-primary-container text-on-primary-container text-sm font-bold text-center">
          {toast}
        </div>
      )}

      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm text-center">
        <p className="font-title-md text-sm font-bold uppercase tracking-wide mb-4">Equipment QR</p>

        <div className="mx-auto w-40 h-40 rounded-2xl border-2 border-dashed border-outline-variant bg-surface-container flex items-center justify-center mb-5">
          <span className="material-symbols-outlined text-6xl text-on-surface-variant">qr_code_2</span>
        </div>

        <button
          type="button"
          onClick={() => setScanned(true)}
          className="w-full py-3.5 rounded-xl bg-primary-container text-on-primary-container font-black text-sm uppercase border border-primary cursor-pointer mb-4"
        >
          Scan QR
        </button>

        {scanned && (
          <div className="text-left border-t border-outline-variant pt-4 space-y-3 animate-in">
            <p className="text-[10px] uppercase font-bold text-on-surface-variant text-center">Mock Result</p>
            <div className="bg-surface-container rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-on-surface-variant">Equipment</span>
                <span className="font-mono font-black">{mockScanResult.equipmentId}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-on-surface-variant">Name</span>
                <span className="font-semibold">{mockScanResult.name}</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-on-surface-variant">Status</span>
                <StatusBadge status="AVAILABLE" />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-on-surface-variant">Site</span>
                <span className="font-semibold">{mockScanResult.site}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => flash('Mock: Checked in')}
                className="py-3 rounded-xl bg-emerald-600 text-white font-bold text-xs uppercase cursor-pointer"
              >
                Check In
              </button>
              <button
                type="button"
                onClick={() => flash('Mock: Checked out')}
                className="py-3 rounded-xl bg-on-surface text-surface font-bold text-xs uppercase cursor-pointer"
              >
                Check Out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
