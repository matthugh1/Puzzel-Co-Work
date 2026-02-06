#!/bin/bash
# Generate Secure Secrets for Deployment
# Usage: pnpm generate:secrets

set -e

echo "🔐 Generating Secure Secrets for Deployment"
echo "============================================"
echo ""
echo "⚠️  IMPORTANT: These secrets are for ONE-TIME use only."
echo "   Save them securely and NEVER commit to version control!"
echo ""

# Generate JWT Secret
echo "NEXTAUTH_SECRET (for JWT tokens):"
NEXTAUTH_SECRET=$(openssl rand -base64 32)
echo "$NEXTAUTH_SECRET"
echo ""

# Generate Database Password
echo "DATABASE_PASSWORD (for PostgreSQL):"
DATABASE_PASSWORD=$(openssl rand -base64 24)
echo "$DATABASE_PASSWORD"
echo ""

echo "============================================"
echo "✅ Secrets generated successfully!"
echo ""
echo "Next steps:"
echo "1. Copy these secrets to your secure secret management system"
echo "2. Set them as environment variables in your deployment platform"
echo "3. Delete this output after saving securely"
echo "4. NEVER commit these secrets to version control"
echo ""
