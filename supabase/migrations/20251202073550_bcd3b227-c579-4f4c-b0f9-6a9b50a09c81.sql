-- Create channel_moderators table
CREATE TABLE public.channel_moderators (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- Enable RLS
ALTER TABLE public.channel_moderators ENABLE ROW LEVEL SECURITY;

-- Everyone can see moderators
CREATE POLICY "Moderators are viewable by everyone"
ON public.channel_moderators
FOR SELECT
USING (true);

-- Channel owners can add moderators
CREATE POLICY "Channel owners can add moderators"
ON public.channel_moderators
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM channels 
    WHERE channels.id = channel_moderators.channel_id 
    AND channels.user_id = auth.uid()
  )
);

-- Channel owners can remove moderators
CREATE POLICY "Channel owners can remove moderators"
ON public.channel_moderators
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM channels 
    WHERE channels.id = channel_moderators.channel_id 
    AND channels.user_id = auth.uid()
  )
);

-- Enable realtime for chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_moderators;