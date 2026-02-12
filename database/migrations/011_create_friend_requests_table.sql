-- ============================================
-- SocialCore Database Migration
-- Table: friend_requests
-- Description: Friend requests and accepted friendships
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'friend_request_status') THEN
    CREATE TYPE public.friend_request_status AS ENUM ('pending', 'accepted', 'declined');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.friend_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  addressee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status public.friend_request_status DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT no_self_friend_request CHECK (requester_id <> addressee_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_friend_requests_unique_pair
  ON public.friend_requests (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));

CREATE INDEX IF NOT EXISTS idx_friend_requests_requester_id ON public.friend_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_addressee_id ON public.friend_requests(addressee_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON public.friend_requests(status);

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Friend requests are viewable by participants"
  ON public.friend_requests
  FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users can send friend requests"
  ON public.friend_requests
  FOR INSERT
  WITH CHECK (auth.uid() = requester_id AND requester_id <> addressee_id);

CREATE POLICY "Addressees can update friend requests"
  ON public.friend_requests
  FOR UPDATE
  USING (auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = addressee_id);

CREATE POLICY "Participants can delete friend requests"
  ON public.friend_requests
  FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE TRIGGER set_friend_requests_updated_at
  BEFORE UPDATE ON public.friend_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.friend_requests IS 'Friend requests and accepted friendships';
COMMENT ON COLUMN public.friend_requests.requester_id IS 'User who sent the friend request';
COMMENT ON COLUMN public.friend_requests.addressee_id IS 'User who received the friend request';
COMMENT ON COLUMN public.friend_requests.status IS 'pending, accepted, or declined';
