---
name: deployment-security
description: Security requirements and best practices for deploying the Skills Library application. Use when preparing for deployment, generating deployment scripts, setting up production environment variables, or creating deployment documentation.
---

# Deployment Security

This skill enforces security best practices for deploying the Skills Library application to production.

## 🔐 Secret Generation

### JWT Secret (NEXTAUTH_SECRET)

**MUST** generate a new, unique secret for each environment (dev, staging, production).

```bash
# Generate secure secret (32+ bytes, base64 encoded)
openssl rand -base64 32

# Example output:
# rhboTnXJbreVPRb/5RDK1x58WpFr9+rVi7DHYENV4Qo=
```

**Requirements:**

- Minimum 32 characters
- Use cryptographically secure random generation
- **NEVER** reuse secrets across environments
- **NEVER** commit secrets to version control
- Store in secure secret management system (Azure Key Vault, AWS Secrets Manager, etc.)

### Database Passwords

**MUST** use strong passwords for production databases:

```bash
# Generate strong database password
openssl rand -base64 24

# Or use a password generator with:
# - Minimum 16 characters
# - Mix of uppercase, lowercase, numbers, special characters
```

## 📝 Environment Variables Setup

### Required Variables

Create a production `.env` file (or use your platform's environment variable system):

```bash
# ============================================================================
# Database Configuration
# ============================================================================
# Production database with SSL
DATABASE_URL="postgresql://user:STRONG_PASSWORD@host:5432/database?sslmode=require"

# ============================================================================
# Authentication Configuration
# ============================================================================
# Generate NEW secret for production (never reuse dev secret!)
NEXTAUTH_SECRET="<generate-with-openssl-rand-base64-32>"

# Production URL (must use HTTPS)
NEXTAUTH_URL="https://your-domain.com"

# ============================================================================
# CORS Configuration
# ============================================================================
# Production domain
ALLOWED_ORIGIN="https://your-domain.com"

# ============================================================================
# Environment
# ============================================================================
NODE_ENV="production"
```

### Optional Variables

```bash
# Redis (for distributed rate limiting)
REDIS_URL="redis://user:password@host:6379"
REDIS_PASSWORD="strong-redis-password"

# Azure AD (if using SSO)
AZURE_AD_CLIENT_ID="your-client-id"
AZURE_AD_CLIENT_SECRET="your-client-secret"
AZURE_AD_TENANT_ID="your-tenant-id"
```

## 🚀 Deployment Script Template

Create deployment scripts that follow security best practices:

### Pre-Deployment Checklist Script

```bash
#!/bin/bash
# scripts/pre-deploy-check.sh
# Validates environment before deployment

set -e

echo "🔍 Pre-Deployment Security Check"
echo "=================================="

# Check required environment variables
REQUIRED_VARS=("DATABASE_URL" "NEXTAUTH_SECRET" "NEXTAUTH_URL" "ALLOWED_ORIGIN" "NODE_ENV")

for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Missing required variable: $var"
    exit 1
  else
    echo "✅ $var is set"
  fi
done

# Validate NEXTAUTH_SECRET strength
SECRET_LENGTH=${#NEXTAUTH_SECRET}
if [ $SECRET_LENGTH -lt 32 ]; then
  echo "❌ NEXTAUTH_SECRET is too short (minimum 32 characters)"
  exit 1
fi

# Validate NEXTAUTH_URL uses HTTPS in production
if [ "$NODE_ENV" = "production" ] && [[ ! "$NEXTAUTH_URL" =~ ^https:// ]]; then
  echo "❌ NEXTAUTH_URL must use HTTPS in production"
  exit 1
fi

# Validate ALLOWED_ORIGIN uses HTTPS in production
if [ "$NODE_ENV" = "production" ] && [[ ! "$ALLOWED_ORIGIN" =~ ^https:// ]]; then
  echo "❌ ALLOWED_ORIGIN must use HTTPS in production"
  exit 1
fi

echo "✅ All security checks passed!"
```

### Generate Secrets Script

```bash
#!/bin/bash
# scripts/generate-secrets.sh
# Generates secure secrets for deployment

echo "🔐 Generating Secure Secrets"
echo "============================="
echo ""

echo "NEXTAUTH_SECRET:"
openssl rand -base64 32
echo ""

echo "Database Password (24 bytes):"
openssl rand -base64 24
echo ""

echo "Redis Password (24 bytes):"
openssl rand -base64 24
echo ""

echo "✅ Secrets generated. Copy these securely to your environment variables."
echo "⚠️  NEVER commit these secrets to version control!"
```

### Deployment Script Template

```bash
#!/bin/bash
# scripts/deploy.sh
# Production deployment script with security checks

set -e

# Load environment variables
if [ -f .env.production ]; then
  export $(cat .env.production | grep -v '^#' | xargs)
else
  echo "❌ .env.production file not found"
  exit 1
fi

# Run pre-deployment checks
echo "Running pre-deployment security checks..."
./scripts/pre-deploy-check.sh

# Build application
echo "Building application..."
pnpm build

# Run database migrations
echo "Running database migrations..."
pnpm db:push

# Deploy (platform-specific)
# Example for Vercel:
# vercel --prod

# Example for Docker:
# docker build -t skills-library:latest .
# docker push skills-library:latest

echo "✅ Deployment complete!"
```

## 🔒 Security Requirements

### Before Deployment

- [ ] Generate new `NEXTAUTH_SECRET` (never reuse dev secret)
- [ ] Use strong database passwords (16+ characters)
- [ ] Enable SSL/TLS for database connections
- [ ] Set `NODE_ENV=production`
- [ ] Use HTTPS for `NEXTAUTH_URL` and `ALLOWED_ORIGIN`
- [ ] Configure secure secret management (no hardcoded secrets)
- [ ] Review and update `.gitignore` (ensure `.env*` is ignored)
- [ ] Run security audit: `pnpm audit`
- [ ] Test password migration if needed

### During Deployment

- [ ] Run pre-deployment security checks
- [ ] Verify environment variables are set correctly
- [ ] Run database migrations securely
- [ ] Deploy with zero-downtime strategy
- [ ] Monitor deployment logs for errors

### After Deployment

- [ ] Verify application is accessible via HTTPS
- [ ] Test authentication flow
- [ ] Verify security headers are present
- [ ] Test rate limiting
- [ ] Monitor error logs
- [ ] Set up alerting for security events
- [ ] Review audit logs

## 📋 Deployment Checklist

### Environment Setup

```bash
# 1. Generate production secrets
./scripts/generate-secrets.sh

# 2. Create .env.production file (DO NOT COMMIT)
cp .env.example .env.production
# Edit .env.production with production values

# 3. Verify secrets are strong
./scripts/pre-deploy-check.sh

# 4. Set up secret management (platform-specific)
# Azure: az keyvault secret set --vault-name <vault> --name NEXTAUTH_SECRET --value <secret>
# AWS: aws secretsmanager create-secret --name NEXTAUTH_SECRET --secret-string <secret>
```

### Database Setup

```bash
# 1. Create production database with SSL
# 2. Run migrations
pnpm db:push

# 3. Migrate passwords (if needed)
pnpm migrate:passwords:auto

# 4. Verify database connection
pnpm db:studio
```

### Application Deployment

```bash
# 1. Build application
pnpm build

# 2. Run security checks
pnpm audit

# 3. Deploy (platform-specific)
# Vercel: vercel --prod
# Docker: docker-compose -f docker-compose.prod.yml up -d
# Kubernetes: kubectl apply -f k8s/
```

## 🛡️ Security Best Practices

### Secret Management

**DO:**

- ✅ Use platform secret management (Azure Key Vault, AWS Secrets Manager)
- ✅ Rotate secrets regularly (every 90 days)
- ✅ Use different secrets for each environment
- ✅ Limit access to secrets (principle of least privilege)
- ✅ Audit secret access

**DON'T:**

- ❌ Commit secrets to version control
- ❌ Share secrets via email or chat
- ❌ Reuse secrets across environments
- ❌ Use weak or default secrets
- ❌ Log secrets in application logs

### Environment Variables

**DO:**

- ✅ Validate all required variables at startup
- ✅ Use strong, unique values for production
- ✅ Enable SSL/TLS for all connections
- ✅ Use HTTPS in production
- ✅ Document all environment variables

**DON'T:**

- ❌ Use development values in production
- ❌ Hardcode secrets in code
- ❌ Expose environment variables in error messages
- ❌ Use HTTP in production

### Database Security

**DO:**

- ✅ Use strong passwords (16+ characters)
- ✅ Enable SSL/TLS connections
- ✅ Use connection pooling with limits
- ✅ Restrict database access by IP
- ✅ Regular backups with encryption

**DON'T:**

- ❌ Use default database passwords
- ❌ Expose database credentials
- ❌ Allow unencrypted connections
- ❌ Grant excessive permissions

## 📚 Platform-Specific Guides

### Vercel Deployment

```bash
# Set secrets via Vercel CLI
vercel env add NEXTAUTH_SECRET production
vercel env add DATABASE_URL production
vercel env add NEXTAUTH_URL production
vercel env add ALLOWED_ORIGIN production

# Deploy
vercel --prod
```

### Docker Deployment

```dockerfile
# Dockerfile should NOT include secrets
# Use environment variables or secrets mount
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

```yaml
# docker-compose.prod.yml
version: "3.8"
services:
  app:
    build: .
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - NEXTAUTH_URL=${NEXTAUTH_URL}
    secrets:
      - db_password
      - jwt_secret
secrets:
  db_password:
    external: true
  jwt_secret:
    external: true
```

### Kubernetes Deployment

```yaml
# k8s/secret.yaml (use kubectl create secret, don't commit)
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
type: Opaque
stringData:
  NEXTAUTH_SECRET: <generated-secret>
  DATABASE_URL: <connection-string>
```

## 🔍 Post-Deployment Verification

### Security Headers Check

```bash
# Verify security headers are present
curl -I https://your-domain.com | grep -i "strict-transport-security\|x-frame-options\|content-security-policy"
```

### Authentication Test

```bash
# Test login endpoint (should require CSRF token)
curl -X POST https://your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'
```

### Rate Limiting Test

```bash
# Make multiple rapid requests (should throttle)
for i in {1..10}; do
  curl https://your-domain.com/api/skills
done
```

## 📝 Example: Complete Deployment Workflow

```bash
#!/bin/bash
# Complete deployment workflow

set -e

echo "🚀 Starting Production Deployment"
echo "=================================="

# Step 1: Generate secrets
echo "1. Generating secrets..."
./scripts/generate-secrets.sh > .secrets.tmp
echo "   ⚠️  Save .secrets.tmp securely, then delete it"

# Step 2: Set environment variables (platform-specific)
echo "2. Setting environment variables..."
# vercel env add NEXTAUTH_SECRET production < secret
# Or use your platform's secret management

# Step 3: Pre-deployment checks
echo "3. Running security checks..."
./scripts/pre-deploy-check.sh

# Step 4: Build
echo "4. Building application..."
pnpm build

# Step 5: Database migrations
echo "5. Running database migrations..."
pnpm db:push

# Step 6: Deploy
echo "6. Deploying application..."
# Platform-specific deployment command

# Step 7: Verify
echo "7. Verifying deployment..."
# Run verification tests

echo "✅ Deployment complete!"
```

## ⚠️ Common Mistakes to Avoid

1. **Reusing Development Secrets**
   - Always generate new secrets for production
   - Never copy `.env.local` to production

2. **Committing Secrets**
   - Double-check `.gitignore` includes `.env*`
   - Use `git-secrets` or similar tools

3. **Weak Passwords**
   - Use password generators or `openssl rand`
   - Minimum 16 characters for production

4. **Missing SSL/TLS**
   - Always use HTTPS in production
   - Enable SSL for database connections

5. **Skipping Security Checks**
   - Always run pre-deployment checks
   - Verify security headers after deployment

## 📖 References

- [OWASP Deployment Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [12-Factor App: Config](https://12factor.net/config)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Docker Secrets](https://docs.docker.com/engine/swarm/secrets/)

## Checklist

When creating deployment scripts:

- [ ] Generate new secrets (never reuse)
- [ ] Validate environment variables
- [ ] Check secret strength
- [ ] Verify HTTPS in production
- [ ] Run pre-deployment security checks
- [ ] Document all steps
- [ ] Include rollback procedures
- [ ] Test in staging first
- [ ] Monitor deployment logs
- [ ] Verify security headers post-deployment
