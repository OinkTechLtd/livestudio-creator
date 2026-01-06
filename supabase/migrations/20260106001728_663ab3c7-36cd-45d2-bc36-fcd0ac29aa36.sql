-- Add is_hidden column to channels for report system
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS hidden_reason text;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS hidden_at timestamp with time zone;

-- Add is_verified column to reports to track AI-verified reports
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone;

-- Create appeals table for channel appeals
CREATE TABLE IF NOT EXISTS public.channel_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  reason text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  ai_decision text,
  created_at timestamp with time zone DEFAULT now(),
  resolved_at timestamp with time zone
);

-- Enable RLS on appeals
ALTER TABLE public.channel_appeals ENABLE ROW LEVEL SECURITY;

-- Appeals policies
CREATE POLICY "Channel owners can view their appeals" ON public.channel_appeals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Channel owners can create appeals" ON public.channel_appeals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add deleted_messages table for moderation
CREATE TABLE IF NOT EXISTS public.deleted_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  message_id uuid NOT NULL,
  message_content text NOT NULL,
  author_id uuid NOT NULL,
  deleted_by uuid NOT NULL,
  deleted_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.deleted_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Channel owners and moderators can view deleted messages" ON public.deleted_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM channels WHERE id = deleted_messages.channel_id AND user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM channel_moderators WHERE channel_id = deleted_messages.channel_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Moderators can insert deleted messages" ON public.deleted_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM channels WHERE id = deleted_messages.channel_id AND user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM channel_moderators WHERE channel_id = deleted_messages.channel_id AND user_id = auth.uid()
    )
  );

-- Add ban_expires_at to chat_blocked_users for timed bans
ALTER TABLE public.chat_blocked_users ADD COLUMN IF NOT EXISTS ban_expires_at timestamp with time zone;
ALTER TABLE public.chat_blocked_users ADD COLUMN IF NOT EXISTS ban_reason text;

-- Add role colors to channel_members for chat display
ALTER TABLE public.channel_members ADD COLUMN IF NOT EXISTS chat_color text;

-- Create user theme preferences table
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL,
  theme text DEFAULT 'default',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their preferences" ON public.user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their preferences" ON public.user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their preferences" ON public.user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- Update RLS for reports to track verified reports count
CREATE OR REPLACE FUNCTION public.get_verified_reports_count(p_channel_id uuid, p_days integer DEFAULT 7)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.reports
  WHERE channel_id = p_channel_id
    AND is_verified = true
    AND created_at > NOW() - (p_days || ' days')::interval;
$$;