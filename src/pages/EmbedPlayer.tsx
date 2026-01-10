import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Radio as RadioIcon } from "lucide-react";
import UniversalPlayer, { SourceType } from "@/components/UniversalPlayer";

interface Channel {
  id: string;
  title: string;
  channel_type: "tv" | "radio";
  streaming_method: "upload" | "live" | "scheduled";
  // mux_playback_id repurposed: Restream RTMP server
  mux_playback_id: string | null;
  // stream_key repurposed: Restream stream key
  stream_key: string | null;
  thumbnail_url: string | null;
  is_live: boolean;
}

interface MediaContent {
  id: string;
  title: string;
  file_url: string;
  is_24_7: boolean;
  source_type: string | null;
}

const EmbedPlayer = () => {
  const { id } = useParams<{ id: string }>();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [mediaContent, setMediaContent] = useState<MediaContent[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChannelAndMedia();
  }, [id]);

  const fetchChannelAndMedia = async () => {
    if (!id) return;

    try {
      const { data: channelData, error: channelError } = await supabase
        .from("channels")
        .select("id, title, channel_type, streaming_method, mux_playback_id, stream_key, thumbnail_url, is_live")
        .eq("id", id)
        .single();

      if (channelError) throw channelError;
      setChannel(channelData);

      const { data: mediaData, error: mediaError } = await supabase
        .from("media_content")
        .select("id, title, file_url, is_24_7, source_type")
        .eq("channel_id", id)
        .order("created_at", { ascending: true });

      if (!mediaError && mediaData) {
        const activeContent = mediaData.filter((m) => m.is_24_7);
        const allContent = activeContent.length > 0 ? activeContent : mediaData;
        setMediaContent(allContent);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="animate-pulse">
          <p className="text-foreground">Загрузка плеера...</p>
        </div>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <p className="text-foreground">Канал не найден</p>
      </div>
    );
  }

  // Live (Restream ingest) — playback зависит от внешней платформы.
  if (channel.streaming_method === "live") {
    return (
      <div className="w-full h-full bg-background relative flex items-center justify-center">
        {channel.thumbnail_url && (
          <div className="absolute top-4 right-4 z-20">
            <img
              src={channel.thumbnail_url}
              alt={channel.title}
              className="w-12 h-12 rounded-full border-2 border-border object-cover"
            />
          </div>
        )}
        <div className="absolute top-4 left-4 bg-destructive text-destructive-foreground px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2 z-10">
          <span className="w-2 h-2 bg-destructive-foreground rounded-full animate-pulse" />
          LIVE
        </div>
        <div className="text-center px-4">
          <RadioIcon className="w-12 h-12 text-primary mx-auto mb-3 animate-pulse" />
          <p className="text-lg font-semibold">{channel.title}</p>
          <p className="text-sm text-muted-foreground">
            Прямая трансляция (RTMP) — воспроизведение зависит от подключённой платформы.
          </p>
        </div>
      </div>
    );
  }

  if (mediaContent.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <p className="text-foreground">Нет доступного контента</p>
      </div>
    );
  }

  const currentMedia = mediaContent[currentIndex];

  const handleEnded = () => {
    setCurrentIndex((prev) => (prev + 1) % mediaContent.length);
  };

  return (
    <div className="w-full h-full bg-background relative">
      {channel.thumbnail_url && (
        <div className="absolute top-4 right-4 z-20">
          <img
            src={channel.thumbnail_url}
            alt={channel.title}
            className="w-12 h-12 rounded-full border-2 border-border object-cover"
          />
        </div>
      )}

      {channel.channel_type === "tv" ? (
        <div className="absolute top-4 left-4 bg-destructive text-destructive-foreground px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2 z-10">
          <span className="w-2 h-2 bg-destructive-foreground rounded-full animate-pulse" />
          LIVE
        </div>
      ) : null}

      <UniversalPlayer
        src={currentMedia.file_url}
        sourceType={(currentMedia.source_type as SourceType) || "mp4"}
        channelType={channel.channel_type}
        autoPlay
        onEnded={handleEnded}
      />
    </div>
  );
};

export default EmbedPlayer;

