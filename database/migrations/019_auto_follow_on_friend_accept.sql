-- ============================================
-- SocialCore Database Migration
-- Auto-follow on accepted friendship
-- Description: Ensure accepted friends follow each other automatically
-- ============================================

CREATE OR REPLACE FUNCTION public.sync_friendship_follows()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'accepted' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'accepted' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.follows (follower_id, following_id)
  VALUES (NEW.requester_id, NEW.addressee_id)
  ON CONFLICT (follower_id, following_id) DO NOTHING;

  INSERT INTO public.follows (follower_id, following_id)
  VALUES (NEW.addressee_id, NEW.requester_id)
  ON CONFLICT (follower_id, following_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_friendship_follows_on_accept ON public.friend_requests;

CREATE TRIGGER sync_friendship_follows_on_accept
  AFTER INSERT OR UPDATE OF status ON public.friend_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_friendship_follows();

COMMENT ON FUNCTION public.sync_friendship_follows() IS
  'Creates mutual follow records when a friend request becomes accepted.';
