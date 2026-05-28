import { useState, useEffect } from 'react';
import type { AuditResult, MarginRow } from '../types';
import { AppSettings } from '../App.tsx';
import {
  Play, Send, RefreshCw, AlertCircle, CheckCircle2, Mail, ShieldAlert, Sliders, Database, Search, Inbox,
} from 'lucide-react';
import './dashboard.css';

interface DashboardPageProps {
  settings: AppSettings;
}

type Status = MarginRow['status'];

const STATUS_TONE: Record<Status, string> = {
  leak: 'var(--loss)',
  warning: 'var(--gold)',
  healthy: 'var(--profit)',
};
const STATUS_DOT: Record<Status, string> = {
  leak: 'dot--loss',
  warning: 'dot--warn',
  healthy: 'dot--profit',
};

const fmtUSD = (n: number): string => `${n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString('en-US')}`;

function DashboardPage({ settings }: DashboardPageProps) {
  const [loading, setLoading] = useState(true);
  const [margins, setMargins] = useState<MarginRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRow, setSelectedRow] = useState<MarginRow | null>(null);

  const [auditLoading, setAuditLoading] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [emailText, setEmailText] = useState('');
  const [auditError, setAuditError] = useState<string | null>(null);

  const [remediating, setRemediating] = useState(false);
  const [remediationSuccess, setRemediationSuccess] = useState<string | null>(null);

  const fetchMargins = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/margins');
      const data = await res.json();
      if (data.success) setMargins(data.data);
      else setError(data.error);
    } catch (err) {
      console.error('Error fetching margins:', err);
      setError('Network error: could not load the margin ledger.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMargins();
  }, [settings.useSandbox]);

  const handleRunAudit = async (row: MarginRow) => {
    setSelectedRow(row);
    setAuditLoading(true);
    setAuditResult(null);
    setAuditError(null);
    setRemediationSuccess(null);
    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row }),
      });
      const data = await res.json();
      if (data.success) {
        setAuditResult(data.data);
        setEmailText(data.data.emailDraft.body);
      } else {
        setAuditError(data.error);
      }
    } catch (err) {
      console.error('Error running audit:', err);
      setAuditError('Network error: could not complete the AI audit.');
    } finally {
      setAuditLoading(false);
    }
  };

  const handleExecuteRemediation = async (action: string) => {
    if (!selectedRow || !auditResult) return;
    setRemediating(true);
    setRemediationSuccess(null);
    try {
      const res = await fetch('/api/remediate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: selectedRow.email,
          action,
          text: action.includes('email') ? emailText : '',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRemediationSuccess(data.message);
        fetchMargins();
      } else {
        alert('Remediation failed: ' + data.error);
      }
    } catch (err) {
      console.error('Error triggering remediation:', err);
    } finally {
      setRemediating(false);
    }
  };

  const filteredMargins = margins.filter(
    (row) =>
      row.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const leakCount = margins.filter((m) => m.status === 'leak').length;
  const portfolioMargin = margins.reduce((sum, m) => sum + m.net_margin, 0);

  return (
    <div className="desk reveal">
      {/* ---------- Left: margin ledger ---------- */}
      <section className="surface panel" aria-label="Customer margin ledger">
        <header className="panel__head">
          <div>
            <h2 className="panel__title">Margin Ledger</h2>
            <p className="panel__sub">Stripe revenue × Langfuse cost × PostHog usage, joined per account.</p>
          </div>
          <button className="btn btn--ghost btn--icon" onClick={fetchMargins} disabled={loading} aria-label="Refresh ledger">
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </header>

        <div className="summary">
          <div className="summary__cell">
            <div className="summary__num">{margins.length}</div>
            <div className="summary__label">Accounts</div>
          </div>
          <div className="summary__cell">
            <div className="summary__num" style={{ color: leakCount ? 'var(--loss)' : 'var(--profit)' }}>{leakCount}</div>
            <div className="summary__label">Leaking</div>
          </div>
          <div className="summary__cell">
            <div className="summary__num" style={{ color: portfolioMargin < 0 ? 'var(--loss)' : 'var(--profit)' }}>
              {fmtUSD(portfolioMargin)}
            </div>
            <div className="summary__label">Net / mo</div>
          </div>
        </div>

        <div className="search">
          <Search size={17} color="var(--bone-faint)" />
          <input
            type="text"
            placeholder="Search accounts or emails…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search accounts"
          />
        </div>

        <div className="panel__scroll">
          {loading ? (
            <div className="state-block">
              <RefreshCw size={30} color="var(--gold)" className="spin" />
              <span>Querying Coral schemas…</span>
            </div>
          ) : error ? (
            <div className="callout callout--loss">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          ) : filteredMargins.length === 0 ? (
            <div className="state-block">
              <Inbox size={30} color="var(--bone-faint)" />
              <span>No accounts match “{searchTerm}”.</span>
            </div>
          ) : (
            <table className="ledger">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Revenue</th>
                  <th>AI Cost</th>
                  <th>Net Margin</th>
                  <th aria-label="Audit action" />
                </tr>
              </thead>
              <tbody>
                {filteredMargins.map((row) => {
                  const tone = STATUS_TONE[row.status];
                  const load = Math.min(row.total_token_cost / Math.max(row.monthly_revenue, 1), 1) * 100;
                  return (
                    <tr key={row.email} data-selected={selectedRow?.email === row.email}>
                      <td>
                        <div className="cust__name" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', width: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className={`dot ${STATUS_DOT[row.status]}`} />
                            {row.customer_name}
                          </div>
                          {row.plan && (
                            <span className="mono faint" style={{ fontSize: '0.62rem', border: '1px solid var(--line-strong)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {row.plan}
                            </span>
                          )}
                        </div>
                        <div className="cust__email">{row.email}</div>
                        <div className="loadbar" title={`Cost is ${Math.round(load)}% of revenue`}>
                          <div className="loadbar__fill" style={{ width: `${load}%`, background: tone }} />
                        </div>
                      </td>
                      <td className="figure">{fmtUSD(row.monthly_revenue)}</td>
                      <td className="figure">{fmtUSD(row.total_token_cost)}</td>
                      <td className="figure figure--big" style={{ color: tone }}>
                        {row.net_margin >= 0 ? '+' : ''}{fmtUSD(row.net_margin)}
                      </td>
                      <td>
                        <button
                          className={`btn btn--sm ${row.status === 'leak' ? 'btn--danger pulse-loss' : 'btn--ghost'}`}
                          onClick={() => handleRunAudit(row)}
                        >
                          <Play size={12} />
                          Audit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ---------- Right: agent control center ---------- */}
      <section className="surface panel" aria-label="Agent control center">
        <header className="panel__head">
          <div>
            <h2 className="panel__title">Agent Control Center</h2>
            <p className="panel__sub">Claude Sonnet · unit-economics analyzer</p>
          </div>
          {auditLoading && <span className="pill pill--warn"><span className="dot dot--warn" /> Auditing</span>}
        </header>

        <div className="terminal console-query">
          <div className="terminal__bar">
            <span style={{ background: 'var(--loss)' }} />
            <span style={{ background: 'var(--gold)' }} />
            <span style={{ background: 'var(--profit)' }} />
            <span className="mono faint" style={{ width: 'auto', height: 'auto', marginLeft: '0.5rem', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Database size={11} /> coral · live execution
            </span>
          </div>
          <div className="terminal__body">
            {selectedRow ? (
              <>
                <span className="query-prompt">›</span>
                <span className="tok-key">SELECT</span> * <span className="tok-key">FROM</span> stripe.subscriptions s{' '}
                <span className="tok-key">JOIN</span> langfuse.traces l{' '}
                <span className="tok-key">ON</span> l.user_email = s.email{' '}
                <span className="tok-key">WHERE</span> s.email = <span className="tok-num">'{selectedRow.email}'</span>;
              </>
            ) : (
              <span className="faint"><span className="query-prompt">›</span> awaiting account selection…</span>
            )}
          </div>
        </div>

        <div className="surface--inset stream">
          <div className="stream__label">Claude Reasoning Stream</div>
          {auditLoading ? (
            <div className="state-block">
              <RefreshCw size={24} color="var(--gold)" className="spin" />
              <span>Claude is auditing usage logs…</span>
            </div>
          ) : auditError ? (
            <div className="callout callout--loss" style={{ alignSelf: 'stretch' }}>
              <AlertCircle size={18} />
              <span>{auditError}</span>
            </div>
          ) : auditResult ? (
            <div className="timeline">
              {auditResult.reasoning.map((step, idx) => (
                <div
                  key={idx}
                  className="timeline__step reveal"
                  data-final={idx === auditResult.reasoning.length - 1}
                  style={{ animationDelay: `${idx * 0.12}s` }}
                >
                  <span className="timeline__node">{String(idx + 1).padStart(2, '0')}</span>
                  <span className="timeline__text">{step}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="state-block">
              <ShieldAlert size={28} color="var(--bone-faint)" />
              <span>Select a flagged account and run an audit to begin the margin analysis.</span>
            </div>
          )}
        </div>

        {auditResult && selectedRow && (
          <div className="action-stack reveal">
            <div className="action-banner">
              <span className="action-banner__label">
                <ShieldAlert size={17} />
                Suggested action
              </span>
              <span className="pill pill--warn">{auditResult.suggestedAction}</span>
            </div>

            <div className="draft">
              <div className="draft__head">
                <Mail size={15} />
                Remediation email draft
              </div>
              {auditResult.emailDraft.subject && (
                <div className="draft__subject">Subject: {auditResult.emailDraft.subject}</div>
              )}
              <textarea value={emailText} onChange={(e) => setEmailText(e.target.value)} aria-label="Email draft body" />
            </div>

            <div className="action-grid">
              <button className="btn btn--primary" onClick={() => handleExecuteRemediation('send_email')} disabled={remediating}>
                {remediating ? <RefreshCw size={16} className="spin" /> : <Send size={16} />}
                Send Notice
              </button>
              <button className="btn btn--ghost" onClick={() => handleExecuteRemediation('throttle_flag')} disabled={remediating}>
                <Sliders size={16} />
                Throttle Flag
              </button>
            </div>

            {remediationSuccess && (
              <div className="callout callout--profit">
                <CheckCircle2 size={16} />
                <span>{remediationSuccess}</span>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default DashboardPage;
