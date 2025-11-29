-- Add mux_playback_id column to channels table for storing Mux live stream playback ID
ALTER TABLE public.channels 
ADD COLUMN IF NOT EXISTS mux_playback_id TEXT;

COMMENT ON COLUMN public.channels.mux_playback_id IS 'Mux playback ID for live streaming';
