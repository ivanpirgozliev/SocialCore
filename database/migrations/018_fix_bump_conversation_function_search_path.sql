-- Fix Supabase advisor warning: Function Search Path Mutable
-- Ensure SECURITY DEFINER trigger function has an explicit, safe search_path

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM pg_proc p
		JOIN pg_namespace n ON n.oid = p.pronamespace
		WHERE n.nspname = 'public' AND p.proname = 'bump_conversation_updated_at'
	) THEN
		EXECUTE 'ALTER FUNCTION public.bump_conversation_updated_at() SET search_path = public';
	END IF;
END $$;
