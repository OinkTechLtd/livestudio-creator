-- Fix ad_content RLS policies - make them PERMISSIVE instead of RESTRICTIVE
DROP POLICY IF EXISTS "Ad content viewable by everyone" ON public.ad_content;
DROP POLICY IF EXISTS "Channel owners can delete ad content" ON public.ad_content;
DROP POLICY IF EXISTS "Channel owners can manage ad content" ON public.ad_content;
DROP POLICY IF EXISTS "Channel owners can update ad content" ON public.ad_content;

-- Recreate as PERMISSIVE policies (default)
CREATE POLICY "Ad content viewable by everyone" 
ON public.ad_content 
FOR SELECT 
USING (true);

CREATE POLICY "Channel owners can insert ad content" 
ON public.ad_content 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM channels 
  WHERE channels.id = ad_content.channel_id 
  AND channels.user_id = auth.uid()
));

CREATE POLICY "Channel owners can update ad content" 
ON public.ad_content 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM channels 
  WHERE channels.id = ad_content.channel_id 
  AND channels.user_id = auth.uid()
));

CREATE POLICY "Channel owners can delete ad content" 
ON public.ad_content 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM channels 
  WHERE channels.id = ad_content.channel_id 
  AND channels.user_id = auth.uid()
));