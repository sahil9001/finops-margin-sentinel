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

const stripeAuthHeader = 'Basic ' + Buffer.from(`${STRIPE_SECRET_KEY}:`).toString('base64');

async function stripeFetch(path, options = {}) {
  const url = `https://api.stripe.com/v1${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': stripeAuthHeader,
      ...options.headers
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe error ${res.status}: ${text}`);
  }
  return res.json();
}

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
    const subscriptions = await stripeFetch('/subscriptions?limit=100');
    for (const sub of subscriptions.data) {
      console.log(`Cancelling subscription: ${sub.id}`);
      await stripeFetch(`/subscriptions/${sub.id}`, { method: 'DELETE' }).catch(err => console.log('Cancel sub warning:', err.message));
    }
    const customers = await stripeFetch('/customers?limit=100');
    for (const customer of customers.data) {
      console.log(`Deleting customer: ${customer.id} (${customer.email})`);
      await stripeFetch(`/customers/${customer.id}`, { method: 'DELETE' }).catch(err => console.log('Delete customer warning:', err.message));
    }
    console.log('Stripe cleanup completed.');
  } catch (err) {
    console.error('Stripe cleanup warning:', err.message);
  }
}

async function seedStripe() {
  await cleanupStripe();
  console.log('\n--- Seeding Stripe Data ---');
  
  // 1. Create a dummy product for the SaaS subscription
  const productBody = new URLSearchParams({
    name: 'Margin Sentinel SaaS Plan',
    description: 'Billed monthly based on subscription tier'
  });
  const product = await stripeFetch('/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: productBody.toString()
  });
  console.log(`Created product: ${product.name} (${product.id})`);

  for (const client of SEED_CLIENTS) {
    // 2. Create customer
    const customerBody = new URLSearchParams({
      email: client.email,
      name: client.name,
      'metadata[user_id]': client.email
    });
    const customer = await stripeFetch('/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: customerBody.toString()
    });
    console.log(`Created Customer: ${customer.name} - ID: ${customer.id}`);

    // 3. Create price for this customer's tier (monthly recurring)
    const priceBody = new URLSearchParams({
      product: product.id,
      unit_amount: String(client.revenue * 100),
      currency: 'usd',
      'recurring[interval]': 'month'
    });
    const price = await stripeFetch('/prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: priceBody.toString()
    });

    // 4. Create subscription
    const subBody = new URLSearchParams({
      customer: customer.id,
      'items[0][price]': price.id,
      payment_behavior: 'default_incomplete',
      'metadata[tenant_id]': client.email
    });
    const subscription = await stripeFetch('/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: subBody.toString()
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

    const mockTracesCount = 5;
    const tokensPerTrace = Math.round((client.tokenCount * 1000) / mockTracesCount);

    const batch = [];
    const timestamp = new Date().toISOString();

    for (let i = 0; i < mockTracesCount; i++) {
      const traceId = `tr_${client.email.replace(/[@.]/g, '_')}_${i}`;
      const generationId = `gen_${client.email.replace(/[@.]/g, '_')}_${i}`;

      batch.push({
        type: 'trace-create',
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

      batch.push({
        type: 'generation-create',
        id: `event_g_${generationId}`,
        timestamp,
        body: {
          id: generationId,
          traceId,
          name: 'claude-3-5-sonnet',
          model: 'claude-3-5-sonnet',
          usage: {
            input: Math.round(tokensPerTrace * 0.7),
            output: Math.round(tokensPerTrace * 0.3),
            total: tokensPerTrace
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
    } catch (err) {
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
      } catch (err) {
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
  } catch (err) {
    console.error('Migration seed failed:', err.message);
    process.exit(1);
  }
}

runSeed();
