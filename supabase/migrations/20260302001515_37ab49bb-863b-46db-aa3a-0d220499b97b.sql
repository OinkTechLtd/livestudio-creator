
-- Fix 1: Allow users to see their own block records (so fetchChatSettings works)
CREATE POLICY "Users can see their own blocks"
  ON public.chat_blocked_users
  FOR SELECT
  USING (auth.uid() = user_id);

-- Fix 2: Allow everyone to see active premium subscriptions for badge display
CREATE POLICY "Everyone can see active premium subs for badges"
  ON public.user_premium_subscriptions
  FOR SELECT
  USING (expires_at > now());
