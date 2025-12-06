import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Radio } from "lucide-react";

interface LiveStreamPlayerProps {
  channelId: string;
  channelType: "tv" | "radio";
  channelTitle: string;
  thumbnailUrl?: string | null;
}

interface StreamState {
  isLive: boolean;
  streamData: MediaStream | null;
}

const LiveStreamPlayer = ({ channelId, channelType, channelTitle, thumbnailUrl }: LiveStreamPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [streamState, setStreamState] = useState<StreamState>({ isLive: false, streamData: null });

  useEffect(() => {
    // Subscribe to channel updates to detect when streaming starts/stops
    const channel = supabase
      .channel(`live-stream-${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "channels",
          filter: `id=eq.${channelId}`,
        },
        (payload: any) => {
          if (payload.new) {
            setStreamState(prev => ({
              ...prev,
              isLive: payload.new.is_live
            }));
          }
        }
      )
      .subscribe();

    // Check initial live status
    const checkLiveStatus = async () => {
      const { data } = await supabase
        .from("channels")
        .select("is_live")
        .eq("id", channelId)
        .single();
      
      if (data) {
        setStreamState(prev => ({ ...prev, isLive: data.is_live }));
      }
    };

    checkLiveStatus();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId]);

  if (!streamState.isLive) {
    return (
      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
        <div className="text-center p-4">
          <p className="text-muted-foreground">Трансляция не активна</p>
          <p className="text-sm text-muted-foreground mt-1">Ожидание начала эфира...</p>
        </div>
      </div>
    );
  }

  if (channelType === "tv") {
    return (
      <div className="aspect-video bg-muted rounded-lg overflow-hidden relative">
        {thumbnailUrl && (
          <div className="absolute top-4 right-4 z-20">
            <img 
              src={thumbnailUrl} 
              alt={channelTitle}
              className="w-10 h-10 md:w-14 md:h-14 rounded-full border-2 border-white/50 object-cover shadow-lg"
            />
          </div>
        )}
        <div className="absolute top-4 left-4 bg-destructive text-white px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-semibold flex items-center gap-2 z-10">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          LIVE
        </div>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-contain"
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
    );
  }

  // Radio player
  return (
    <div className="aspect-video bg-gradient-to-br from-background to-primary/10 rounded-lg flex flex-col items-center justify-center">
      {thumbnailUrl && (
        <div className="absolute top-4 right-4 z-20">
          <img 
            src={thumbnailUrl} 
            alt={channelTitle}
            className="w-10 h-10 md:w-14 md:h-14 rounded-full border-2 border-white/50 object-cover shadow-lg"
          />
        </div>
      )}
      <div className="absolute top-4 left-4 bg-destructive text-white px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-semibold flex items-center gap-2 z-10">
        <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
        LIVE
      </div>
      <Radio className="w-16 h-16 md:w-24 md:h-24 text-primary mb-4 md:mb-6 animate-pulse" />
      <h2 className="text-xl md:text-2xl font-bold mb-2">{channelTitle}</h2>
      <p className="text-sm md:text-base text-muted-foreground mb-4">В прямом эфире</p>
      <audio
        ref={audioRef}
        autoPlay
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
};

export default LiveStreamPlayer;
