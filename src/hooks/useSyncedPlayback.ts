import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PlaybackState {
  currentMediaId: string | null;
  currentPosition: number;
  isPlaying: boolean;
  startedAt: string;
}

export const useSyncedPlayback = (channelId: string, mediaContent: any[], isOwner: boolean) => {
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch initial playback state
  useEffect(() => {
    const fetchPlaybackState = async () => {
      const { data, error } = await supabase
        .from("channel_playback_state")
        .select("*")
        .eq("channel_id", channelId)
        .single();

      if (data && !error) {
        setPlaybackState({
          currentMediaId: data.current_media_id,
          currentPosition: data.current_position,
          isPlaying: data.is_playing,
          startedAt: data.started_at,
        });

        // Find index of current media
        if (data.current_media_id && mediaContent.length > 0) {
          const idx = mediaContent.findIndex((m) => m.id === data.current_media_id);
          if (idx !== -1) setCurrentIndex(idx);
        }
      }
    };

    if (channelId && mediaContent.length > 0) {
      fetchPlaybackState();
    }
  }, [channelId, mediaContent]);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`playback-${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "channel_playback_state",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload: any) => {
          if (payload.new) {
            setPlaybackState({
              currentMediaId: payload.new.current_media_id,
              currentPosition: payload.new.current_position,
              isPlaying: payload.new.is_playing,
              startedAt: payload.new.started_at,
            });

            // Find index of current media
            if (payload.new.current_media_id && mediaContent.length > 0) {
              const idx = mediaContent.findIndex((m: any) => m.id === payload.new.current_media_id);
              if (idx !== -1) setCurrentIndex(idx);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, mediaContent]);

  // Calculate synced position based on server time
  const getSyncedPosition = useCallback(() => {
    if (!playbackState || !playbackState.startedAt) return 0;

    const startedAt = new Date(playbackState.startedAt).getTime();
    const now = Date.now();
    const elapsed = (now - startedAt) / 1000; // seconds
    
    return playbackState.currentPosition + elapsed;
  }, [playbackState]);

  // Update playback state (owner only)
  const updatePlaybackState = useCallback(
    async (mediaId: string, position: number, isPlaying: boolean = true) => {
      if (!isOwner) return;

      await supabase.from("channel_playback_state").upsert({
        channel_id: channelId,
        current_media_id: mediaId,
        current_position: Math.floor(position),
        is_playing: isPlaying,
        started_at: new Date().toISOString(),
      });
    },
    [channelId, isOwner]
  );

  // Handle media ended - move to next
  const handleMediaEnded = useCallback(async () => {
    if (!isOwner || mediaContent.length === 0) return;

    const nextIndex = (currentIndex + 1) % mediaContent.length;
    const nextMedia = mediaContent[nextIndex];

    await updatePlaybackState(nextMedia.id, 0, true);
    setCurrentIndex(nextIndex);
  }, [currentIndex, isOwner, mediaContent, updatePlaybackState]);

  // Sync video/audio element to server time
  const syncMedia = useCallback(
    (element: HTMLVideoElement | HTMLAudioElement | null) => {
      if (!element || !playbackState) return;

      const targetPosition = getSyncedPosition();
      const currentTime = element.currentTime;
      const diff = Math.abs(targetPosition - currentTime);

      // Only seek if difference is more than 2 seconds
      if (diff > 2) {
        element.currentTime = targetPosition;
      }

      if (playbackState.isPlaying && element.paused) {
        element.play().catch(() => {});
      }
    },
    [playbackState, getSyncedPosition]
  );

  // Periodic sync (every 10 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      if (videoRef.current) syncMedia(videoRef.current);
      if (audioRef.current) syncMedia(audioRef.current);
    }, 10000);

    return () => clearInterval(interval);
  }, [syncMedia]);

  return {
    currentIndex,
    setCurrentIndex,
    playbackState,
    getSyncedPosition,
    updatePlaybackState,
    handleMediaEnded,
    syncMedia,
    videoRef,
    audioRef,
  };
};
