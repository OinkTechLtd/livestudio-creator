-- Create favorite_channels table for users to save favorite channels
CREATE TABLE public.favorite_channels (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, channel_id)
);

-- Enable RLS
ALTER TABLE public.favorite_channels ENABLE ROW LEVEL SECURITY;

-- RLS policies for favorite channels
CREATE POLICY "Users can view their own favorites"
ON public.favorite_channels
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can add their own favorites"
ON public.favorite_channels
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own favorites"
ON public.favorite_channels
FOR DELETE
USING (auth.uid() = user_id);

-- Add chat settings to channels table for subscriber-only chat
ALTER TABLE public.channels 
ADD COLUMN IF NOT EXISTS chat_subscribers_only BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS chat_subscriber_wait_minutes INTEGER DEFAULT 0;

-- Enable realtime for favorite_channels and reward_redemptions
ALTER PUBLICATION supabase_realtime ADD TABLE public.favorite_channels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reward_redemptions;