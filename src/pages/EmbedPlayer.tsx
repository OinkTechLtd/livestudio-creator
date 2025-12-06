import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Radio as RadioIcon } from "lucide-react";
import HLSPlayer from "@/components/HLSPlayer";

interface Channel {
  id: string;
  title: string;
  channel_type: "tv" | "radio";
  streaming_method: "upload" | "live" | "scheduled";
  mux_playback_id: string | null;
  thumbnail_url: string | null;
  is_live: boolean;
}

interface MediaContent {
  id: string;
  title: string;
  file_url: string;
  is_24_7: boolean;
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
        .select("id, title, channel_type, streaming_method, mux_playback_id, thumbnail_url, is_live")
        .eq("id", id)
        .single();

      if (channelError) throw channelError;
      setChannel(channelData);

      // Fetch media content
      const { data: mediaData, error: mediaError } = await supabase
        .from("media_content")
        .select("id, title, file_url, is_24_7")
        .eq("channel_id", id)
        .order("created_at", { ascending: true });

      if (!mediaError && mediaData) {
        // Filter to get active 24/7 content first, then others
        const activeContent = mediaData.filter(m => m.is_24_7);
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
      <div className="w-full h-full flex items-center justify-center bg-black">
        <div className="animate-pulse">
          <p className="text-white">Загрузка плеера...</p>
        </div>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <p className="text-white">Канал не найден</p>
      </div>
    );
  }

  // Live streaming with Mux
  if (channel.streaming_method === "live" && channel.mux_playback_id) {
    return (
      <div className="w-full h-full bg-black relative">
        {/* Channel Avatar */}
        {channel.thumbnail_url && (
          <div className="absolute top-4 right-4 z-20">
            <img 
              src={channel.thumbnail_url} 
              alt={channel.title}
              className="w-12 h-12 rounded-full border-2 border-white/50 object-cover"
            />
          </div>
        )}
        <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2 z-10">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          LIVE
        </div>
        <iframe
          src={`https://stream.mux.com/${channel.mux_playback_id}.html?autoplay=true&muted=false`}
          style={{ width: '100%', height: '100%', border: 0 }}
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      </div>
    );
  }

  // Check if media exists for uploaded content
  if (mediaContent.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <p className="text-white">Нет доступного контента</p>
      </div>
    );
  }

  const currentMedia = mediaContent[currentIndex];

  const handleEnded = () => {
    if (currentIndex < mediaContent.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  return (
    <div className="w-full h-full bg-black relative">
      {/* Channel Avatar */}
      {channel.thumbnail_url && (
        <div className="absolute top-4 right-4 z-20">
          <img 
            src={channel.thumbnail_url} 
            alt={channel.title}
            className="w-12 h-12 rounded-full border-2 border-white/50 object-cover"
          />
        </div>
      )}
      
      {channel.channel_type === "tv" ? (
        <>
          <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2 z-10">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            LIVE
          </div>
          {currentMedia.file_url.includes('.m3u8') ? (
            <HLSPlayer
              src={currentMedia.file_url}
              autoPlay={true}
              className="w-full h-full object-contain"
              onEnded={handleEnded}
            />
          ) : (
            <video
              key={currentMedia.id}
              src={currentMedia.file_url}
              autoPlay
              muted={false}
              playsInline
              onEnded={handleEnded}
              onContextMenu={(e) => e.preventDefault()}
              controlsList="nodownload nofullscreen noremoteplayback"
              disablePictureInPicture
              className="w-full h-full object-contain"
              style={{ pointerEvents: 'none' }}
            />
          )}
        </>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
          <div className="text-center space-y-6">
            {channel.thumbnail_url ? (
              <img 
                src={channel.thumbnail_url} 
                alt={channel.title}
                className="w-32 h-32 mx-auto rounded-full border-4 border-white/20 object-cover"
              />
            ) : (
              <div className="w-32 h-32 mx-auto bg-white/10 rounded-full flex items-center justify-center mb-4">
                <RadioIcon className="w-16 h-16 text-white animate-pulse" />
              </div>
            )}
            <div className="bg-red-600 text-white px-4 py-2 rounded-full text-sm font-semibold inline-flex items-center gap-2">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              ПРЯМОЙ ЭФИР
            </div>
            <h2 className="text-white text-3xl font-bold">{channel.title}</h2>
            <p className="text-white/70 text-lg">Сейчас в эфире: {currentMedia.title}</p>
            <audio
              key={currentMedia.id}
              src={currentMedia.file_url}
              autoPlay
              onEnded={handleEnded}
              onContextMenu={(e) => e.preventDefault()}
              controlsList="nodownload"
              className="w-full max-w-md mx-auto mt-6"
              style={{ pointerEvents: 'none' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default EmbedPlayer;
