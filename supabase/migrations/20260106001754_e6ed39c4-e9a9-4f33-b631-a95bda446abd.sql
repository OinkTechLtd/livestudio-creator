-- Allow channel owners and moderators to delete any message in their channel
CREATE POLICY "Channel owners and moderators can delete messages" ON public.chat_messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM channels WHERE id = chat_messages.channel_id AND user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM channel_moderators WHERE channel_id = chat_messages.channel_id AND user_id = auth.uid()
    )
  );