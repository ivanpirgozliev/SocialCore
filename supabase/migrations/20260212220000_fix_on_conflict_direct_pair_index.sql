-- ============================================
-- Fix ON CONFLICT for direct conversations
-- Created: 2026-02-12
-- ============================================
-- Supabase client uses on_conflict=direct_user_low,direct_user_high for upsert.
-- PostgREST can fail to infer partial unique indexes for ON CONFLICT.
-- Solution: replace partial unique index with a non-partial UNIQUE index.

DO $do$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname='public'
      AND tablename='conversations'
      AND indexname='ux_conversations_direct_pair'
  ) THEN
    EXECUTE 'DROP INDEX public.ux_conversations_direct_pair';
  END IF;
END
$do$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_conversations_direct_pair
  ON public.conversations (direct_user_low, direct_user_high);
