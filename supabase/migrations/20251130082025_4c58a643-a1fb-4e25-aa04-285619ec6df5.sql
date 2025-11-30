-- Fix storage policies for media uploads and thumbnails

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload media" ON storage.objects;
DROP POLICY IF EXISTS "Media is publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own media" ON storage.objects;

DROP POLICY IF EXISTS "Users can upload thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Thumbnails are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own thumbnails" ON storage.objects;

-- Media uploads bucket policies
CREATE POLICY "Users can upload media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'media-uploads' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Media is publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'media-uploads');

CREATE POLICY "Users can update own media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'media-uploads' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'media-uploads' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Channel thumbnails bucket policies
CREATE POLICY "Users can upload thumbnails"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'channel-thumbnails' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Thumbnails are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'channel-thumbnails');

CREATE POLICY "Users can update own thumbnails"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'channel-thumbnails' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own thumbnails"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'channel-thumbnails' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Function to get user storage usage
CREATE OR REPLACE FUNCTION public.get_user_storage_usage(user_uuid uuid)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT COALESCE(SUM((metadata->>'size')::bigint), 0)
  FROM storage.objects
  WHERE bucket_id = 'media-uploads'
  AND (storage.foldername(name))[1] = user_uuid::text;
$$;