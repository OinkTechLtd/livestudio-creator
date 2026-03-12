import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Heart, MessageCircle, Share2, Volume2, VolumeX,
  ChevronUp, ChevronDown, Send, X, Tv,
  Radio as RadioIcon, Eye, RefreshCw, Sparkles, RotateCcw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import UniversalPlayer, { SourceType } from "@/components/UniversalPlayer";
import DataConsentBanner from "@/components/DataConsentBanner";
import { useShortsRecommendations } from "@/hooks/useShortsRecommendations";
import { resolveLiveStreamUrl } from "@/lib/liveStream";
import { deduplicateChannelsByTitle, shouldCensorChannelFromDiscovery } from "@/lib/channelSafety";

interface Channel {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  channel_type: "tv" | "radio";
  is_live: boolean;
  streaming_method: "upload" | "live" | "scheduled";
  viewer_count: number;
  user_id: string;
  created_at: string;
  category_id?: string | null;
  mux_playback_id?: string | null;
  stream_key?: string | null;
  is_hidden?: boolean;
  hidden_reason?: string | null;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
}

interface MediaContent {
  id: string;
  file_url: string;
  source_type: string | null;
  title: string;
  is_24_7?: boolean;
}

interface ChatMessage {
  id: string;
  message: string;
  user_id: string;
  created_at: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
}

