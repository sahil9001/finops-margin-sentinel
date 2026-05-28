import { ArrowRight, Database, LineChart, GitMerge, Cpu, Check } from 'lucide-react';
import './landing.css';

interface LandingPageProps {
  onEnterDashboard: () => void;
  onLaunchSandbox: () => void;
}

const STATS = [
  { num: '$24,840', label: 'AI margin leaks intercepted', tone: 'var(--profit)' },
  { num: '84.2%', label: 'Coral query efficiency', tone: 'var(--gold)' },
  { num: '148', label: 'Autonomous agent audits run', tone: 'var(--bone)' },
];

const STEPS = [
  { icon: Database, title: 'Ingest Stripe', body: 'Coral reads subscription plans and invoices directly, surfacing active recurring revenue per account.' },
  { icon: LineChart, title: 'Trace LLM cost', body: 'Token spend from Langfuse and feature events from PostHog are mapped back to each customer email.' },
  { icon: GitMerge, title: 'Join locally', body: 'A single local-first SQL join fuses revenue and cost — no warehouse, no pipeline, no latency.' },
  { icon: Cpu, title: 'Remediate', body: 'Claude audits the leak, drafts an upsell notice, and proposes a feature-flag throttle to stop the bleed.' },
];

const CHECKS = [
  'Zero data latency — queries live APIs directly.',
  'Secure by default — key management stays on your host.',
  'Declarative mapping — simple YAML manifests compile to tables.',
];

function LandingPage({ onEnterDashboard, onLaunchSandbox }: LandingPageProps) {
  return (
    <div className="shell landing">
      {/* Hero */}
      <section className="hero" aria-labelledby="hero-heading">
        <div className="reveal" style={{ animationDelay: '0.05s' }}>
          <p className="eyebrow">FinOps · SaaS Unit Economics</p>
          <h1 className="display hero__title" id="hero-heading">
            Your AI features are <em>quietly</em> losing you money.
          </h1>
          <p className="hero__sub">
            Margin Sentinel joins Stripe revenue, Langfuse token cost, and PostHog usage into one customer ledger —
            then sends a Claude agent to audit every negative-margin account and draft the fix.
          </p>
          <div className="hero__cta">
            <button className="btn btn--primary" onClick={onLaunchSandbox} style={{ padding: '0.85rem 1.5rem' }}>
              Launch Demo Sandbox
              <ArrowRight size={18} />
            </button>
            <button className="btn btn--ghost" onClick={onEnterDashboard} style={{ padding: '0.85rem 1.5rem' }}>
              Open the Desk
            </button>
          </div>
        </div>

        {/* Hero visual: a margin statement caught in the red */}
        <div className="surface statement reveal" style={{ animationDelay: '0.18s' }}>
          <div className="statement__head">
            <span className="statement__name">Acme Corporation</span>
            <span className="pill pill--loss">
              <span className="dot dot--loss" />
              Leak
            </span>
          </div>
          <div className="statement__line">
            <span className="label">Stripe subscription</span>
            <span className="val" style={{ color: 'var(--profit)' }}>+ $1,200.00</span>
          </div>
          <div className="statement__line">
            <span className="label">Langfuse token cost</span>
            <span className="val" style={{ color: 'var(--loss)' }}>− $1,540.00</span>
          </div>
          <div className="statement__line">
            <span className="label">AI feature calls</span>
            <span className="val muted">45,200</span>
          </div>
          <div className="statement__total">
            <span className="muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Net Margin
            </span>
            <span className="big" style={{ color: 'var(--loss)' }}>− $340</span>
          </div>
          <div className="statement__stamp">Negative gross margin — flagged</div>
        </div>
      </section>

      {/* Ticker stats */}
      <section className="ticker reveal" style={{ animationDelay: '0.28s' }} aria-label="Key metrics">
        {STATS.map((s) => (
          <div className="ticker__cell" key={s.label}>
            <div className="ticker__num" style={{ color: s.tone }}>{s.num}</div>
            <div className="ticker__label">{s.label}</div>
          </div>
        ))}
      </section>

      {/* Workflow */}
      <section className="section" aria-labelledby="workflow-heading">
        <p className="eyebrow">The Pipeline</p>
        <h2 className="section__title" id="workflow-heading">From raw billing to remediation in four moves.</h2>
        <div className="steps">
          {STEPS.map((step, i) => (
            <article className="surface surface-hover step reveal" key={step.title} style={{ animationDelay: `${0.1 * i}s` }}>
              <span className="step__index">{String(i + 1).padStart(2, '0')}</span>
              <step.icon className="step__icon" size={26} strokeWidth={1.75} />
              <h3 className="step__title">{step.title}</h3>
              <p className="step__body">{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* SQL section */}
      <section className="surface sql-section" aria-labelledby="sql-heading">
        <div>
          <p className="eyebrow">Coral SQL Engine</p>
          <h2 style={{ fontSize: '1.9rem', margin: '0.75rem 0 1rem' }} id="sql-heading">
            One query where there used to be a pipeline.
          </h2>
          <p className="muted" style={{ fontSize: '0.95rem', lineHeight: 1.6 }}>
            Connecting usage events to pricing data normally means an ETL job into a warehouse and a separate BI tool.
            Coral collapses that into a single query running inside the agent's workspace.
          </p>
          <ul className="checklist">
            {CHECKS.map((c) => (
              <li key={c}>
                <Check size={17} strokeWidth={2.5} />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="terminal">
          <div className="terminal__bar">
            <span style={{ background: 'var(--loss)' }} />
            <span style={{ background: 'var(--gold)' }} />
            <span style={{ background: 'var(--profit)' }} />
            <span className="mono faint" style={{ width: 'auto', height: 'auto', marginLeft: '0.5rem', fontSize: '0.72rem' }}>
              coral · margin.sql
            </span>
          </div>
          <pre className="terminal__body" style={{ margin: 0 }}>
            <span className="tok-cmt">-- Cross-source margin join</span>{'\n'}
            <span className="tok-key">SELECT</span> s.email, s.monthly_revenue, l.token_cost,{'\n'}
            {'       '}(s.monthly_revenue - l.token_cost) <span className="tok-key">AS</span> net_margin{'\n'}
            <span className="tok-key">FROM</span> stripe.subscriptions s{'\n'}
            <span className="tok-key">JOIN</span> langfuse.usage_summary l{'\n'}
            {'  '}<span className="tok-key">ON</span> l.user_email = s.email{'\n'}
            <span className="tok-key">WHERE</span> (s.monthly_revenue - l.token_cost) {'<'} <span className="tok-num">0</span>;
          </pre>
        </div>
      </section>

      <footer className="landing-footer">
        <span>Margin Sentinel</span>
        <span>Pirates of the Coral-bean · Enterprise Track</span>
      </footer>
    </div>
  );
}

export default LandingPage;
