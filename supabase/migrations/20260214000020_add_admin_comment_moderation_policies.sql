-- ============================================
-- SocialCore Database Migration
-- Add admin moderation policies for comments
-- Description: Allow admins to update/delete any comment while keeping owner policies
-- ============================================

DROP POLICY IF EXISTS "Admins can update all comments" ON public.comments;
DROP POLICY IF EXISTS "Admins can delete all comments" ON public.comments;

CREATE POLICY "Admins can update all comments"
  ON public.comments
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete all comments"
  ON public.comments
  FOR DELETE
  USING (public.is_admin());
