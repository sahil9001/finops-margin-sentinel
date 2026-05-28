import { useState, useEffect } from 'react';
import type { AuditResult, MarginRow } from '../types';
import type { AppSettings } from '../App.tsx';
import { Play, Send, RefreshCw, AlertCircle, CheckCircle2, Sliders, Search, Inbox } from 'lucide-react';

interface DashboardPageProps {
  settings: AppSettings;
  onRefreshMarginsTrigger?: () => void;
}

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
  
  const [activeTab, setActiveTab] = useState<'ledger' | 'policies' | 'audit' | 'settings'>('ledger');

  const fetchMargins = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/margins');
      const data = await res.json();
      if (data.success) {
        setMargins(data.data);
        // Pre-select the first leaking customer for context, but do NOT audit —
        // the live Claude audit only runs when the user clicks the play button.
        if (data.data.length > 0 && !selectedRow) {
          const leakRow = data.data.find((r: MarginRow) => r.status === 'leak') || data.data[0];
          setSelectedRow(leakRow);
        }
      } else {
        setError(data.error);
      }
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

  // Selecting a row is free (no API call). Clear any audit result that belongs
  // to a different customer so the panel never shows a stale mismatch.
  const handleSelectRow = (row: MarginRow) => {
    setSelectedRow(row);
    if (auditResult && auditResult.clientEmail !== row.email) {
      setAuditResult(null);
      setAuditError(null);
      setRemediationSuccess(null);
    }
  };

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
    <div className="dash">
      <div className="dash-topbar">
        <div className="left">
          <div className="brand-mini"><span className="mark"></span> Sentinel</div>
          <div className="dash-tabs">
            <div className={`dash-tab ${activeTab === 'ledger' ? 'active' : ''}`} onClick={() => setActiveTab('ledger')}>Margin Ledger</div>
            <div className={`dash-tab ${activeTab === 'policies' ? 'active' : ''}`} onClick={() => setActiveTab('policies')}>Policies</div>
            <div className={`dash-tab ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>Audit Log</div>
            <div className={`dash-tab ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>Settings</div>
          </div>
        </div>
        <div className="right">
          <button className="dash-pill" onClick={fetchMargins} disabled={loading} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="pulse"></span> 
            {loading ? 'syncing...' : 'last sync · 14s ago'}
          </button>
          <span className="dash-av">M</span>
        </div>
      </div>

      {activeTab === 'ledger' && (
        <div className="dash-split">
          {/* LEFT PANE */}
          <div className="dash-pane left">
            <div className="dash-head">
              <div>
                <h2>Margin Ledger</h2>
                <div className="sub">stripe.invoices × langfuse.traces · joined per customer_id</div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid var(--line)', borderRadius: '999px', padding: '2px 12px 2px 8px', fontSize: '12px' }}>
                  <Search size={14} color="var(--ink-3)" style={{ marginRight: '6px' }} />
                  <input
                    type="text"
                    placeholder="Search accounts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '12px', width: '130px', color: 'var(--ink)' }}
                  />
                </div>
                <button className="dash-pill" onClick={fetchMargins} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <RefreshCw size={11} className={loading ? 'spin' : ''} />
                  refresh
                </button>
              </div>
            </div>

            <div className="dash-stat-row">
              <div className="dash-stat">
                <div className="lbl">Active accounts</div>
                <div className="val">{margins.length}</div>
                <div className="delta" style={{ color: 'var(--ink-3)' }}>+8 vs. last audit</div>
              </div>
              <div className="dash-stat leak">
                <div className="lbl">Leaking</div>
                <div className="val">{leakCount}</div>
                <div className="delta">−$2,180 / mo at risk</div>
              </div>
              <div className="dash-stat profit">
                <div className="lbl">Total net margin</div>
                <div className="val">{fmtUSD(portfolioMargin)}<span className="unit">/mo</span></div>
                <div className="delta">+6.2% vs. prior 30d</div>
              </div>
            </div>

            <div className="dash-table-card">
              {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-3)' }}>
                  <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px', display: 'block' }} />
                  Querying Coral schemas...
                </div>
              ) : error ? (
                <div style={{ padding: '20px', color: 'var(--coral-2)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              ) : filteredMargins.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-3)' }}>
                  <Inbox size={28} style={{ margin: '0 auto 10px', display: 'block' }} />
                  No accounts matched.
                </div>
              ) : (
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Plan</th>
                      <th style={{ textAlign: 'right' }}>Subscription</th>
                      <th style={{ textAlign: 'right' }}>AI cost</th>
                      <th style={{ textAlign: 'right' }}>Net margin</th>
                      <th style={{ textAlign: 'right' }}>Audit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMargins.map((row) => (
                      <tr key={row.email} className={selectedRow?.email === row.email ? 'selected' : ''} onClick={() => handleSelectRow(row)} style={{ cursor: 'pointer' }}>
                        <td>
                          <div className="dash-cust">
                            <span className={`dot ${row.status}`}></span>
                            <div>
                              <div className="name">{row.customer_name}</div>
                              <div className="email">{row.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`dash-plan ${row.plan?.toLowerCase() || 'starter'}`}>
                            {row.plan || 'Starter'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="dash-num">{fmtUSD(row.monthly_revenue)}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="dash-num">{fmtUSD(row.total_token_cost)}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className={`dash-num ${row.net_margin < 0 ? 'neg' : 'pos'}`}>
                            {row.net_margin >= 0 ? '+' : ''}{fmtUSD(row.net_margin)}
                          </span>
                        </td>
                        <td>
                          <div className="audit-cell" onClick={(e) => e.stopPropagation()}>
                            <button
                              className={`audit-btn ${selectedRow?.email === row.email ? 'live' : ''}`}
                              onClick={() => handleRunAudit(row)}
                            >
                              <Play size={11} fill={selectedRow?.email === row.email ? '#fff' : 'currentColor'} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* RIGHT PANE: AGENT CONTROL */}
          <div className="dash-pane right">
            <div className="dash-head">
              <div>
                <h2>Agent Control</h2>
                <div className="sub">Claude 3.5 Sonnet · Unit-Economics agent</div>
              </div>
              <span className="agent-live"><span className="pulse"></span> live</span>
            </div>

            <div className="agent-bar">
              <div className="agent-avatar">CL</div>
              <div className="info">
                <div className="n">{auditLoading ? 'Auditing account...' : selectedRow ? `Auditing · ${selectedRow.customer_name}` : 'Awaiting Selection'}</div>
                <div className="v">{selectedRow ? 'run_id · aud_7K2pNqRv · active' : 'select a row to begin audit'}</div>
              </div>
            </div>

            <div className="sec-lbl">
              <span>Active query</span>
              <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--ink-4)' }}>postgres · read replica</span>
            </div>

            <div className="console">
              <div className="console-head">
                <span className="ttl">~/sentinel/agent/margin_audit.sql</span>
                <div className="lights"><span></span><span></span><span></span></div>
              </div>
              <div className="console-body">
                {selectedRow ? (
                  <>
                    <span className="tok-cmt">-- join 30d invoices with attributed LLM cost</span>{'\n'}
                    <span className="tok-kw">SELECT</span> s.email, s.monthly_revenue, l.token_cost{'\n'}
                    <span className="tok-kw">FROM</span> <span className="tok-tbl">stripe.subscriptions</span> s{'\n'}
                    <span className="tok-kw">JOIN</span> <span className="tok-tbl">langfuse.traces</span> l{'\n'}
                    {'  '}<span className="tok-kw">ON</span> l.customer_id = s.customer_id{'\n'}
                    <span className="tok-kw">WHERE</span> s.email = <span className="tok-str">'{selectedRow.email}'</span>;
                    <span className="cursor-blink"></span>
                  </>
                ) : (
                  <>
                    <span className="tok-cmt">-- Awaiting account selection...</span>
                  </>
                )}
              </div>
            </div>

            <div className="sec-lbl">
              <span>Reasoning stream</span>
              <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--ink-4)' }}>
                {auditResult ? `${auditResult.reasoning.length} of ${auditResult.reasoning.length} steps` : '0 steps'}
              </span>
            </div>

            <div className="timeline">
              {auditLoading ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--ink-3)' }}>
                  <RefreshCw size={18} className="spin" style={{ margin: '0 auto 10px', display: 'block' }} />
                  Analyzing API usage traces...
                </div>
              ) : auditError ? (
                <div style={{ color: 'var(--coral-2)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <AlertCircle size={16} />
                  <span>{auditError}</span>
                </div>
              ) : auditResult ? (
                auditResult.reasoning.map((step, idx) => {
                  const isLast = idx === auditResult.reasoning.length - 1;
                  return (
                    <div key={idx} className={`tl ${isLast ? 'live' : 'done'}`}>
                      <div className="mk">
                        {isLast ? (
                          String(idx + 1).padStart(2, '0')
                        ) : (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        )}
                      </div>
                      <div className="text">
                        <strong>{String(idx + 1).padStart(2, '0')}.</strong> {step}
                        <div className="ts">
                          {idx === 0 && '12:04:18 · 1,243 rows scanned'}
                          {idx === 1 && `12:04:19 · gross_margin = ${((selectedRow?.net_margin || 0) / (selectedRow?.monthly_revenue || 1) * 100).toFixed(1)}%`}
                          {idx === 2 && '12:04:20 · 412 traces in 14m window'}
                          {idx === 3 && '12:04:22 · drafting remediation notice…'}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ color: 'var(--ink-3)', fontSize: '13px' }}>
                  Select an account and run audit to view Claude's live reasoning stream.
                </div>
              )}
            </div>

            {auditResult && selectedRow && (
              <div className="action-stack reveal">
                <div className="sec-lbl">
                  <span>Suggested action</span>
                  <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--ink-4)' }}>{selectedRow.customer_name.toLowerCase()}</span>
                </div>

                <div className="action-banner">
                  <div className="ab-head">
                    <div className="label">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '6px' }}>
                        <path d="M12 2 1 22h22L12 2zm0 6 7.5 13h-15L12 8zm-1 3v4h2v-4h-2zm0 6v2h2v-2h-2z"></path>
                      </svg>
                      {auditResult.suggestedAction}
                    </div>
                    <span className="badge">Net {fmtUSD(selectedRow.net_margin)} / mo</span>
                  </div>
                  <div className="email-draft">
                    <div className="meta">
                      <div><span className="k">To</span> {selectedRow.email}</div>
                      <div><span className="k">Re</span> {auditResult.emailDraft.subject || `Your ${selectedRow.customer_name} subscription`}</div>
                    </div>
                    <textarea
                      value={emailText}
                      onChange={(e) => setEmailText(e.target.value)}
                      style={{ width: '100%', height: '110px', border: 'none', outline: 'none', resize: 'none', fontSize: '13px', fontFamily: 'var(--sans)', color: 'var(--ink)' }}
                      aria-label="Email draft text"
                    />
                  </div>
                  <div className="ab-actions">
                    <button className="ab-btn primary" onClick={() => handleExecuteRemediation('send_email')} disabled={remediating}>
                      {remediating ? <RefreshCw size={13} className="spin" /> : <Send size={13} />}
                      {selectedRow.net_margin >= 0 ? 'Send Thank You' : 'Send Notice'}
                    </button>
                    {selectedRow.net_margin < 0 && (
                      <button className="ab-btn outline" onClick={() => handleExecuteRemediation('throttle_flag')} disabled={remediating}>
                        <Sliders size={13} />
                        Throttle Flag
                      </button>
                    )}
                  </div>
                </div>

                {remediationSuccess && (
                  <div className="callout callout--profit" style={{ marginTop: '12px', background: 'var(--emerald-soft)', border: '1px solid rgba(16,185,129,0.22)', color: 'var(--emerald-2)', display: 'flex', gap: '8px', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>
                    <CheckCircle2 size={15} />
                    <span>{remediationSuccess}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'policies' && (
        <div style={{ padding: '40px', color: 'var(--ink-2)', textAlign: 'center' }}>
          <h3>Margin Threshold Policies</h3>
          <p style={{ marginTop: '10px', fontSize: '14px' }}>Automatic throttle rules and margin alerts are configured inside the config repository.</p>
        </div>
      )}

      {activeTab === 'audit' && (
        <div style={{ padding: '40px', color: 'var(--ink-2)', textAlign: 'center' }}>
          <h3>System Audit Log</h3>
          <p style={{ marginTop: '10px', fontSize: '14px' }}>No logs recorded in this session. Running in local-first memory cache.</p>
        </div>
      )}

      {activeTab === 'settings' && (
        <div style={{ padding: '40px', color: 'var(--ink-2)', maxWidth: '600px', margin: '0 auto' }}>
          <h3 style={{ fontSize: '20px', marginBottom: '14px', color: 'var(--ink)' }}>Credential Configuration</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Stripe Secret Key</label>
              <input type="password" value={settings.stripeKey ? '••••••••••••••••••••••••' : ''} className="ob-input" style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '6px', padding: '10px' }} readOnly />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Langfuse Key</label>
              <input type="password" value={settings.langfuseKey ? '••••••••••••••••••••••••' : ''} className="ob-input" style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '6px', padding: '10px' }} readOnly />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Execution Environment</label>
              <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '8px', padding: '14px', marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 600, display: 'block', fontSize: '14px' }}>Data Mode</span>
                  <span style={{ fontSize: '12px', color: 'var(--ink-3)' }}>Switch between simulated sandbox or API connections</span>
                </div>
                <div style={{ display: 'inline-flex', background: 'var(--sand-2)', padding: '4px', borderRadius: '999px', border: '1px solid var(--line)' }}>
                  <span style={{ padding: '6px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: settings.useSandbox ? '#fff' : 'transparent', color: settings.useSandbox ? 'var(--ink)' : 'var(--ink-3)', cursor: 'default' }}>Sandbox</span>
                  <span style={{ padding: '6px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: !settings.useSandbox ? '#fff' : 'transparent', color: !settings.useSandbox ? 'var(--ink)' : 'var(--ink-3)', cursor: 'default' }}>Live</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;
