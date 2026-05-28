import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const {
  STRIPE_SECRET_KEY,
  LANGFUSE_PUBLIC_KEY,
  LANGFUSE_SECRET_KEY,
  LANGFUSE_HOST = process.env.LANGFUSE_BASE_URL || 'https://api.langfuse.com',
  POSTHOG_API_KEY,
  POSTHOG_HOST = 'https://us.i.posthog.com',
} = process.env;

// Verify keys
if (!STRIPE_SECRET_KEY) {
  console.error('Error: STRIPE_SECRET_KEY is missing in your environment variables.');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-04-10' as any,
});

const SEED_CLIENTS = [
  {
    email: 'alex@acme.com',
    name: 'Acme Corporation',
    revenue: 1200, // Standard subscription tier ($1,200/mo)
    tokenCount: 45200, // Large consumption to trigger leak
  },
  {
    email: 'billing@globex.io',
    name: 'Globex Corp',
    revenue: 2500, // Premium subscription tier ($2,500/mo)
    tokenCount: 68100, // Healthy consumption ratio
  },
  {
    email: 'dev@innovate.co',
    name: 'Innovate LLC',
    revenue: 450, // Starter tier ($450/mo)
    tokenCount: 12500, // Borderline warning consumption
  }
];

async function cleanupStripe() {
  console.log('\n--- Cleaning up Existing Stripe Data ---');
  try {
    const subscriptions = await stripe.subscriptions.list({ limit: 100 });
    for (const sub of subscriptions.data) {
      console.log(`Cancelling subscription: ${sub.id}`);
      await stripe.subscriptions.cancel(sub.id);
    }
    const customers = await stripe.customers.list({ limit: 100 });
    for (const customer of customers.data) {
      console.log(`Deleting customer: ${customer.id} (${customer.email})`);
      await stripe.customers.del(customer.id);
    }
    console.log('Stripe cleanup completed.');
  } catch (err: any) {
    console.error('Stripe cleanup warning:', err.message);
  }
}

async function seedStripe() {
  await cleanupStripe();
  console.log('\n--- Seeding Stripe Data ---');
  
  // 1. Create a dummy product for the SaaS subscription
  const product = await stripe.products.create({
    name: 'Margin Sentinel SaaS Plan',
    description: 'Billed monthly based on subscription tier',
  });
  console.log(`Created product: ${product.name} (${product.id})`);

  for (const client of SEED_CLIENTS) {
    // 2. Create customer
    const customer = await stripe.customers.create({
      email: client.email,
      name: client.name,
      metadata: {
        // Store customer metadata so Coral SQL joins can link user IDs
        user_id: client.email,
      }
    });
    console.log(`Created Customer: ${customer.name} - ID: ${customer.id}`);

    // 3. Create price for this customer's tier (monthly recurring)
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: client.revenue * 100, // cents
      currency: 'usd',
      recurring: { interval: 'month' },
    });

    // 4. Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: price.id }],
      payment_behavior: 'default_incomplete',
      metadata: {
        // Embed user identity metadata
        tenant_id: client.email,
      }
    });
    console.log(`  Subscribed to standard plan. Monthly rate: $${client.revenue}. Sub ID: ${subscription.id}`);
  }
}

async function seedLangfuse() {
  if (!LANGFUSE_PUBLIC_KEY || !LANGFUSE_SECRET_KEY) {
    console.log('\nSkipping Langfuse seeding: Public/Secret keys are missing.');
    return;
  }

  console.log('\n--- Seeding Langfuse Logs ---');
  const authHeader = 'Basic ' + Buffer.from(`${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}`).toString('base64');
  const endpoint = `${LANGFUSE_HOST}/api/public/ingestion`;

  for (const client of SEED_CLIENTS) {
    console.log(`Sending traces for user: ${client.email} (${client.tokenCount} tokens)...`);

    // Calculate mock usage metrics
    // We assume 1 token costs ~$0.00003 on average (blended rate of Sonnet/GPT-4o)
    // For Acme: 45,200 requests * ~1,000 tokens = 45M tokens = ~$1,540
    const mockTracesCount = 5; // Send 5 batch trace calls
    const tokensPerTrace = Math.round((client.tokenCount * 1000) / mockTracesCount);

    const batch = [];
    const timestamp = new Date().toISOString();

    for (let i = 0; i < mockTracesCount; i++) {
      const traceId = `tr_${client.email.replace(/[@.]/g, '_')}_${i}`;
      const generationId = `gen_${client.email.replace(/[@.]/g, '_')}_${i}`;

      // 1. Create trace event
      batch.push({
        event: 'trace-create',
        id: `event_t_${traceId}`,
        timestamp,
        body: {
          id: traceId,
          name: 'ai_copilot_assistant',
          userId: client.email,
          metadata: {
            email: client.email,
            customer: client.name,
          }
        }
      });

      // 2. Create generation event inside the trace
      batch.push({
        event: 'generation-create',
        id: `event_g_${generationId}`,
        timestamp,
        body: {
          id: generationId,
          traceId,
          name: 'claude-3-5-sonnet',
          model: 'claude-3-5-sonnet',
          usage: {
            // Distribute token counts
            inputTokens: Math.round(tokensPerTrace * 0.7),
            outputTokens: Math.round(tokensPerTrace * 0.3),
          }
        }
      });
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({ batch }),
      });

      if (res.ok) {
        console.log(`  Successfully ingested Langfuse batch trace calls for ${client.email}.`);
      } else {
        const errText = await res.text();
        console.error(`  Failed to ingest Langfuse: ${res.status} ${res.statusText} - ${errText}`);
      }
    } catch (err: any) {
      console.error(`  Network error seeding Langfuse for ${client.email}:`, err.message);
    }
  }
}

async function seedPostHog() {
  if (!POSTHOG_API_KEY) {
    console.log('\nSkipping PostHog seeding: API key is missing.');
    return;
  }

  console.log('\n--- Seeding PostHog Events ---');
  const endpoint = `${POSTHOG_HOST}/capture/`;

  for (const client of SEED_CLIENTS) {
    console.log(`Capturing click events for: ${client.email}...`);

    // Simulating user click triggers (e.g. 50 events)
    for (let i = 0; i < 5; i++) {
      const payload = {
        api_key: POSTHOG_API_KEY,
        event: 'ai_feature_used',
        properties: {
          distinct_id: client.email,
          email: client.email,
          customer: client.name,
          environment: 'production',
        },
        timestamp: new Date().toISOString()
      };

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          console.error(`  Failed to capture event: ${res.status} ${res.statusText}`);
        }
      } catch (err: any) {
        console.error(`  Network error seeding PostHog:`, err.message);
      }
    }
    console.log(`  Captured mock event batches for ${client.email}.`);
  }
}

async function runSeed() {
  try {
    await seedStripe();
    await seedLangfuse();
    await seedPostHog();
    console.log('\n=========================================');
    console.log('Seed execution completed successfully!');
    console.log('=========================================');
  } catch (err: any) {
    console.error('Migration seed failed:', err.message);
    process.exit(1);
  }
}

runSeed();
