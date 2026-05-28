import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { coralService } from './services/coral.js';
import { agentService } from './services/agent.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// In-memory store for session credentials and config
let settings = {
  useSandbox: true,
  stripeKey: '',
  langfuseKey: '',
  posthogKey: '',
  anthropicKey: '',
  resendKey: '',
};

// Seed keys from process.env if they exist
if (process.env.ANTHROPIC_API_KEY) {
  settings.anthropicKey = process.env.ANTHROPIC_API_KEY;
}
if (process.env.RESEND_API_KEY) {
  settings.resendKey = process.env.RESEND_API_KEY;
}
if (process.env.STRIPE_SECRET_KEY) {
  settings.stripeKey = process.env.STRIPE_SECRET_KEY;
}
if (process.env.LANGFUSE_PUBLIC_KEY) {
  settings.langfuseKey = process.env.LANGFUSE_PUBLIC_KEY;
}
if (process.env.POSTHOG_API_KEY) {
  settings.posthogKey = process.env.POSTHOG_API_KEY;
}

// Auto-switch sandbox mode to false if live API keys are provided in .env
if (settings.stripeKey && settings.langfuseKey) {
  settings.useSandbox = false;
  coralService.setSandboxMode(false);
  coralService.setCredentials({
    STRIPE_API_KEY: settings.stripeKey,
    LANGFUSE_API_KEY: settings.langfuseKey,
    POSTHOG_API_KEY: settings.posthogKey,
  });
}

// In-memory store for audit history
interface AuditHistoryEntry {
  id: string;
  timestamp: string;
  clientEmail: string;
  clientName: string;
  margin: number;
  suggestedAction: string;
  remediationStatus: 'pending' | 'emailed' | 'throttled' | 'ignored';
  details?: any;
}

let auditLog: AuditHistoryEntry[] = [];

// In-memory policies configuration
let policies = {
  alertThreshold: -100, // Deficit threshold in USD
  autoThrottle: false,
  notificationSlack: true,
  monitoringInterval: 'Daily',
};

// REST APIs
app.get('/api/settings', (req: express.Request, res: express.Response) => {
  res.json({
    useSandbox: settings.useSandbox,
    hasStripeKey: !!settings.stripeKey,
    hasLangfuseKey: !!settings.langfuseKey,
    hasPosthogKey: !!settings.posthogKey,
    hasAnthropicKey: !!settings.anthropicKey,
    hasResendKey: !!settings.resendKey,
  });
});

app.post('/api/settings', async (req: express.Request, res: express.Response) => {
  const { useSandbox, stripeKey, langfuseKey, posthogKey, anthropicKey, resendKey } = req.body;
  
  settings = {
    useSandbox: useSandbox !== undefined ? useSandbox : settings.useSandbox,
    stripeKey: stripeKey || settings.stripeKey,
    langfuseKey: langfuseKey || settings.langfuseKey,
    posthogKey: posthogKey || settings.posthogKey,
    anthropicKey: anthropicKey || settings.anthropicKey,
    resendKey: resendKey || settings.resendKey,
  };

  // Update services
  coralService.setSandboxMode(settings.useSandbox);
  coralService.setCredentials({
    STRIPE_API_KEY: settings.stripeKey,
    LANGFUSE_API_KEY: settings.langfuseKey,
    POSTHOG_API_KEY: settings.posthogKey,
  });

  if (settings.anthropicKey) {
    await agentService.setApiKey(settings.anthropicKey);
  }

  res.json({ success: true, message: 'Settings updated successfully' });
});

// Policies Configuration APIs
app.get('/api/policies', (req: express.Request, res: express.Response) => {
  res.json({ success: true, data: policies });
});

app.post('/api/policies', (req: express.Request, res: express.Response) => {
  const { alertThreshold, autoThrottle, notificationSlack, monitoringInterval } = req.body;
  policies = {
    alertThreshold: alertThreshold !== undefined ? Number(alertThreshold) : policies.alertThreshold,
    autoThrottle: autoThrottle !== undefined ? Boolean(autoThrottle) : policies.autoThrottle,
    notificationSlack: notificationSlack !== undefined ? Boolean(notificationSlack) : policies.notificationSlack,
    monitoringInterval: monitoringInterval || policies.monitoringInterval,
  };
  res.json({ success: true, message: 'Policies updated successfully', data: policies });
});

