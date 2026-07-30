import { usePwaInstall } from '../../hooks/usePwaInstall';

/**
 * Sticky install banner for mobile web app (PWA).
 * - Chromium: one-tap Install via beforeinstallprompt
 * - iOS: instructions to Add to Home Screen
 */
export default function InstallAppBanner() {
  const { canPrompt, showIosTip, install, dismiss, isStandalone } = usePwaInstall();

  if (isStandalone || (!canPrompt && !showIosTip)) return null;

  return (
    <div
      className="fixed inset-x-0 z-[60] px-3"
      style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      role="region"
      aria-label="Install app"
    >
      <div className="mx-auto max-w-lg rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-lg overflow-hidden">
        <div className="h-1 w-full bg-primary-container" aria-hidden />
        <div className="flex items-start gap-3 p-3 sm:p-4">
          <div className="w-11 h-11 rounded-xl bg-primary-container border border-outline-variant flex items-center justify-center shrink-0">
            <span
              className="material-symbols-outlined text-2xl text-on-primary-container"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              construction
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-on-surface leading-tight">Install CAT Rental</p>
            {canPrompt ? (
              <p className="text-xs text-on-surface-variant mt-0.5">
                Add to your home screen for full-screen app experience — offline shell, faster launch.
              </p>
            ) : (
              <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                On iPhone/iPad: tap <strong>Share</strong>{' '}
                <span className="material-symbols-outlined text-sm align-middle">ios_share</span> then{' '}
                <strong>Add to Home Screen</strong>.
              </p>
            )}
            <div className="flex flex-wrap gap-2 mt-2.5">
              {canPrompt && (
                <button
                  type="button"
                  onClick={() => void install()}
                  className="px-3 py-2 rounded-lg bg-primary-container text-on-primary-container text-[11px] font-black uppercase tracking-wide border border-primary/30"
                >
                  Install app
                </button>
              )}
              <button
                type="button"
                onClick={dismiss}
                className="px-3 py-2 rounded-lg bg-surface-container text-on-surface-variant text-[11px] font-bold uppercase tracking-wide border border-outline-variant"
              >
                Not now
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
            aria-label="Dismiss"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      </div>
    </div>
  );
}
