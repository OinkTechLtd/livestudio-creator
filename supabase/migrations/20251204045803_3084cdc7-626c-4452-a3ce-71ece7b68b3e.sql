-- Add notification settings to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS notification_email BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_new_stream BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_new_content BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_channel_update BOOLEAN DEFAULT true;

-- Create channel members table for channel-specific roles
CREATE TABLE public.channel_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'presenter')),
  invited_by UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- Enable RLS on channel_members
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;

-- RLS policies for channel_members
CREATE POLICY "Channel members viewable by everyone"
ON public.channel_members FOR SELECT
USING (true);

CREATE POLICY "Channel owners can invite members"
ON public.channel_members FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM channels 
    WHERE channels.id = channel_members.channel_id 
    AND channels.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own invitations"
ON public.channel_members FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Channel owners can remove members"
ON public.channel_members FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM channels 
    WHERE channels.id = channel_members.channel_id 
    AND channels.user_id = auth.uid()
  )
  OR user_id = auth.uid()
);

-- Create chat bot messages table
CREATE TABLE public.chat_bot_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  interval_seconds INTEGER NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on chat_bot_messages
ALTER TABLE public.chat_bot_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for chat_bot_messages
CREATE POLICY "Bot messages viewable by everyone"
ON public.chat_bot_messages FOR SELECT
USING (true);

CREATE POLICY "Channel owners can manage bot messages"
ON public.chat_bot_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM channels 
    WHERE channels.id = chat_bot_messages.channel_id 
    AND channels.user_id = auth.uid()
  )
);

CREATE POLICY "Channel owners can update bot messages"
ON public.chat_bot_messages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM channels 
    WHERE channels.id = chat_bot_messages.channel_id 
    AND channels.user_id = auth.uid()
  )
);

CREATE POLICY "Channel owners can delete bot messages"
ON public.chat_bot_messages FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM channels 
    WHERE channels.id = chat_bot_messages.channel_id 
    AND channels.user_id = auth.uid()
  )
);