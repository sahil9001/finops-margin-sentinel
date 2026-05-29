#!/bin/bash

echo "Starting FinOps Margin Sentinel on Railway..."

# Map Railway environment variables to what config.toml and the app expect
export STRIPE_API_KEY="$STRIPE_SECRET_KEY"
export LANGFUSE_API_KEY="$LANGFUSE_PUBLIC_KEY"
export POSTHOG_API_KEY="$POSTHOG_API_KEY"

# Register Coral sources at runtime using the environment secrets
echo "Registering Coral sources..."
if ! coral source add stripe; then
  echo "Warning: Failed to register stripe source. Check if STRIPE_SECRET_KEY is configured."
fi

if ! coral source add langfuse; then
  echo "Warning: Failed to register langfuse source. Check if LANGFUSE_PUBLIC_KEY is configured."
fi

if ! coral source add posthog; then
  echo "Warning: Failed to register posthog source. Check if POSTHOG_API_KEY is configured."
fi

# Start the Node.js monorepo server
echo "Starting backend Express server..."
npm start
