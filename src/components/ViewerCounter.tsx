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
    // Register viewer
    const registerViewer = async () => {
      await supabase.from("channel_viewers").upsert(
        {
          channel_id: channelId,
          user_id: user?.id || null,
          session_id: sessionId,
          last_seen: new Date().toISOString(),
        },
        { onConflict: "session_id" }
      );
    };

    // Update heartbeat every 30 seconds
    const heartbeat = setInterval(async () => {
      await supabase
        .from("channel_viewers")
        .update({ last_seen: new Date().toISOString() })
        .eq("session_id", sessionId);
    }, 30000);

    // Fetch viewer count
    const fetchViewerCount = async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("channel_viewers")
        .select("*", { count: "exact", head: true })
        .eq("channel_id", channelId)
        .gte("last_seen", fiveMinutesAgo);
      
      setViewerCount(count || 0);
    };

    registerViewer();
    fetchViewerCount();

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
      clearInterval(heartbeat);
      supabase.removeChannel(channel);
      // Remove viewer record
      supabase
        .from("channel_viewers")
        .delete()
        .eq("session_id", sessionId);
    };
  }, [channelId, user?.id, sessionId]);

  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Users className="w-4 h-4" />
      <span className="font-medium">{viewerCount}</span>
    </div>
  );
};

export default ViewerCounter;
