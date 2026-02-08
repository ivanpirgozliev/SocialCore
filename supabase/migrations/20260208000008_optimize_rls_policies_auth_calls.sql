-- ============================================
-- SocialCore Database Migration
-- Optimize RLS policies by avoiding per-row auth.* evaluations
--
-- Supabase Advisor (Performance): "Auth RLS Initialization Plan"
-- Fix: wrap auth.* calls in a scalar subquery so they are evaluated once per statement.
-- Example: (select auth.uid()) instead of auth.uid()
-- ============================================

DO $$
BEGIN
  -- =====================
  -- profiles
  -- =====================
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND policyname = 'Users can insert their own profile'
  ) THEN
    EXECUTE 'ALTER POLICY "Users can insert their own profile" ON public.profiles '
         || 'WITH CHECK ((select auth.uid()) = id)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND policyname = 'Users can update their own profile'
  ) THEN
    EXECUTE 'ALTER POLICY "Users can update their own profile" ON public.profiles '
         || 'USING ((select auth.uid()) = id) '
         || 'WITH CHECK ((select auth.uid()) = id)';
  END IF;

  -- =====================
  -- posts
  -- =====================
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'posts'
      AND policyname = 'Authenticated users can create posts'
  ) THEN
    EXECUTE 'ALTER POLICY "Authenticated users can create posts" ON public.posts '
         || 'WITH CHECK ((select auth.uid()) = user_id)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'posts'
      AND policyname = 'Users can update their own posts'
  ) THEN
    EXECUTE 'ALTER POLICY "Users can update their own posts" ON public.posts '
         || 'USING ((select auth.uid()) = user_id) '
         || 'WITH CHECK ((select auth.uid()) = user_id)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'posts'
      AND policyname = 'Users can delete their own posts'
  ) THEN
    EXECUTE 'ALTER POLICY "Users can delete their own posts" ON public.posts '
         || 'USING ((select auth.uid()) = user_id)';
  END IF;

  -- =====================
  -- comments
  -- =====================
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'comments'
      AND policyname = 'Authenticated users can create comments'
  ) THEN
    EXECUTE 'ALTER POLICY "Authenticated users can create comments" ON public.comments '
         || 'WITH CHECK ((select auth.uid()) = user_id)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'comments'
      AND policyname = 'Users can update their own comments'
  ) THEN
    EXECUTE 'ALTER POLICY "Users can update their own comments" ON public.comments '
         || 'USING ((select auth.uid()) = user_id) '
         || 'WITH CHECK ((select auth.uid()) = user_id)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'comments'
      AND policyname = 'Users can delete their own comments'
  ) THEN
    EXECUTE 'ALTER POLICY "Users can delete their own comments" ON public.comments '
         || 'USING ((select auth.uid()) = user_id)';
  END IF;

  -- =====================
  -- follows
  -- =====================
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'follows'
      AND policyname = 'Users can follow others'
  ) THEN
    EXECUTE 'ALTER POLICY "Users can follow others" ON public.follows '
         || 'WITH CHECK ((select auth.uid()) = follower_id)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'follows'
      AND policyname = 'Users can unfollow others'
  ) THEN
    EXECUTE 'ALTER POLICY "Users can unfollow others" ON public.follows '
         || 'USING ((select auth.uid()) = follower_id)';
  END IF;

  -- =====================
  -- likes
  -- =====================
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'likes'
      AND policyname = 'Authenticated users can like'
  ) THEN
    EXECUTE 'ALTER POLICY "Authenticated users can like" ON public.likes '
         || 'WITH CHECK ((select auth.uid()) = user_id)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'likes'
      AND policyname = 'Users can unlike'
  ) THEN
    EXECUTE 'ALTER POLICY "Users can unlike" ON public.likes '
         || 'USING ((select auth.uid()) = user_id)';
  END IF;
END $$;
