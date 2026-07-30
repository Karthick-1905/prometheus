import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FeedbackBanner } from '../components/ui/Feedback';
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
  const [selected, setSelected] = useState<Role>('fleet_manager');
  const [email, setEmail] = useState('demo@cat-rental.local');
  const [password, setPassword] = useState('demo');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useRole();
  const navigate = useNavigate();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login({ email, password, role: selected });
      navigate(ROLE_HOME[selected], { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-shell">
      <section className="login-intro">
        <div className="brand-lockup">
          <span className="material-symbols-outlined" aria-hidden="true">construction</span>
          <div><strong>CAT Smart Rental</strong><span>Connected operations</span></div>
        </div>
        <h1>One live view of every machine, commitment, and decision.</h1>
        <p>
          Sign in to the role-specific workspace backed by live fleet, dealer, site,
          anomaly, and demand services.
        </p>
        <ul>
          <li><span className="material-symbols-outlined">check_circle</span>Scoped backend access</li>
          <li><span className="material-symbols-outlined">check_circle</span>Live operational status</li>
          <li><span className="material-symbols-outlined">check_circle</span>Auditable human decisions</li>
        </ul>
      </section>

      <form className="login-panel" onSubmit={submit}>
        <div>
          <h2>Sign in</h2>
          <p>The demo backend issues a real JWT for the selected workspace.</p>
        </div>
        {error && <FeedbackBanner tone="error">{error}</FeedbackBanner>}
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <fieldset className="role-picker">
          <legend>Workspace</legend>
          {ROLES.map((role) => (
            <label key={role} className={selected === role ? 'is-selected' : ''}>
              <input
                type="radio"
                name="role"
                value={role}
                checked={selected === role}
                onChange={() => setSelected(role)}
              />
              <span className="material-symbols-outlined" aria-hidden="true">{ROLE_ICONS[role]}</span>
              <span><strong>{ROLE_LABELS[role]}</strong><small>{ROLE_DESCRIPTIONS[role]}</small></span>
            </label>
          ))}
        </fieldset>
        <button className="btn-primary login-submit" type="submit" disabled={loading}>
          {loading ? 'Signing in…' : `Continue as ${ROLE_LABELS[selected]}`}
        </button>
        <p className="login-note">
          Demo authentication accepts any non-empty password. Production policy belongs in the identity provider.
        </p>
      </form>
    </main>
  );
}
