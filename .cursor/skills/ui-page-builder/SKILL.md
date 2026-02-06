---
name: ui-page-builder
description: Creates Next.js App Router pages and React components following Puzzel Nordic Design System rules. Use when adding new UI pages or components.
---

# UI Page Builder

Create Next.js App Router pages and React components following Puzzel Nordic Design System rules.

## Page Location

- **Directory**: `src/app/` (for pages) or `src/components/` (for reusable components)
- **File naming**: kebab-case for directories, PascalCase for components
- **Example**: `src/app/runs/[id]/page.tsx`

## Page Layout Pattern

All pages MUST use the height-constrained layout:

```tsx
export default function MyPage() {
  return (
    <div className="page-container">
      <header className="page-header">
        <h1
          style={{
            fontSize: "2.25rem",
            fontWeight: 700,
            margin: 0,
            fontFamily: "var(--font-display)",
            color: "var(--color-text)",
          }}
        >
          Page Title
        </h1>
      </header>

      <main className="page-content">{/* Scrollable content here */}</main>
    </div>
  );
}
```

### Layout Classes

- `.page-container` - Full viewport height, flex column, overflow hidden
- `.page-header` - Fixed header with border-bottom, flex-shrink-0
- `.page-content` - Scrollable main content area, flex-1, overflow-y-auto

## Design System Rules

### ✅ DO

- White backgrounds only (`var(--color-background)`)
- Dark text (`var(--color-text)`)
- Purple accents (`var(--color-primary)`)
- Height-constrained pages (`max-height: 100vh`)
- CSS variables for all values
- Generous whitespace

### ❌ DON'T

- Dark backgrounds
- White text on dark
- Glass morphism effects
- Cyan/teal colors
- Unlimited page heights
- Tailwind opacity classes (`bg-white/5`)
- Hardcoded color values

## Color Usage

### Always Use CSS Variables

Reference `src/app/globals.css` for available variables.

```tsx
// Background
style={{ background: 'var(--color-background)' }}
style={{ background: 'var(--color-surface)' }}
style={{ background: 'var(--color-surface-secondary)' }}

// Text
style={{ color: 'var(--color-text)' }}
style={{ color: 'var(--color-text-secondary)' }}

// Accents
style={{ color: 'var(--color-primary)' }}
style={{ borderColor: 'var(--color-border)' }}
```

## Component Pattern

### Basic Component

```tsx
"use client";

import { useState } from "react";

interface ComponentProps {
  title: string;
  onAction?: () => void;
}

export function MyComponent({ title, onAction }: ComponentProps) {
  const [state, setState] = useState<string>("");

  return (
    <div
      style={{
        padding: "1.5rem",
        background: "var(--color-surface)",
        borderRadius: "0.5rem",
        border: "1px solid var(--color-border)",
      }}
    >
      <h2
        style={{
          fontSize: "1.5rem",
          fontWeight: 600,
          margin: "0 0 1rem 0",
          color: "var(--color-text)",
        }}
      >
        {title}
      </h2>
      {/* Content */}
    </div>
  );
}
```

## Form Pattern

```tsx
"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api-client";

export function CreateForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData(e.currentTarget);
      const data = Object.fromEntries(formData);

      await apiClient.post("/api/resource", data);
      // Handle success
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      {error && (
        <div style={{ color: "var(--color-error)", marginTop: "1rem" }}>
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={loading}
        style={{
          padding: "0.75rem 1.5rem",
          background: "var(--color-primary)",
          color: "white",
          border: "none",
          borderRadius: "0.375rem",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Creating..." : "Create"}
      </button>
    </form>
  );
}
```

## Data Fetching Pattern

### Server Component (Recommended)

```tsx
import { db } from "@/lib/db";

export default async function ResourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const resource = await db.resource.findUnique({
    where: { id },
  });

  if (!resource) {
    return <div>Resource not found</div>;
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>{resource.name}</h1>
      </header>
      <main className="page-content">{/* Content */}</main>
    </div>
  );
}
```

### Client Component with API

```tsx
"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

export function ResourceList() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get("/api/resources")
      .then((data) => setResources(data.resources))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {resources.map((resource) => (
        <div key={resource.id}>{resource.name}</div>
      ))}
    </div>
  );
}
```

## Typography

```tsx
// Page title
<h1 style={{
  fontSize: '2.25rem',
  fontWeight: 700,
  fontFamily: 'var(--font-display)',
  color: 'var(--color-text)',
}}>

// Section heading
<h2 style={{
  fontSize: '1.5rem',
  fontWeight: 600,
  color: 'var(--color-text)',
}}>

// Body text
<p style={{
  fontSize: '1rem',
  color: 'var(--color-text-secondary)',
}}>
```

## Spacing

Use consistent spacing:

```tsx
style={{
  padding: '1.5rem',        // Standard padding
  margin: '1rem 0',         // Vertical margin
  gap: '1rem',              // Flex gap
}}
```

## Verification Checklist

- [ ] Uses page-container/page-header/page-content layout
- [ ] White backgrounds only
- [ ] Dark text
- [ ] CSS variables (no hardcoded colors)
- [ ] Height-constrained (max-height: 100vh)
- [ ] No dark backgrounds or glass morphism
- [ ] Proper error handling
- [ ] Loading states
- [ ] Accessible (semantic HTML, ARIA labels if needed)

## Files Changed

- `src/app/page-name/page.tsx` - New page file
- `src/components/ComponentName.tsx` - New component file (if reusable)

## Done When

- [ ] Page/component created following layout pattern
- [ ] Design system rules followed
- [ ] CSS variables used (no hardcoded colors)
- [ ] Error and loading states handled
- [ ] Page renders correctly
