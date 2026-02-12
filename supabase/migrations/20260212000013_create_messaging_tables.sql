-- ============================================
-- SocialCore Database Migration
-- Messaging: conversations, participants, messages
-- ============================================

-- Conversations table (supports direct 1:1 via direct_user_low/high)
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  is_group BOOLEAN DEFAULT FALSE NOT NULL,
  direct_user_low UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  direct_user_high UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT direct_users_distinct CHECK (direct_user_low IS NULL OR direct_user_high IS NULL OR direct_user_low <> direct_user_high)
);

-- Enforce unique direct 1:1 pair (when direct fields are set)
CREATE UNIQUE INDEX IF NOT EXISTS ux_conversations_direct_pair
  ON public.conversations(direct_user_low, direct_user_high)
  WHERE direct_user_low IS NOT NULL AND direct_user_high IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON public.conversations(updated_at DESC);

-- Participants table
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_read_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_participants_user ON public.conversation_participants(user_id);

-- Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT message_body_length CHECK (char_length(body) >= 1 AND char_length(body) <= 5000)
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON public.messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);

-- Enable Row Level Security
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Trigger function: bump conversation updated_at on new message
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'bump_conversation_updated_at'
  ) THEN
    EXECUTE $sql$
      CREATE FUNCTION public.bump_conversation_updated_at()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $fn$
      BEGIN
        UPDATE public.conversations
          SET updated_at = NOW()
          WHERE id = NEW.conversation_id;
        RETURN NEW;
      END;
      $fn$;
    $sql$;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'messages'
      AND t.tgname = 'trg_bump_conversation_updated_at'
  ) THEN
    EXECUTE 'CREATE TRIGGER trg_bump_conversation_updated_at AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.bump_conversation_updated_at()';
  END IF;
END
$do$;

-- RLS Policies (idempotent via pg_policies checks)
DO $do$
BEGIN
  -- conversations
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='conversations' AND policyname='Conversations are viewable by participants'
  ) THEN
    CREATE POLICY "Conversations are viewable by participants"
      ON public.conversations
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.conversation_participants cp
          WHERE cp.conversation_id = public.conversations.id
            AND cp.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='conversations' AND policyname='Authenticated users can create conversations'
  ) THEN
    CREATE POLICY "Authenticated users can create conversations"
      ON public.conversations
      FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='conversations' AND policyname='Participants can update conversations'
  ) THEN
    CREATE POLICY "Participants can update conversations"
      ON public.conversations
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.conversation_participants cp
          WHERE cp.conversation_id = public.conversations.id
            AND cp.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.conversation_participants cp
          WHERE cp.conversation_id = public.conversations.id
            AND cp.user_id = auth.uid()
        )
      );
  END IF;

  -- conversation_participants
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='conversation_participants' AND policyname='Participants are viewable by conversation participants'
  ) THEN
    CREATE POLICY "Participants are viewable by conversation participants"
      ON public.conversation_participants
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.conversation_participants cp
          WHERE cp.conversation_id = public.conversation_participants.conversation_id
            AND cp.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='conversation_participants' AND policyname='Users can add participants to their conversations'
  ) THEN
    CREATE POLICY "Users can add participants to their conversations"
      ON public.conversation_participants
      FOR INSERT
      WITH CHECK (
        auth.uid() = public.conversation_participants.user_id
        OR EXISTS (
          SELECT 1 FROM public.conversation_participants cp
          WHERE cp.conversation_id = public.conversation_participants.conversation_id
            AND cp.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='conversation_participants' AND policyname='Users can update their own participant row'
  ) THEN
    CREATE POLICY "Users can update their own participant row"
      ON public.conversation_participants
      FOR UPDATE
      USING (auth.uid() = public.conversation_participants.user_id)
      WITH CHECK (auth.uid() = public.conversation_participants.user_id);
  END IF;

  -- messages
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='messages' AND policyname='Messages are viewable by conversation participants'
  ) THEN
    CREATE POLICY "Messages are viewable by conversation participants"
      ON public.messages
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.conversation_participants cp
          WHERE cp.conversation_id = public.messages.conversation_id
            AND cp.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='messages' AND policyname='Participants can send messages'
  ) THEN
    CREATE POLICY "Participants can send messages"
      ON public.messages
      FOR INSERT
      WITH CHECK (
        auth.uid() = public.messages.sender_id
        AND EXISTS (
          SELECT 1 FROM public.conversation_participants cp
          WHERE cp.conversation_id = public.messages.conversation_id
            AND cp.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='messages' AND policyname='Users can delete their own messages'
  ) THEN
    CREATE POLICY "Users can delete their own messages"
      ON public.messages
      FOR DELETE
      USING (auth.uid() = public.messages.sender_id);
  END IF;
END
$do$;

COMMENT ON TABLE public.conversations IS 'Message conversations (direct and group)';
COMMENT ON TABLE public.conversation_participants IS 'Participants in a conversation';
COMMENT ON TABLE public.messages IS 'Messages sent within a conversation';
