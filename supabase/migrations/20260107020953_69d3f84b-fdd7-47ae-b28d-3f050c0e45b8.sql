
-- Premium Subscriptions System (за баллы)
CREATE TABLE public.premium_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cost INTEGER NOT NULL DEFAULT 100,
  duration_days INTEGER NOT NULL DEFAULT 30,
  badge_emoji TEXT DEFAULT '⭐',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.premium_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Premium subs viewable by everyone" ON public.premium_subscriptions FOR SELECT USING (true);
CREATE POLICY "Channel owners can manage premium subs" ON public.premium_subscriptions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM channels WHERE channels.id = premium_subscriptions.channel_id AND channels.user_id = auth.uid())
);
CREATE POLICY "Channel owners can update premium subs" ON public.premium_subscriptions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM channels WHERE channels.id = premium_subscriptions.channel_id AND channels.user_id = auth.uid())
);
CREATE POLICY "Channel owners can delete premium subs" ON public.premium_subscriptions FOR DELETE USING (
  EXISTS (SELECT 1 FROM channels WHERE channels.id = premium_subscriptions.channel_id AND channels.user_id = auth.uid())
);

-- User premium subscriptions (purchased)
CREATE TABLE public.user_premium_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.premium_subscriptions(id) ON DELETE CASCADE,
  purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  granted_by UUID REFERENCES auth.users(id),
  is_manual_grant BOOLEAN DEFAULT false
);

ALTER TABLE public.user_premium_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can view own premium subs" ON public.user_premium_subscriptions FOR SELECT USING (
  auth.uid() = user_id OR 
  EXISTS (SELECT 1 FROM channels WHERE channels.id = user_premium_subscriptions.channel_id AND channels.user_id = auth.uid())
);
CREATE POLICY "Users can purchase premium subs" ON public.user_premium_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id OR 
  EXISTS (SELECT 1 FROM channels WHERE channels.id = user_premium_subscriptions.channel_id AND channels.user_id = auth.uid())
);
CREATE POLICY "Channel owners can update user subs" ON public.user_premium_subscriptions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM channels WHERE channels.id = user_premium_subscriptions.channel_id AND channels.user_id = auth.uid())
);

-- Subscriber badge settings per channel
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS subscriber_badge TEXT DEFAULT '⭐';

-- Roulette Prizes System
CREATE TABLE public.roulette_prizes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  prize_type TEXT NOT NULL DEFAULT 'internal', -- 'internal', 'partner_api', 'promocode'
  prize_value TEXT, -- Points amount, API endpoint, or static promocode
  chance_percent NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.roulette_prizes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Prizes viewable by everyone" ON public.roulette_prizes FOR SELECT USING (true);
CREATE POLICY "Channel owners can manage prizes" ON public.roulette_prizes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM channels WHERE channels.id = roulette_prizes.channel_id AND channels.user_id = auth.uid())
);
CREATE POLICY "Channel owners can update prizes" ON public.roulette_prizes FOR UPDATE USING (
  EXISTS (SELECT 1 FROM channels WHERE channels.id = roulette_prizes.channel_id AND channels.user_id = auth.uid())
);
CREATE POLICY "Channel owners can delete prizes" ON public.roulette_prizes FOR DELETE USING (
  EXISTS (SELECT 1 FROM channels WHERE channels.id = roulette_prizes.channel_id AND channels.user_id = auth.uid())
);

-- Roulette Spins History
CREATE TABLE public.roulette_spins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  prize_id UUID REFERENCES public.roulette_prizes(id) ON DELETE SET NULL,
  prize_title TEXT NOT NULL,
  promocode TEXT,
  spun_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  cost_points INTEGER NOT NULL DEFAULT 500,
  was_free BOOLEAN DEFAULT false
);

ALTER TABLE public.roulette_spins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own spins" ON public.roulette_spins FOR SELECT USING (
  auth.uid() = user_id OR 
  EXISTS (SELECT 1 FROM channels WHERE channels.id = roulette_spins.channel_id AND channels.user_id = auth.uid())
);
CREATE POLICY "Users can spin" ON public.roulette_spins FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Free spin tracking
CREATE TABLE public.free_spin_claims (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  claimed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.free_spin_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own claims" ON public.free_spin_claims FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can claim free spin" ON public.free_spin_claims FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Partner API Keys for external prize providers
CREATE TABLE public.partner_api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  partner_name TEXT NOT NULL,
  api_key TEXT NOT NULL,
  api_endpoint TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Channel owners can view API keys" ON public.partner_api_keys FOR SELECT USING (
  EXISTS (SELECT 1 FROM channels WHERE channels.id = partner_api_keys.channel_id AND channels.user_id = auth.uid())
);
CREATE POLICY "Channel owners can manage API keys" ON public.partner_api_keys FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM channels WHERE channels.id = partner_api_keys.channel_id AND channels.user_id = auth.uid())
);
CREATE POLICY "Channel owners can update API keys" ON public.partner_api_keys FOR UPDATE USING (
  EXISTS (SELECT 1 FROM channels WHERE channels.id = partner_api_keys.channel_id AND channels.user_id = auth.uid())
);
CREATE POLICY "Channel owners can delete API keys" ON public.partner_api_keys FOR DELETE USING (
  EXISTS (SELECT 1 FROM channels WHERE channels.id = partner_api_keys.channel_id AND channels.user_id = auth.uid())
);

-- Enable realtime for premium subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_premium_subscriptions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.roulette_spins;
