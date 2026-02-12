-- ============================================
-- SocialCore Database Migration
-- Allow read access to accepted friend requests for mutual counts
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'friend_requests'
      AND policyname = 'Accepted friend requests are viewable by everyone'
  ) THEN
    CREATE POLICY "Accepted friend requests are viewable by everyone"
      ON public.friend_requests
      FOR SELECT
      USING (status = 'accepted');
  END IF;
END $$;
