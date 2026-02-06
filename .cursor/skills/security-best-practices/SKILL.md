---
name: security-best-practices
description: General security best practices and requirements for the Skills Library project. Use when writing any code that handles user input, authentication, data storage, or external communication.
---

# Security Best Practices

This skill defines mandatory security requirements for all code in the Skills Library project.

## Input Validation & Sanitization

### Required for ALL User Input

- **MUST** validate all user input using Zod schemas
- **MUST** sanitize string inputs (trim, length limits, escape special chars)
- **MUST** validate data types and formats
- **MUST** enforce maximum length limits
- **NEVER** trust user input, even from authenticated users

### Validation Pattern

```typescript
import {
  validateRequestBody,
  validationSchemas,
  ValidationError,
} from "@/lib/validation";

try {
  const body = await validateRequestBody(
    request,
    validationSchemas.createSkill,
  );
  // Use validated body
} catch (error) {
  if (error instanceof ValidationError) {
    return NextResponse.json(
      { error: "Invalid request data", details: error.errors },
      { status: 400 },
    );
  }
}
```

### Sanitization

- Trim all strings
- Limit string lengths (prevent DoS)
- Escape HTML/script tags in user-generated content
- Validate email formats
- Validate CUIDs for IDs
- Validate enums match allowed values

## Rate Limiting

### When to Apply

- **MUST** apply to all API endpoints
- **MUST** use stricter limits for authentication endpoints
- **MUST** track by user ID (authenticated) or IP (unauthenticated)

### Implementation

```typescript
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
if (rateLimitResponse) {
  return rateLimitResponse; // Returns 429 with Retry-After header
}
```

### Rate Limit Configurations

- `RATE_LIMITS.AUTH`: 5 requests per 15 minutes (login endpoints)
- `RATE_LIMITS.API`: 100 requests per minute (general endpoints)
- `RATE_LIMITS.MCP`: 100 requests per minute (MCP endpoints)

## Error Handling & Information Leakage

### Error Messages

- **NEVER** expose internal system details
- **NEVER** reveal whether resources exist or not
- **NEVER** include stack traces in production responses
- Use generic error messages for security-related failures
- Log detailed errors server-side only

### Examples

```typescript
// BAD - reveals user existence
if (!user) {
  return { error: 'User not found' };
}

// GOOD - generic message
if (!user || !user.passwordHash) {
  return { error: 'Invalid credentials' };
}

// BAD - exposes internal error
catch (error) {
  return { error: error.message, stack: error.stack };
}

// GOOD - generic error, log details
catch (error) {
  console.error('Operation failed:', error);
  return { error: 'Operation failed' };
}
```

## SQL Injection Prevention

### Prisma ORM

- Prisma protects against SQL injection, but:
- **NEVER** use `Prisma.raw()` with user input
- **NEVER** concatenate user input into query strings
- Always use Prisma's type-safe query builders
- Validate IDs are valid CUIDs before using in queries

### Example

```typescript
// BAD - vulnerable
const id = request.params.id;
await db.$queryRaw`SELECT * FROM users WHERE id = ${id}`;

// GOOD - safe
const { id } = await validateRequestBody(
  request,
  z.object({ id: z.string().cuid() }),
);
const user = await db.user.findUnique({ where: { id } });
```

## XSS Prevention

### Content Sanitization

- **MUST** sanitize all user-generated content before display
- **NEVER** use `dangerouslySetInnerHTML` with user input
- **NEVER** use `eval()` or `Function()` constructor
- Escape HTML entities in user content
- Use React's built-in escaping (default behavior)

### MCP Tool Input

- **MUST** sanitize input before merging into prompts
- Escape template delimiters (`{{` and `}}`)
- Remove script tags and event handlers
- Limit input length to prevent DoS

## CSRF Protection

### Current Status

- CSRF protection should be implemented for state-changing operations
- Consider using CSRF tokens for POST/PUT/DELETE requests
- Validate Origin/Referer headers
- Use SameSite cookies for session management

## Security Headers

### Required Headers

All responses should include security headers (configured in `next.config.ts`):

- `Strict-Transport-Security`: Force HTTPS
- `X-Frame-Options`: Prevent clickjacking
- `X-Content-Type-Options`: Prevent MIME sniffing
- `X-XSS-Protection`: Enable XSS filter
- `Content-Security-Policy`: Restrict resource loading
- `Referrer-Policy`: Control referrer information

## Environment Variables

### Secrets Management

- **NEVER** commit secrets to version control
- **NEVER** use hardcoded secrets or fallback defaults
- **MUST** validate required environment variables at startup
- Use `.env.local` for local development (gitignored)
- Use secure secret management in production (Azure Key Vault, etc.)

### Validation

```typescript
// GOOD - throws if missing
const JWT_SECRET = new TextEncoder().encode(env.NEXTAUTH_SECRET);

// BAD - has fallback
const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || "dev-secret",
);
```

## Audit Logging

### When to Log

- **MUST** log all authentication events (login, logout, failures)
- **MUST** log all create/update/delete operations
- **MUST** log permission changes
- **MUST** log approval actions
- Include user ID, IP address, user agent, and timestamp

### Pattern

```typescript
import { audit } from "@/lib/audit";

await audit.skillCreated(
  skillId,
  user.id,
  {
    name: skill.name,
    category: skill.category,
  },
  request,
);
```

## Password Security

See `authentication-security` skill for detailed requirements.

Key points:

- Use bcrypt (12+ rounds)
- Validate password strength
- Never log or return passwords
- Generic error messages for auth failures

## Request Size Limits

### Configuration

- Configured in `next.config.ts`: `bodyParser.sizeLimit: '1mb'`
- **MUST** enforce limits to prevent DoS attacks
- Return 413 Payload Too Large for oversized requests

## CORS Configuration

### API Routes

- Configured in `next.config.ts` headers
- Whitelist allowed origins via `ALLOWED_ORIGIN` environment variable
- Default to `http://localhost:3000` for development
- **MUST** restrict to specific origins in production

## Database Security

### Connection Security

- Use connection pooling with limits
- Use SSL/TLS for database connections in production
- Never expose database credentials
- Use environment variables for connection strings

### Query Security

- Use Prisma ORM (protects against SQL injection)
- Validate all inputs before queries
- Use transactions for multi-step operations
- Implement soft deletes (archiving) instead of hard deletes

## Checklist

Before submitting any code:

### Input & Validation

- [ ] All user input validated with Zod
- [ ] String inputs sanitized (trim, length limits)
- [ ] Data types and formats validated
- [ ] Maximum length limits enforced

### Security

- [ ] Rate limiting applied
- [ ] Generic error messages (no information leakage)
- [ ] No SQL injection vulnerabilities
- [ ] XSS prevention (no dangerous HTML)
- [ ] No secrets in code or logs

### Authentication

- [ ] Password hashing with bcrypt
- [ ] Password strength validation
- [ ] Account lockout after failed attempts
- [ ] Generic auth error messages

### Infrastructure

- [ ] Security headers configured
- [ ] CORS properly configured
- [ ] Request size limits enforced
- [ ] Environment variables validated
- [ ] Audit logging for sensitive operations

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheets](https://cheatsheetseries.owasp.org/)
- [Next.js Security](https://nextjs.org/docs/app/building-your-application/configuring/security-headers)
