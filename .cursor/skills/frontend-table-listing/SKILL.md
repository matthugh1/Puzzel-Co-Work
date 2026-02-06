---
name: frontend-table-listing
description: Build list or table views with loading, empty, error states, and pagination. Use when creating pages or components that display collections.
---

# Frontend Table and Listing Patterns

Create list or table UIs with consistent states and design system styling.

## Required States

- Loading state
- Empty state
- Error state
- Success state

## Example Pattern (Client Component)

```tsx
"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api-client";

type Item = { id: string; name: string };

export function ExampleList() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<{ items: Item[] }>("/api/items")
      .then((data) => setItems(data.items))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load"),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div style={{ color: "var(--color-danger)" }}>{error}</div>;
  if (items.length === 0) return <div>No results found</div>;

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th
            style={{
              textAlign: "left",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            Name
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td style={{ padding: "var(--spacing-sm) 0" }}>{item.name}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

## Checklist

- [ ] Loading, empty, and error states
- [ ] CSS variables for colors and spacing
- [ ] Accessible table headers or list semantics
- [ ] Pagination or limits when lists are large
