import { useState, useEffect } from 'react';
import LandingPage from './views/LandingPage.tsx';
import OnboardingWizard from './views/OnboardingWizard.tsx';
import DashboardPage from './views/DashboardPage.tsx';
import { Settings, ShieldCheck, X, AlertTriangle, ToggleLeft, ToggleRight, Sun, Moon } from 'lucide-react';
import './app.css';

export interface AppSettings {
  useSandbox: boolean;
  stripeKey: string;
  langfuseKey: string;
  posthogKey: string;
  anthropicKey: string;
  resendKey: string;
}

type ViewName = 'landing' | 'onboarding' | 'dashboard';

const KEY_FIELDS: { key: keyof AppSettings; label: string; placeholder: string }[] = [
  { key: 'anthropicKey', label: 'Anthropic API Key — Claude Sonnet agent', placeholder: 'sk-ant-…' },
  { key: 'stripeKey', label: 'Stripe Secret Key', placeholder: 'sk_live_…' },
  { key: 'resendKey', label: 'Resend API Key — Live emails', placeholder: 're_…' },
  { key: 'langfuseKey', label: 'Langfuse Public Key', placeholder: 'pk-lf-…' },
  { key: 'posthogKey', label: 'PostHog Project API Key', placeholder: 'phc_…' },
];

