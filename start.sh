#!/bin/bash

echo "Starting FinOps Margin Sentinel on Railway..."

# Register Coral sources at runtime using the environment secrets
echo "Registering Coral sources..."
coral source add stripe || true
coral source add langfuse || true
coral source add posthog || true

# Start the Node.js monorepo server
echo "Starting backend Express server..."
npm start
