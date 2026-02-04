import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Volume2, 
  VolumeX,
  ChevronUp,
  ChevronDown,
  Send,
  X,
  Tv,
  Radio as RadioIcon,
  Users
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import UniversalPlayer, { SourceType } from "@/components/UniversalPlayer";

interface Channel {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  channel_type: "tv" | "radio";
  is_live: boolean;
  viewer_count: number;
  user_id: string;
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
  const [currentSourceIndex, setCurrentSourceIndex] = useState(0);

  // Fetch channels with AI recommendation logic
  useEffect(() => {
    fetchChannels();
  }, [user]);

  const fetchChannels = async () => {
    setLoading(true);
    
    // Get user's viewing history for recommendations
    let viewedCategories: string[] = [];
    if (user) {
      const { data: views } = await supabase
        .from("channel_views")
        .select("channel_id, channels(category_id)")
        .eq("viewer_id", user.id)
        .order("viewed_at", { ascending: false })
        .limit(50);
      
      if (views) {
        viewedCategories = views
          .map((v: any) => v.channels?.category_id)
          .filter(Boolean);
      }
    }

    // Fetch all active channels (not hidden)
    const { data, error } = await supabase
      .from("channels")
      .select(`
        id, title, description, thumbnail_url, channel_type, is_live, viewer_count, user_id,
        profiles:user_id (username, avatar_url)
      `)
      .eq("is_hidden", false)
      .order("viewer_count", { ascending: false });

    if (!error && data) {
      // Fetch media for deduplication
      const channelIds = (data as any[]).map(c => c.id);
      const { data: mediaData } = await supabase
        .from("media_content")
        .select("id, file_url, source_type, title, channel_id")
        .in("channel_id", channelIds)
        .order("created_at", { ascending: true });

      // Build media map
      const mediaMap: Record<string, MediaContent[]> = {};
      if (mediaData) {
        mediaData.forEach((m: any) => {
          if (!mediaMap[m.channel_id]) mediaMap[m.channel_id] = [];
          mediaMap[m.channel_id].push(m);
        });
      }
      setMediaByChannel(mediaMap);

      // DEDUPLICATION FILTER
      // 1. Remove duplicates by title + type
      // 2. Remove duplicates by source URL
      const seenTitles = new Set<string>();
      const seenSources = new Set<string>();
      
      const filteredChannels = (data as any[]).filter((ch) => {
        // Skip channels without description (low quality)
        // Commented out per user request - only filter duplicates
        // if (!ch.description || ch.description.trim().length < 5) return false;
        
        // Check title duplicate (normalize: lowercase, trim)
        const titleKey = `${ch.title?.toLowerCase().trim()}|${ch.channel_type}`;
        if (seenTitles.has(titleKey)) {
          console.log("Filtering duplicate by title:", ch.title);
          return false;
        }
        seenTitles.add(titleKey);
        
        // Check source URL duplicate
        const channelMedia = mediaMap[ch.id] || [];
        for (const media of channelMedia) {
          const sourceKey = media.file_url?.toLowerCase().trim();
          if (sourceKey && seenSources.has(sourceKey)) {
            console.log("Filtering duplicate by source:", ch.title, media.file_url);
            return false;
          }
          if (sourceKey) seenSources.add(sourceKey);
        }
        
        return true;
      });

      // Sort by relevance (viewed categories first, then by viewer count)
      const sortedChannels = filteredChannels.sort((a, b) => {
        const aRelevance = viewedCategories.filter(c => c === a.category_id).length;
        const bRelevance = viewedCategories.filter(c => c === b.category_id).length;
        if (aRelevance !== bRelevance) return bRelevance - aRelevance;
        return (b.viewer_count || 0) - (a.viewer_count || 0);
      });
      
      setChannels(sortedChannels);
    }
    
    setLoading(false);
  };

  // Fetch user likes
  useEffect(() => {
    if (user) {
      fetchLikes();
    }
  }, [user]);

  const fetchLikes = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("likes")
      .select("channel_id")
      .eq("user_id", user.id)
      .eq("is_like", true);
    