function App() {
  const [currentView, setCurrentView] = useState<ViewName>('landing');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'light';
  });
  const [settings, setSettings] = useState<AppSettings>({
    useSandbox: true,
    stripeKey: '',
    langfuseKey: '',
    posthogKey: '',
    anthropicKey: '',
    resendKey: '',
  });
  // Whether the backend already has data-source credentials. The GET endpoint
  // only exposes has* booleans (never the raw secrets), so we track this flag
  // separately rather than trying to read key strings off the response.
  const [keysConfigured, setKeysConfigured] = useState(false);

  // Hydrate mode from the Express backend on mount.
  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        setSettings((prev) => ({ ...prev, useSandbox: data.useSandbox ?? true }));
        setKeysConfigured(Boolean(data.hasStripeKey || data.hasLangfuseKey || data.hasPosthogKey || data.hasResendKey));
      })
      .catch((err) => console.error('Error fetching settings:', err));
  }, []);

  // Update theme data-attribute on root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

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
        if (newSettings.stripeKey || newSettings.langfuseKey || newSettings.posthogKey) {
          setKeysConfigured(true);
        }
        if (closeModal) setIsSettingsOpen(false);
      } else {
        alert('Failed to save settings: ' + data.error);
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('Network error while saving settings.');
    }
  };

  const handleStartAudit = () => {
    // Returning users with configured sources skip straight to the dashboard.
    if (keysConfigured) {
      setCurrentView('dashboard');
    } else {
      setCurrentView('onboarding');
    }
  };

  const handleLaunchSandbox = async () => {
    const newSettings = { ...settings, useSandbox: true };
    await saveSettings(newSettings);
    setCurrentView('dashboard');
  };

  const handleSaveOnboardingSettings = async (keys: AppSettings) => {
    await saveSettings(keys);
    setCurrentView('dashboard');
  };

  const handleSetSandboxMode = (useSandbox: boolean) => {
    const newSettings = { ...settings, useSandbox };
    saveSettings(newSettings);
  };

  return (
    <div className="app">
      {/* Renders global header if they are in Onboarding or Dashboard */}
      {currentView !== 'landing' && (
        <header className="topbar" style={{ background: 'rgba(255, 255, 255, 0.8)', borderBottom: '1px solid var(--line)', padding: '12px 24px' }}>
          <button className="brand" onClick={() => setCurrentView('landing')} aria-label="Margin Sentinel home" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer' }}>
            <span className="brand__mark" style={{ display: 'grid', placeItems: 'center', width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
              <ShieldCheck size={18} color="#fff" strokeWidth={2.4} />
            </span>
            <span style={{ textAlign: 'left' }}>
              <span className="brand__name" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--ink)' }}>
                Margin <em style={{ fontStyle: 'italic', fontWeight: 500, color: 'var(--indigo)' }}>Sentinel</em>
              </span>
            </span>
          </button>

          <div className="topbar__actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="seg" role="group" aria-label="Data mode" style={{ display: 'flex', background: 'var(--sand-2)', border: '1px solid var(--line-2)', borderRadius: '999px', padding: '2px' }}>
              <button
                className="seg__btn"
                data-active={settings.useSandbox}
                onClick={() => handleSetSandboxMode(true)}
                style={{
                  border: 'none',
                  background: settings.useSandbox ? '#fff' : 'transparent',
                  color: settings.useSandbox ? 'var(--ink)' : 'var(--ink-3)',
                  padding: '6px 12px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Sandbox
              </button>
              <button
                className="seg__btn seg__btn--live"
                data-active={!settings.useSandbox}
                onClick={() => handleSetSandboxMode(false)}
                style={{
                  border: 'none',
                  background: !settings.useSandbox ? '#fff' : 'transparent',
                  color: !settings.useSandbox ? 'var(--ink)' : 'var(--ink-3)',
                  padding: '6px 12px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Live
              </button>
            </div>

            <button
              onClick={() => setIsSettingsOpen(true)}
              style={{
                background: 'transparent',
                border: '1px solid var(--line-3)',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--ink-2)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <Settings size={14} />
              Configure
            </button>

            <button 
              onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
              style={{
                background: 'transparent',
                border: '1px solid var(--line-3)',
                borderRadius: '8px',
                padding: '6px',
                color: 'var(--ink-2)',
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer'
              }}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </header>
      )}

      <main style={{ flex: 1 }}>
        {currentView === 'landing' && (
          <LandingPage onStartAudit={handleStartAudit} />
        )}
        {currentView === 'onboarding' && (
          <OnboardingWizard
            settings={settings}
            onSaveSettings={handleSaveOnboardingSettings}
            onSkipToSandbox={handleLaunchSandbox}
          />
        )}
        {currentView === 'dashboard' && (
          <DashboardPage settings={settings} />
        )}
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="modal-scrim" onClick={() => setIsSettingsOpen(false)}>
          <div className="surface modal" onClick={(e) => e.stopPropagation()} style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '16px', padding: '28px', maxWidth: '500px', width: '100%', position: 'relative' }}>
            <button className="modal__close" onClick={() => setIsSettingsOpen(false)} aria-label="Close settings" style={{ position: 'absolute', right: '16px', top: '16px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}>
              <X size={18} />
            </button>

            <p className="ob-crumb" style={{ marginBottom: '0.5rem', color: 'var(--indigo)' }}>Agent Configuration</p>
            <h3 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', fontFamily: 'var(--sans)', fontWeight: 600, color: 'var(--ink)' }}>Execution Environment</h3>
            <p className="muted" style={{ fontSize: '0.9rem', marginBottom: '1.5rem', color: 'var(--ink-3)' }}>
              Choose where margin checks run and provide the credentials the Coral engine needs.
            </p>

            <div className="toggle-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--sand-2)', border: '1px solid var(--line-2)', borderRadius: '8px', padding: '14px', marginBottom: '1.5rem' }}>
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--ink)' }}>Demo Sandbox</h4>
                <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.15rem', color: 'var(--ink-3)' }}>
                  Queries simulated customer tables — no live API accounts required.
                </p>
              </div>
              <button
                onClick={() => setSettings((prev) => ({ ...prev, useSandbox: !prev.useSandbox }))}
                style={{ background: 'transparent', border: 'none', color: settings.useSandbox ? 'var(--indigo)' : 'var(--ink-4)', cursor: 'pointer' }}
                aria-label="Toggle sandbox mode"
              >
                {settings.useSandbox ? <ToggleRight size={42} /> : <ToggleLeft size={42} />}
              </button>
            </div>

            {!settings.useSandbox && (
              <div className="reveal" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="callout callout--warn" style={{ display: 'flex', gap: '8px', background: 'var(--amber-soft)', border: '1px solid rgba(245,158,11,0.22)', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', color: 'var(--amber)' }}>
                  <AlertTriangle size={16} />
                  <span>
                    <strong>Live mode</strong> requires the Coral binary running locally and configured against your
                    source APIs.
                  </span>
                </div>
                {KEY_FIELDS.map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="field-label" htmlFor={key} style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--ink-2)' }}>{label}</label>
                    <input
                      id={key}
                      className="ob-input"
                      type="password"
                      value={settings[key] as string}
                      onChange={(e) => setSettings((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder={placeholder}
                      style={{ background: '#fff' }}
                    />
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: '1px solid var(--line)', paddingTop: '18px' }}>
              <button className="lf-btn lf-btn-secondary" style={{ padding: '8px 16px', fontSize: '14px' }} onClick={() => setIsSettingsOpen(false)}>Cancel</button>
              <button className="lf-btn lf-btn-primary" style={{ padding: '8px 16px', fontSize: '14px' }} onClick={() => saveSettings(settings, true)}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
