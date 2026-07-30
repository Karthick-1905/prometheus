import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRole } from '../context/RoleContext';
import {
  ROLE_DESCRIPTIONS,
  ROLE_HOME,
  ROLE_ICONS,
  ROLE_LABELS,
  ROLES,
  type Role,
} from '../types/roles';

export default function LoginPage() {
  const [selected, setSelected] = useState<Role | null>(null);
  const { setRole } = useRole();
  const navigate = useNavigate();

  const continueAs = () => {
    if (!selected) return;
    setRole(selected);
    navigate(ROLE_HOME[selected], { replace: true });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center latent-grid px-4 py-10">
      <div className="w-full max-w-lg bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-lg p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-2">
          <span
            className="material-symbols-outlined text-4xl text-primary"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            construction
          </span>
          <div>
            <h1 className="font-headline-lg text-2xl font-black text-on-surface">CAT Smart Rental</h1>
            <p className="text-xs uppercase tracking-widest text-on-surface-variant font-bold">
              Role-based access (demo)
            </p>
          </div>
        </div>

        <p className="text-sm text-on-surface-variant mt-3 mb-6">
          Authentication is mocked. Select a role to explore the corresponding workspace. Real JWT
          auth will plug in later.
        </p>

        <h2 className="font-title-md text-sm font-bold uppercase tracking-wide text-on-surface mb-3">
          Select Role
        </h2>

        <div className="flex flex-col gap-2 mb-6" role="radiogroup" aria-label="Select role">
          {ROLES.map((role) => {
            const active = selected === role;
            return (
              <button
                key={role}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSelected(role)}
                className={`text-left flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer ${
                  active
                    ? 'border-primary bg-primary-container/30 shadow-sm'
                    : 'border-outline-variant bg-surface hover:bg-surface-container'
                }`}
              >
                <span
                  className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    active ? 'border-primary' : 'border-outline'
                  }`}
                >
                  {active && <span className="w-2.5 h-2.5 rounded-full bg-primary" />}
                </span>
                <span
                  className="material-symbols-outlined text-2xl text-primary shrink-0"
                  style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {ROLE_ICONS[role]}
                </span>
                <span>
                  <span className="block font-bold text-sm text-on-surface">{ROLE_LABELS[role]}</span>
                  <span className="block text-xs text-on-surface-variant mt-0.5">
                    {ROLE_DESCRIPTIONS[role]}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          disabled={!selected}
          onClick={continueAs}
          className="w-full py-3.5 rounded-xl bg-primary-container text-on-primary-container font-black text-sm uppercase tracking-wide border border-primary disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-95 transition cursor-pointer"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
