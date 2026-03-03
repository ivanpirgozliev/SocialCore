-- Allow posts with image and empty text content
ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS content_length;

ALTER TABLE public.posts
  ADD CONSTRAINT content_length
  CHECK (
    (
      char_length(btrim(content)) >= 1
      AND char_length(content) <= 5000
    )
    OR image_url IS NOT NULL
  );
