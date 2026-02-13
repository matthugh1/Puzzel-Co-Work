#!/bin/bash
# Script to clear all cowork sessions (database + file storage)

set -e

echo "🧹 Clearing all cowork sessions..."

# Check if app is running
if ! curl -s http://localhost:3002/api/health > /dev/null; then
  echo "❌ Error: App is not running. Start it with: pnpm dev"
  exit 1
fi

# Get CSRF token
echo "1️⃣  Getting CSRF token..."
CSRF_TOKEN=$(curl -s http://localhost:3002/api/csrf-token | jq -r '.token')

if [ -z "$CSRF_TOKEN" ] || [ "$CSRF_TOKEN" = "null" ]; then
  echo "❌ Error: Could not get CSRF token"
  exit 1
fi

echo "2️⃣  Calling cleanup API..."
# Call cleanup API with deleteAllSessions flag
RESPONSE=$(curl -s -X POST http://localhost:3002/api/cowork/cleanup \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d '{"deleteAllSessions": true, "cleanupOrphanedSubAgents": true}')

echo "$RESPONSE" | jq .

# Check if cleanup was successful
if echo "$RESPONSE" | jq -e '.success' > /dev/null; then
  echo "3️⃣  Cleaning up file storage..."
  # Remove all session folders except .gitkeep
  cd "$(dirname "$0")/.."
  find storage/sessions -mindepth 1 -maxdepth 1 -type d -exec rm -rf {} +
  echo "✅ All sessions cleared successfully!"
else
  echo "❌ Cleanup API call failed"
  exit 1
fi
