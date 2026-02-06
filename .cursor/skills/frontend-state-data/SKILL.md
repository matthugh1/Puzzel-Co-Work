---
name: frontend-state-data
description: Fetch and mutate data in the App Router with safe patterns, optimistic UI, and error handling. Use when building pages or data-heavy components.
---

# Frontend State and Data

Use App Router patterns for data fetching and mutation.

## Preferred Patterns

- Server components for initial data load when possible
- Client components for mutations and live updates
- Use `apiRequest` or typed helpers from `@/lib/api-client`

## Optimistic Update Pattern

```tsx
"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/api-client";

type Item = { id: string; name: string };

export function EditableList({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState<string | null>(null);

  const renameItem = async (id: string, name: string) => {
    const previous = items;
    setItems(items.map((item) => (item.id === id ? { ...item, name } : item)));

    try {
      await apiRequest(`/api/items/${id}`, {
        method: "PUT",
        body: JSON.stringify({ name }),
      });
    } catch (err) {
      setItems(previous);
      setError("Update failed");
    }
  };

  return (
    <div>
      {error && <div style={{ color: "var(--color-danger)" }}>{error}</div>}
      {/* Render items */}
    </div>
  );
}
```

## Checklist

- [ ] Server component for initial load when feasible
- [ ] Client mutations use `apiRequest`
- [ ] Optimistic updates roll back on error
- [ ] Errors handled with user-friendly messages
