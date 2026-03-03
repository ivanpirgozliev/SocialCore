-- Message reactions (single reaction per user per message)
CREATE TABLE IF NOT EXISTS public.message_reactions (
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (message_id, user_id),
  CONSTRAINT message_reaction_type_check CHECK (reaction_type IN ('like', 'love', 'haha', 'wow', 'sad', 'angry'))
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON public.message_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON public.message_reactions(message_id);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='message_reactions' AND policyname='Message reactions are viewable by conversation participants'
  ) THEN
    CREATE POLICY "Message reactions are viewable by conversation participants"
      ON public.message_reactions
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.messages m
          JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id
          WHERE m.id = public.message_reactions.message_id
            AND cp.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='message_reactions' AND policyname='Participants can add their own message reactions'
  ) THEN
    CREATE POLICY "Participants can add their own message reactions"
      ON public.message_reactions
      FOR INSERT
      WITH CHECK (
        auth.uid() = public.message_reactions.user_id
        AND EXISTS (
          SELECT 1
          FROM public.messages m
          JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id
          WHERE m.id = public.message_reactions.message_id
            AND cp.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='message_reactions' AND policyname='Users can update their own message reactions'
  ) THEN
    CREATE POLICY "Users can update their own message reactions"
      ON public.message_reactions
      FOR UPDATE
      USING (auth.uid() = public.message_reactions.user_id)
      WITH CHECK (auth.uid() = public.message_reactions.user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='message_reactions' AND policyname='Users can delete their own message reactions'
  ) THEN
    CREATE POLICY "Users can delete their own message reactions"
      ON public.message_reactions
      FOR DELETE
      USING (auth.uid() = public.message_reactions.user_id);
  END IF;
END
$do$;
