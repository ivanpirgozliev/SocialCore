# SocialCore Database Schema Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          DATABASE SCHEMA DIAGRAM                         │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────┐
│         auth.users           │  (Supabase Auth - Built-in)
│──────────────────────────────│
│ • id (UUID) PK               │
│ • email                      │
│ • encrypted_password         │
│ • email_confirmed_at         │
│ • created_at                 │
└──────────────────────────────┘
         │
         │ 1:1
         ▼
┌──────────────────────────────┐
│         profiles             │
│──────────────────────────────│
│ • id (UUID) PK, FK           │◄──┐
│ • username (unique)          │   │
│ • full_name                  │   │
│ • bio                        │   │
│ • avatar_url                 │   │
│ • cover_photo_url            │   │
│ • created_at                 │   │
│ • updated_at                 │   │
└──────────────────────────────┘   │
         │                         │
         │ 1:M                     │
         ▼                         │
┌──────────────────────────────┐   │
│           posts              │   │
│──────────────────────────────│   │
│ • id (UUID) PK               │   │
│ • user_id (UUID) FK ─────────┼───┘
│ • content                    │
│ • image_url                  │
│ • likes_count                │
│ • comments_count             │
│ • shares_count               │
│ • created_at                 │
│ • updated_at                 │
└──────────────────────────────┘
         │
         │ 1:M
         ▼
┌──────────────────────────────┐
│         comments             │
│──────────────────────────────│
│ • id (UUID) PK               │
│ • post_id (UUID) FK          │
│ • user_id (UUID) FK ─────────┼───┐
│ • content                    │   │
│ • likes_count                │   │
│ • created_at                 │   │
│ • updated_at                 │   │
└──────────────────────────────┘   │
                                   │
                                   │
┌──────────────────────────────┐   │
│          follows             │   │
│──────────────────────────────│   │
│ • id (UUID) PK               │   │
│ • follower_id (UUID) FK ─────┼───┤
│ • following_id (UUID) FK ────┼───┤
│ • created_at                 │   │
│                              │   │
│ UNIQUE(follower_id,          │   │
│        following_id)         │   │
└──────────────────────────────┘   │
                                   │
                                   │
┌──────────────────────────────┐   │
│           likes              │   │
│──────────────────────────────│   │
│ • id (UUID) PK               │   │
│ • user_id (UUID) FK ─────────┼───┘
│ • post_id (UUID) FK          │
│ • comment_id (UUID) FK       │
│ • created_at                 │
│                              │
│ CHECK: post_id XOR           │
│        comment_id NOT NULL   │
└──────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                           RELATIONSHIPS                                  │
└─────────────────────────────────────────────────────────────────────────┘

1. profiles ──< posts (one-to-many)
   - One user can create many posts
   - Each post belongs to one user

2. profiles ──< comments (one-to-many)
   - One user can create many comments
   - Each comment belongs to one user

3. posts ──< comments (one-to-many)
   - One post can have many comments
   - Each comment belongs to one post

4. profiles >──< profiles via follows (many-to-many)
   - One user can follow many users
   - One user can be followed by many users

5. profiles ──< likes (one-to-many)
   - One user can create many likes
   - Each like belongs to one user

6. posts ──< likes (one-to-many)
   - One post can have many likes
   - Each like can belong to one post OR one comment (polymorphic)

7. comments ──< likes (one-to-many)
   - One comment can have many likes
   - Each like can belong to one post OR one comment (polymorphic)


┌─────────────────────────────────────────────────────────────────────────┐
│                         INDEXES (Performance)                            │
└─────────────────────────────────────────────────────────────────────────┘

profiles:
  - idx_profiles_username (username)
  - idx_profiles_created_at (created_at DESC)

posts:
  - idx_posts_user_id (user_id)
  - idx_posts_created_at (created_at DESC)
  - idx_posts_likes_count (likes_count DESC)
  - idx_posts_user_created (user_id, created_at DESC)

comments:
  - idx_comments_post_id (post_id)
  - idx_comments_user_id (user_id)
  - idx_comments_created_at (created_at DESC)
  - idx_comments_post_created (post_id, created_at ASC)

follows:
  - idx_follows_follower_id (follower_id)
  - idx_follows_following_id (following_id)
  - idx_follows_created_at (created_at DESC)

likes:
  - idx_likes_user_id (user_id)
  - idx_likes_post_id (post_id WHERE post_id IS NOT NULL)
  - idx_likes_comment_id (comment_id WHERE comment_id IS NOT NULL)
  - idx_likes_created_at (created_at DESC)


┌─────────────────────────────────────────────────────────────────────────┐
│                    KEY FEATURES & CONSTRAINTS                            │
└─────────────────────────────────────────────────────────────────────────┘

✓ Row Level Security (RLS) enabled on all tables
✓ Automatic profile creation on user signup
✓ Cascading deletes (delete user → deletes all their content)
✓ Auto-incrementing counters (likes_count, comments_count)
✓ Unique constraints (username, follow relationships, likes)
✓ Check constraints (no self-follows, content length limits)
✓ Automatic updated_at timestamp updates
✓ Helper functions for follower/following counts
✓ Optimized indexes for common queries
✓ UUID v4 for all primary keys
✓ Timezone-aware timestamps (TIMESTAMPTZ)
```
