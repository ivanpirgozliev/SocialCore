-- ============================================
-- Messaging: RPC to get/create direct conversation (robust against RLS edge cases)
-- Created: 2026-02-12
-- ============================================

CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  me uuid := auth.uid();
  low uuid;
  high uuid;
  conv_id uuid;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF other_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing other_user_id' USING ERRCODE = '22004';
  END IF;

  IF other_user_id = me THEN
    RAISE EXCEPTION 'Cannot create a conversation with yourself' USING ERRCODE = '22023';
  END IF;

  low := LEAST(me, other_user_id);
  high := GREATEST(me, other_user_id);

  INSERT INTO public.conversations (is_group, direct_user_low, direct_user_high)
  VALUES (false, low, high)
  ON CONFLICT (direct_user_low, direct_user_high)
  DO UPDATE SET updated_at = public.conversations.updated_at
  RETURNING id INTO conv_id;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (conv_id, me)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (conv_id, other_user_id)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  RETURN conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_direct_conversation(uuid) TO authenticated;
