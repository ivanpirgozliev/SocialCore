-- ============================================
-- SocialCore Database Migration
-- Messaging: unread counts RPC
-- ============================================

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_my_unread_counts'
  ) THEN
    EXECUTE $sql$
      CREATE FUNCTION public.get_my_unread_counts()
      RETURNS TABLE(unread_conversations integer, unread_messages integer)
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public
      AS $fn$
        WITH me AS (
          SELECT auth.uid() AS uid
        ),
        my_participants AS (
          SELECT cp.conversation_id, cp.last_read_at
          FROM public.conversation_participants cp
          JOIN me ON cp.user_id = me.uid
        ),
        per_conversation AS (
          SELECT
            m.conversation_id,
            COUNT(*) FILTER (WHERE m.sender_id <> (SELECT uid FROM me))::int AS unread_messages
          FROM public.messages m
          JOIN my_participants cp ON cp.conversation_id = m.conversation_id
          WHERE m.created_at > cp.last_read_at
          GROUP BY m.conversation_id
        )
        SELECT
          COUNT(*) FILTER (WHERE per_conversation.unread_messages > 0)::int AS unread_conversations,
          COALESCE(SUM(per_conversation.unread_messages), 0)::int AS unread_messages
        FROM per_conversation;
      $fn$;
    $sql$;
  END IF;
END
$do$;

GRANT EXECUTE ON FUNCTION public.get_my_unread_counts() TO authenticated;
