# FinOps Margin Sentinel

**FinOps Margin Sentinel** is an AI-powered SaaS profitability and unit-economics controller built for the **Enterprise Track of the Pirates of the Coral-bean hackathon**. It solves a massive, real-world problem for modern software companies: **the AI Margin Leak**.

🚀 **Live Demo URL**: [https://backend-production-0050.up.railway.app/](https://backend-production-0050.up.railway.app/)

---

## The Initial Idea & Vision

### The Problem It Solves
As software companies integrate expensive generative AI features (like Claude or GPT) into their apps, their compute costs become variable and highly unpredictable:
* **Variable AI Costs**: A customer might pay a flat **$29/month** subscription (managed in **Stripe**).
* **High LLM Consumption**: That same customer might make heavy, automated calls to your AI features, consuming **$150/month** in LLM tokens (tracked in **Langfuse**).
* **The Silo Barrier**: Because finance data (Stripe) and AI developer logs (Langfuse) live in completely separate siloes, companies have **no idea they are losing money** on their heaviest users.
* **The Traditional Solution**: Currently, solving this requires a data engineering team to build complex ETL pipelines (e.g. Fivetran) to sync both tools into a data warehouse (Snowflake) and build Tableau dashboards.

### How Coral Makes This Simple (The SQL Engine)
Coral bypasses the data warehouse entirely. It maps each external API to a virtual SQL table via declarative YAML manifests, then lets the backend run one ordinary cross-source `JOIN` — executed *locally* against the live APIs, with no warehouse, no pipeline, and no data ever leaving the host:

| Signal | Lives in | Exposed by Coral as |
|--------|----------|---------------------|
| Subscription revenue | **Stripe** | `stripe.subscriptions` |
| LLM token cost | **Langfuse** | `langfuse.usage_summary` |
| AI feature usage | **PostHog** | `posthog.events_summary` |

The SQL join computed by Coral:
```sql
SELECT s.email, s.customer_name, s.monthly_revenue,
       l.total_token_cost, p.ai_features_clicked,
       (s.monthly_revenue - l.total_token_cost) as net_margin
FROM stripe.subscriptions s
JOIN langfuse.usage_summary l ON l.user_id = s.metadata_user_id
JOIN posthog.events_summary p ON p.distinct_id = s.metadata_user_id
```

By querying live source APIs directly:
* **Zero ETL**: No pipeline setup, no recurring sync lag, and no data leaving the host.
* **Cross-Source Joins in Plain SQL**: Fuses Stripe + Langfuse + PostHog on the customer's user ID.
* **Local-First & Secure**: Runs on the host, keeping API keys local.

### The Agentic Workflow (Claude 3.5)
1. **Monitor**: The agent runs this cross-source SQL query daily or in real-time.
2. **Analyze**: If a customer's margin becomes negative, Claude intercepts the alert, inspects their query logs, and identifies *why* (e.g., *"Customer Acme Corp is running loops on Claude 3.5 Sonnet, consuming 15M tokens"*).
3. **Remediate**:
   * It drafts a Slack alert to the account manager.
   * It drafts a personalized email in **Resend** suggesting an upgrade to an Enterprise plan or custom token limits.
   * It can throttle the user's access by toggling a feature flag in **LaunchDarkly** (simulated).

### What the Premium UI Demo Looks Like
Built with a sleek, obsidian dark-theme glassmorphic style:
* **Gross Margin Ledger**: An interactive dashboard showing a list of all SaaS tenants. Each tenant has a glowing green, orange, or red indicator based on their margin.
* **Leak Alert Panel**: Pulsing red cards for customers who are actively costing you more than they pay.
* **Agent Inspector Drawer**: Clicking an alert opens a drawer showing:
  1. The live SQL query Coral ran.
  2. Claude’s reasoning breakdown of their token usage.
  3. A gorgeous, pre-composed email draft ready to send, or a "Throttle Access" toggle to disable their AI features.
* **Savings Counter**: A glowing metric showing "Total SaaS Revenue Saved" by the agent's optimization actions.

### Why This Has a High Win Chance
It combines **finance (Stripe)**, **LLM operations (Langfuse)**, **product analytics (PostHog)**, and **feature flags (LaunchDarkly)**. It showcases the absolute best of Coral: joining disparate, live data sources locally via SQL to make an immediate, dollar-saving business decision.

---

## How It Works

```
┌─────────────────┐      /api/margins      ┌──────────────────────┐
│  React Dashboard │ ◄──────────────────── │   Express Backend     │
│  (Vite, :3000)   │      /api/audit        │   (:3001)             │
│                  │ ──────────────────────►│                       │
└─────────────────┘      /api/remediate     │  ┌────────────────┐  │
                                            │  │ CoralService   │──┼──► Stripe / Langfuse / PostHog
                                            │  │ (SQL join)     │  │    (via Coral SQL engine)
                                            │  ├────────────────┤  │
                                            │  │ AgentService   │──┼──► Anthropic Claude (Sonnet)
                                            │  │ (Claude audit) │  │
                                            │  └────────────────┘  │
                                            └──────────────────────┘
```

- **Coral SQL Engine** — `CoralService` runs a single SQL query that joins Stripe and Langfuse tables to produce one margin row per customer.
- **Claude Agent Loop** — `AgentService` sends a flagged customer's context to Claude (`claude-3-5-sonnet`), which returns a step-by-step reasoning log, a suggested action, and a drafted email.
- **Vite + React Dashboard** — a glassmorphic two-pane console: a customer **margin ledger** on the left and an **agent control center** (reasoning stream, editable email, remediation triggers) on the right.

### Two Run Modes

The app ships with a **Sandbox / Live** toggle (in the header and the settings modal) so it can be demoed with zero external accounts.

| Mode | Data source | Claude | Requirements |
|------|-------------|--------|--------------|
| **Demo Sandbox** (default) | In-memory mock customers (`MOCK_MARGINS`) | Curated mock audits (`MOCK_AUDITS`) | None — runs offline |
| **Live Integration** | Real Coral SQL queries against Stripe/Langfuse/PostHog | Live Anthropic API calls | Coral CLI binary + API keys |

> **Live mode requires the Coral CLI binary** installed and configured on the host machine. The backend shells out to `coral sql --format json "<query>"` to fetch live data. Remediation actions (email send, feature-flag throttle) are currently **simulated** — they log the intended action server-side rather than calling Resend / LaunchDarkly.

---

## Tech Stack

- **Frontend:** React 18, Vite 5, TypeScript, vanilla CSS (glassmorphism), `lucide-react` icons
- **Backend:** Node.js, Express 4, TypeScript (ESM), `tsx`
- **AI:** `@anthropic-ai/sdk` (Claude 3.5 Sonnet)
- **Integrations:** Stripe SDK, Langfuse (ingestion API), PostHog (capture API), Coral SQL engine
- **Tooling:** npm workspaces monorepo, `concurrently`

---

## Project Structure

```
finops-margin-sentinel/
├── package.json              # Monorepo root — npm workspaces + dev scripts
├── backend/
│   ├── .env.example          # Required environment variables
│   └── src/
│       ├── server.ts         # Express app + REST API (:3001)
│       ├── services/
│       │   ├── coral.ts      # CoralService — SQL join, sandbox + live modes
│       │   └── agent.ts      # AgentService — Claude audit, sandbox + live modes
│       └── scripts/
│           └── seed.ts       # Seeds Stripe/Langfuse/PostHog with demo customers
└── frontend/
    ├── vite.config.ts        # Dev server :3000, proxies /api → :3001
    └── src/
        ├── App.tsx           # Shell: header, mode toggle, settings modal, router
        ├── types.ts          # Shared MarginRow / AuditResult types
        └── views/
            ├── LandingPage.tsx
            └── DashboardPage.tsx   # Ledger + agent control center
```

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- (Live mode only) The Coral CLI and accounts for Stripe, Langfuse, PostHog, and Anthropic

### 1. Install

```bash
npm install        # installs all workspaces (root, frontend, backend)
```

### 2. Configure environment (optional for sandbox)

Sandbox mode needs no keys. For live mode, create `backend/.env` from the template:

```bash
cp backend/.env.example backend/.env
# then fill in your keys
```

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude agent reasoning |
| `STRIPE_SECRET_KEY` | Read/seed customer subscriptions |
| `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` / `LANGFUSE_HOST` | LLM token-cost metrics |
| `POSTHOG_API_KEY` / `POSTHOG_HOST` | Product usage events |

> Keys can also be entered at runtime via the dashboard's **Configure Keys** modal — they're held in memory for the session and are not persisted.

### 3. Run

```bash
npm run dev          # starts backend (:3001) and frontend (:3000) together
```

Then open **http://localhost:3000** and click **Launch Sandbox** to explore with demo data.

Run either side independently if needed:

```bash
npm run dev:backend
npm run dev:frontend
```

### 4. (Optional) Seed live integrations

Populates Stripe with demo customers/subscriptions and pushes matching traces/events to Langfuse and PostHog. **Requires a valid `STRIPE_SECRET_KEY`** and wipes existing test customers/subscriptions first.

```bash
npm run seed
```

### Build for production

```bash
npm run build:all
```

### Deployment

For detailed instructions on deploying the application to Railway, please refer to the [Railway Deployment Guide](file:///Users/ssilare/dev/finops-margin-sentinel/docs/deploy-to-railway.md).

The live production deployment is hosted at: [https://backend-production-0050.up.railway.app/](https://backend-production-0050.up.railway.app/)

---

## REST API

The backend exposes a small JSON API consumed by the dashboard. All responses use a `{ success, data?, error? }` envelope.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/settings` | Current mode and which keys are configured (booleans only) |
| `POST` | `/api/settings` | Update sandbox mode and credentials for the session |
| `GET`  | `/api/margins` | Run the Coral join and return the customer margin ledger |
| `POST` | `/api/audit` | Run a Claude audit on a customer row → reasoning + suggested action + email draft |
| `POST` | `/api/remediate` | Execute a remediation action (send email / throttle flag) |

---

## User Flow

1. Land on the marketing page → **Launch Sandbox**.
2. The **margin ledger** loads, color-coding each account green (healthy), amber (warning), or red (leak).
3. Click **Audit** on a leaking account. Claude's reasoning streams into the **Agent Control Center**, ending with a suggested action and a pre-drafted email.
4. Edit the email if needed, then **Send Remediation Notice** or **Throttle Flag** to act on the leak.

---

## Notes & Limitations

- This is a **hackathon prototype**. Sandbox data, audits, and remediation outcomes are mocked to guarantee a fast, dependency-free demo.
- Session settings and API keys are stored **in memory** on the backend — restarting the server resets them.
- Remediation is **simulated** (server-side logging); wiring up Resend (email) and LaunchDarkly (feature flags) is the natural next step for a production build.
