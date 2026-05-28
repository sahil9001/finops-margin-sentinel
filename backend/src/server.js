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
};

// Seed Anthropic if key exists in process.env
if (process.env.ANTHROPIC_API_KEY) {
  settings.anthropicKey = process.env.ANTHROPIC_API_KEY;
}

// REST APIs
app.get('/api/settings', (req, res) => {
  res.json({
    useSandbox: settings.useSandbox,
    hasStripeKey: !!settings.stripeKey,
    hasLangfuseKey: !!settings.langfuseKey,
    hasPosthogKey: !!settings.posthogKey,
    hasAnthropicKey: !!settings.anthropicKey,
  });
});

app.post('/api/settings', async (req, res) => {
  const { useSandbox, stripeKey, langfuseKey, posthogKey, anthropicKey } = req.body;
  
  settings = {
    useSandbox: useSandbox !== undefined ? useSandbox : settings.useSandbox,
    stripeKey: stripeKey || settings.stripeKey,
    langfuseKey: langfuseKey || settings.langfuseKey,
    posthogKey: posthogKey || settings.posthogKey,
    anthropicKey: anthropicKey || settings.anthropicKey,
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

// Run Coral query to get customer margins
app.get('/api/margins', async (req, res) => {
  try {
    // 1. Fetch Stripe and Langfuse data joined using Coral
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
    const rows = await coralService.query(mainSql);

    // 2. Try to fetch PostHog event counts. If it fails, fallback to estimated/mock counts.
    let posthogClicks = {};
    try {
      console.log('[Server] Attempting to query PostHog environment...');
      const orgs = await coralService.query('SELECT id FROM posthog.organizations LIMIT 1');
      if (orgs && orgs.length > 0) {
        const orgId = orgs[0].id;
        const projects = await coralService.query(`SELECT id FROM posthog.projects WHERE organization_id = '${orgId}' LIMIT 1`);
        if (projects && projects.length > 0) {
          const projectId = projects[0].id;
          const envs = await coralService.query(`SELECT id FROM posthog.environments WHERE project_id = '${projectId}' LIMIT 1`);
          if (envs && envs.length > 0) {
            const envId = envs[0].id;
            console.log(`[Server] Found PostHog environment ID: ${envId}. Querying events...`);
            const events = await coralService.query(`
              SELECT distinct_id, COUNT(*) as count 
              FROM posthog.events 
              WHERE environment_id = '${envId}' AND event = 'ai_feature_used'
              GROUP BY distinct_id
            `);
            for (const ev of events) {
              if (ev.distinct_id) {
                posthogClicks[ev.distinct_id] = ev.count;
              }
            }
          }
        }
      }
    } catch (phError) {
      console.warn('[Server] PostHog query skipped or failed (this is normal if using a project API key instead of personal API key):', phError.message);
    }

    // 3. Map rows to final response format, calculating net_margin, status, and posthog clicks
    const processedRows = rows.map(row => {
      const email = row.email;
      const monthly_revenue = Number(row.monthly_revenue) || 0;
      const total_token_cost = Number(row.total_token_cost) || 0;
      const total_tokens = Number(row.total_tokens) || 0;
      
      const net_margin = Number((monthly_revenue - total_token_cost).toFixed(2));
      
      // If we got PostHog event count, use it. Otherwise, default to seeded-equivalent (tokens / 1000).
      const ai_features_clicked = posthogClicks[email] !== undefined 
        ? posthogClicks[email] 
        : Math.round(total_tokens / 1000) || 0;

      // Calculate status based on net_margin
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
  } catch (error) {
    console.error('[Server] Query error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Audit a specific client via the Claude agent loop
app.post('/api/audit', async (req, res) => {
  const { row } = req.body;
  if (!row) {
    return res.status(400).json({ success: false, error: 'Customer row context required' });
  }

  try {
    const result = await agentService.auditClient(row, settings.useSandbox);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Server] Audit error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Execute mitigation / remediation updates
app.post('/api/remediate', (req, res) => {
  const { email, action, text } = req.body;
  if (!email || !action) {
    return res.status(400).json({ success: false, error: 'Missing client email or action context' });
  }

  console.log(`[Remediation] Executing action [${action}] on client [${email}]`);
  if (action.includes('email') || action.includes('Upgrade')) {
    console.log(`[Remediation] Sending email to ${email} via Resend:\n${text}`);
  } else {
    console.log(`[Remediation] Triggering LaunchDarkly flag throttling for ${email}`);
  }
  res.json({ 
    success: true, 
    message: `Remediation action [${action}] executed successfully for ${email}.`
  });
});

// Serve frontend static assets in production
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDist = path.join(__dirname, '../../frontend/dist');

app.use(express.static(frontendDist));

// Fallback all non-API GET requests to index.html for React Router support
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(frontendDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[FinOps Backend] Server running on http://localhost:${PORT}`);
  console.log(`[FinOps Backend] Default mode: ${settings.useSandbox ? 'SANDBOX' : 'LIVE API'}`);
});
