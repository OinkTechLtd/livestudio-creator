
-- Add paid_only flag to channels so owners can restrict content
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS paid_only boolean DEFAULT false;

-- Add RLS policy for chat_messages INSERT that blocks banned users at DB level
CREATE OR REPLACE FUNCTION public.check_chat_not_blocked()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.chat_blocked_users
    WHERE channel_id = NEW.channel_id
      AND user_id = NEW.user_id
      AND (ban_expires_at IS NULL OR ban_expires_at > now())
  ) THEN
    RAISE EXCEPTION 'User is blocked from this chat';
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to enforce chat blocks at DB level
DROP TRIGGER IF EXISTS enforce_chat_block ON public.chat_messages;
CREATE TRIGGER enforce_chat_block
  BEFORE INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.check_chat_not_blocked();

-- Create channel_clips table for Twitch-style clips
CREATE TABLE IF NOT EXISTS public.channel_clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  clip_url text NOT NULL,
  thumbnail_url text,
  duration integer DEFAULT 30,
  views integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.channel_clips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clips viewable by everyone"
  ON public.channel_clips FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create clips"
  ON public.channel_clips FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own clips"
  ON public.channel_clips FOR DELETE
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM channels WHERE channels.id = channel_clips.channel_id AND channels.user_id = auth.uid()
  ));
