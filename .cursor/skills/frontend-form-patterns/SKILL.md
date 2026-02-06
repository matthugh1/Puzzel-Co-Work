---
name: frontend-form-patterns
description: Build frontend forms with validation, loading states, and CSRF-safe API calls. Use when creating or updating forms in src/app or src/components.
---

# Frontend Form Patterns

Create forms that follow the design system and safe API patterns.

## Required Foundations

- Use design system CSS variables only
- Use `apiRequest` or typed API helpers from `@/lib/api-client`
- Handle loading, error, and success states explicitly

## Example Form Pattern

```tsx
"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/api-client";

export function ExampleForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData(event.currentTarget);
      const payload = Object.fromEntries(formData);
      await apiRequest("/api/resource", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Fields */}
      {error && (
        <div
          style={{
            color: "var(--color-danger)",
            marginTop: "var(--spacing-sm)",
          }}
        >
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={loading}
        style={{
          padding: "var(--spacing-sm) var(--spacing-md)",
          background: "var(--color-primary)",
          color: "white",
          border: "none",
          borderRadius: "var(--radius-md)",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
```

## CSRF Handling

- `apiRequest` automatically includes the CSRF token
- Do not manually add `X-CSRF-Token` unless you bypass `apiRequest`

## Checklist

- [ ] Uses CSS variables only
- [ ] Loading and error states included
- [ ] `apiRequest` for state-changing actions
- [ ] Errors are generic and user-friendly
