import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UseViewerNotificationsProps {
  channelId: string;
  isOwner: boolean;
  isStreaming: boolean;
}

export const useViewerNotifications = ({ 
  channelId, 
  isOwner, 
  isStreaming 
}: UseViewerNotificationsProps) => {
  const { toast } = useToast();
  const notifiedViewersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isOwner || !isStreaming) {
      notifiedViewersRef.current.clear();
      return;
    }

    // Listen for WebRTC viewer-joined events
    const channel = supabase.channel(`viewer-notifications-${channelId}`, {
      config: { broadcast: { self: false } }
    });

    channel.on('broadcast', { event: 'viewer-joined' }, (payload: any) => {
      const viewerId = payload.payload?.viewerId;
      
      if (viewerId && !notifiedViewersRef.current.has(viewerId)) {
        notifiedViewersRef.current.add(viewerId);
        
        // Get viewer count
        const viewerCount = notifiedViewersRef.current.size;
        
        toast({
          title: "👁️ Новый зритель",
          description: `К трансляции подключился зритель (всего: ${viewerCount})`,
        });
      }
    });

    // Also listen to voice channel for radio
    const voiceChannel = supabase.channel(`voice-viewer-notifications-${channelId}`, {
      config: { broadcast: { self: false } }
    });

    voiceChannel.on('broadcast', { event: 'viewer-joined' }, (payload: any) => {
      const viewerId = payload.payload?.viewerId;
      
      if (viewerId && !notifiedViewersRef.current.has(viewerId)) {
        notifiedViewersRef.current.add(viewerId);
        
        const viewerCount = notifiedViewersRef.current.size;
        
        toast({
          title: "🎧 Новый слушатель",
          description: `К радио подключился слушатель (всего: ${viewerCount})`,
        });
      }
    });

    channel.subscribe();
    voiceChannel.subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(voiceChannel);
    };
  }, [channelId, isOwner, isStreaming, toast]);

  return {
    viewerCount: notifiedViewersRef.current.size
  };
};
