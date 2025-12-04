-- Таблица баллов пользователей за канал
CREATE TABLE public.channel_points (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 0,
  total_watch_time integer NOT NULL DEFAULT 0,
  messages_sent integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

ALTER TABLE public.channel_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Points viewable by everyone" ON public.channel_points
FOR SELECT USING (true);

CREATE POLICY "Users can update own points" ON public.channel_points
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can insert points" ON public.channel_points
FOR INSERT WITH CHECK (true);

-- Таблица наград канала
CREATE TABLE public.channel_rewards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  cost integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.channel_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rewards viewable by everyone" ON public.channel_rewards
FOR SELECT USING (true);

CREATE POLICY "Channel owners can manage rewards" ON public.channel_rewards
FOR INSERT WITH CHECK (EXISTS (
  SELECT 1 FROM channels WHERE channels.id = channel_rewards.channel_id AND channels.user_id = auth.uid()
));

CREATE POLICY "Channel owners can update rewards" ON public.channel_rewards
FOR UPDATE USING (EXISTS (
  SELECT 1 FROM channels WHERE channels.id = channel_rewards.channel_id AND channels.user_id = auth.uid()
));

CREATE POLICY "Channel owners can delete rewards" ON public.channel_rewards
FOR DELETE USING (EXISTS (
  SELECT 1 FROM channels WHERE channels.id = channel_rewards.channel_id AND channels.user_id = auth.uid()
));

-- Таблица выкупленных наград
CREATE TABLE public.reward_redemptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reward_id uuid NOT NULL REFERENCES public.channel_rewards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own redemptions" ON public.reward_redemptions
FOR SELECT USING (auth.uid() = user_id OR EXISTS (
  SELECT 1 FROM channels WHERE channels.id = reward_redemptions.channel_id AND channels.user_id = auth.uid()
));

CREATE POLICY "Users can redeem rewards" ON public.reward_redemptions
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Channel owners can update redemptions" ON public.reward_redemptions
FOR UPDATE USING (EXISTS (
  SELECT 1 FROM channels WHERE channels.id = reward_redemptions.channel_id AND channels.user_id = auth.uid()
));

-- Таблица активных зрителей (для подсчёта онлайн)
CREATE TABLE public.channel_viewers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  last_seen timestamp with time zone NOT NULL DEFAULT now(),
  joined_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.channel_viewers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Viewers viewable by everyone" ON public.channel_viewers
FOR SELECT USING (true);

CREATE POLICY "Anyone can insert viewer" ON public.channel_viewers
FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own viewer status" ON public.channel_viewers
FOR UPDATE USING (true);

CREATE POLICY "Users can delete own viewer status" ON public.channel_viewers
FOR DELETE USING (true);

-- Таблица синхронизации видео
CREATE TABLE public.channel_playback_state (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE UNIQUE,
  current_media_id uuid REFERENCES public.media_content(id) ON DELETE SET NULL,
  current_position integer NOT NULL DEFAULT 0,
  is_playing boolean NOT NULL DEFAULT true,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.channel_playback_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Playback state viewable by everyone" ON public.channel_playback_state
FOR SELECT USING (true);

CREATE POLICY "Channel owners can manage playback" ON public.channel_playback_state
FOR INSERT WITH CHECK (EXISTS (
  SELECT 1 FROM channels WHERE channels.id = channel_playback_state.channel_id AND channels.user_id = auth.uid()
));

CREATE POLICY "Channel owners can update playback" ON public.channel_playback_state
FOR UPDATE USING (EXISTS (
  SELECT 1 FROM channels WHERE channels.id = channel_playback_state.channel_id AND channels.user_id = auth.uid()
));

-- Добавляем realtime для новых таблиц
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_viewers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_playback_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_bot_messages;