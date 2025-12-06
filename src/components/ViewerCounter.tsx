import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Users } from "lucide-react";

interface ViewerCounterProps {
  channelId: string;
}

const ViewerCounter = ({ channelId }: ViewerCounterProps) => {
  const { user } = useAuth();
  const [viewerCount, setViewerCount] = useState(0);
  const [sessionId] = useState(() => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    let mounted = true;

    // Register viewer
    const registerViewer = async () => {
      try {
        await supabase.from("channel_viewers").upsert(
          {
            channel_id: channelId,
            user_id: user?.id || null,
            session_id: sessionId,
            last_seen: new Date().toISOString(),
          },
          { onConflict: "session_id" }
        );
      } catch (error) {
        console.error("Error registering viewer:", error);
      }
    };

    // Fetch viewer count
    const fetchViewerCount = async () => {
      try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { count, error } = await supabase
          .from("channel_viewers")
          .select("*", { count: "exact", head: true })
          .eq("channel_id", channelId)
          .gte("last_seen", fiveMinutesAgo);
        
        if (!error && mounted) {
          setViewerCount(count || 0);
        }
      } catch (error) {
        console.error("Error fetching viewer count:", error);
      }
    };

    registerViewer();
    fetchViewerCount();

    // Update heartbeat every 30 seconds
    const heartbeat = setInterval(async () => {
      try {
        await supabase
          .from("channel_viewers")
          .update({ last_seen: new Date().toISOString() })
          .eq("session_id", sessionId);
        fetchViewerCount();
      } catch (error) {
        console.error("Heartbeat error:", error);
      }
    }, 30000);

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`viewers:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "channel_viewers",
          filter: `channel_id=eq.${channelId}`,
        },
        () => {
          fetchViewerCount();
        }
      )
      .subscribe();

    // Cleanup on unmount
    return () => {
      mounted = false;
      clearInterval(heartbeat);
      supabase.removeChannel(channel);
      // Remove viewer record
      supabase
        .from("channel_viewers")
        .delete()
        .eq("session_id", sessionId)
        .then(() => {});
    };
  }, [channelId, user?.id, sessionId]);

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <div className="flex items-center gap-1 bg-destructive/20 text-destructive px-2 py-0.5 rounded-full">
        <div className="w-1.5 h-1.5 bg-destructive rounded-full animate-pulse" />
        <Users className="w-3.5 h-3.5" />
        <span className="font-medium text-xs">{viewerCount}</span>
      </div>
    </div>
  );
};

export default ViewerCounter;
