import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Users } from "lucide-react";

interface ViewerCounterProps {
  channelId: string;
}

const ViewerCounter = ({ channelId }: ViewerCounterProps) => {
  const { user } = useAuth();
  const [viewerCount, setViewerCount] = useState(1); // Start with 1 (self)
  const [sessionId] = useState(() => `session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`);
  const [isRegistered, setIsRegistered] = useState(false);

  // Register viewer
  const registerViewer = useCallback(async () => {
    if (isRegistered) return;
    
    try {
      // First, try to delete any stale sessions
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      await supabase
        .from("channel_viewers")
        .delete()
        .eq("channel_id", channelId)
        .lt("last_seen", fiveMinutesAgo);

      // Insert new viewer record
      const { error } = await supabase.from("channel_viewers").insert({
        channel_id: channelId,
        user_id: user?.id || null,
        session_id: sessionId,
        last_seen: new Date().toISOString(),
      });

      if (!error) {
        setIsRegistered(true);
        console.log("Viewer registered:", sessionId);
      } else {
        console.error("Error registering viewer:", error);
      }
    } catch (error) {
      console.error("Error registering viewer:", error);
    }
  }, [channelId, user?.id, sessionId, isRegistered]);

  // Fetch viewer count
  const fetchViewerCount = useCallback(async () => {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { count, error } = await supabase
        .from("channel_viewers")
        .select("*", { count: "exact", head: true })
        .eq("channel_id", channelId)
        .gte("last_seen", fiveMinutesAgo);
      
      if (!error) {
        // Ensure at least 1 (self) is shown
        setViewerCount(Math.max(1, count || 0));
      }
    } catch (error) {
      console.error("Error fetching viewer count:", error);
    }
  }, [channelId]);

  useEffect(() => {
    // Register immediately
    registerViewer();
    
    // Small delay to ensure registration completes before count
    const countTimeout = setTimeout(() => {
      fetchViewerCount();
    }, 500);

    // Update heartbeat every 20 seconds
    const heartbeat = setInterval(async () => {
      try {
        if (isRegistered) {
          await supabase
            .from("channel_viewers")
            .update({ last_seen: new Date().toISOString() })
            .eq("session_id", sessionId);
        }
        fetchViewerCount();
      } catch (error) {
        console.error("Heartbeat error:", error);
      }
    }, 20000);

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`viewers-${channelId}-${sessionId}`)
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
      clearTimeout(countTimeout);
      clearInterval(heartbeat);
      supabase.removeChannel(channel);
      
      // Remove viewer record on unmount
      supabase
        .from("channel_viewers")
        .delete()
        .eq("session_id", sessionId)
        .then(() => console.log("Viewer removed:", sessionId));
    };
  }, [channelId, sessionId, registerViewer, fetchViewerCount, isRegistered]);

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
