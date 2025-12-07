-- Create ad_content table for commercial breaks
CREATE TABLE public.ad_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  duration INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ad_settings table for commercial break intervals
CREATE TABLE public.ad_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE UNIQUE,
  interval_minutes INTEGER NOT NULL DEFAULT 15,
  is_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ad_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for ad_content
CREATE POLICY "Ad content viewable by everyone" ON public.ad_content FOR SELECT USING (true);
CREATE POLICY "Channel owners can manage ad content" ON public.ad_content FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM channels WHERE channels.id = ad_content.channel_id AND channels.user_id = auth.uid())
);
CREATE POLICY "Channel owners can update ad content" ON public.ad_content FOR UPDATE USING (
  EXISTS (SELECT 1 FROM channels WHERE channels.id = ad_content.channel_id AND channels.user_id = auth.uid())
);
CREATE POLICY "Channel owners can delete ad content" ON public.ad_content FOR DELETE USING (
  EXISTS (SELECT 1 FROM channels WHERE channels.id = ad_content.channel_id AND channels.user_id = auth.uid())
);

-- RLS policies for ad_settings
CREATE POLICY "Ad settings viewable by everyone" ON public.ad_settings FOR SELECT USING (true);
CREATE POLICY "Channel owners can manage ad settings" ON public.ad_settings FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM channels WHERE channels.id = ad_settings.channel_id AND channels.user_id = auth.uid())
);
CREATE POLICY "Channel owners can update ad settings" ON public.ad_settings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM channels WHERE channels.id = ad_settings.channel_id AND channels.user_id = auth.uid())
);

-- Add shuffle mode to channel playback state
ALTER TABLE public.channel_playback_state ADD COLUMN IF NOT EXISTS shuffle_mode BOOLEAN DEFAULT false;
ALTER TABLE public.channel_playback_state ADD COLUMN IF NOT EXISTS playlist_order TEXT[] DEFAULT '{}';

-- Enable realtime for ad tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.ad_content;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ad_settings;