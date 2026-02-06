---
name: backend-integration
description: Add or modify third-party backend integrations (Slack, Gmail, etc.), including OAuth/connect flows, secure credential storage, webhook endpoints, and audit logging. Use when working in src/app/api/integrations or AppIntegration/AppAction/WebhookEndpoint models.
---

# Backend Integration

Create or update integrations in a consistent, secure way.

## Scope

Use this skill when:

- Adding a new integration endpoint under `src/app/api/integrations`
- Extending `AppIntegration`, `AppAction`, or `WebhookEndpoint` data
- Implementing OAuth connect flows or webhook receivers

## Required API Route Order

For any state-changing integration route:
CSRF → Auth → Rate Limit → Validate → Logic → Audit → Response

Use the same imports as standard API routes and `validateCSRFToken` from `@/lib/csrf`.

## Credential Handling

- Store credentials in `AppIntegration.credentials` only
- Never log secrets, access tokens, refresh tokens, or raw OAuth responses
- Set `status` to `CONNECTING`, `CONNECTED`, `DISCONNECTED`, or `ERROR`
- Record `errorMessage` only with safe, non-sensitive text

## Webhook Endpoints

- Use `WebhookEndpoint` for externally-triggered runs
- Validate webhook signatures if a `secret` is configured
- Apply `runPolicyId` when present
- Return generic errors on verification failure

## Audit Logging

- Log connect, disconnect, and credential refresh events
- Include the integration name and user ID

## Checklist

- [ ] CSRF validation for POST/PUT/PATCH/DELETE
- [ ] `checkAuthWithPermission` for protected routes
- [ ] Rate limiting applied
- [ ] Zod validation for payloads
- [ ] Secrets never logged or returned
- [ ] Audit log entry created for changes
- [ ] Error messages are generic
