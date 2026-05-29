#!/bin/bash

echo "Starting FinOps Margin Sentinel on Railway..."

# Map Railway environment variables to what Coral config and manifests expect
export STRIPE_API_KEY="$STRIPE_SECRET_KEY"

export LANGFUSE_PUBLIC_KEY="$LANGFUSE_PUBLIC_KEY"
export LANGFUSE_SECRET_KEY="$LANGFUSE_SECRET_KEY"
export LANGFUSE_BASE_URL="${LANGFUSE_HOST:-https://api.langfuse.com}"
export LANGFUSE_API_KEY="$LANGFUSE_PUBLIC_KEY" # backend compatibility mapping

export POSTHOG_API_KEY="$POSTHOG_API_KEY"
export POSTHOG_API_BASE="${POSTHOG_HOST:-https://us.i.posthog.com}"

# Register Coral sources at runtime using the environment secrets
echo "Registering Coral sources..."
if [ -n "$STRIPE_API_KEY" ]; then
  if ! coral source add stripe; then
    echo "Warning: Failed to register stripe source."
  fi
else
  echo "Skipped registering stripe source (STRIPE_SECRET_KEY not set)."
fi

if [ -n "$LANGFUSE_PUBLIC_KEY" ] && [ -n "$LANGFUSE_SECRET_KEY" ]; then
  if ! coral source add --file coral-specs/langfuse.yaml; then
    echo "Warning: Failed to register langfuse source."
  fi
else
  echo "Skipped registering langfuse source (LANGFUSE_PUBLIC_KEY and/or LANGFUSE_SECRET_KEY not set)."
fi

if [ -n "$POSTHOG_API_KEY" ]; then
  if ! coral source add posthog; then
    echo "Warning: Failed to register posthog source."
  fi
else
  echo "Skipped registering posthog source (POSTHOG_API_KEY not set)."
fi

# Start the Node.js monorepo server
echo "Starting backend Express server..."
npm start
