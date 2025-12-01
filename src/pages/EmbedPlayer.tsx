import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface Channel {
  id: string;
  title: string;
  channel_type: "tv" | "radio";
  streaming_method: "upload" | "live" | "scheduled";
  mux_playback_id: string | null;
}

interface MediaContent {
  id: string;
  title: string;
  file_url: string;
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
        .select("id, title, channel_type, streaming_method, mux_playback_id")
        .eq("id", id)
        .single();

      if (channelError) throw channelError;
      setChannel(channelData);

      // Only fetch media content if not live streaming
      if (channelData.streaming_method !== "live") {
        const { data: mediaData, error: mediaError } = await supabase
          .from("media_content")
          .select("id, title, file_url")
          .eq("channel_id", id)
          .order("created_at", { ascending: false });

        if (!mediaError && mediaData) {
          setMediaContent(mediaData);
        }
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

  // For uploaded content - check if media exists
  if (channel.streaming_method !== "live" && mediaContent.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <p className="text-white">Нет доступного контента</p>
      </div>
    );
  }

  // Live streaming with Mux
  if (channel.streaming_method === "live" && channel.mux_playback_id) {
    return (
      <div className="w-full h-full bg-black">
        <iframe
          src={`https://stream.mux.com/${channel.mux_playback_id}.html?autoplay=true`}
          style={{ width: '100%', height: '100%', border: 0 }}
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      </div>
    );
  }

  // Uploaded content - should have media at this point
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
      {channel.channel_type === "tv" ? (
        <>
          <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2 z-10">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            LIVE
          </div>
          <video
            key={currentMedia.id}
            src={currentMedia.file_url}
            autoPlay
            loop={false}
            playsInline
            onEnded={handleEnded}
            onContextMenu={(e) => e.preventDefault()}
            controlsList="nodownload nofullscreen noremoteplayback"
            disablePictureInPicture
            className="w-full h-full object-contain"
            style={{ pointerEvents: 'none' }}
          />
        </>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
          <div className="text-center space-y-6">
            <div className="w-32 h-32 mx-auto bg-white/10 rounded-full flex items-center justify-center mb-4">
              <svg className="w-16 h-16 text-white animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                <path d="M18.41 16.59L13.82 12l4.59-4.59L17 6l-6 6 6 6zM6 6h2v12H6zm-4 0h2v12H2z" />
              </svg>
            </div>
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
