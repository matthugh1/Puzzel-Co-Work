#!/bin/bash
# Simple script to clear all cowork sessions

set -e

echo "🧹 Clearing all cowork sessions..."
echo ""

# Load environment variables
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
fi

# Delete database records using psql
echo "1️⃣  Deleting database records..."
SESSIONS_DELETED=$(psql "$DATABASE_URL" -t -c "DELETE FROM cowork_sessions; SELECT COUNT(*) FROM cowork_sessions;")
echo "   ✓ Database cleared"
echo ""

# Clean up file storage
echo "2️⃣  Cleaning up file storage..."
cd "$(dirname "$0")/.."
FOLDER_COUNT=$(find storage/sessions -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
if [ "$FOLDER_COUNT" -gt 0 ]; then
  find storage/sessions -mindepth 1 -maxdepth 1 -type d -exec rm -rf {} +
  echo "   ✓ Deleted $FOLDER_COUNT session folders"
else
  echo "   ✓ No session folders to delete"
fi
echo ""

echo "✅ All sessions cleared successfully!"
