import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import LiveChat from "@/components/LiveChat";
import { Radio as RadioIcon } from "lucide-react";

interface Channel {
  id: string;
  title: string;
  channel_type: "tv" | "radio";
  streaming_method: "upload" | "live" | "scheduled";
  mux_playback_id: string | null;
  thumbnail_url: string | null;
  user_id: string;
}

interface MediaContent {
  id: string;
  title: string;
  file_url: string;
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
        .select("id, title, channel_type, streaming_method, mux_playback_id, thumbnail_url, user_id")
        .eq("id", id)
        .single();

      if (channelData) {
        setChannel(channelData);

        if (channelData.streaming_method !== "live") {
          const { data: mediaData } = await supabase
            .from("media_content")
            .select("id, title, file_url")
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
    if (currentIndex < mediaContent.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-pulse text-white">Загрузка...</div>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white">Канал не найден</p>
      </div>
    );
  }

  const currentMedia = mediaContent[currentIndex];

  return (
    <div className="min-h-screen bg-black flex">
      {/* Player Section */}
      <div className="flex-1 relative">
        {/* Channel Avatar Overlay */}
        {channel.thumbnail_url && (
          <div className="absolute top-4 right-4 z-20">
            <img 
              src={channel.thumbnail_url} 
              alt={channel.title}
              className="w-16 h-16 rounded-full border-2 border-white/50 object-cover shadow-lg"
            />
          </div>
        )}
        
        {/* Live Badge */}
        <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2 z-20">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          LIVE
        </div>

        {channel.streaming_method === "live" && channel.mux_playback_id ? (
          <iframe
            src={`https://stream.mux.com/${channel.mux_playback_id}.html?autoplay=true`}
            className="w-full h-full"
            style={{ border: 0 }}
            allow="autoplay; fullscreen"
            allowFullScreen
          />
        ) : currentMedia ? (
          channel.channel_type === "tv" ? (
            <video
              key={currentMedia.id}
              src={currentMedia.file_url}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
              onEnded={handleEnded}
              onContextMenu={(e) => e.preventDefault()}
              controlsList="nodownload nofullscreen noremoteplayback"
              disablePictureInPicture
              style={{ pointerEvents: 'none' }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
              <RadioIcon className="w-24 h-24 text-white mb-6 animate-pulse" />
              <h2 className="text-white text-2xl font-bold mb-2">{channel.title}</h2>
              <p className="text-white/70 mb-6">В эфире: {currentMedia.title}</p>
              <audio
                key={currentMedia.id}
                src={currentMedia.file_url}
                autoPlay
                onEnded={handleEnded}
                onContextMenu={(e) => e.preventDefault()}
                controlsList="nodownload"
                style={{ pointerEvents: 'none' }}
              />
            </div>
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-white">Нет контента</p>
          </div>
        )}
      </div>

      {/* Chat Sidebar */}
      <div className="w-80 h-screen border-l border-gray-800 bg-background">
        <LiveChat channelId={channel.id} channelOwnerId={channel.user_id} />
      </div>
    </div>
  );
};

export default PopoutPlayer;
