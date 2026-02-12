-- ============================================
-- Migration 015: Fix infinite recursion in conversation_participants RLS
-- Created: 2026-02-12
-- ============================================
-- The SELECT policy on conversation_participants was self-referencing,
-- causing PostgreSQL error: "infinite recursion detected in policy for
-- relation conversation_participants".
-- Fix: Use a SECURITY DEFINER helper function that bypasses RLS.
-- ============================================

-- Helper: check if current user is a member of a conversation (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_conversation_member(conv_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = conv_id AND user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid) TO authenticated;

-- ==================
-- conversation_participants policies (drop + recreate)
-- ==================
DROP POLICY IF EXISTS "Participants are viewable by conversation participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can add participants to their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can update their own participant row" ON public.conversation_participants;

CREATE POLICY "Participants are viewable by conversation members"
  ON public.conversation_participants FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_conversation_member(conversation_id)
  );

CREATE POLICY "Users can add participants to their conversations"
  ON public.conversation_participants FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_conversation_member(conversation_id)
  );

CREATE POLICY "Users can update their own participant row"
  ON public.conversation_participants FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ==================
-- conversations policies (drop + recreate to use the helper)
-- ==================
DROP POLICY IF EXISTS "Conversations are viewable by participants" ON public.conversations;
DROP POLICY IF EXISTS "Participants can update conversations" ON public.conversations;

CREATE POLICY "Conversations are viewable by participants"
  ON public.conversations FOR SELECT
  USING (public.is_conversation_member(id));

CREATE POLICY "Participants can update conversations"
  ON public.conversations FOR UPDATE
  USING (public.is_conversation_member(id))
  WITH CHECK (public.is_conversation_member(id));

-- ==================
-- messages policies (drop + recreate to use the helper)
-- ==================
DROP POLICY IF EXISTS "Messages are viewable by conversation participants" ON public.messages;
DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;

CREATE POLICY "Messages are viewable by conversation members"
  ON public.messages FOR SELECT
  USING (public.is_conversation_member(conversation_id));

CREATE POLICY "Participants can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_conversation_member(conversation_id)
  );