    if (data) {
      setLikedChannels(new Set(data.map(l => l.channel_id)));
    }
  };

  // Fetch chat messages for current channel
  useEffect(() => {
    if (channels[currentIndex]) {
      fetchChatMessages(channels[currentIndex].id);
      const unsubscribe = subscribeToChat(channels[currentIndex].id);
      // Reset source index when switching to a new channel
      setCurrentSourceIndex(0);
      return unsubscribe;
    }
  }, [currentIndex, channels]);

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (!showChat) return;
    const el = chatListRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chatMessages, showChat]);

  const fetchChatMessages = async (channelId: string) => {
    const { data } = await supabase
      .from("chat_messages")
      .select(`
        id, message, user_id, created_at,
        profiles:user_id (username, avatar_url)
      `)
      .eq("channel_id", channelId)
      .order("created_at", { ascending: false })
      .limit(50);
    
    if (data) {
      setChatMessages((data as any).reverse());
    }
  };

  const subscribeToChat = (channelId: string) => {
    const channel = supabase
      .channel(`shorts-chat-${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("username, avatar_url")
            .eq("id", payload.new.user_id)
            .single();
          
          setChatMessages(prev => [...prev, {
            ...payload.new as any,
            profiles: profile,
          }]);
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
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
    if (chatRootRef.current?.contains(target)) {
      setTouchStart(null);
      return;
    }
    if (!touchStart) return;
    
    const touchEnd = e.changedTouches[0].clientY;
    const diff = touchStart - touchEnd;
    
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentIndex < channels.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else if (diff < 0 && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      }
    }
    
    setTouchStart(null);
  };

  // Like channel
  const handleLike = async () => {
    if (!user || !channels[currentIndex]) return;
    
    const channelId = channels[currentIndex].id;
    const isLiked = likedChannels.has(channelId);
    
    if (isLiked) {
      await supabase
        .from("likes")
        .delete()
        .eq("channel_id", channelId)
        .eq("user_id", user.id);
      
      setLikedChannels(prev => {
        const newSet = new Set(prev);
        newSet.delete(channelId);
        return newSet;
      });
    } else {
      await supabase
        .from("likes")
        .insert({ channel_id: channelId, user_id: user.id, is_like: true });
      
      setLikedChannels(prev => new Set([...prev, channelId]));
    }
  };

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newMessage.trim() || !channels[currentIndex]) return;
    
    await supabase
      .from("chat_messages")
      .insert({
        channel_id: channels[currentIndex].id,
        user_id: user.id,
        message: newMessage.trim(),
      });
    
    setNewMessage("");
  };

  // Share
  const handleShare = async () => {
    if (!channels[currentIndex]) return;
    
    try {
      await navigator.share({
        title: channels[currentIndex].title,
        url: `${window.location.origin}/channel/${channels[currentIndex].id}`,
      });
    } catch {
      navigator.clipboard.writeText(`${window.location.origin}/channel/${channels[currentIndex].id}`);
      toast({ title: "Ссылка скопирована" });
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
        <div className="text-center">
          <Tv className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p>Нет доступных каналов</p>
        </div>
      </div>
    );
  }

  const currentChannel = channels[currentIndex];
  const sourcesForChannel = mediaByChannel[currentChannel?.id] || [];
  const safeSourceIndex = Math.min(currentSourceIndex, Math.max(0, sourcesForChannel.length - 1));
  const currentMedia = sourcesForChannel[safeSourceIndex];
  const isLiked = likedChannels.has(currentChannel?.id);

  const cycleSource = () => {
    if (sourcesForChannel.length <= 1) return;
    setCurrentSourceIndex((prev) => (prev + 1) % sourcesForChannel.length);
  };

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 bg-black overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Video Player - Full Screen */}
      <div className="absolute inset-0">
        {currentMedia ? (
          <UniversalPlayer
            key={`shorts-${currentMedia.id}`}
            src={currentMedia.file_url}
            sourceType={(currentMedia.source_type as SourceType) || "mp4"}
            title={currentMedia.title}
            channelType={currentChannel.channel_type}
            autoPlay={true}
            className="w-full h-full object-cover"
          />
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

      {/* Channel Info - Bottom Left */}
      <div className="absolute bottom-20 left-4 right-20 z-10">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="w-10 h-10 border-2 border-primary">
            <AvatarImage src={currentChannel.profiles?.avatar_url || ""} />
            <AvatarFallback>{currentChannel.profiles?.username?.[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-white text-sm">@{currentChannel.profiles?.username}</p>
            <Badge variant="secondary" className="text-xs">
              {currentChannel.channel_type === "tv" ? "TV" : "Радио"}
            </Badge>
          </div>
        </div>
        <h3 className="text-white font-bold text-lg mb-1">{currentChannel.title}</h3>
        {currentChannel.description && (
          <p className="text-white/80 text-sm line-clamp-2">{currentChannel.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2 text-white/60 text-xs">
          <Users className="w-3 h-3" />
          <span>{currentChannel.viewer_count || 0} смотрят</span>
        </div>

        {sourcesForChannel.length > 1 && (
          <div className="mt-3">
            <Button type="button" variant="secondary" size="sm" onClick={cycleSource}>
              Источник {safeSourceIndex + 1}/{sourcesForChannel.length}
            </Button>
          </div>
        )}
      </div>

      {/* Actions - Right Side */}
      <div className="absolute right-4 bottom-24 flex flex-col items-center gap-6 z-10">
        <button
          onClick={handleLike}
          className="flex flex-col items-center"
        >
          <div className={`p-3 rounded-full ${isLiked ? "bg-destructive" : "bg-white/20"}`}>
            <Heart className={`w-6 h-6 ${isLiked ? "text-white fill-white" : "text-white"}`} />
          </div>
          <span className="text-white text-xs mt-1">Лайк</span>
        </button>

        <button
          onClick={() => setShowChat(!showChat)}
          className="flex flex-col items-center"
        >
          <div className={`p-3 rounded-full ${showChat ? "bg-primary" : "bg-white/20"}`}>
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <span className="text-white text-xs mt-1">Чат</span>
        </button>

        <button
          onClick={handleShare}
          className="flex flex-col items-center"
        >
          <div className="p-3 rounded-full bg-white/20">
            <Share2 className="w-6 h-6 text-white" />
          </div>
          <span className="text-white text-xs mt-1">Поделиться</span>
        </button>

        <button
          onClick={() => setMuted(!muted)}
          className="flex flex-col items-center"
        >
          <div className="p-3 rounded-full bg-white/20">
            {muted ? (
              <VolumeX className="w-6 h-6 text-white" />
            ) : (
              <Volume2 className="w-6 h-6 text-white" />
            )}
          </div>
          <span className="text-white text-xs mt-1">{muted ? "Вкл" : "Выкл"}</span>
        </button>
      </div>

      {/* Navigation Arrows */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-10">
        {currentIndex > 0 && (
          <button
            onClick={() => setCurrentIndex(currentIndex - 1)}
            className="p-2 rounded-full bg-white/20"
          >
            <ChevronUp className="w-6 h-6 text-white" />
          </button>
        )}
        {currentIndex < channels.length - 1 && (
          <button
            onClick={() => setCurrentIndex(currentIndex + 1)}
            className="p-2 rounded-full bg-white/20"
          >
            <ChevronDown className="w-6 h-6 text-white" />
          </button>
        )}
      </div>

      {/* Progress indicator */}
      <div className="absolute top-4 left-4 right-4 flex gap-1 z-10">
        {channels.slice(0, 10).map((_, idx) => (
          <div
            key={idx}
            className={`flex-1 h-1 rounded-full ${idx === currentIndex ? "bg-white" : "bg-white/30"}`}
          />
        ))}
      </div>

      {/* Chat Overlay */}
      {showChat && (
        <div
          ref={chatRootRef}
          className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/90 to-transparent z-20 flex flex-col"
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4">
            <h4 className="text-white font-semibold">Чат трансляции</h4>
            <button onClick={() => setShowChat(false)}>
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          
          <div ref={chatListRef} className="flex-1 overflow-y-auto px-4 space-y-2">
            {chatMessages.map((msg) => (
              <div key={msg.id} className="flex items-start gap-2">
                <Avatar className="w-6 h-6">
                  <AvatarImage src={msg.profiles?.avatar_url || ""} />
                  <AvatarFallback className="text-xs">{msg.profiles?.username?.[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <span className="text-primary text-xs font-semibold">{msg.profiles?.username}</span>
                  <p className="text-white text-sm">{msg.message}</p>
                </div>
              </div>
            ))}
          </div>
          
          {user ? (
            <form onSubmit={handleSendMessage} className="p-4 flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Написать сообщение..."
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              />
              <Button type="submit" size="icon" variant="secondary">
                <Send className="w-4 h-4" />
              </Button>
            </form>
          ) : (
            <p className="text-center text-white/50 p-4 text-sm">
              Войдите, чтобы писать в чат
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default Shorts;
