import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PlaybackState {
  currentMediaId: string | null;
  currentPosition: number;
  isPlaying: boolean;
  startedAt: string;
}

interface MediaItem {
  id: string;
  file_url: string;
  is_24_7?: boolean;
  [key: string]: any;
}

export const useSyncedPlayback = (channelId: string, mediaContent: MediaItem[], isOwner: boolean) => {
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAdBreak, setIsAdBreak] = useState(false);
  const [adContent, setAdContent] = useState<any[]>([]);
  const [adSettings, setAdSettings] = useState<any>(null);
  const [savedPosition, setSavedPosition] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastAdTimeRef = useRef<number>(Date.now());

  // Filter active media content
  const activeMedia = mediaContent.filter(m => m.is_24_7);

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
        if (data.current_media_id && activeMedia.length > 0) {
          const idx = activeMedia.findIndex((m) => m.id === data.current_media_id);
          if (idx !== -1) setCurrentIndex(idx);
        }
      }
    };

    const fetchAdData = async () => {
      const [contentRes, settingsRes] = await Promise.all([
        supabase.from("ad_content").select("*").eq("channel_id", channelId).eq("is_active", true),
        supabase.from("ad_settings").select("*").eq("channel_id", channelId).single()
      ]);

      if (contentRes.data) setAdContent(contentRes.data);
      if (settingsRes.data) setAdSettings(settingsRes.data);
    };

    if (channelId && mediaContent.length > 0) {
      fetchPlaybackState();
      fetchAdData();
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
            if (payload.new.current_media_id && activeMedia.length > 0) {
              const idx = activeMedia.findIndex((m: any) => m.id === payload.new.current_media_id);
              if (idx !== -1) setCurrentIndex(idx);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, activeMedia]);

  // Check for ad break timing
  useEffect(() => {
    if (!adSettings?.is_enabled || adContent.length === 0) return;

    const checkAdBreak = () => {
      const now = Date.now();
      const elapsed = (now - lastAdTimeRef.current) / 1000 / 60; // minutes

      if (elapsed >= adSettings.interval_minutes && !isAdBreak) {
        // Save current position before ad
        const element = videoRef.current || audioRef.current;
        if (element) {
          setSavedPosition(element.currentTime);
        }
        setIsAdBreak(true);
        lastAdTimeRef.current = now;
      }
    };

    const interval = setInterval(checkAdBreak, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [adSettings, adContent, isAdBreak]);

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

  // Handle media ended - move to next in playlist
  const handleMediaEnded = useCallback(async () => {
    if (activeMedia.length === 0) return;

    // If in ad break, return to main content
    if (isAdBreak) {
      setIsAdBreak(false);
      // Restore saved position
      const element = videoRef.current || audioRef.current;
      if (element) {
        element.currentTime = savedPosition;
        element.play().catch(() => {});
      }
      return;
    }

    // Move to next media in playlist (loop)
    const nextIndex = (currentIndex + 1) % activeMedia.length;
    const nextMedia = activeMedia[nextIndex];

    if (isOwner && nextMedia) {
      await updatePlaybackState(nextMedia.id, 0, true);
    }
    
    setCurrentIndex(nextIndex);
  }, [currentIndex, isOwner, activeMedia, updatePlaybackState, isAdBreak, savedPosition]);

  // Sync video/audio element to server time
  const syncMedia = useCallback(
    (element: HTMLVideoElement | HTMLAudioElement | null) => {
      if (!element || !playbackState || isAdBreak) return;

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
    [playbackState, getSyncedPosition, isAdBreak]
  );

  // Periodic sync (every 10 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isAdBreak) {
        if (videoRef.current) syncMedia(videoRef.current);
        if (audioRef.current) syncMedia(audioRef.current);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [syncMedia, isAdBreak]);

  // Get current media to play
  const getCurrentMedia = useCallback(() => {
    if (isAdBreak && adContent.length > 0) {
      // Return random ad
      const randomAd = adContent[Math.floor(Math.random() * adContent.length)];
      return { url: randomAd.file_url, isAd: true };
    }

    if (activeMedia.length > 0 && activeMedia[currentIndex]) {
      return { url: activeMedia[currentIndex].file_url, isAd: false };
    }

    return null;
  }, [isAdBreak, adContent, activeMedia, currentIndex]);

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
    isAdBreak,
    setIsAdBreak,
    getCurrentMedia,
    activeMedia,
  };
};