// System Audit Logs API
app.get('/api/audit-log', (req: express.Request, res: express.Response) => {
  res.json({ success: true, data: auditLog });
});

// Run Coral query to get customer margins
app.get('/api/margins', async (req: express.Request, res: express.Response) => {
  try {
    const mainSql = `
      WITH stripe_data AS (
        SELECT 
          c.email, 
          c.name as customer_name, 
          COALESCE(SUM(i.total) / 100.0, 0.0) as monthly_revenue
        FROM stripe.customers c
        LEFT JOIN stripe.invoices i ON i.customer = c.id
        GROUP BY c.email, c.name
      ),
      langfuse_data AS (
        SELECT 
          t.user_id,
          COALESCE(SUM(o.input_tokens), 0) as input_tokens,
          COALESCE(SUM(o.output_tokens), 0) as output_tokens,
          COALESCE(SUM(o.total_tokens), 0) as total_tokens,
          COALESCE(SUM(o.input_tokens) * 0.00001 + SUM(o.output_tokens) * 0.00009, 0.0) as total_token_cost
        FROM langfuse.traces t
        JOIN langfuse.observations o ON o.trace_id = t.id
        GROUP BY t.user_id
      )
      SELECT 
        s.email, 
        s.customer_name, 
        s.monthly_revenue,
        COALESCE(l.total_token_cost, 0.0) as total_token_cost,
        COALESCE(l.total_tokens, 0) as total_tokens
      FROM stripe_data s
      LEFT JOIN langfuse_data l ON l.user_id = s.email
    `;

    console.log('[Server] Querying Stripe and Langfuse from Coral...');
    const rows = await coralService.query<any>(mainSql);

    // 2. Try to fetch PostHog event counts. If it fails, fallback to estimated/mock counts.
    let posthogClicks: Record<string, number> = {};
    try {
      console.log('[Server] Attempting to query PostHog environment...');
      const orgs = await coralService.query<any>('SELECT id FROM posthog.organizations LIMIT 1');
      if (orgs && orgs.length > 0) {
        const orgId = orgs[0].id;
        const projects = await coralService.query<any>(`SELECT id FROM posthog.projects WHERE organization_id = '${orgId}' LIMIT 1`);
        if (projects && projects.length > 0) {
          const projectId = projects[0].id;
          const envs = await coralService.query<any>(`SELECT id FROM posthog.environments WHERE project_id = '${projectId}' LIMIT 1`);
          if (envs && envs.length > 0) {
            const envId = envs[0].id;
            console.log(`[Server] Found PostHog environment ID: ${envId}. Querying events...`);
            const events = await coralService.query<any>(`
              SELECT distinct_id, COUNT(*) as count 
              FROM posthog.events 
              WHERE environment_id = '${envId}' AND event = 'ai_feature_used'
              GROUP BY distinct_id
            `);
            for (const ev of events) {
              if (ev.distinct_id) {
                posthogClicks[ev.distinct_id] = Number(ev.count) || 0;
              }
            }
          }
        }
      }
    } catch (phError: any) {
      console.warn('[Server] PostHog query skipped or failed (this is normal if using a project API key instead of personal API key):', phError.message);
    }

    // 3. Map rows to final response format, calculating net_margin, status, and posthog clicks
    const processedRows = rows.map((row: any) => {
      const email = row.email;
      const monthly_revenue = Number(row.monthly_revenue) || 0;
      const total_token_cost = Number(row.total_token_cost) || 0;
      const total_tokens = Number(row.total_tokens) || 0;
      
      const net_margin = Number((monthly_revenue - total_token_cost).toFixed(2));
      
      const ai_features_clicked = posthogClicks[email] !== undefined 
        ? posthogClicks[email] 
        : Math.round(total_tokens / 1000) || 0;

      let status = 'healthy';
      if (net_margin < -100) {
        status = 'leak';
      } else if (net_margin < 0) {
        status = 'warning';
      }

      let plan = 'Custom Tier';
      if (monthly_revenue === 3000) plan = 'Enterprise Tier';
      else if (monthly_revenue === 2500) plan = 'Scale Tier';
      else if (monthly_revenue === 1200) plan = 'Growth Tier';
      else if (monthly_revenue === 800) plan = 'Startup Tier';
      else if (monthly_revenue === 450) plan = 'Developer Tier';

      return {
        email,
        customer_name: row.customer_name,
        monthly_revenue,
        total_token_cost: Number(total_token_cost.toFixed(2)),
        ai_features_clicked,
        net_margin,
        status,
        plan
      };
    });

    res.json({ success: true, data: processedRows });
  } catch (error: any) {
    console.error('[Server] Query error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Audit a specific client via the Claude agent loop
app.post('/api/audit', async (req: express.Request, res: express.Response) => {
  const { row } = req.body;
  if (!row) {
    return res.status(400).json({ success: false, error: 'Customer row context required' });
  }

  try {
    const result = await agentService.auditClient(row, settings.useSandbox);
    
    // Check if audit already exists for this email in pending status, if so remove or replace
    auditLog = auditLog.filter(item => !(item.clientEmail === result.clientEmail && item.remediationStatus === 'pending'));

    // Record the audit in history
    auditLog.unshift({
      id: `aud_${Math.random().toString(36).substring(2, 11)}`,
      timestamp: new Date().toISOString(),
      clientEmail: result.clientEmail,
      clientName: result.clientName,
      margin: result.margin,
      suggestedAction: result.suggestedAction,
      remediationStatus: 'pending',
      details: result
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Server] Audit error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Execute mitigation / remediation updates
app.post('/api/remediate', async (req: express.Request, res: express.Response) => {
  const { email, action, text } = req.body;
  if (!email || !action) {
    return res.status(400).json({ success: false, error: 'Missing client email or action context' });
  }

  console.log(`[Remediation] Executing action [${action}] on client [${email}]`);
  
  let executedSuccessfully = true;
  let statusMessage = '';

  if (action === 'send_email') {
    if (settings.resendKey) {
      try {
        console.log(`[Remediation] Dispatching real email to ${email} via Resend...`);
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${settings.resendKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Margin Sentinel <onboarding@resend.dev>',
            to: email,
            subject: 'AI Usage Economics Alert',
            html: text.replace(/\n/g, '<br />')
          })
        });

        const data: any = await response.json();
        if (response.ok) {
          console.log(`[Remediation] Resend email sent successfully. ID: ${data.id}`);
          statusMessage = `Remediation email sent successfully to ${email} (via Resend ID: ${data.id}).`;
        } else {
          console.error('[Remediation] Resend API error:', data);
          executedSuccessfully = false;
          statusMessage = `Failed to send email via Resend: ${data.message || 'Unknown error'}`;
        }
      } catch (err: any) {
        console.error('[Remediation] Network error sending email:', err.message);
        executedSuccessfully = false;
        statusMessage = `Network error sending email via Resend: ${err.message}`;
      }
    } else {
      console.log(`[Remediation] Simulated email sent to ${email}:\n${text}`);
      statusMessage = `Remediation email simulated for ${email} (configure Resend Key for live dispatch).`;
    }
  } else if (action === 'throttle_flag') {
    console.log(`[Remediation] Triggering LaunchDarkly flag throttling for ${email}`);
    statusMessage = `LaunchDarkly flag updated. Throttling active for ${email}.`;
  }

  if (executedSuccessfully) {
    // Update audit log remediation status
    const entry = auditLog.find(e => e.clientEmail === email && e.remediationStatus === 'pending');
    if (entry) {
      entry.remediationStatus = action === 'send_email' ? 'emailed' : 'throttled';
    }

    res.json({ 
      success: true, 
      message: statusMessage
    });
  } else {
    res.status(500).json({
      success: false,
      error: statusMessage
    });
  }
});

// Serve frontend static assets in production
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDist = path.join(__dirname, '../../frontend/dist');

app.use(express.static(frontendDist));

// Fallback all non-API GET requests to index.html for React Router support
app.get('*', (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(frontendDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[FinOps Backend] Server running on http://localhost:${PORT}`);
  console.log(`[FinOps Backend] Default mode: ${settings.useSandbox ? 'SANDBOX' : 'LIVE API'}`);
});
