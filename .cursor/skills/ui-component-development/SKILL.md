---
name: ui-component-development
description: Enforces Puzzel Nordic Design System rules for UI components and pages. Use when creating or modifying React components, pages, or styling in src/app/ or src/components/, including color usage, typography, layout patterns, and CSS variables.
---

# UI Component Development

Follow the Puzzel Nordic Design System rules for all UI components and pages. See `pm/DESIGN_REFERENCE.md` for complete design specifications.

## Critical Rules

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

## Page Layout Pattern

All pages must use the height-constrained layout pattern:

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

## Color Usage

### Always Use CSS Variables

Reference `src/app/globals.css` for all available variables.

### Background Colors

```tsx
// Primary background (white)
style={{ background: 'var(--color-background)' }}

// Surface (white)
style={{ background: 'var(--color-surface)' }}

// Secondary surface (light gray)
style={{ background: 'var(--color-surface-secondary)' }}

// Tertiary surface (lighter gray)
style={{ background: 'var(--color-surface-tertiary)' }}
```

### Text Colors

```tsx
// Primary text (dark)
style={{ color: 'var(--color-text)' }}

// Secondary text (medium gray)
style={{ color: 'var(--color-text-secondary)' }}

// Muted text (light gray)
style={{ color: 'var(--color-text-muted)' }}
```

### Primary Accent (Purple)

```tsx
// Primary purple
style={{ background: 'var(--color-primary)' }}

// Darker purple
style={{ background: 'var(--color-primary-dark)' }}

// Lighter purple
style={{ background: 'var(--color-primary-light)' }}
```

### Semantic Colors

```tsx
// Success (green)
style={{ color: 'var(--color-success)' }}

// Warning (amber)
style={{ color: 'var(--color-warning)' }}

// Danger (red)
style={{ color: 'var(--color-danger)' }}
```

### Borders

```tsx
style={{ border: '1px solid var(--color-border)' }}
```

## Typography

### Fonts

- **Headings**: `var(--font-display)` (Space Grotesk)
- **Body**: `var(--font-body)` (DM Sans)

### Heading Sizes

```tsx
// H1
style={{
  fontSize: '2.25rem', // 36px
  fontWeight: 700,
  fontFamily: 'var(--font-display)',
  color: 'var(--color-text)',
}}

// H2
style={{
  fontSize: '1.875rem', // 30px
  fontWeight: 600,
  fontFamily: 'var(--font-display)',
  color: 'var(--color-text)',
}}

// H3
style={{
  fontSize: '1.5rem', // 24px
  fontWeight: 600,
  fontFamily: 'var(--font-display)',
  color: 'var(--color-text)',
}}
```

### Body Text

```tsx
style={{
  fontSize: '1rem', // 16px
  fontWeight: 400,
  fontFamily: 'var(--font-body)',
  color: 'var(--color-text)',
}}

// Small text
style={{
  fontSize: '0.875rem', // 14px
  fontWeight: 400,
  fontFamily: 'var(--font-body)',
  color: 'var(--color-text-secondary)',
}}
```

## Component Patterns

### Cards

```tsx
<div
  style={{
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow-md)",
    padding: "var(--spacing-lg)",
  }}
>
  {/* Card content */}
</div>
```

### Buttons

#### Primary Button

```tsx
<button
  style={{
    background: "var(--color-primary)",
    color: "white",
    border: "none",
    borderRadius: "var(--radius-md)",
    padding: "var(--spacing-sm) var(--spacing-md)",
    cursor: "pointer",
    fontFamily: "var(--font-body)",
  }}
>
  Primary Action
</button>
```

#### Secondary Button

```tsx
<button
  style={{
    background: "var(--color-surface-secondary)",
    color: "var(--color-text)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    padding: "var(--spacing-sm) var(--spacing-md)",
    cursor: "pointer",
    fontFamily: "var(--font-body)",
  }}
>
  Secondary Action
</button>
```

### Inputs

