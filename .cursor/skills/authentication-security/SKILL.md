---
name: authentication-security
description: Security requirements for authentication and password handling. Use when implementing or modifying authentication flows, password management, or user credential handling.
---

# Authentication Security

This skill enforces strict security standards for all authentication-related code.

## Password Security

### Hashing

- **MUST** use `bcrypt` with at least 12 rounds (never SHA-256 or MD5)
- **MUST** use async password hashing: `await hashPassword(password)`
- **MUST** use async password verification: `await verifyPassword(password, hash)`
- **NEVER** store plaintext passwords
- **NEVER** log passwords or password hashes

### Password Strength

- **MUST** validate password strength using `validatePasswordStrength()` from `@/lib/password`
- Minimum requirements:
  - At least 8 characters (max 128)
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character
  - Score of at least 2 on zxcvbn strength checker
- Return validation errors if password doesn't meet requirements

### Password Storage

```typescript
import { hashPassword } from "@/lib/auth/simple-auth";
import { validatePasswordStrength } from "@/lib/password";

// When creating/updating password
const validation = validatePasswordStrength(password);
if (!validation.valid) {
  return {
    error: "Password does not meet requirements",
    details: validation.errors,
  };
}

const passwordHash = await hashPassword(password);
```

## Authentication Endpoints

### Rate Limiting

- **MUST** apply strict rate limiting to login endpoints
- Use `RATE_LIMITS.AUTH` (5 attempts per 15 minutes)
- Track failed login attempts per email
- Lock accounts after 5 failed attempts for 30 minutes

### Account Lockout

```typescript
import { trackFailedLogin, clearFailedLoginAttempts } from "@/lib/rate-limit";

// Before authentication attempt
const lockStatus = trackFailedLogin(email);
if (lockStatus.locked) {
  return { error: "Account temporarily locked" };
}

// On successful login
clearFailedLoginAttempts(email);

// On failed login
trackFailedLogin(email); // Increments counter
```

### Error Messages

- **NEVER** reveal whether an email exists or not
- Use generic message: "Invalid credentials" for all authentication failures
- Don't differentiate between "wrong password" and "user not found"
- Log detailed errors server-side only

### Input Validation

- **MUST** validate email format using Zod schema
- **MUST** validate password is not empty
- Use `validationSchemas.login` from `@/lib/validation`

## JWT Token Security

### Secret Management

- **MUST** use `env.NEXTAUTH_SECRET` (no hardcoded fallbacks)
- **MUST** ensure secret is at least 32 characters
- Generate with: `openssl rand -base64 32`
- **NEVER** commit secrets to version control

### Token Storage

- Prefer httpOnly cookies over localStorage
- If using localStorage, ensure XSS protection is in place
- Set appropriate expiration times (24h for access tokens)
- Consider implementing refresh tokens for better security

### Token Validation

- **ALWAYS** validate tokens on every request
- Check expiration
- Verify signature
- Refresh user permissions from database (don't trust token claims alone)

## Example: Secure Login Route

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  rateLimit,
  RATE_LIMITS,
  trackFailedLogin,
  clearFailedLoginAttempts,
} from "@/lib/rate-limit";
import {
  validateRequestBody,
  validationSchemas,
  ValidationError,
} from "@/lib/validation";

export async function POST(request: Request) {
  // 1. Rate limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.AUTH);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // 2. Input validation
    const { email, password } = await validateRequestBody(
      request,
      validationSchemas.login,
    );

    // 3. Check account lockout
    const lockStatus = trackFailedLogin(email);
    if (lockStatus.locked) {
      return NextResponse.json(
        { error: "Account temporarily locked due to too many failed attempts" },
        { status: 429 },
      );
    }

    // 4. Authenticate
    const result = await auth.authenticate({ email, password });

    if (!result.success) {
      trackFailedLogin(email); // Track failed attempt
      await audit.authFailed(email, {}, request);
      return NextResponse.json(
        { error: "Invalid credentials" }, // Generic message
        { status: 401 },
      );
    }

    // 5. Clear failed attempts on success
    clearFailedLoginAttempts(email);
    await audit.authLogin(result.user.id, { email }, request);

    return NextResponse.json({
      user: result.user,
      token: result.token,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 },
      );
    }

    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 },
    );
  }
}
```

## Checklist

When implementing authentication:

- [ ] Uses bcrypt (not SHA-256/MD5) with 12+ rounds
- [ ] Validates password strength before hashing
- [ ] Rate limiting applied (strict limits for auth endpoints)
- [ ] Account lockout after failed attempts
- [ ] Generic error messages (no user enumeration)
- [ ] Input validation with Zod
- [ ] Failed login attempts tracked and logged
- [ ] Successful logins clear failed attempt counters
- [ ] No passwords in logs or responses
- [ ] JWT secret from environment (no hardcoded fallback)
- [ ] Token expiration configured appropriately
