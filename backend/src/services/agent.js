// Lazy-loaded to avoid blocking server startup (SDK is ~20s to import)
// const Anthropic = await import('@anthropic-ai/sdk');

// Pre-compiled sandbox responses for instant hackathon evaluation
const MOCK_AUDITS = {
  'alex@acme.com': {
    clientEmail: 'alex@acme.com',
    clientName: 'Acme Corporation',
    margin: -340,
    reasoning: [
      'Querying Coral engine: JOIN stripe.subscriptions with langfuse.traces...',
      'Detected subscription revenue: $1,200/mo.',
      'Detected LLM token consumption: $1,540/mo (45,200 queries).',
      'Calculated net margin: -$340 (unprofitable account).',
      'Inspecting Langfuse trace logs for acme.com...',
      'Anomaly detected: Employee account user_acme_832 running parallel unit test generation loops on Claude 3.5 Sonnet.',
      'Action determined: Recommend immediate upgrade to Enterprise Scale tier and prompt rate-limiting.'
    ],
    suggestedAction: 'Upgrade to Scale Tier ($1,999/mo)',
    emailDraft: {
      subject: 'Action Required: Acme Corporation AI usage limits exceeded',
      body: `Hi Alex,

We hope you are enjoying our generative AI features. 

During our routine unit economics audit, we noticed that Acme Corporation's AI token usage has scaled significantly. This month, your team consumed 45,200 requests, costing $1,540 in raw LLM infrastructure costs, which exceeds your current $1,200/mo subscription.

To prevent any service throttling or interruption, we recommend upgrading to our Scale Tier, which includes expanded token caps and volume-discounted rates.

You can view your full usage breakdown and upgrade directly in your billing center.

Best regards,
FinOps Margin Sentinel`
    }
  },
  'dev@innovate.co': {
    clientEmail: 'dev@innovate.co',
    clientName: 'Innovate LLC',
    margin: -40,
    reasoning: [
      'Querying Coral engine: JOIN stripe.subscriptions with langfuse.traces...',
      'Detected subscription revenue: $450/mo.',
      'Detected LLM token consumption: $490/mo (12,500 queries).',
      'Calculated net margin: -$40 (borderline leak).',
      'Inspecting Langfuse trace logs for innovate.co...',
      'Observed pattern: High density of chat completions using GPT-4o-mini, with high prompt length overhead.',
      'Action determined: Suggest system prompt caching optimizations to reduce input token billing.'
    ],
    suggestedAction: 'Apply Prompt Caching Optimizations',
    emailDraft: {
      subject: 'Developer Alert: Optimize your AI prompt costs',
      body: `Hi Innovate Team,

We noticed your AI features usage has put your account in a deficit this month ($490 cost vs $450 subscription revenue). 

Before upgrading you to a larger tier, our analyzer suggests that enabling prompt caching for your system instructions can reduce your input token billing by up to 40%.

We have prepared a caching configuration snippet for your codebase in your dashboard settings. If your usage continues to expand, you can upgrade to the Professional tier ($650/mo).

Best,
FinOps Margin Sentinel`
    }
  },
  'support@cyberdyne.jp': {
    clientEmail: 'support@cyberdyne.jp',
    clientName: 'Cyberdyne Systems',
    margin: -250,
    reasoning: [
      'Querying Coral engine: JOIN stripe.subscriptions with langfuse.traces...',
      'Detected subscription revenue: $3,000/mo.',
      'Detected LLM token consumption: $3,250/mo (92,400 queries).',
      'Calculated net margin: -$250 (unprofitable enterprise account).',
      'Inspecting Langfuse trace logs for cyberdyne.jp...',
      'Observed pattern: Support agent bot user_skynet_01 looping on semantic search queries in high-latency vector tables.',
      'Action determined: Recommend vector chunking changes and prompt upgrade to Enterprise Tier.'
    ],
    suggestedAction: 'Trigger Sales Contact for Enterprise Custom Tier',
    emailDraft: {
      subject: 'Enterprise Account Review: Cyberdyne Systems AI usage',
      body: `Dear Cyberdyne Systems Team,

Thank you for choosing our platform to power your support automation. 

Our automated Sentinel has flagged that your LLM usage has exceeded your enterprise tier limits, consuming 92,400 API requests and costing $3,250 in token infrastructure against your $3,000 monthly contract.

Our accounts team would love to discuss a custom volume contract to unlock flat-rate API discounts. Please let us know if you have time for a brief alignment call this week.

Sincerely,
FinOps Margin Sentinel`
    }
  }
};

