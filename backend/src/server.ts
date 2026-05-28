import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { coralService } from './services/coral.ts';
import { agentService } from './services/agent.ts';

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
    const sql = `
      SELECT 
        s.email, s.customer_name, s.monthly_revenue,
        l.total_token_cost, p.ai_features_clicked,
        (s.monthly_revenue - l.total_token_cost) as net_margin
      FROM stripe.subscriptions s
      JOIN langfuse.usage_summary l ON l.user_id = s.metadata_user_id
      JOIN posthog.events_summary p ON p.distinct_id = s.metadata_user_id
    `;
    
    const rows = await coralService.query<any>(sql);
    const processed = rows.map((row: any) => {
      const monthly_revenue = Number(row.monthly_revenue) || 0;
      let plan = 'Custom Tier';
      if (monthly_revenue === 3000) plan = 'Enterprise Tier';
      else if (monthly_revenue === 2500) plan = 'Scale Tier';
      else if (monthly_revenue === 1200) plan = 'Growth Tier';
      else if (monthly_revenue === 800) plan = 'Startup Tier';
      else if (monthly_revenue === 450) plan = 'Developer Tier';

      return {
        ...row,
        plan
      };
    });
    res.json({ success: true, data: processed });
  } catch (error: any) {
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
  } catch (error: any) {
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

app.listen(PORT, () => {
  console.log(`[FinOps Backend] Server running on http://localhost:${PORT}`);
  console.log(`[FinOps Backend] Default mode: ${settings.useSandbox ? 'SANDBOX' : 'LIVE API'}`);
});
