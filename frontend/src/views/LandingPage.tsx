import { ArrowRight } from 'lucide-react';
import { BrandLockup, StripeGlyph, LangfuseGlyph, PostHogGlyph, SentinelGlyph } from './BrandLogos.tsx';

interface LandingPageProps {
  onStartAudit: () => void;
}

function LandingPage({ onStartAudit }: LandingPageProps) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* background glows inside frame */}
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: `
          radial-gradient(600px 400px at 15% 10%, rgba(244,114,182,0.18), transparent 60%),
          radial-gradient(700px 500px at 90% 25%, rgba(251,146,60,0.16), transparent 60%),
          radial-gradient(800px 500px at 50% 95%, rgba(167,139,250,0.20), transparent 60%)
        `
      }}></div>

      <nav className="lf-nav">
        <div className="lf-brand"><span className="mark"></span> Sentinel</div>
        <div className="lf-nav-links">
          <a href="#product" onClick={(e) => e.preventDefault()}>Product</a>
          <a href="#integrations" onClick={(e) => e.preventDefault()}>Integrations</a>
          <a href="#pricing" onClick={(e) => e.preventDefault()}>Pricing</a>
          <a href="#customers" onClick={(e) => e.preventDefault()}>Customers</a>
          <a href="#changelog" onClick={(e) => e.preventDefault()}>Changelog</a>
        </div>
        <div className="lf-nav-cta">
          <a href="#signin" onClick={(e) => { e.preventDefault(); onStartAudit(); }} style={{ color: 'var(--ink-2)', textDecoration: 'none', fontSize: '15px', fontWeight: 500, padding: '10px 14px' }}>Sign in</a>
          <button className="lf-btn lf-btn-secondary" style={{ padding: '12px 20px', fontSize: '14px' }} onClick={onStartAudit}>Book demo</button>
        </div>
      </nav>

      <section className="lf-hero">
        <span className="lf-eyebrow">
          <span className="pulse"></span>
          Margin Sentinel · SaaS Unit Economics
        </span>
        <h1 className="lf-h1">Your AI features are <span className="quietly">quietly</span> losing you money.</h1>
        <p className="lf-sub">Sentinel joins Stripe revenue, Langfuse token cost, and PostHog click logs into a single customer ledger — then sends a Claude agent to audit negative-margin accounts and draft the fix.</p>
        <div className="lf-cta-row">
          <button className="lf-btn lf-btn-primary" id="cta-start" onClick={onStartAudit}>
            Start Free Audit
            <ArrowRight size={18} />
          </button>
          <button className="lf-btn lf-btn-secondary" onClick={onStartAudit}>Request Demo</button>
        </div>
        <div className="lf-trust">
          <span>SOC 2 Type II</span>
          <span className="pip"></span>
          <span>Read-only keys</span>
          <span className="pip"></span>
          <span>14-day audit window</span>
        </div>

        <div className="lf-integrations-logos">
          <span>Supported Stack</span>
          <div className="logo-group">
            <BrandLockup brand="stripe" name="Stripe" role="Billing" />
            <span className="logo-sep"></span>
            <BrandLockup brand="langfuse" name="Langfuse" role="Traces" />
            <span className="logo-sep"></span>
            <BrandLockup brand="posthog" name="PostHog" role="Logs" />
          </div>
        </div>
      </section>

      <section className="lf-bento">
        {/* Card A: Stripe */}
        <div className="bento">
          <div className="bento-eyebrow"><span className="src-dot" style={{ background: '#635BFF' }}></span> Stripe · Billing sync</div>
          <h3>Live invoice ledger</h3>
          <p>Active subscriptions, MRR, and 30-day invoice history ingested on a read-only key.</p>
          <div className="bento-preview">
            <div className="mini-invoice">
              <div className="mi-row"><span className="label">Acme Corp · Growth</span><span className="val mi-pos">+$1,200.00</span></div>
              <div className="mi-row"><span className="label">Northwind · Scale</span><span className="val mi-pos">+$2,500.00</span></div>
              <div className="mi-row"><span className="label">Parallax · Starter</span><span className="val mi-pos">+$99.00</span></div>
              <div className="mi-row"><span className="label">Status</span><span className="mi-status">SYNCED · 248 ACCOUNTS</span></div>
            </div>
          </div>
        </div>

        {/* Card B: Langfuse chart */}
        <div className="bento">
          <div className="bento-eyebrow"><span className="src-dot" style={{ background: '#10B981' }}></span> Langfuse · Token cost</div>
          <h3>Per-customer LLM spend</h3>
          <p>Every prompt and completion attributed back to a customer_id.</p>
          <div className="bento-preview">
            <div className="mini-chart">
              <div className="legend"><span>30d token spend</span><span className="total">$8,420</span></div>
              <svg className="chart-svg" viewBox="0 0 320 100" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="gradChart" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F87171" stopOpacity="0.35"></stop>
                    <stop offset="100%" stopColor="#F87171" stopOpacity="0"></stop>
                  </linearGradient>
                </defs>
                <path d="M0,70 L20,62 L40,68 L60,55 L80,58 L100,40 L120,46 L140,30 L160,38 L180,22 L200,28 L220,18 L240,24 L260,12 L280,18 L300,8 L320,14 L320,100 L0,100 Z" fill="url(#gradChart)"></path>
                <path d="M0,70 L20,62 L40,68 L60,55 L80,58 L100,40 L120,46 L140,30 L160,38 L180,22 L200,28 L220,18 L240,24 L260,12 L280,18 L300,8 L320,14" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"></path>
                <circle cx="300" cy="8" r="4" fill="#EF4444" stroke="#fff" strokeWidth="2"></circle>
              </svg>
            </div>
          </div>
        </div>

        {/* Card C: Sentinel */}
        <div className="bento">
          <div className="bento-eyebrow"><span className="src-dot" style={{ background: '#6366F1' }}></span> Claude agent · Auditor</div>
          <h3>Sentinel watches every account.</h3>
          <p>Drafts remediation notices for negative-margin customers.</p>
          <div className="bento-preview">
            <div className="sentinel-icon">
              <div className="scan-line"></div>
              <div className="sentinel-bot">
                <div className="head">
                  <div className="eye l"></div>
                  <div className="eye r"></div>
                  <div className="mouth"></div>
                </div>
                <div className="body"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Themed data-flow pipeline */}
      <section className="lf-flow-section" id="product">
        <span className="lf-eyebrow"><span className="pulse"></span> The Pipeline</span>
        <h2 className="lf-flow-title">How data fuses into margin control</h2>
        <p className="lf-flow-sub">
          Sentinel joins billing revenue, LLM trace cost, and usage clickstreams into a single
          local-first ledger — then hands it to a Claude agent that audits every account.
        </p>

        <div className="lf-flow-diagram">
          <div className="flow-node">
            <span className="node-icon stripe"><StripeGlyph size={22} /></span>
            <h4>Stripe Invoices</h4>
            <p>Monthly recurring revenue</p>
          </div>

          <div className="flow-link" aria-hidden="true"><span className="flow-pulse"></span></div>

          <div className="flow-node">
            <span className="node-icon langfuse"><LangfuseGlyph size={22} /></span>
            <h4>Langfuse Traces</h4>
            <p>Per-customer token cost</p>
          </div>

          <div className="flow-link" aria-hidden="true"><span className="flow-pulse"></span></div>

          <div className="flow-node">
            <span className="node-icon posthog"><PostHogGlyph size={22} /></span>
            <h4>PostHog Clicks</h4>
            <p>Feature action logs</p>
          </div>

          <div className="flow-link special" aria-hidden="true">
            <span className="flow-chip">Coral · SQL Join</span>
            <span className="flow-pulse"></span>
          </div>

          <div className="flow-node highlight">
            <span className="node-icon sentinel"><SentinelGlyph size={22} /></span>
            <h4>Claude Sentinel</h4>
            <p>Drafts the margin fix</p>
          </div>
        </div>
      </section>

      <footer className="lf-footer">
        <div className="lf-footer-top">
          <div className="lf-footer-brand">
            <div className="lf-brand"><span className="mark"></span> Sentinel</div>
            <p>The unit-economics desk for AI products. Find the accounts quietly losing you money — and fix them before renewal.</p>
            <div className="lf-footer-badges">
              <span>SOC 2 Type II</span>
              <span>Read-only keys</span>
            </div>
          </div>

          <nav className="lf-footer-cols" aria-label="Footer">
            <div className="lf-footer-col">
              <h5>Product</h5>
              <a href="#product" onClick={(e) => e.preventDefault()}>Overview</a>
              <a href="#pricing" onClick={(e) => e.preventDefault()}>Pricing</a>
              <a href="#changelog" onClick={(e) => e.preventDefault()}>Changelog</a>
              <a href="#signin" onClick={(e) => { e.preventDefault(); onStartAudit(); }}>Start free audit</a>
            </div>
            <div className="lf-footer-col">
              <h5>Integrations</h5>
              <a href="#integrations" onClick={(e) => e.preventDefault()}>Stripe</a>
              <a href="#integrations" onClick={(e) => e.preventDefault()}>Langfuse</a>
              <a href="#integrations" onClick={(e) => e.preventDefault()}>PostHog</a>
              <a href="#integrations" onClick={(e) => e.preventDefault()}>Anthropic</a>
            </div>
            <div className="lf-footer-col">
              <h5>Company</h5>
              <a href="#about" onClick={(e) => e.preventDefault()}>About</a>
              <a href="#customers" onClick={(e) => e.preventDefault()}>Customers</a>
              <a href="#security" onClick={(e) => e.preventDefault()}>Security</a>
              <a href="#contact" onClick={(e) => e.preventDefault()}>Contact</a>
            </div>
          </nav>
        </div>

        <div className="lf-footer-stack">
          <span className="lf-footer-stack-label">Connects with</span>
          <div className="lf-footer-stack-logos">
            <BrandLockup brand="stripe" name="Stripe" />
            <BrandLockup brand="langfuse" name="Langfuse" />
            <BrandLockup brand="posthog" name="PostHog" />
          </div>
        </div>

        <div className="lf-footer-bottom">
          <span>© 2026 Margin Sentinel</span>
          <span>Pirates of the Coral-bean · Enterprise Track</span>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
