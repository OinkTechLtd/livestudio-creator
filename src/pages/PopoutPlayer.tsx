import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import EnhancedLiveChat from "@/components/EnhancedLiveChat";
import { Radio as RadioIcon } from "lucide-react";
import UniversalPlayer, { SourceType } from "@/components/UniversalPlayer";

interface Channel {
  id: string;
  title: string;
  channel_type: "tv" | "radio";
  streaming_method: "upload" | "live" | "scheduled";
  mux_playback_id: string | null; // Restream RTMP server
  stream_key: string | null; // Restream stream key
  thumbnail_url: string | null;
  user_id: string;
}

interface MediaContent {
  id: string;
  title: string;
  file_url: string;
  source_type: string | null;
  is_24_7?: boolean;
}

const PopoutPlayer = () => {
  const { id } = useParams<{ id: string }>();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [mediaContent, setMediaContent] = useState<MediaContent[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    if (!id) return;

    try {
      const { data: channelData } = await supabase
        .from("channels")
        .select("id, title, channel_type, streaming_method, mux_playback_id, stream_key, thumbnail_url, user_id")
        .eq("id", id)
        .single();

      if (channelData) {
        setChannel(channelData);

        if (channelData.streaming_method !== "live") {
          const { data: mediaData } = await supabase
            .from("media_content")
            .select("id, title, file_url, source_type, is_24_7")
            .eq("channel_id", id)
            .order("created_at", { ascending: false });

          if (mediaData) setMediaContent(mediaData);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnded = () => {
    setCurrentIndex((prev) => (prev + 1) % (mediaContent.length || 1));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-foreground">Загрузка...</div>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-foreground">Канал не найден</p>
      </div>
    );
  }

  const currentMedia = mediaContent[currentIndex];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Player Section */}
      <div className="flex-1 relative">
        {channel.thumbnail_url && (
          <div className="absolute top-4 right-4 z-20">
            <img
              src={channel.thumbnail_url}
              alt={channel.title}
              className="w-16 h-16 rounded-full border-2 border-border object-cover shadow-lg"
            />
          </div>
        )}

        <div className="absolute top-4 left-4 bg-destructive text-destructive-foreground px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2 z-20">
          <span className="w-2 h-2 bg-destructive-foreground rounded-full animate-pulse" />
          LIVE
        </div>

        {channel.streaming_method === "live" ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center px-4">
              <RadioIcon className="w-12 h-12 text-primary mx-auto mb-3 animate-pulse" />
              <p className="text-lg font-semibold">{channel.title}</p>
              <p className="text-sm text-muted-foreground">
                Прямая трансляция (RTMP) — воспроизведение зависит от подключённой платформы.
              </p>
            </div>
          </div>
        ) : currentMedia ? (
          <UniversalPlayer
            src={currentMedia.file_url}
            sourceType={(currentMedia.source_type as SourceType) || "mp4"}
            channelType={channel.channel_type}
            autoPlay
            onEnded={handleEnded}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-muted-foreground">Нет контента</p>
          </div>
        )}
      </div>

      {/* Chat Sidebar */}
      <div className="w-80 h-screen border-l border-border bg-background">
        <EnhancedLiveChat channelId={channel.id} channelOwnerId={channel.user_id} />
      </div>
    </div>
  );
};

export default PopoutPlayer;

