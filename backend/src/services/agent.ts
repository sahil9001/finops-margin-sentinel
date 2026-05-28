// Lazy-loaded to avoid blocking server startup (SDK is ~20s to import)
// import Anthropic from '@anthropic-ai/sdk';
import type { MarginRow } from './coral.js';
import type Anthropic from '@anthropic-ai/sdk';

export interface AuditResult {
  clientEmail: string;
  clientName: string;
  margin: number;
  reasoning: string[];
  suggestedAction: string;
  emailDraft: {
    subject: string;
    body: string;
  };
}

// Pre-compiled sandbox responses for instant hackathon evaluation
const MOCK_AUDITS: Record<string, AuditResult> = {
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

// Response shape enforced by the API via forced tool use. Claude must return
// its findings as this tool's input, which the SDK hands back as a parsed
// object (tool_use.input) — no text/markdown/JSON.parse fragility.
const AUDIT_TOOL: Anthropic.Tool = {
  name: 'submit_audit',
  description: 'Submit the completed margin audit for the customer.',
  input_schema: {
    type: 'object',
    properties: {
      reasoning: {
        type: 'array',
        items: { type: 'string' },
        description: 'Step-by-step reasoning log (3-5 short items) showing how the customer usage was reviewed.',
      },
      suggestedAction: {
        type: 'string',
        description: 'The recommended action, e.g. "Upgrade to Scale Tier" or "No action required — customer is profitable".',
      },
      emailDraft: {
        type: 'object',
        properties: {
          subject: { type: 'string', description: 'Subject line of the customer email.' },
          body: { type: 'string', description: 'Full body of the customer email.' },
        },
        required: ['subject', 'body'],
      },
    },
    required: ['reasoning', 'suggestedAction', 'emailDraft'],
  },
};

export class AgentService {
  private anthropic: any = null;
  private apiKey: string | null = null;

  constructor() {
    // Don't import Anthropic SDK at startup — lazy-load on first use
    if (process.env.ANTHROPIC_API_KEY) {
      this.apiKey = process.env.ANTHROPIC_API_KEY;
    }
  }

  private async ensureClient(): Promise<any> {
    if (!this.anthropic && this.apiKey) {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      this.anthropic = new Anthropic({ apiKey: this.apiKey });
    }
    return this.anthropic;
  }

  async setApiKey(key: string) {
    this.apiKey = key;
    this.anthropic = null;
    console.log('[AgentService] Anthropic API Key updated (lazy-loaded on next audit request).');
  }

  /**
   * Performs an agent audit on a leaky customer.
   * In sandbox mode, returns curated high-quality reasoning and emails.
   * In live mode, queries Claude using the Anthropic API.
   */
  async auditClient(row: MarginRow, isSandbox: boolean = true): Promise<AuditResult> {
    if (isSandbox) {
      console.log(`[AgentService] Performing mock Claude audit for: ${row.email}`);
      if (MOCK_AUDITS[row.email]) {
        return MOCK_AUDITS[row.email];
      }

      const isProfitable = row.net_margin >= 0;
      return {
        clientEmail: row.email,
        clientName: row.customer_name,
        margin: row.net_margin,
        reasoning: isProfitable ? [
          'Querying Coral engine: JOIN stripe.customers with langfuse.traces...',
          `Detected subscription plan revenue: $${row.monthly_revenue}/mo.`,
          `Detected LLM token consumption: $${row.total_token_cost}/mo.`,
          `Calculated net margin: +$${row.net_margin}/mo (profitable account).`,
          'Analyzing usage patterns: stable usage within plan limits.',
          'Action determined: No immediate optimization or upgrade required.'
        ] : [
          'Checking records...',
          `Subscription payment: $${row.monthly_revenue}/mo`,
          `Token expense: $${row.total_token_cost}/mo`,
          'Net loss detected. Drafting standard notice.'
        ],
        suggestedAction: isProfitable 
          ? 'No action required — customer is profitable' 
          : 'Contact customer for subscription review',
        emailDraft: {
          subject: isProfitable 
            ? 'Thank you for choosing FinOps Margin Sentinel' 
            : 'Usage Alert: Subscription limit reached',
          body: isProfitable 
            ? `Hi ${row.customer_name},\n\nWe want to thank you for using our platform. We noticed your usage has been stable and highly efficient. Keep up the great work!\n\nBest,\nFinOps Margin Sentinel`
            : `Hi ${row.customer_name},\n\nWe noticed your AI usage has exceeded your subscription plan metrics. Please visit your billing panel to check options.\n\nBest,\nFinOps Margin Sentinel`
        }
      };
    }

    console.log(`[AgentService] Initiating live Claude audit for: ${row.email}`);
    try {
      const client = await this.ensureClient();
      if (!client) throw new Error('Anthropic API key not configured.');
      
      const isNegative = row.net_margin < 0;
      const prompt = `
You are FinOps Margin Sentinel, an autonomous AI agent auditing SaaS gross margins.
${isNegative 
  ? 'A customer has been flagged with a negative profit margin because their LLM token infrastructure costs exceed their subscription billing.'
  : 'A customer has a positive profit margin and is within their usage limits. You are auditing their usage to ensure everything is healthy.'
}

Audit context:
- Customer Name: ${row.customer_name}
- Email: ${row.email}
- Monthly Subscription Payment: $${row.monthly_revenue}
- Raw LLM/Infra cost: $${row.total_token_cost}
- AI Feature Calls: ${row.ai_features_clicked}

Analyze this customer. Write a brief step-by-step reasoning log (3-5 items, each a single concise sentence) showing how you reviewed their usage.
${isNegative
  ? 'Then, draft a highly professional, polite email to the customer explaining the situation, outlining the cost breakdown, and suggesting they upgrade or optimize their prompts to lower costs.'
  : 'Then, draft a polite thank-you email to the customer thanking them for being a valued user, noting that their usage looks healthy and optimal.'
}

${isNegative
  ? 'For the suggested action, summarize the final recommendation (e.g. "Upgrade to Scale Tier").'
  : 'For the suggested action, use "No action required — customer is profitable".'}

Submit your findings by calling the submit_audit tool.
`;

      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        tools: [AUDIT_TOOL],
        tool_choice: { type: 'tool', name: 'submit_audit' },
        messages: [{ role: 'user', content: prompt }],
      });

      const toolUse = response.content.find((block: Anthropic.ContentBlock) => block.type === 'tool_use');
      if (!toolUse || toolUse.type !== 'tool_use') {
        throw new Error('Claude did not return the expected audit tool call.');
      }
      const parsed = toolUse.input as Omit<AuditResult, 'clientEmail' | 'clientName' | 'margin'>;

      return {
        clientEmail: row.email,
        clientName: row.customer_name,
        margin: row.net_margin,
        ...parsed
      };
    } catch (error: any) {
      console.error('[AgentService] Claude API failed:', error.message);
      throw new Error(`Claude analysis failed: ${error.message}`);
    }
  }
}

export const agentService = new AgentService();
