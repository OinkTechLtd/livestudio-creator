import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Lock, AlertTriangle } from "lucide-react";
import UniversalPlayer, { SourceType } from "@/components/UniversalPlayer";
import { getDiscoveryCensorshipReason, shouldCensorChannelFromDiscovery } from "@/lib/channelSafety";

interface Channel {
  id: string;
  title: string;
  channel_type: "tv" | "radio";
  streaming_method: "upload" | "live" | "scheduled";
  mux_playback_id: string | null;
  stream_key: string | null;
  thumbnail_url: string | null;
  is_live: boolean;
  paid_only: boolean;
  user_id: string;
  is_hidden: boolean;
  hidden_reason: string | null;
  description: string | null;
  profiles?: {
    username: string;
  } | null;
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
  const { user } = useAuth();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [mediaContent, setMediaContent] = useState<MediaContent[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(true);

  useEffect(() => { fetchChannelAndMedia(); }, [id]);

  useEffect(() => {
    if (channel?.paid_only) {
      checkAccess();
    }
  }, [channel, user]);

  const checkAccess = async () => {
    if (!channel?.paid_only) { setHasAccess(true); return; }
    if (!user) { setHasAccess(false); return; }
    if (user.id === channel.user_id) { setHasAccess(true); return; }
    const { data } = await supabase
      .from("user_premium_subscriptions")
      .select("id")
      .eq("channel_id", channel.id)
      .eq("user_id", user.id)
      .gte("expires_at", new Date().toISOString())
      .limit(1);
    setHasAccess((data && data.length > 0) || false);
  };

  const fetchChannelAndMedia = async () => {
    if (!id) return;
    try {
      const { data: channelData, error: channelError } = await supabase
        .from("channels")
        .select("id, title, channel_type, streaming_method, mux_playback_id, stream_key, thumbnail_url, is_live, paid_only, user_id, is_hidden, hidden_reason, description, profiles:user_id(username)")
        .eq("id", id)
        .single();
      if (channelError) throw channelError;
      setChannel(channelData as Channel);

      const { data: mediaData, error: mediaError } = await supabase
        .from("media_content")
        .select("id, title, file_url, is_24_7, source_type")
        .eq("channel_id", id)
        .order("created_at", { ascending: true });
      if (!mediaError && mediaData) {
        const activeContent = mediaData.filter((m) => m.is_24_7);
        setMediaContent(activeContent.length > 0 ? activeContent : mediaData);
      }
    } catch (error) { console.error("Error fetching data:", error); }
    finally { setLoading(false); }
  };

  if (loading) {
    return <div className="w-full h-full flex items-center justify-center bg-background"><div className="animate-pulse"><p className="text-foreground">Загрузка плеера...</p></div></div>;
  }

  if (!channel) {
    return <div className="w-full h-full flex items-center justify-center bg-background"><p className="text-foreground">Канал не найден</p></div>;
  }

  const isBlocked = shouldCensorChannelFromDiscovery({
    username: channel.profiles?.username,
    title: channel.title,
    description: channel.description,
    isHidden: channel.is_hidden,
    hiddenReason: channel.hidden_reason,
  });
  const blockReason = getDiscoveryCensorshipReason({
    username: channel.profiles?.username,
    title: channel.title,
    description: channel.description,
    isHidden: channel.is_hidden,
    hiddenReason: channel.hidden_reason,
  });

  if (isBlocked) {
    const ownerMessage = user?.id && user.id === channel.user_id;
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="text-center p-8 max-w-md">
          <AlertTriangle className="w-14 h-14 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">{ownerMessage ? "Ваш канал был заблокирован" : "Данный канал больше не доступен"}</h2>
          {blockReason && <p className="text-sm text-destructive mb-2">Причина: {blockReason}</p>}
          <p className="text-muted-foreground text-sm">Этот канал недоступен в Embed-плеере.</p>
        </div>
      </div>
    );
  }

  // Paid content gate for embed
  if (channel.paid_only && !hasAccess) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="text-center p-8">
          <Lock className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Данный контент доступен только по подписке</h2>
          <p className="text-muted-foreground text-sm">Оформите подписку на канал, чтобы получить доступ к контенту.</p>
        </div>
      </div>
    );
  }

  if (channel.streaming_method === "live") {
    const liveStreamUrl = `https://aqeleulwobgamdffkfri.functions.supabase.co/hls-playlist?channelId=${channel.id}`;

    if (channel.is_live) {
      return (
        <div className="w-full h-full bg-background relative">
          <UniversalPlayer
            src={liveStreamUrl}
            sourceType="m3u8"
            title={channel.title}
            channelType={channel.channel_type}
            autoPlay
            poster={channel.thumbnail_url || undefined}
            className="w-full h-full"
          />
        </div>
      );
    }

    return (
      <div className="w-full h-full bg-background relative flex items-center justify-center">
        {channel.thumbnail_url && (
          <div className="absolute top-4 right-4 z-20"><img src={channel.thumbnail_url} alt={channel.title} className="w-12 h-12 rounded-full border-2 border-border object-cover" /></div>
        )}
        <div className="text-center px-4">
          <p className="text-lg font-semibold">{channel.title}</p>
          <p className="text-sm text-muted-foreground">Трансляция сейчас офлайн</p>
        </div>
      </div>
    );
  }

  if (mediaContent.length === 0) {
    return <div className="w-full h-full flex items-center justify-center bg-background"><p className="text-foreground">Нет доступного контента</p></div>;
  }

  const currentMedia = mediaContent[currentIndex];
  const handleEnded = () => setCurrentIndex((prev) => (prev + 1) % mediaContent.length);

  return (
    <div className="w-full h-full bg-background relative">
      {channel.thumbnail_url && (
        <div className="absolute top-4 right-4 z-20"><img src={channel.thumbnail_url} alt={channel.title} className="w-12 h-12 rounded-full border-2 border-border object-cover" /></div>
      )}
      {channel.channel_type === "tv" && (
        <div className="absolute top-4 left-4 bg-destructive text-destructive-foreground px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2 z-10">
          <span className="w-2 h-2 bg-destructive-foreground rounded-full animate-pulse" />LIVE
        </div>
      )}
      <UniversalPlayer src={currentMedia.file_url} sourceType={(currentMedia.source_type as SourceType) || "mp4"} channelType={channel.channel_type} autoPlay onEnded={handleEnded} />
    </div>
  );
};

export default EmbedPlayer;
