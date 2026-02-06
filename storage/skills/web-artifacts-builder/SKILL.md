---
name: Web Artifacts Builder
description: Create multi-component web artifacts with HTML, CSS, and JavaScript
triggers:
  - web artifact
  - html css js
  - interactive web page
  - create web page
  - build website
  - web component
---

# Web Artifacts Builder Skill

This skill enables the agent to create rich, interactive web artifacts with HTML, CSS, and JavaScript components.

## Approach

When creating web artifacts:

1. **Structure**: Create a single HTML file that includes:
   - Embedded CSS in `<style>` tags
   - Embedded JavaScript in `<script>` tags
   - All assets (images, fonts) as data URIs or inline SVG

2. **Self-contained**: The artifact should be a single file that works standalone when opened in a browser

3. **Modern patterns**:
   - Use modern CSS (flexbox, grid, CSS variables)
   - Use vanilla JavaScript (no external dependencies)
   - Include responsive design (mobile-first)
   - Add interactive elements (buttons, forms, animations)

## File Structure

Create a single HTML file with this structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Artifact Title</title>
  <style>
    /* All CSS here */
    :root {
      --primary-color: #8b5cf6;
      --text-color: #1a1a2e;
    }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 20px;
    }
  </style>
</head>
<body>
  <!-- HTML content here -->
  
  <script>
    // All JavaScript here
    document.addEventListener("DOMContentLoaded", () => {
      // Interactive functionality
    });
  </script>
</body>
</html>
```

## Best Practices

1. **CSS Variables**: Use CSS custom properties for theming
2. **Responsive**: Use media queries for mobile/tablet/desktop
3. **Accessibility**: Include proper ARIA labels and semantic HTML
4. **Performance**: Minimize inline styles, use efficient selectors
5. **Interactivity**: Add smooth transitions and user feedback

## Examples

- Interactive dashboard with charts and filters
- Form builder with validation
- Data visualization with interactive elements
- Landing page with animations
- Calculator or tool interface
