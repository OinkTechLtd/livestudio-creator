import { useState, useEffect, useCallback } from "react";

interface MediaContent {
  id: string;
  title: string;
  file_url: string;
  file_type: string | null;
  duration: number | null;
  is_24_7: boolean;
  scheduled_at: string | null;
  start_time: string | null;
  end_time: string | null;
}

// Convert local time to Moscow time
const getMoscowTime = (): Date => {
  const now = new Date();
  // Moscow is UTC+3
  const moscowOffset = 3 * 60; // minutes
  const localOffset = now.getTimezoneOffset(); // minutes (negative for east of UTC)
  const totalOffsetMs = (moscowOffset + localOffset) * 60 * 1000;
  return new Date(now.getTime() + totalOffsetMs);
};

// Parse time string (HH:MM or HH:MM:SS) to minutes since midnight
const parseTimeToMinutes = (timeStr: string): number => {
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  return hours * 60 + minutes;
};

// Get current minutes since midnight in Moscow time
const getCurrentMoscowMinutes = (): number => {
  const moscow = getMoscowTime();
  return moscow.getHours() * 60 + moscow.getMinutes();
};

export const useScheduledPlayback = (mediaContent: MediaContent[]) => {
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [scheduledMedia, setScheduledMedia] = useState<MediaContent | null>(null);

  const findScheduledMedia = useCallback(() => {
    if (mediaContent.length === 0) return null;

    const currentMinutes = getCurrentMoscowMinutes();
    
    // Find media that should be playing now based on schedule
    for (const media of mediaContent) {
      if (media.start_time && media.end_time) {
        const startMinutes = parseTimeToMinutes(media.start_time);
        const endMinutes = parseTimeToMinutes(media.end_time);
        
        // Handle overnight schedules (e.g., 22:00 - 06:00)
        if (endMinutes < startMinutes) {
          if (currentMinutes >= startMinutes || currentMinutes < endMinutes) {
            return media;
          }
        } else {
          if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
            return media;
          }
        }
      }
    }

    // No scheduled media found, return first 24/7 media or first media
    const media247 = mediaContent.find(m => m.is_24_7);
    return media247 || null;
  }, [mediaContent]);

  const updateCurrentMedia = useCallback(() => {
    const scheduled = findScheduledMedia();
    
    if (scheduled) {
      setScheduledMedia(scheduled);
      const index = mediaContent.findIndex(m => m.id === scheduled.id);
      if (index !== -1 && index !== currentMediaIndex) {
        setCurrentMediaIndex(index);
      }
    }
  }, [findScheduledMedia, mediaContent, currentMediaIndex]);

  useEffect(() => {
    if (mediaContent.length === 0) return;

    // Initial check
    updateCurrentMedia();

    // Check every minute for schedule changes
    const interval = setInterval(() => {
      updateCurrentMedia();
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [mediaContent, updateCurrentMedia]);

  const handleMediaEnded = useCallback(() => {
    // Check if there's scheduled content that should play
    const scheduled = findScheduledMedia();
    
    if (scheduled && scheduled.id !== mediaContent[currentMediaIndex]?.id) {
      const index = mediaContent.findIndex(m => m.id === scheduled.id);
      if (index !== -1) {
        setCurrentMediaIndex(index);
        return;
      }
    }

    // Otherwise, go to next media in loop
    const nextIndex = (currentMediaIndex + 1) % mediaContent.length;
    setCurrentMediaIndex(nextIndex);
  }, [currentMediaIndex, mediaContent, findScheduledMedia]);

  return {
    currentMediaIndex,
    setCurrentMediaIndex,
    scheduledMedia,
    handleMediaEnded,
    getCurrentMoscowTime: getMoscowTime,
  };
};

export default useScheduledPlayback;