const Shorts = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const chatRootRef = useRef<HTMLDivElement>(null);
  const chatListRef = useRef<HTMLDivElement>(null);
  
  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [mediaByChannel, setMediaByChannel] = useState<Record<string, MediaContent[]>>({});
  const [likedChannels, setLikedChannels] = useState<Set<string>>(new Set());
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [liveViewerCounts, setLiveViewerCounts] = useState<Record<string, number>>({});
  const [sessionId] = useState(() => `shorts-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
  const [playerKey, setPlayerKey] = useState(0);
  const [interestInput, setInterestInput] = useState("");
  const [showInterestEditor, setShowInterestEditor] = useState(false);

  const tokenizeContent = (value: string) =>
    value
      .toLowerCase()
      .split(/[\s,.;:!?()\[\]{}"'`~@#$%^&*+=|\\/<>\-]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3);

  const {
    showConsentBanner,
    acceptConsent,
    declineConsent,
    trackView,
    scoreChannel,
    interestTags,
    saveInterestTags,
    clearRecommendationProfile,
  } = useShortsRecommendations(user?.id);

  useEffect(() => {
    setInterestInput(interestTags.join(", "));
  }, [interestTags]);

  const fetchChannels = useCallback(async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from("channels")
      .select(`id, title, description, thumbnail_url, channel_type, is_live, streaming_method, viewer_count, user_id, created_at, category_id, mux_playback_id, stream_key, is_hidden, hidden_reason, profiles:user_id (username, avatar_url)`)
      .eq("is_hidden", false)
      .order("viewer_count", { ascending: false })
      .limit(500);

    if (error || !data) { setLoading(false); return; }

    const channelIds = data.map((c: any) => c.id);
    let mediaMap: Record<string, MediaContent[]> = {};
    
    if (channelIds.length > 0) {
      for (let i = 0; i < channelIds.length; i += 30) {
        const batch = channelIds.slice(i, i + 30);
        const { data: mediaData } = await supabase
          .from("media_content")
          .select("id, file_url, source_type, title, channel_id, is_24_7")
          .in("channel_id", batch)
          .eq("is_24_7", true)
          .order("created_at", { ascending: true });
        if (mediaData) {
          mediaData.forEach((m: any) => {
            if (!mediaMap[m.channel_id]) mediaMap[m.channel_id] = [];
            mediaMap[m.channel_id].push(m);
          });
        }
      }
      
      // Fallback: if no is_24_7 media, get all media for channels that had none
      const channelsWithoutMedia = channelIds.filter(id => !mediaMap[id] || mediaMap[id].length === 0);
      if (channelsWithoutMedia.length > 0) {
        for (let i = 0; i < channelsWithoutMedia.length; i += 30) {
          const batch = channelsWithoutMedia.slice(i, i + 30);
          const { data: mediaData } = await supabase
            .from("media_content")
            .select("id, file_url, source_type, title, channel_id, is_24_7")
            .in("channel_id", batch)
            .order("created_at", { ascending: true });
          if (mediaData) {
            mediaData.forEach((m: any) => {
              if (!mediaMap[m.channel_id]) mediaMap[m.channel_id] = [];
              mediaMap[m.channel_id].push(m);
            });
          }
        }
      }
    }
    setMediaByChannel(mediaMap);

    const userIds = Array.from(new Set((data as any[]).map((channel) => channel.user_id).filter(Boolean)));
    let bannedUsers = new Set<string>();
    if (userIds.length > 0) {
      const { data: bannedData } = await supabase
        .from("banned_users")
        .select("user_id")
        .in("user_id", userIds);
      bannedUsers = new Set((bannedData || []).map((row: any) => row.user_id));
    }

    const withMedia = (data as any[])
      .filter((ch) => !bannedUsers.has(ch.user_id))
      .filter((ch) => !shouldCensorChannelFromDiscovery({
        username: ch.profiles?.username,
        title: ch.title,
        description: ch.description,
        isHidden: ch.is_hidden,
        hiddenReason: ch.hidden_reason,
      }))
      .filter((ch) => ch.is_live || (mediaMap[ch.id] || []).length > 0);
    const deduped = deduplicateChannelsByTitle(withMedia as any[]);

    const scored = deduped.map((ch: any) => ({ ...ch, _score: scoreChannel(ch) }));

    const hasManualInterests = interestTags.length > 0;
    const relevantOnly = hasManualInterests
      ? scored.filter((ch: any) => ch._score > 0)
      : scored;
    const feedSource = relevantOnly.length > 0 ? relevantOnly : scored;

    feedSource.sort((a: any, b: any) => {
      if (a._score !== b._score) return b._score - a._score;
      return (b.viewer_count || 0) - (a.viewer_count || 0);
    });
    
    setChannels(feedSource);
    setCurrentIndex(0);
    setCurrentMediaIndex(0);
    setLoading(false);
  }, [interestTags.length, scoreChannel]);

  const suggestionSource = channels
    .flatMap((channel) => tokenizeContent(`${channel.title} ${channel.description || ""}`))
    .reduce<Record<string, number>>((acc, token) => {
      acc[token] = (acc[token] || 0) + 1;
      return acc;
    }, {});

  const normalizedInterestInput = interestInput.trim().toLowerCase();
  const interestSuggestions = Object.entries(suggestionSource)
    .filter(([token]) => normalizedInterestInput.length === 0 || token.startsWith(normalizedInterestInput))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([token]) => token);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  useEffect(() => {
    const ch = channels[currentIndex];
    if (ch) trackView(ch.id, ch.category_id || null, ch.channel_type, ch.title);
  }, [currentIndex, channels, trackView]);

  // Reset media index when switching channels
  useEffect(() => {
    setCurrentMediaIndex(0);
    setPlayerKey(prev => prev + 1);
  }, [currentIndex]);

  // Viewer heartbeat
  useEffect(() => {
    const ch = channels[currentIndex];
    if (!ch) return;
    const channelId = ch.id;
    const register = async () => {
      try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        await supabase.from("channel_viewers").delete().eq("channel_id", channelId).lt("last_seen", fiveMinutesAgo);
        await supabase.from("channel_viewers").insert({ 
          channel_id: channelId, 
          user_id: user?.id || null, 
          session_id: sessionId, 
          last_seen: new Date().toISOString() 
        });
      } catch (e) { console.error("Viewer register error:", e); }
    };
    const fetchViewerCount = async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { count } = await supabase.from("channel_viewers").select("*", { count: "exact", head: true }).eq("channel_id", channelId).gte("last_seen", fiveMinutesAgo);
      setLiveViewerCounts(prev => ({ ...prev, [channelId]: Math.max(1, count || 0) }));
    };
    register();
    fetchViewerCount();
    const heartbeat = setInterval(async () => {
      await supabase.from("channel_viewers").update({ last_seen: new Date().toISOString() }).eq("session_id", sessionId);
      fetchViewerCount();
    }, 20000);
    return () => { clearInterval(heartbeat); supabase.from("channel_viewers").delete().eq("session_id", sessionId).then(() => {}); };
  }, [currentIndex, channels, user?.id, sessionId]);

  useEffect(() => { if (user) fetchLikes(); }, [user]);

  const fetchLikes = async () => {
    if (!user) return;
    const { data } = await supabase.from("likes").select("channel_id").eq("user_id", user.id).eq("is_like", true);
    if (data) setLikedChannels(new Set(data.map(l => l.channel_id)));
  };

  useEffect(() => {
    if (channels[currentIndex]) {
      fetchChatMessages(channels[currentIndex].id);
      const unsubscribe = subscribeToChat(channels[currentIndex].id);
      return unsubscribe;
    }
  }, [currentIndex, channels]);

  useEffect(() => {
    if (!showChat) return;
    const el = chatListRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatMessages, showChat]);

  const fetchChatMessages = async (channelId: string) => {
    const { data } = await supabase.from("chat_messages").select(`id, message, user_id, created_at, profiles:user_id (username, avatar_url)`).eq("channel_id", channelId).order("created_at", { ascending: false }).limit(50);
    if (data) setChatMessages((data as any).reverse());
  };

  const subscribeToChat = (channelId: string) => {
    const channel = supabase.channel(`shorts-chat-${channelId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `channel_id=eq.${channelId}` },
        async (payload) => {
          const { data: profile } = await supabase.from("profiles").select("username, avatar_url").eq("id", payload.new.user_id).single();
          setChatMessages(prev => [...prev, { ...payload.new as any, profiles: profile }]);
        }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  // Swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    if (showChat) return;
    const target = e.target as unknown as Node;
    if (chatRootRef.current?.contains(target)) return;
    setTouchStart(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (showChat) return;
    const target = e.target as unknown as Node;
    if (chatRootRef.current?.contains(target)) { setTouchStart(null); return; }
    if (!touchStart) return;
    const touchEnd = e.changedTouches[0].clientY;
    const diff = touchStart - touchEnd;
    if (Math.abs(diff) > 80) {
      if (diff > 0 && currentIndex < channels.length - 1) setCurrentIndex(currentIndex + 1);
      else if (diff < 0 && currentIndex > 0) setCurrentIndex(currentIndex - 1);
    }
    setTouchStart(null);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" && currentIndex < channels.length - 1) {
        e.preventDefault();
        setCurrentIndex(prev => prev + 1);
      } else if (e.key === "ArrowUp" && currentIndex > 0) {
        e.preventDefault();
        setCurrentIndex(prev => prev - 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, channels.length]);

  const handleLike = async () => {
    if (!user || !channels[currentIndex]) return;
    const channelId = channels[currentIndex].id;
    const isLiked = likedChannels.has(channelId);
    if (isLiked) {
      await supabase.from("likes").delete().eq("channel_id", channelId).eq("user_id", user.id);
      setLikedChannels(prev => { const s = new Set(prev); s.delete(channelId); return s; });
    } else {
      await supabase.from("likes").insert({ channel_id: channelId, user_id: user.id, is_like: true });
      setLikedChannels(prev => new Set([...prev, channelId]));
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newMessage.trim() || !channels[currentIndex]) return;
    const { error } = await supabase.from("chat_messages").insert({ channel_id: channels[currentIndex].id, user_id: user.id, message: newMessage.trim() });
    if (error) toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    setNewMessage("");
  };

  const handleShare = async () => {
    if (!channels[currentIndex]) return;
    try {
      await navigator.share({ title: channels[currentIndex].title, url: `${window.location.origin}/channel/${channels[currentIndex].id}` });
    } catch {
      navigator.clipboard.writeText(`${window.location.origin}/channel/${channels[currentIndex].id}`);
      toast({ title: "Ссылка скопирована" });
    }
  };

  // Continuous broadcast: cycle through media
  const handleMediaEnded = () => {
    const sources = mediaByChannel[channels[currentIndex]?.id] || [];
    if (sources.length > 1) {
      setCurrentMediaIndex(prev => (prev + 1) % sources.length);
      setPlayerKey(prev => prev + 1);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-center">
          <Tv className="w-12 h-12 mx-auto mb-4 text-primary" />
          <p>Загрузка ленты...</p>
        </div>
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Tv className="w-12 h-12 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Нет доступных каналов с медиа</p>
          <Button variant="outline" onClick={() => fetchChannels()}>
            <RefreshCw className="w-4 h-4 mr-2" />Обновить
          </Button>
        </div>
      </div>
    );
  }

  const currentChannel = channels[currentIndex];
  const sourcesForChannel = mediaByChannel[currentChannel?.id] || [];
  const safeMediaIndex = Math.min(currentMediaIndex, Math.max(0, sourcesForChannel.length - 1));
  const currentMedia = sourcesForChannel[safeMediaIndex];
  const isLiked = likedChannels.has(currentChannel?.id);
  const currentLiveViewers = liveViewerCounts[currentChannel?.id] || currentChannel?.viewer_count || 0;
  const liveStreamUrl = currentChannel
    ? resolveLiveStreamUrl({
        channelId: currentChannel.id,
        streamingMethod: currentChannel.streaming_method,
        isLive: currentChannel.is_live,
        muxPlaybackId: currentChannel.mux_playback_id,
      })
    : "";

  return (
    <div ref={containerRef} className="fixed inset-0 bg-black overflow-hidden" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {showConsentBanner && <DataConsentBanner onAccept={acceptConsent} onDecline={declineConsent} />}

      <div className="absolute top-4 right-4 z-30 flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setShowInterestEditor((prev) => !prev)}
          className="bg-black/50 text-white border-white/20"
        >
          <Sparkles className="w-4 h-4 mr-1" />
          Интересы
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            clearRecommendationProfile();
            toast({ title: "Профиль рекомендаций сброшен" });
            fetchChannels();
          }}
          className="bg-black/50 text-white border-white/20"
        >
          <RotateCcw className="w-4 h-4 mr-1" />
          Сброс
        </Button>
      </div>

      {showInterestEditor && (
        <div className="absolute top-16 right-4 z-30 w-[320px] max-w-[calc(100vw-2rem)] rounded-lg border border-white/20 bg-black/80 p-3 backdrop-blur-sm">
          <p className="text-sm text-white font-medium mb-2">Персональные интересы (как TikTok)</p>
          <Input
            value={interestInput}
            onChange={(e) => setInterestInput(e.target.value)}
            placeholder="спорт, кино, новости, музыка"
            className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
          />
          {interestSuggestions.length > 0 && !interestInput.includes(",") && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {interestSuggestions.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setInterestInput(tag)}
                  className="rounded-full border border-white/30 bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              onClick={() => {
                const tags = interestInput.split(",").map((tag) => tag.trim()).filter(Boolean);
                saveInterestTags(tags);
                toast({ title: "Интересы сохранены" });
                fetchChannels();
              }}
            >
              Сохранить
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowInterestEditor(false)}>
              Закрыть
            </Button>
          </div>
          {interestTags.length > 0 && (
            <p className="text-xs text-white/70 mt-2">Текущие: {interestTags.join(", ")}</p>
          )}
        </div>
      )}

      {/* Video Player */}
      <div className="absolute inset-0">
        {currentMedia ? (
          <UniversalPlayer
            key={`shorts-${currentChannel.id}-${currentMedia.id}-${playerKey}`}
            src={currentMedia.file_url}
            sourceType={(currentMedia.source_type as SourceType) || "mp4"}
            title={currentMedia.title}
            channelType={currentChannel.channel_type}
            autoPlay={true}
            muted={muted}
            useProxy={false}
            onEnded={handleMediaEnded}
            className="w-full h-full object-cover"
          />
        ) : currentChannel.is_live && currentChannel.streaming_method === "live" && liveStreamUrl ? (
          <UniversalPlayer
            key={`shorts-live-${currentChannel.id}-${playerKey}`}
            src={liveStreamUrl}
            sourceType="m3u8"
            title={currentChannel.title}
            channelType={currentChannel.channel_type}
            autoPlay={true}
            muted={muted}
            className="w-full h-full object-cover"
          />
        ) : currentChannel.is_live && currentChannel.streaming_method === "live" ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-background to-primary/20 text-center px-6">
            <Tv className="w-16 h-16 text-primary mb-3 animate-pulse" />
            <p className="text-white font-semibold">Ожидаем входящий live-поток</p>
            <p className="text-white/70 text-sm mt-1">Проверь RTMP Server/Stream Key и перезапусти трансляцию в OBS/Restream.</p>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-background to-primary/20">
            {currentChannel.channel_type === "tv" ? (
              <Tv className="w-24 h-24 text-primary animate-pulse" />
            ) : (
              <RadioIcon className="w-24 h-24 text-primary animate-pulse" />
            )}
          </div>
        )}
      </div>

      {/* Overlay Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80 pointer-events-none" />

      {/* Navigation Arrows */}
      <div className="absolute top-1/2 -translate-y-1/2 right-4 flex flex-col gap-4 z-20">
        {currentIndex > 0 && (
          <button onClick={() => setCurrentIndex(currentIndex - 1)} className="p-2 bg-white/20 rounded-full backdrop-blur-sm">
            <ChevronUp className="w-5 h-5 text-white" />
          </button>
        )}
        {currentIndex < channels.length - 1 && (
          <button onClick={() => setCurrentIndex(currentIndex + 1)} className="p-2 bg-white/20 rounded-full backdrop-blur-sm">
            <ChevronDown className="w-5 h-5 text-white" />
          </button>
        )}
      </div>

      {/* Channel Info */}
      <div className="absolute bottom-20 left-4 right-20 z-10">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="w-10 h-10 border-2 border-primary">
            <AvatarImage src={currentChannel.profiles?.avatar_url || ""} />
            <AvatarFallback>{currentChannel.profiles?.username?.[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-white text-sm">@{currentChannel.profiles?.username}</p>
            <Badge variant="secondary" className="text-xs">{currentChannel.channel_type === "tv" ? "TV" : "Радио"}</Badge>
          </div>
        </div>
        <h3 className="text-white font-bold text-lg mb-1">{currentChannel.title}</h3>
        {currentChannel.description && <p className="text-white/80 text-sm line-clamp-2">{currentChannel.description}</p>}
        <div className="flex items-center gap-3 mt-2">
          <div className="flex items-center gap-1.5 bg-destructive/30 text-white px-2 py-0.5 rounded-full">
            <div className="w-1.5 h-1.5 bg-destructive rounded-full animate-pulse" />
            <Eye className="w-3 h-3" /><span className="text-xs font-medium">{currentLiveViewers} онлайн</span>
          </div>
          {sourcesForChannel.length > 1 && <span className="text-white/50 text-xs">{safeMediaIndex + 1}/{sourcesForChannel.length}</span>}
        </div>
      </div>

      {/* Actions */}
      <div className="absolute right-4 bottom-24 flex flex-col items-center gap-6 z-10">
        <button onClick={handleLike} className="flex flex-col items-center">
          <div className={`p-3 rounded-full ${isLiked ? "bg-destructive" : "bg-white/20"}`}>
            <Heart className={`w-6 h-6 ${isLiked ? "text-white fill-white" : "text-white"}`} />
          </div>
          <span className="text-white text-xs mt-1">Лайк</span>
        </button>
        <button onClick={() => setShowChat(!showChat)} className="flex flex-col items-center">
          <div className={`p-3 rounded-full ${showChat ? "bg-primary" : "bg-white/20"}`}>
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <span className="text-white text-xs mt-1">Чат</span>
        </button>
        <button onClick={handleShare} className="flex flex-col items-center">
          <div className="p-3 rounded-full bg-white/20"><Share2 className="w-6 h-6 text-white" /></div>
          <span className="text-white text-xs mt-1">Поделиться</span>
        </button>
        <button onClick={() => setMuted(!muted)} className="flex flex-col items-center">
          <div className="p-3 rounded-full bg-white/20">
            {muted ? <VolumeX className="w-6 h-6 text-white" /> : <Volume2 className="w-6 h-6 text-white" />}
          </div>
          <span className="text-white text-xs mt-1">{muted ? "Вкл" : "Выкл"}</span>
        </button>
      </div>

      {/* Chat Overlay */}
      {showChat && (
        <div ref={chatRootRef} className="absolute bottom-0 left-0 right-0 h-[50vh] bg-black/90 z-30 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h3 className="text-white font-semibold">Чат — {currentChannel.title}</h3>
            <button onClick={() => setShowChat(false)}><X className="w-5 h-5 text-white" /></button>
          </div>
          <div ref={chatListRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
            {chatMessages.map((msg) => (
              <div key={msg.id} className="flex items-start gap-2">
                <Avatar className="w-6 h-6">
                  <AvatarImage src={msg.profiles?.avatar_url || ""} />
                  <AvatarFallback className="text-xs">{msg.profiles?.username?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <span className="text-xs text-primary font-medium">{msg.profiles?.username}</span>
                  <p className="text-sm text-white/90">{msg.message}</p>
                </div>
              </div>
            ))}
          </div>
          {user ? (
            <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10 flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Сообщение..."
                className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/50"
              />
              <Button type="submit" size="sm"><Send className="w-4 h-4" /></Button>
            </form>
          ) : (
            <div className="p-3 text-center text-white/50 text-sm">Войдите, чтобы писать в чат</div>
          )}
        </div>
      )}
    </div>
  );
};

export default Shorts;
