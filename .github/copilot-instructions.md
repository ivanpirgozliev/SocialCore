# SocialCore - AI Coding Instructions

## Project Overview
SocialCore is a vanilla JavaScript social network platform using **Vite** as the build tool and **Bootstrap 5** for UI. Backend integration with **Supabase** is planned but not yet implemented (see `TODO:` comments).

## Architecture

### Multi-Page Application (MPA)
- Entry point: [index.html](../index.html) (landing page with video background)
- All pages in [pages/](../pages/) are separate HTML files with their own `<script>` tags
- Vite is configured for MPA builds via `rollupOptions.input` in [vite.config.js](../vite.config.js)
- Relative paths differ between root (`./`) and pages (`../`) - maintain this pattern

### JavaScript Module Structure
Each page has a dedicated ES module in [js/](../js/):
- Modules use `import { showToast, formatRelativeTime } from './main.js'` for shared utilities
- All modules initialize via `DOMContentLoaded` event listener
- Pattern: DOM element queries → event listener setup → handler functions

```javascript
// Standard module pattern
document.addEventListener('DOMContentLoaded', () => {
  initFeatureX();
});
function initFeatureX() { /* ... */ }
```

### CSS Architecture
Single stylesheet [css/styles.css](../css/styles.css) using:
- CSS custom properties in `:root` for theming (colors, spacing, shadows)
- Primary gradient: `var(--primary-gradient)` for branded buttons/text
- Naming: `.btn-primary-gradient`, `.post-card`, `.hero-section`
- Bootstrap utilities extended, not overridden

## Key Conventions

### Form Handling Pattern
All forms follow this pattern (see [auth.js](../js/auth.js)):
1. Prevent default, validate with `validateForm(form)`
2. Show loading state: `submitBtn.innerHTML = '<span class="spinner-border..."></span>Loading...'`
3. Wrap async operations in try/catch with `showToast()` for feedback
4. Redirect on success after 1500ms delay

### Event Delegation
For dynamic content (posts, comments), use event delegation on parent containers:
```javascript
postsFeed.addEventListener('click', (e) => {
  const actionBtn = e.target.closest('.post-action-btn');
  if (!actionBtn) return;
  // Handle action based on data-action attribute
});
```

### UI Components
- Toasts: `showToast(message, type)` - types: `'success'`, `'error'`, `'warning'`, `'info'`
- Modals: Created dynamically, stored in DOM for reuse (see profile.js `openEditProfileModal`)
- Icons: Bootstrap Icons via `<i class="bi bi-icon-name">`

## Development Workflow

### Commands
```bash
npm run dev      # Start dev server at localhost:3000
npm run build    # Production build to /dist
npm run preview  # Preview production build
```

### Adding New Pages
1. Create HTML in `pages/` with proper relative paths (`../css/`, `../js/`, `../assets/`)
2. Add entry to `vite.config.js` → `rollupOptions.input`
3. Create corresponding JS module in `js/` if needed

### Supabase Integration (Future)
Search for `TODO: Implement Supabase` to find integration points. Current functions use `simulate*()` placeholders (e.g., `simulateLogin`, `simulateCreatePost`).

## File Reference
| Path | Purpose |
|------|---------|
| `js/main.js` | Shared utilities (toasts, validation, nav highlighting) |
| `js/auth.js` | Login/register forms with validation |
| `js/feed.js` | Post interactions (like, comment, share) |
| `js/profile.js` | Profile page, edit modal |
| `js/admin.js` | Admin dashboard (user management, reports) |
| `css/styles.css` | All styles, CSS variables at top |
