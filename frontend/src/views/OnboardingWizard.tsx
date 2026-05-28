import { useState } from 'react';
import type { AppSettings } from '../App.tsx';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';

interface OnboardingWizardProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => Promise<void>;
  onSkipToSandbox: () => void;
}

function OnboardingWizard({ settings, onSaveSettings, onSkipToSandbox }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [stripeKey, setStripeKey] = useState(settings.stripeKey || '');
  const [langfuseKey, setLangfuseKey] = useState(settings.langfuseKey || '');
  const [posthogKey, setPosthogKey] = useState(settings.posthogKey || '');
  const [anthropicKey, setAnthropicKey] = useState(settings.anthropicKey || '');
  
  const [showStripe, setShowStripe] = useState(false);
  const [showLangfuse, setShowLangfuse] = useState(false);
  const [showPosthog, setShowPosthog] = useState(false);
  const [showAnthropic, setShowAnthropic] = useState(false);

  const handleNext = async () => {
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    // Only go Live if at least one data source was actually provided —
    // otherwise stay in the sandbox so the dashboard has data to show
    // instead of failing against unconfigured live APIs.
    const hasDataSourceKey = Boolean(stripeKey || langfuseKey || posthogKey);
    await onSaveSettings({
      useSandbox: !hasDataSourceKey,
      stripeKey,
      langfuseKey,
      posthogKey,
      anthropicKey,
    });
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  return (
    <div className="ob-frame">
      <div className="ob-head">
        <div className="ob-crumb">Workspace setup · 3 min</div>
        <h1 className="ob-h1">Connect your stack.</h1>
        <p className="ob-sub">Three keys, one schema. Sentinel only reads — it never writes back to your sources.</p>
      </div>

      <div className="ob-card">
        {step === 1 && (
          <div className="reveal">
            <div className="ob-card-head">
              <div>
                <h2 className="ob-card-title">Connect your Billing</h2>
                <div className="ob-card-sub">Stripe · read-only scoped key</div>
              </div>
              <span className="step-badge">STEP 1 OF 3</span>
            </div>

            <div className="ob-source-row">
              <span className="ob-src-logo" style={{ background: 'linear-gradient(135deg, #635BFF, #4F46E5)' }}>S</span>
              <div className="ob-src-meta">
                <div className="n">Stripe Workspace</div>
                <div className="d">Connect your API key to map revenue ledger</div>
              </div>
              {stripeKey ? (
                <span className="ob-src-status"><span className="pulse"></span> configured</span>
              ) : (
                <span className="ob-src-status" style={{ background: 'var(--amber-soft)', color: 'var(--amber)', borderColor: 'rgba(245,158,11,0.22)' }}>
                  awaiting key
                </span>
              )}
            </div>

            <div className="ob-field">
              <div className="ob-label">
                <span>Stripe Secret Key</span>
                <span className="help" onClick={() => window.open('https://stripe.com/docs/keys', '_blank')}>where do I find this? →</span>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showStripe ? 'text' : 'password'}
                  className="ob-input"
                  value={stripeKey}
                  onChange={(e) => setStripeKey(e.target.value)}
                  placeholder="sk_live_..."
                />
                <button
                  type="button"
                  onClick={() => setShowStripe(!showStripe)}
                  style={{ position: 'absolute', right: 5, top: 10, background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer' }}
                >
                  {showStripe ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="ob-glow"></div>
            </div>

            <div className="ob-actions">
              <button type="button" className="ob-skip" onClick={onSkipToSandbox}>Skip to Demo Sandbox</button>
              <button type="button" className="ob-next" onClick={handleNext}>
                Next Step
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="reveal">
            <div className="ob-card-head">
              <div>
                <h2 className="ob-card-title">Connect your Observability</h2>
                <div className="ob-card-sub">Langfuse · LLM request tracing key</div>
              </div>
              <span className="step-badge">STEP 2 OF 3</span>
            </div>

            <div className="ob-source-row">
              <span className="ob-src-logo" style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>L</span>
              <div className="ob-src-meta">
                <div className="n">Langfuse Workspace</div>
                <div className="d">Connect public API key to trace token expenses</div>
              </div>
              {langfuseKey ? (
                <span className="ob-src-status"><span className="pulse"></span> configured</span>
              ) : (
                <span className="ob-src-status" style={{ background: 'var(--amber-soft)', color: 'var(--amber)', borderColor: 'rgba(245,158,11,0.22)' }}>
                  awaiting key
                </span>
              )}
            </div>

            <div className="ob-field">
              <div className="ob-label">
                <span>Langfuse Public Key</span>
                <span className="help" onClick={() => window.open('https://langfuse.com/docs', '_blank')}>where do I find this? →</span>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showLangfuse ? 'text' : 'password'}
                  className="ob-input"
                  value={langfuseKey}
                  onChange={(e) => setLangfuseKey(e.target.value)}
                  placeholder="pk-lf-..."
                />
                <button
                  type="button"
                  onClick={() => setShowLangfuse(!showLangfuse)}
                  style={{ position: 'absolute', right: 5, top: 10, background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer' }}
                >
                  {showLangfuse ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="ob-glow"></div>
            </div>

            <div className="ob-actions">
              <button type="button" className="ob-skip" onClick={handleBack}>Go Back</button>
              <button type="button" className="ob-next" onClick={handleNext}>
                Next Step
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="reveal">
            <div className="ob-card-head">
              <div>
                <h2 className="ob-card-title">Connect your Tracking & AI</h2>
                <div className="ob-card-sub">PostHog analytics & Anthropic Claude keys</div>
              </div>
              <span className="step-badge">STEP 3 OF 3</span>
            </div>

            <div className="ob-source-row">
              <span className="ob-src-logo" style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>P</span>
              <div className="ob-src-meta">
                <div className="n">PostHog & Claude Agent</div>
                <div className="d">Map user action click logs and run margin audits</div>
              </div>
              {posthogKey && anthropicKey ? (
                <span className="ob-src-status"><span className="pulse"></span> configured</span>
              ) : (
                <span className="ob-src-status" style={{ background: 'var(--amber-soft)', color: 'var(--amber)', borderColor: 'rgba(245,158,11,0.22)' }}>
                  awaiting keys
                </span>
              )}
            </div>

            <div className="ob-field">
              <div className="ob-label">
                <span>PostHog Project API Key</span>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPosthog ? 'text' : 'password'}
                  className="ob-input"
                  value={posthogKey}
                  onChange={(e) => setPosthogKey(e.target.value)}
                  placeholder="phc_..."
                />
                <button
                  type="button"
                  onClick={() => setShowPosthog(!showPosthog)}
                  style={{ position: 'absolute', right: 5, top: 10, background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer' }}
                >
                  {showPosthog ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="ob-glow"></div>
            </div>

            <div className="ob-field">
              <div className="ob-label">
                <span>Anthropic API Key — Claude Sonnet agent</span>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showAnthropic ? 'text' : 'password'}
                  className="ob-input"
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  placeholder="sk-ant-..."
                />
                <button
                  type="button"
                  onClick={() => setShowAnthropic(!showAnthropic)}
                  style={{ position: 'absolute', right: 5, top: 10, background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer' }}
                >
                  {showAnthropic ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="ob-glow"></div>
            </div>

            <div className="ob-actions">
              <button type="button" className="ob-skip" onClick={handleBack}>Go Back</button>
              <button type="button" className="ob-next" onClick={handleNext}>
                Complete Setup
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="ob-dots">
        <span className={`ob-dot ${step === 1 ? 'active' : ''}`} onClick={() => setStep(1)} style={{ cursor: 'pointer' }}></span>
        <span className={`ob-dot ${step === 2 ? 'active' : ''}`} onClick={() => setStep(2)} style={{ cursor: 'pointer' }}></span>
        <span className={`ob-dot ${step === 3 ? 'active' : ''}`} onClick={() => setStep(3)} style={{ cursor: 'pointer' }}></span>
      </div>
      <div className="ob-dot-label">
        {step === 1 && 'Connect billing keys to fetch subscriber database'}
        {step === 2 && 'Connect LLM request trace dashboard to measure cost'}
        {step === 3 && 'Inject PostHog actions & spawn Claude Auditor agent'}
      </div>
    </div>
  );
}

export default OnboardingWizard;
