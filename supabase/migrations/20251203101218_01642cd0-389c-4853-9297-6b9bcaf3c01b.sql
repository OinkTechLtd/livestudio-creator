-- Add donation_url to channels
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS donation_url text;

-- Add source_type and source_url to media_content for external links
ALTER TABLE public.media_content ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'upload';
ALTER TABLE public.media_content ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE public.media_content ADD COLUMN IF NOT EXISTS start_time time;
ALTER TABLE public.media_content ADD COLUMN IF NOT EXISTS end_time time;

-- Create chat_blocked_users table
CREATE TABLE IF NOT EXISTS public.chat_blocked_users (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- Create pinned_messages table
CREATE TABLE IF NOT EXISTS public.pinned_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  pinned_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(channel_id)
);

-- Create channel_schedule table
CREATE TABLE IF NOT EXISTS public.channel_schedule (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  source_type text DEFAULT 'media',
  source_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pinned_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_schedule ENABLE ROW LEVEL SECURITY;

-- RLS for chat_blocked_users
CREATE POLICY "Blocked users viewable by channel owner and mods" ON public.chat_blocked_users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM channels WHERE channels.id = chat_blocked_users.channel_id AND channels.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM channel_moderators WHERE channel_moderators.channel_id = chat_blocked_users.channel_id AND channel_moderators.user_id = auth.uid())
  );

CREATE POLICY "Channel owner and mods can block users" ON public.chat_blocked_users
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM channels WHERE channels.id = chat_blocked_users.channel_id AND channels.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM channel_moderators WHERE channel_moderators.channel_id = chat_blocked_users.channel_id AND channel_moderators.user_id = auth.uid())
  );

CREATE POLICY "Channel owner and mods can unblock users" ON public.chat_blocked_users
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM channels WHERE channels.id = chat_blocked_users.channel_id AND channels.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM channel_moderators WHERE channel_moderators.channel_id = chat_blocked_users.channel_id AND channel_moderators.user_id = auth.uid())
  );

-- RLS for pinned_messages
CREATE POLICY "Pinned messages viewable by everyone" ON public.pinned_messages
  FOR SELECT USING (true);

CREATE POLICY "Channel owner and mods can pin messages" ON public.pinned_messages
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM channels WHERE channels.id = pinned_messages.channel_id AND channels.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM channel_moderators WHERE channel_moderators.channel_id = pinned_messages.channel_id AND channel_moderators.user_id = auth.uid())
  );

CREATE POLICY "Channel owner and mods can unpin messages" ON public.pinned_messages
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM channels WHERE channels.id = pinned_messages.channel_id AND channels.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM channel_moderators WHERE channel_moderators.channel_id = pinned_messages.channel_id AND channel_moderators.user_id = auth.uid())
  );

-- RLS for channel_schedule
CREATE POLICY "Schedule viewable by everyone" ON public.channel_schedule
  FOR SELECT USING (true);

CREATE POLICY "Channel owners can manage schedule" ON public.channel_schedule
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM channels WHERE channels.id = channel_schedule.channel_id AND channels.user_id = auth.uid())
  );

CREATE POLICY "Channel owners can update schedule" ON public.channel_schedule
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM channels WHERE channels.id = channel_schedule.channel_id AND channels.user_id = auth.uid())
  );

CREATE POLICY "Channel owners can delete schedule" ON public.channel_schedule
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM channels WHERE channels.id = channel_schedule.channel_id AND channels.user_id = auth.uid())
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pinned_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_blocked_users;