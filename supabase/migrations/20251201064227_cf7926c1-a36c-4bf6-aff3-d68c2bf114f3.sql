-- Create chat_messages table for live chat
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for chat_messages
CREATE POLICY "Chat messages are viewable by everyone"
  ON public.chat_messages
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can send messages"
  ON public.chat_messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages"
  ON public.chat_messages
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_id ON public.chat_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at DESC);

-- Enable realtime for chat_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Create channel_categories table
CREATE TABLE IF NOT EXISTS public.channel_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add category_id to channels
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.channel_categories(id) ON DELETE SET NULL;

-- Insert default categories
INSERT INTO public.channel_categories (name, description) VALUES
  ('Музыка', 'Музыкальные каналы и радиостанции'),
  ('Новости', 'Новостные каналы'),
  ('Развлечения', 'Развлекательный контент'),
  ('Спорт', 'Спортивные трансляции'),
  ('Образование', 'Образовательный контент'),
  ('Игры', 'Игровой контент'),
  ('Технологии', 'Технологии и наука'),
  ('Другое', 'Прочие каналы')
ON CONFLICT (name) DO NOTHING;

-- RLS for channel_categories
ALTER TABLE public.channel_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories are viewable by everyone"
  ON public.channel_categories
  FOR SELECT
  USING (true);