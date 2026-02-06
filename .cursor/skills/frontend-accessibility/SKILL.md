---
name: frontend-accessibility
description: Ensure accessible UI with keyboard navigation, labels, and ARIA where needed. Use when building or reviewing frontend components and pages.
---

# Frontend Accessibility

Build UI that is usable by keyboard and assistive technologies.

## Core Requirements

- Use semantic HTML elements
- Ensure all form fields have labels
- Provide keyboard navigation for interactive elements
- Maintain visible focus states
- Use ARIA only when native semantics are insufficient

## Checklist

- [ ] Labels associated with inputs (`htmlFor` + `id`)
- [ ] Buttons are real `<button>` elements
- [ ] Links are real `<a>` elements
- [ ] Focus states visible and not removed
- [ ] Keyboard navigation works for dialogs and menus
- [ ] Color contrast is sufficient
- [ ] Error messages are announced (aria-live when needed)