export class AgentService {
  constructor() {
    this.anthropic = null;
    this.apiKey = null;
    if (process.env.ANTHROPIC_API_KEY) {
      this.apiKey = process.env.ANTHROPIC_API_KEY;
    }
  }

  async ensureClient() {
    if (!this.anthropic && this.apiKey) {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      this.anthropic = new Anthropic({ apiKey: this.apiKey });
    }
    return this.anthropic;
  }

  async setApiKey(key) {
    this.apiKey = key;
    this.anthropic = null;
    console.log('[AgentService] Anthropic API Key updated (lazy-loaded on next audit request).');
  }

  async auditClient(row, isSandbox = true) {
    if (isSandbox) {
      console.log(`[AgentService] Performing mock Claude audit for: ${row.email}`);
      return MOCK_AUDITS[row.email] || {
        clientEmail: row.email,
        clientName: row.customer_name,
        margin: row.net_margin,
        reasoning: [
          'Checking records...',
          `Subscription payment: $${row.monthly_revenue}/mo`,
          `Token expense: $${row.total_token_cost}/mo`,
          'Net loss detected. Drafting standard notice.'
        ],
        suggestedAction: 'Contact customer for subscription review',
        emailDraft: {
          subject: 'Usage Alert: Subscription limit reached',
          body: `Hi ${row.customer_name},\n\nWe noticed your AI usage has exceeded your subscription plan metrics. Please visit your billing panel to check options.\n\nBest,\nFinOps Margin Sentinel`
        }
      };
    }

    console.log(`[AgentService] Initiating live Claude audit for: ${row.email}`);
    try {
      const client = await this.ensureClient();
      if (!client) throw new Error('Anthropic API key not configured.');
      const prompt = `
You are FinOps Margin Sentinel, an autonomous AI agent auditing SaaS gross margins.
A customer has been flagged with a negative profit margin because their LLM token infrastructure costs exceed their subscription billing.

Audit context:
- Customer Name: ${row.customer_name}
- Email: ${row.email}
- Monthly Subscription Payment: $${row.monthly_revenue}
- Raw LLM/Infra cost: $${row.total_token_cost}
- AI Feature Calls: ${row.ai_features_clicked}

Analyze this customer. Write a brief step-by-step reasoning log (3-5 items) showing how you reviewed their usage.
Then, draft a highly professional, polite email to the customer explaining the situation, outlining the cost breakdown, and suggesting they upgrade or optimize their prompts.

Format your output strictly as a JSON object:
{
  "reasoning": [
    "Step 1...",
    "Step 2..."
  ],
  "suggestedAction": "Summary of the final action (e.g. Upgrade to scale plan)",
  "emailDraft": {
    "subject": "Email subject",
    "body": "Email body content"
  }
}
`;

      const response = await client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      });

      const firstBlock = response.content[0];
      if (firstBlock.type !== 'text') {
        throw new Error('Unexpected response format from Claude.');
      }
      const content = firstBlock.text;
      const parsed = JSON.parse(content.trim());

      return {
        clientEmail: row.email,
        clientName: row.customer_name,
        margin: row.net_margin,
        ...parsed
      };
    } catch (error) {
      console.error('[AgentService] Claude API failed:', error.message);
      throw new Error(`Claude analysis failed: ${error.message}`);
    }
  }
}

export const agentService = new AgentService();
