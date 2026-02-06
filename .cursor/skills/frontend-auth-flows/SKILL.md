---
name: frontend-auth-flows
description: Implement login/logout/session UX safely. Use when building auth-related pages, forms, or client logic in src/app or src/components.
---

# Frontend Auth Flows

Build user-facing authentication flows that are secure and consistent.

## Core Rules

- Use generic error messages (never reveal user existence)
- Prefer httpOnly cookies set by the server
- Use `apiRequest` from `@/lib/api-client` for auth calls

## Login Pattern

```tsx
"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/api-client";

export function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData(event.currentTarget);
      const payload = Object.fromEntries(formData);
      await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      // Redirect or refresh session view
    } catch (err) {
      setError("Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Email + password fields */}
      {error && <div style={{ color: "var(--color-danger)" }}>{error}</div>}
      <button type="submit" disabled={loading}>
        Login
      </button>
    </form>
  );
}
```

## Logout Pattern

- Call `/api/auth/logout` with `POST`
- Clear any client-side state and redirect

## Checklist

- [ ] Generic error messages
- [ ] CSRF handled via `apiRequest`
- [ ] No sensitive data stored in localStorage