```tsx
<input
  style={{
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    padding: "var(--spacing-sm) var(--spacing-md)",
    fontFamily: "var(--font-body)",
    color: "var(--color-text)",
  }}
/>
```

### Badges (Status)

```tsx
// Draft (gray)
<span style={{
  background: 'var(--color-surface-secondary)',
  color: 'var(--color-text-secondary)',
  padding: 'var(--spacing-xs) var(--spacing-sm)',
  borderRadius: 'var(--radius-sm)',
}}>Draft</span>

// Pending (amber)
<span style={{
  background: 'var(--color-surface-secondary)',
  color: 'var(--color-warning)',
  padding: 'var(--spacing-xs) var(--spacing-sm)',
  borderRadius: 'var(--radius-sm)',
}}>Pending</span>

// Published (green)
<span style={{
  background: 'var(--color-surface-secondary)',
  color: 'var(--color-success)',
  padding: 'var(--spacing-xs) var(--spacing-sm)',
  borderRadius: 'var(--radius-sm)',
}}>Published</span>

// Rejected (red)
<span style={{
  background: 'var(--color-surface-secondary)',
  color: 'var(--color-danger)',
  padding: 'var(--spacing-xs) var(--spacing-sm)',
  borderRadius: 'var(--radius-sm)',
}}>Rejected</span>
```

## Spacing

Use CSS variables for all spacing:

```tsx
// Spacing values
var(--spacing-xs)   // 0.25rem
var(--spacing-sm)   // 0.5rem
var(--spacing-md)   // 1rem
var(--spacing-lg)   // 1.5rem
var(--spacing-xl)   // 2rem
var(--spacing-2xl)  // 3rem
```

## Border Radius

```tsx
var(--radius-sm)  // 0.25rem
var(--radius-md)  // 0.5rem
var(--radius-lg)  // 0.75rem
var(--radius-xl)  // 1rem
```

## Shadows

```tsx
var(--shadow-sm)  // Subtle shadow
var(--shadow-md)  // Medium shadow (default for cards)
var(--shadow-lg)  // Large shadow
```

## Checklist

Before submitting UI components:

- [ ] Uses white backgrounds only (`var(--color-background)` or `var(--color-surface)`)
- [ ] Uses dark text (`var(--color-text)`)
- [ ] Uses purple for primary actions (`var(--color-primary)`)
- [ ] Page uses `.page-container`, `.page-header`, `.page-content` pattern
- [ ] Page height is constrained (`max-height: 100vh`)
- [ ] All colors use CSS variables (no hardcoded values)
- [ ] Typography uses `var(--font-display)` for headings, `var(--font-body)` for body
- [ ] No dark backgrounds or glass morphism
- [ ] No cyan/teal colors
- [ ] Generous whitespace using spacing variables
- [ ] Borders use `var(--color-border)`
- [ ] Shadows use shadow variables

## Common Mistakes to Avoid

### ❌ Hardcoded Colors

```tsx
// BAD
style={{ background: '#ffffff' }}
style={{ color: '#000000' }}

// GOOD
style={{ background: 'var(--color-background)' }}
style={{ color: 'var(--color-text)' }}
```

### ❌ Dark Backgrounds

```tsx
// BAD
style={{ background: '#1a1a1a', color: 'white' }}

// GOOD
style={{ background: 'var(--color-background)', color: 'var(--color-text)' }}
```

### ❌ Unlimited Height

```tsx
// BAD
<div style={{ minHeight: '100vh' }}>

// GOOD
<div className="page-container">
  <main className="page-content">
```

### ❌ Tailwind Opacity

```tsx
// BAD
className="bg-white/5"

// GOOD
style={{ background: 'var(--color-surface-secondary)' }}
```

## Reference Files

- Design System: `pm/DESIGN_REFERENCE.md`
- CSS Variables: `src/app/globals.css`
- Example Pages: `src/app/admin/page.tsx`, `src/app/approvals/[skillId]/[versionId]/page.tsx`
