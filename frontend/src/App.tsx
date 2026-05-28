import { useState, useEffect } from 'react';
import LandingPage from './views/LandingPage.tsx';
import DashboardPage from './views/DashboardPage.tsx';
import { Settings, ShieldCheck, X, AlertTriangle, ToggleLeft, ToggleRight } from 'lucide-react';
import './app.css';

export interface AppSettings {
  useSandbox: boolean;
  stripeKey: string;
  langfuseKey: string;
  posthogKey: string;
  anthropicKey: string;
}

type ViewName = 'landing' | 'dashboard';

const KEY_FIELDS: { key: keyof AppSettings; label: string; placeholder: string }[] = [
  { key: 'anthropicKey', label: 'Anthropic API Key — Claude Sonnet agent', placeholder: 'sk-ant-…' },
  { key: 'stripeKey', label: 'Stripe Secret Key', placeholder: 'sk_live_…' },
  { key: 'langfuseKey', label: 'Langfuse Public Key', placeholder: 'pk-lf-…' },
  { key: 'posthogKey', label: 'PostHog Project API Key', placeholder: 'phc_…' },
];

function App() {
  const [currentView, setCurrentView] = useState<ViewName>('landing');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
    useSandbox: true,
    stripeKey: '',
    langfuseKey: '',
    posthogKey: '',
    anthropicKey: '',
  });

  // Hydrate mode from the Express backend on mount.
  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => setSettings((prev) => ({ ...prev, useSandbox: data.useSandbox ?? true })))
      .catch((err) => console.error('Error fetching settings:', err));
  }, []);

  const saveSettings = async (newSettings: AppSettings, closeModal = false) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      const data = await res.json();
      if (data.success) {
        setSettings(newSettings);
        if (closeModal) setIsSettingsOpen(false);
      } else {
        alert('Failed to save settings: ' + data.error);
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('Network error while saving settings.');
    }
  };

  const setMode = (useSandbox: boolean) => saveSettings({ ...settings, useSandbox });

  const handleLaunchSandbox = () => {
    saveSettings({ ...settings, useSandbox: true });
    setCurrentView('dashboard');
  };

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setCurrentView('landing')} aria-label="Margin Sentinel home">
          <span className="brand__mark">
            <ShieldCheck size={22} color="oklch(22% 0.05 70)" strokeWidth={2.4} />
          </span>
          <span>
            <span className="brand__name">
              Margin <em>Sentinel</em>
            </span>
            <span className="brand__tag">Unit-Economics Desk</span>
          </span>
        </button>

        <div className="topbar__actions">
          <div className="seg" role="group" aria-label="Data mode">
            <button
              className="seg__btn"
              data-active={settings.useSandbox}
              onClick={() => setMode(true)}
            >
              <span className="dot dot--warn" style={{ opacity: settings.useSandbox ? 1 : 0.3 }} />
              Sandbox
            </button>
            <button
              className="seg__btn seg__btn--live"
              data-active={!settings.useSandbox}
              onClick={() => setMode(false)}
            >
              <span className="dot dot--profit" style={{ opacity: settings.useSandbox ? 0.3 : 1 }} />
              Live
            </button>
          </div>

          <button className="btn btn--ghost" onClick={() => setIsSettingsOpen(true)}>
            <Settings size={17} />
            Configure
          </button>
        </div>
      </header>

      <main style={{ flex: 1 }}>
        {currentView === 'landing' ? (
          <LandingPage onEnterDashboard={() => setCurrentView('dashboard')} onLaunchSandbox={handleLaunchSandbox} />
        ) : (
          <DashboardPage settings={settings} />
        )}
      </main>

      {isSettingsOpen && (
        <div className="modal-scrim" onClick={() => setIsSettingsOpen(false)}>
          <div className="surface modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal__close" onClick={() => setIsSettingsOpen(false)} aria-label="Close settings">
              <X size={18} />
            </button>

            <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>Agent Configuration</p>
            <h3 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Execution Environment</h3>
            <p className="muted" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Choose where margin checks run and provide the credentials the Coral engine needs.
            </p>

            <div className="toggle-row" style={{ marginBottom: '1.5rem' }}>
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>Demo Sandbox</h4>
                <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.15rem' }}>
                  Queries simulated customer tables — no live API accounts required.
                </p>
              </div>
              <button
                onClick={() => setSettings((prev) => ({ ...prev, useSandbox: !prev.useSandbox }))}
                style={{ color: settings.useSandbox ? 'var(--gold)' : 'var(--bone-faint)' }}
                aria-label="Toggle sandbox mode"
              >
                {settings.useSandbox ? <ToggleRight size={42} /> : <ToggleLeft size={42} />}
              </button>
            </div>

            {!settings.useSandbox && (
              <div className="reveal" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="callout callout--warn">
                  <AlertTriangle size={16} />
                  <span>
                    <strong>Live mode</strong> requires the Coral binary running locally and configured against your
                    source APIs.
                  </span>
                </div>
                {KEY_FIELDS.map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="field-label" htmlFor={key}>{label}</label>
                    <input
                      id={key}
                      className="input"
                      type="password"
                      value={settings[key] as string}
                      onChange={(e) => setSettings((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder={placeholder}
                    />
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn--ghost" onClick={() => setIsSettingsOpen(false)}>Cancel</button>
              <button className="btn btn--primary" onClick={() => saveSettings(settings, true)}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
