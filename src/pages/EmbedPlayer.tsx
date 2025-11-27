import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface Channel {
  id: string;
  title: string;
  channel_type: "tv" | "radio";
}

interface MediaContent {
  id: string;
  title: string;
  file_url: string;
}

const EmbedPlayer = () => {
  const { id } = useParams<{ id: string }>();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [mediaContent, setMediaContent] = useState<MediaContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChannelAndMedia();
  }, [id]);

  const fetchChannelAndMedia = async () => {
    if (!id) return;

    try {
      const { data: channelData, error: channelError } = await supabase
        .from("channels")
        .select("id, title, channel_type")
        .eq("id", id)
        .single();

      if (channelError) throw channelError;
      setChannel(channelData);

      const { data: mediaData, error: mediaError } = await supabase
        .from("media_content")
        .select("id, title, file_url")
        .eq("channel_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!mediaError && mediaData) {
        setMediaContent(mediaData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <p className="text-white">Загрузка...</p>
      </div>
    );
  }

  if (!channel || !mediaContent) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <p className="text-white">Контент не найден</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-black">
      {channel.channel_type === "tv" ? (
        <video
          src={mediaContent.file_url}
          controls
          autoPlay
          className="w-full h-full"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center">
          <h2 className="text-white text-2xl mb-4">{channel.title}</h2>
          <audio src={mediaContent.file_url} controls autoPlay className="w-full max-w-md" />
        </div>
      )}
    </div>
  );
};

export default EmbedPlayer;
