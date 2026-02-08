# SocialCore Database Migrations

This directory contains SQL migration scripts for the SocialCore application database schema.

## Database Schema Overview

### Tables

1. **profiles** - User profile information
   - Extends `auth.users` with additional profile data
   - Fields: username, full_name, bio, avatar_url, cover_photo_url
   - Automatically created when user signs up

2. **posts** - User posts
   - Content with optional images
   - Cached counters for likes, comments, shares
   - Foreign key to profiles (user_id)

3. **comments** - Comments on posts
   - Text comments with like counter
   - Foreign keys to posts and profiles
   - Auto-increments post comment count

4. **follows** - User follow relationships
   - Many-to-many relationship between users
   - Prevents self-follows and duplicate relationships
   - Indexed for efficient follower/following queries

5. **likes** - Likes on posts and comments
   - Polymorphic relationship (either post or comment)
   - Auto-increments like counters
   - Prevents duplicate likes

### Relationships

```
profiles (1) ----< (M) posts
profiles (1) ----< (M) comments
posts (1) ----< (M) comments
profiles (1) ----< (M) likes
posts (1) ----< (M) likes
comments (1) ----< (M) likes
profiles (M) >----< (M) profiles (via follows)
```

## Migration Files

Run migrations in order:

1. `001_create_profiles_table.sql` - Creates profiles table with auto-creation trigger
2. `002_create_posts_table.sql` - Creates posts table
3. `003_create_comments_table.sql` - Creates comments table with counter triggers
4. `004_create_follows_table.sql` - Creates follows table with helper functions
5. `005_create_likes_table.sql` - Creates likes table with counter triggers
6. `006_add_location_website_to_profiles.sql` - Adds location + website fields to profiles
7. `007_add_extended_profile_fields.sql` - Adds extended profile fields (phone, birthday, etc.)
8. `008_optimize_rls_policies_auth_calls.sql` - Optimizes RLS policies to avoid per-row auth.* evaluation

## How to Run Migrations

### Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste each migration file content
4. Execute them in order (001, 002, 003, 004, 005)

### Using Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run all migrations
supabase db push
```

### Manual Execution

```bash
# Using psql
psql -h your-db-host -U postgres -d postgres -f database/migrations/001_create_profiles_table.sql
psql -h your-db-host -U postgres -d postgres -f database/migrations/002_create_posts_table.sql
psql -h your-db-host -U postgres -d postgres -f database/migrations/003_create_comments_table.sql
psql -h your-db-host -U postgres -d postgres -f database/migrations/004_create_follows_table.sql
psql -h your-db-host -U postgres -d postgres -f database/migrations/005_create_likes_table.sql
```

## Features

### Row Level Security (RLS)

All tables have RLS enabled with policies for:
- Public read access (SELECT)
- Authenticated users can create content
- Users can only update/delete their own content

### Automatic Triggers

- **Profiles**: Auto-created on user signup
- **Posts/Comments**: `updated_at` timestamp auto-updates
- **Comments**: Auto-increment/decrement post comment count
- **Likes**: Auto-increment/decrement like counts

### Helper Functions

- `get_followers_count(user_id)` - Get follower count for a user
- `get_following_count(user_id)` - Get following count for a user
- `is_following(follower_id, following_id)` - Check if user A follows user B

### Indexes

Optimized indexes for:
- User lookups (username, id)
- Post feeds (created_at DESC, user_id)
- Comment threads (post_id, created_at)
- Follow relationships (follower_id, following_id)
- Like queries (user_id, post_id, comment_id)

## Database Constraints

- **Username**: 3-30 characters, alphanumeric + underscore
- **Post content**: 1-5000 characters
- **Comment content**: 1-1000 characters
- **No self-follows**: Users cannot follow themselves
- **Unique follows**: Prevents duplicate follow relationships
- **Unique likes**: Prevents duplicate likes on posts/comments
- **Cascading deletes**: Deleting a user removes all their content

## Development Notes

- All IDs use UUID v4 for better distribution
- Timestamps use `TIMESTAMPTZ` for timezone support
- Counters are denormalized for performance (cached)
- Foreign keys have `ON DELETE CASCADE` for data integrity
