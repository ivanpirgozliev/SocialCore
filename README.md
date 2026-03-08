# SocialCore

SocialCore is a multi-page social networking application built with Vite, vanilla JavaScript, Bootstrap 5, and Supabase. It includes authentication, a feed, profiles, follows, friend requests, direct messaging, saved posts, admin tooling, and a Supabase-backed database with RLS policies.

## Feature Overview

- Public landing page with dedicated login and register flows
- User profiles with editable personal details and profile media
- Feed with post creation, image-only posts, comments, threaded replies, and reactions
- Social graph features: follows, friend requests, accepted friends, saved posts
- Direct messaging with conversation creation, unread count support, and message reactions
- Admin area backed by protected Supabase Edge Functions for user management and moderation workflows

## Tech Stack

- Frontend: HTML5, CSS3, vanilla JavaScript ES modules, Bootstrap 5, Bootstrap Icons
- Build tooling: Vite 5 multi-page configuration
- Backend: Supabase Auth, Supabase Postgres, Row Level Security, SQL RPC/functions, Edge Functions
- Data layer: shared browser-side helpers in `js/database.js`

## Application Structure

### Multi-page app

The app uses Vite in MPA mode. Each HTML page has its own JavaScript module.

Available pages:

- `index.html` - landing page
- `pages/login.html`
- `pages/register.html`
- `pages/feed.html`
- `pages/messages.html`
- `pages/profile.html`
- `pages/photos.html`
- `pages/saved-posts.html`
- `pages/friends.html`
- `pages/create-post.html`
- `pages/edit-profile.html`
- `pages/settings.html`
- `pages/admin.html`

### Frontend organization

- `js/` contains page modules and shared helpers
- `css/` contains global, page-specific, and section styles
- `assets/` contains images and background video assets
- `vite.config.js` defines all page entry points and local dev settings

### Supabase integration

- `js/supabase.js` creates the browser client from Vite environment variables
- `js/database.js` contains the main async helpers for posts, comments, follows, friends, messaging, reactions, and saved posts
- Security is enforced primarily in Supabase through RLS policies, constraints, triggers, and RPC functions

## Database Overview

The current schema covers core social content, relationships, messaging, moderation, and saved content.

Main tables:

- Core social: `profiles`, `posts`, `comments`, `likes`, `follows`
- Friendship: `friend_requests`
- Messaging: `conversations`, `conversation_participants`, `messages`, `message_reactions`
- Personalization: `saved_posts`
- Access control: `user_roles`

Current migration sets:

- `database/migrations/` contains 24 SQL files for the manual/reference workflow
- `supabase/migrations/` contains the Supabase CLI migration history used by `supabase db push`

Notable schema behavior:

- Automatic profile creation after signup
- Threaded comments via `parent_comment_id`
- Reactions on both likes and messages
- Mutual follow sync on accepted friend requests
- RPC helpers for unread counts and direct-conversation creation

See `database/schema-diagram.md` for the schema overview.

## Local Setup

### Prerequisites

- Node.js 18+
- npm
- A Supabase project
- Optional: Supabase CLI for the recommended migration workflow

### 1. Install dependencies

```bash
npm install
```

### 2. Create environment variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

If either variable is missing, the app will fail fast during client initialization.

### 3. Apply database migrations

Recommended Supabase CLI workflow:

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase db push
```

Alternative manual workflow:

- Execute the SQL files in `database/migrations/` in order through Supabase SQL Editor
- Or run `database/EXECUTE_THIS_IN_SUPABASE.sql` if you are using the consolidated manual setup path

### 4. Start the development server

```bash
npm run dev
```

The app runs at `http://localhost:3000`.

### 5. Production build and preview

```bash
npm run build
npm run preview
```

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Vite dev server on port 3000 |
| `npm run build` | Build the multi-page app into `dist/` |
| `npm run preview` | Preview the production build locally |

## Key Directories

| Path | Purpose |
|---|---|
| `index.html` | Public landing page entry |
| `pages/` | Feature pages for the app |
| `js/` | Page scripts, shared UI helpers, and data-access helpers |
| `css/` | Global, page-level, and section-level styles |
| `assets/` | Images and background video assets |
| `database/migrations/` | Manual/reference SQL migrations |
| `database/schema-diagram.md` | ASCII schema overview |
| `supabase/migrations/` | Supabase CLI migration history |
| `supabase/functions/` | Edge Functions for admin operations |
| `SUPABASE_SETUP.md` | Detailed Supabase setup guide |
| `QUICK_START.md` | Short setup and smoke-test guide |
| `MIGRATION_CHECKLIST.md` | Migration validation notes |

## Edge Functions

The `supabase/functions/` directory currently includes admin-oriented functions:

- `create-user`
- `list-users`
- `edit-user`
- `delete-user`

These are intended for protected admin workflows rather than direct public access.

## Development Notes

- The app is intentionally organized as a vanilla-JS MPA rather than a SPA
- Relative asset paths differ between the project root and files inside `pages/`
- Bootstrap utilities are extended with custom CSS rather than replaced wholesale
- There is currently no automated test script in `package.json`; validation is mainly through local app flows and database checks

## Additional Docs

- `SUPABASE_SETUP.md` for a longer setup walkthrough
- `QUICK_START.md` for a short start-to-finish setup checklist
- `database/schema-diagram.md` for the schema overview
- `MIGRATION_CHECKLIST.md` for migration verification steps
