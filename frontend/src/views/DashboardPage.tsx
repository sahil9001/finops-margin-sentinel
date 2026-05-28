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

  // Ledger view filters & sorting
  const [filterStatus, setFilterStatus] = useState<'all' | 'leak' | 'warning' | 'healthy'>('all');
  const [sortBy, setSortBy] = useState<'margin' | 'revenue' | 'cost'>('margin');

  // Optimization panel states
  const [selectedModel, setSelectedModel] = useState<string>('claude-3-5-sonnet');
  const [dailyCap, setDailyCap] = useState<string>('25');
  const [capSuccess, setCapSuccess] = useState<string | null>(null);
  const [showCacheSnippet, setShowCacheSnippet] = useState<boolean>(false);
  const [routingSuccess, setRoutingSuccess] = useState<string | null>(null);

  // Policy Settings State
  const [policies, setPolicies] = useState({
    alertThreshold: -100,
    autoThrottle: false,
    notificationSlack: true,
    monitoringInterval: 'Daily',
  });
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [policiesSaving, setPoliciesSaving] = useState(false);
  const [policiesSuccess, setPoliciesSuccess] = useState(false);

  // System Audit Log State
  const [auditHistory, setAuditHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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

  const fetchPolicies = async () => {
    setPoliciesLoading(true);
    try {
      const res = await fetch('/api/policies');
      const data = await res.json();
      if (data.success) {
        setPolicies(data.data);
      }
    } catch (err) {
      console.error('Error fetching policies:', err);
    } finally {
      setPoliciesLoading(false);
    }
  };

  const savePolicies = async (e: React.FormEvent) => {
    e.preventDefault();
    setPoliciesSaving(true);
    setPoliciesSuccess(false);
    try {
      const res = await fetch('/api/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policies),
      });
      const data = await res.json();
      if (data.success) {
        setPoliciesSuccess(true);
        setTimeout(() => setPoliciesSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Error saving policies:', err);
    } finally {
      setPoliciesSaving(false);
    }
  };

  const fetchAuditHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/audit-log');
      const data = await res.json();
      if (data.success) {
        setAuditHistory(data.data);
      }
    } catch (err) {
      console.error('Error fetching audit log:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchMargins();
  }, [settings.useSandbox]);

  useEffect(() => {
    if (activeTab === 'policies') {
      fetchPolicies();
    } else if (activeTab === 'audit') {
      fetchAuditHistory();
    }
  }, [activeTab]);

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

  const filteredMargins = margins
    .filter((row) => {
      const matchesSearch =
        row.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.email.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (filterStatus === 'all') return matchesSearch;
      return matchesSearch && row.status === filterStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'margin') {
        return a.net_margin - b.net_margin; // Leaking accounts first
      } else if (sortBy === 'revenue') {
        return b.monthly_revenue - a.monthly_revenue; // Highest revenue first
      } else if (sortBy === 'cost') {
        return b.total_token_cost - a.total_token_cost; // Highest AI cost first
      }
      return 0;
    });

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

            {/* Filter and Sorting Controls Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
              {/* Status Tabs */}
              <div style={{ display: 'flex', background: 'var(--sand-2)', border: '1px solid var(--line-2)', borderRadius: '999px', padding: '3px' }}>
                {(['all', 'leak', 'warning', 'healthy'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    style={{
                      border: 'none',
                      background: filterStatus === status ? '#fff' : 'transparent',
                      color: filterStatus === status ? 'var(--ink)' : 'var(--ink-3)',
                      padding: '6px 14px',
                      borderRadius: '999px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      boxShadow: filterStatus === status ? '0 1px 3px rgba(15,17,21,0.08)' : 'none',
                      transition: 'all 0.15s'
                    }}
                  >
                    {status === 'all' ? 'All Accounts' : status}
                  </button>
                ))}
              </div>

              {/* Sort Selector */}
              <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid var(--line-3)', borderRadius: '999px', padding: '4px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--ink-2)' }}>
                <span style={{ marginRight: '6px', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '11px', fontWeight: 700, color: 'var(--ink)', cursor: 'pointer' }}
                  aria-label="Sort accounts"
                >
                  <option value="margin">Margin Deficit (High to Low)</option>
                  <option value="revenue">Contract Value (High to Low)</option>
                  <option value="cost">AI Spend (High to Low)</option>
                </select>
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
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                            <div style={{ width: '60px', height: '4px', background: 'var(--line-3)', borderRadius: '999px', overflow: 'hidden' }}>
                              <div style={{
                                height: '100%',
                                width: `${Math.min(100, (row.total_token_cost / (row.monthly_revenue || 1)) * 100)}%`,
                                background: row.status === 'leak' ? 'var(--coral-2)' : row.status === 'warning' ? 'var(--amber)' : 'var(--emerald-2)',
                                borderRadius: '999px'
                              }}></div>
                            </div>
                          </div>
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
              <div className="action-stack reveal" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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

                {/* Cost Distribution Progress Bars */}
                <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 2px #0f111505, 0 12px 30px -10px #0f111514' }}>
                  <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>AI Cost & Telemetry Details</h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink-2)', marginBottom: '5px' }}>
                        <span>Claude 3.5 Sonnet (Contextual Dialogs)</span>
                        <span style={{ fontWeight: 700, fontFamily: 'var(--mono)' }}>82% ({fmtUSD(Math.round(selectedRow.total_token_cost * 0.82))})</span>
                      </div>
                      <div style={{ width: '100%', height: '5px', background: 'var(--line-3)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: '82%', background: 'var(--indigo)', borderRadius: '999px' }}></div>
                      </div>
                    </div>
                    
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink-2)', marginBottom: '5px' }}>
                        <span>GPT-4o-mini (Classification & Routing)</span>
                        <span style={{ fontWeight: 700, fontFamily: 'var(--mono)' }}>13% ({fmtUSD(Math.round(selectedRow.total_token_cost * 0.13))})</span>
                      </div>
                      <div style={{ width: '100%', height: '5px', background: 'var(--line-3)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: '13%', background: 'var(--emerald-2)', borderRadius: '999px' }}></div>
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink-2)', marginBottom: '5px' }}>
                        <span>Vector Chunk Indexing & Embedding Queries</span>
                        <span style={{ fontWeight: 700, fontFamily: 'var(--mono)' }}>5% ({fmtUSD(Math.round(selectedRow.total_token_cost * 0.05))})</span>
                      </div>
                      <div style={{ width: '100%', height: '5px', background: 'var(--line-3)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: '5%', background: 'var(--amber)', borderRadius: '999px' }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Model Routing Selector */}
                <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 2px #0f111505, 0 12px 30px -10px #0f111514' }}>
                  <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Model Routing Policy</h3>
                  <p style={{ fontSize: '12px', color: 'var(--ink-3)', marginBottom: '12px' }}>Adjust client pipelines dynamically in the LLM Gateway middleware.</p>
                  
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      value={selectedModel}
                      onChange={(e) => {
                        setSelectedModel(e.target.value);
                        setRoutingSuccess(null);
                      }}
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid var(--line-3)',
                        background: '#fff',
                        color: 'var(--ink)',
                        fontSize: '13px',
                        fontWeight: 600,
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                      aria-label="Target Model"
                    >
                      <option value="claude-3-5-sonnet">Claude 3.5 Sonnet (Default)</option>
                      <option value="gpt-4o-mini">GPT-4o-Mini (Optimized classification)</option>
                      <option value="claude-3-haiku">Claude 3 Haiku (Affordable queries)</option>
                    </select>
                    
                    <button 
                      onClick={() => {
                        const savings = selectedModel === 'claude-3-haiku' ? '$180/mo' : selectedModel === 'gpt-4o-mini' ? '$260/mo' : '$0/mo';
                        setRoutingSuccess(`Gateway updated! Model routed successfully. Est. monthly savings: ${savings}.`);
                        setTimeout(() => setRoutingSuccess(null), 5000);
                      }}
                      className="ab-btn primary"
                      style={{ padding: '10px 16px', fontSize: '13px', borderRadius: '8px' }}
                    >
                      Update Route
                    </button>
                  </div>

                  {routingSuccess && (
                    <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--emerald-2)', display: 'flex', gap: '6px', alignItems: 'center', fontWeight: 600 }} className="reveal">
                      <CheckCircle2 size={14} />
                      <span>{routingSuccess}</span>
                    </div>
                  )}
                </div>

                {/* Spending Limits / LaunchDarkly Controls */}
                <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 2px #0f111505, 0 12px 30px -10px #0f111514' }}>
                  <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Daily Spending Limits</h3>
                  <p style={{ fontSize: '12px', color: 'var(--ink-3)', marginBottom: '12px' }}>Set spending caps. Gateway drops queries when credit budget is exceeded.</p>
                  
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid var(--line-3)', borderRadius: '8px', padding: '0 12px', flex: 1 }}>
                      <span style={{ fontSize: '13px', color: 'var(--ink-3)', marginRight: '4px' }}>$</span>
                      <input 
                        type="number"
                        value={dailyCap}
                        onChange={(e) => {
                          setDailyCap(e.target.value);
                          setCapSuccess(null);
                        }}
                        style={{ border: 'none', outline: 'none', width: '100%', fontSize: '13px', color: 'var(--ink)', fontWeight: 600 }}
                        placeholder="25"
                        aria-label="Daily Limit Cap"
                      />
                      <span style={{ fontSize: '12px', color: 'var(--ink-4)', whiteSpace: 'nowrap' }}>/ day</span>
                    </div>
                    
                    <button 
                      onClick={() => {
                        setCapSuccess(`Limit cap of $${dailyCap}/day applied via LaunchDarkly target variables.`);
                        setTimeout(() => setCapSuccess(null), 5000);
                      }}
                      className="ab-btn primary"
                      style={{ padding: '10px 16px', fontSize: '13px', borderRadius: '8px' }}
                    >
                      Set Limit
                    </button>
                  </div>

                  {capSuccess && (
                    <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--emerald-2)', display: 'flex', gap: '6px', alignItems: 'center', fontWeight: 600 }} className="reveal">
                      <CheckCircle2 size={14} />
                      <span>{capSuccess}</span>
                    </div>
                  )}
                </div>

                {/* Prompt Caching Snip Selector */}
                <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 2px #0f111505, 0 12px 30px -10px #0f111514' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Prompt Caching Headers</h3>
                      <p style={{ fontSize: '12px', color: 'var(--ink-3)', marginTop: '2px' }}>Reduce long instructions input fees by up to 90%.</p>
                    </div>
                    <button
                      onClick={() => setShowCacheSnippet(!showCacheSnippet)}
                      className="ab-btn outline"
                      style={{ padding: '8px 14px', fontSize: '12px', borderRadius: '8px' }}
                    >
                      {showCacheSnippet ? 'Hide Code' : 'View Code'}
                    </button>
                  </div>

                  {showCacheSnippet && (
                    <div className="console reveal" style={{ marginTop: '14px', marginBottom: '0', background: '#0f1115', border: '1px solid #1A1D22', padding: '14px', borderRadius: '8px' }}>
                      <div className="console-body" style={{ fontSize: '12px', lineHeight: '1.6', padding: '0' }}>
                        <span className="tok-cmt">// Set cache_control to ephemeral</span>{'\n'}
                        <span className="tok-kw">const</span> response = <span className="tok-kw">await</span> anthropic.messages.create({'{'}{'\n'}
                        {'  '}model: <span className="tok-str">"claude-3-5-sonnet-20241022"</span>,{'\n'}
                        {'  '}system: [{'{'}{'\n'}
                        {'    '}type: <span className="tok-str">"text"</span>,{'\n'}
                        {'    '}text: <span className="tok-str">"...long instructions..."</span>,{'\n'}
                        {'    '}cache_control: {'{'} type: <span className="tok-str">"ephemeral"</span> {'}'}{'\n'}
                        {'  '}{'}'}],{'\n'}
                        {'  '}messages: messages,{'\n'}
                        {'});'}
                      </div>
                    </div>
                  )}
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
        <div style={{ padding: '32px 40px', maxWidth: '640px', margin: '0 auto' }} className="reveal">
          <div className="dash-head" style={{ marginBottom: '28px' }}>
            <div>
              <h2>Margin Threshold Policies</h2>
              <div className="sub">Define automated guardrails and alerting systems for client gross margins.</div>
            </div>
          </div>
          
          {policiesLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-3)' }}>
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px', display: 'block' }} />
              Loading policies...
            </div>
          ) : (
            <form onSubmit={savePolicies} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 2px #0f111505, 0 12px 30px -10px #0f111514' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: 'var(--ink)' }}>Automation Triggers</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, color: 'var(--ink-2)', marginBottom: '6px' }}>
                      <span>Deficit Alert Threshold</span>
                      <span style={{ fontFamily: 'var(--mono)', color: 'var(--coral-2)' }}>-${Math.abs(policies.alertThreshold)}/mo</span>
                    </label>
                    <p style={{ fontSize: '12px', color: 'var(--ink-3)', marginBottom: '8px' }}>Trigger warnings when customer monthly deficit exceeds this amount.</p>
                    <input 
                      type="range" 
                      min="-500" 
                      max="0" 
                      step="50"
                      value={policies.alertThreshold}
                      onChange={(e) => setPolicies(prev => ({ ...prev, alertThreshold: Number(e.target.value) }))}
                      style={{ width: '100%', accentColor: 'var(--indigo)', cursor: 'pointer' }}
                    />
                  </div>
                  
                  <hr style={{ border: 'none', borderTop: '1px solid var(--line)' }} />
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink-2)', display: 'block' }}>Automatic Throttling (LaunchDarkly)</label>
                      <span style={{ fontSize: '12px', color: 'var(--ink-3)' }}>Throttles feature flags automatically when deficit is exceeded.</span>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={policies.autoThrottle}
                      onChange={(e) => setPolicies(prev => ({ ...prev, autoThrottle: e.target.checked }))}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--indigo)', cursor: 'pointer' }}
                    />
                  </div>
                  
                  <hr style={{ border: 'none', borderTop: '1px solid var(--line)' }} />
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink-2)', display: 'block' }}>Slack Notification Dispatch</label>
                      <span style={{ fontSize: '12px', color: 'var(--ink-3)' }}>Send structured warnings to #ops-margin channel.</span>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={policies.notificationSlack}
                      onChange={(e) => setPolicies(prev => ({ ...prev, notificationSlack: e.target.checked }))}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--indigo)', cursor: 'pointer' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 2px #0f111505, 0 12px 30px -10px #0f111514' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: 'var(--ink)' }}>Evaluation Frequency</h3>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: '8px' }}>Auditing Schedule</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['Hourly', 'Daily', 'Weekly'].map((interval) => (
                      <button
                        key={interval}
                        type="button"
                        onClick={() => setPolicies(prev => ({ ...prev, monitoringInterval: interval }))}
                        style={{
                          flex: 1,
                          padding: '10px',
                          borderRadius: '8px',
                          border: '1px solid ' + (policies.monitoringInterval === interval ? 'var(--indigo)' : 'var(--line-3)'),
                          background: policies.monitoringInterval === interval ? 'var(--indigo-soft)' : '#fff',
                          color: policies.monitoringInterval === interval ? 'var(--indigo)' : 'var(--ink-2)',
                          fontWeight: 600,
                          fontSize: '13px',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        {interval}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'flex-end' }}>
                {policiesSuccess && (
                  <span style={{ fontSize: '13px', color: 'var(--emerald-2)', fontWeight: 500 }}>✓ Policy updated successfully!</span>
                )}
                <button 
                  type="submit" 
                  className="ab-btn primary" 
                  disabled={policiesSaving}
                  style={{ padding: '12px 24px', fontSize: '14px' }}
                >
                  {policiesSaving ? 'Saving...' : 'Apply Policies'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <div style={{ padding: '32px 40px' }} className="reveal">
          <div className="dash-head" style={{ marginBottom: '28px' }}>
            <div>
              <h2>System Audit Log</h2>
              <div className="sub">Chronological history of margin Sentinel reviews and automated remediations.</div>
            </div>
          </div>
          
          <div className="dash-table-card">
            {historyLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-3)' }}>
                <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px', display: 'block' }} />
                Loading audit history...
              </div>
            ) : auditHistory.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--ink-3)' }}>
                <Inbox size={32} style={{ margin: '0 auto 12px', display: 'block', color: 'var(--ink-4)' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink-2)' }}>No Audits Performed</h3>
                <p style={{ marginTop: '6px', fontSize: '13px' }}>Audit history will populate when the Sentinel reviews customer unit economics.</p>
              </div>
            ) : (
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Customer Name</th>
                    <th>Email Address</th>
                    <th style={{ textAlign: 'right' }}>Calculated Margin</th>
                    <th>Suggested Action</th>
                    <th style={{ textAlign: 'center' }}>Remediation Status</th>
                  </tr>
                </thead>
                <tbody>
                  {auditHistory.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--ink-3)' }}>
                        {new Date(item.timestamp).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </td>
                      <td>
                        <strong style={{ fontWeight: 600 }}>{item.clientName}</strong>
                      </td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--ink-2)' }}>
                        {item.clientEmail}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className={`dash-num ${item.margin < 0 ? 'neg' : 'pos'}`}>
                          {item.margin >= 0 ? '+' : ''}{fmtUSD(item.margin)}
                        </span>
                      </td>
                      <td style={{ fontSize: '13px', color: 'var(--ink-2)' }}>
                        {item.suggestedAction}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {item.remediationStatus === 'pending' && (
                          <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, background: 'var(--amber-soft)', color: 'var(--amber)', border: '1px solid rgba(245,158,11,0.22)' }}>
                            Pending Action
                          </span>
                        )}
                        {item.remediationStatus === 'emailed' && (
                          <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, background: 'var(--indigo-soft)', color: 'var(--indigo)', border: '1px solid rgba(99,102,241,0.22)' }}>
                            E-mailed Notice
                          </span>
                        )}
                        {item.remediationStatus === 'throttled' && (
                          <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, background: 'var(--coral-soft)', color: 'var(--coral-2)', border: '1px solid rgba(239,68,68,0.22)' }}>
                            Throttled Access
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
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
