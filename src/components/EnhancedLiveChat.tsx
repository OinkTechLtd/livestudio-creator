import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Crown, Shield, UserPlus, UserMinus, Pin, Ban, MoreVertical, Bot, Users, Mic, Trash2, Gift, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import ViewerCounter from "@/components/ViewerCounter";
import ChatEmojiPicker from "@/components/ChatEmojiPicker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ChatMessage {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
  isSystem?: boolean;
  isDeleted?: boolean;
}

interface ChannelMember {
  user_id: string;
  role: string;
}

interface BlockedUser {
  user_id: string;
  ban_reason: string | null;
  ban_expires_at: string | null;
}

interface PremiumSubscription {
  id: string;
  title: string;
  duration_days: number;
  badge_emoji: string;
}

interface EnhancedLiveChatProps {
  channelId: string;
  channelOwnerId?: string;
}

const EnhancedLiveChat = ({ channelId, channelOwnerId }: EnhancedLiveChatProps) => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [moderators, setModerators] = useState<string[]>([]);
  const [channelMembers, setChannelMembers] = useState<ChannelMember[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [subscriberUserIds, setSubscriberUserIds] = useState<Set<string>>(new Set());
  const [subscriberBadge, setSubscriberBadge] = useState<string>("⭐");
  const [pinnedMessage, setPinnedMessage] = useState<ChatMessage | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [canWrite, setCanWrite] = useState(true);
  const [chatRestrictionMessage, setChatRestrictionMessage] = useState("");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [deletedMessageIds, setDeletedMessageIds] = useState<Set<string>>(new Set());
  const [showGrantDialog, setShowGrantDialog] = useState(false);
  const [grantUserId, setGrantUserId] = useState<string | null>(null);
  const [grantUsername, setGrantUsername] = useState<string>("");
  const [availableSubscriptions, setAvailableSubscriptions] = useState<PremiumSubscription[]>([]);
  const [selectedSubscription, setSelectedSubscription] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
    fetchModerators();
    fetchChannelMembers();
    fetchBlockedUsers();
    fetchPinnedMessage();
    fetchChatSettings();
    fetchDeletedMessages();
    fetchSubscribers();
    fetchSubscriberBadge();
    fetchAvailableSubscriptions();
    
    const channel = supabase
      .channel(`chat:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${channelId}`
        },
        (payload) => {
          const newMsg = payload.new as any;
          supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', newMsg.user_id)
            .single()
            .then(({ data }) => {
              if (data) {
                setMessages(prev => [...prev, {
                  ...newMsg,
                  profiles: data
                }]);
              }
            });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pinned_messages',
          filter: `channel_id=eq.${channelId}`
        },
        () => {
          fetchPinnedMessage();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_blocked_users',
          filter: `channel_id=eq.${channelId}`
        },
        () => {
          fetchBlockedUsers();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_premium_subscriptions',
          filter: `channel_id=eq.${channelId}`
        },
        () => {
          fetchSubscribers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId]);

  const fetchSubscriberBadge = async () => {
    const { data } = await supabase
      .from("channels")
      .select("subscriber_badge")
      .eq("id", channelId)
      .single();
    
    if (data?.subscriber_badge) {
      setSubscriberBadge(data.subscriber_badge);
    }
  };

  const fetchSubscribers = async () => {
    const now = new Date().toISOString();
    const { data } = await supabase
      .from("user_premium_subscriptions")
      .select("user_id")
      .eq("channel_id", channelId)
      .gte("expires_at", now);

    if (data) {
      setSubscriberUserIds(new Set(data.map(s => s.user_id)));
    }
  };

  const fetchAvailableSubscriptions = async () => {
    const { data } = await supabase
      .from("premium_subscriptions")
      .select("id, title, duration_days, badge_emoji")
      .eq("channel_id", channelId)
      .eq("is_active", true);

    if (data) {
      setAvailableSubscriptions(data);
    }
  };

  // Fetch chat settings and check if user can write
  const fetchChatSettings = useCallback(async () => {
    if (authLoading) return;

    if (!user) {
      setCanWrite(false);
      setChatRestrictionMessage("Войдите для отправки сообщений");
      setSettingsLoaded(true);
      return;
    }

    // Check if user is blocked with proper ban_expires_at handling
    const { data: blockedData } = await supabase
      .from("chat_blocked_users")
      .select("id, ban_expires_at, ban_reason")
      .eq("channel_id", channelId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (blockedData) {
      const now = new Date();
      const banExpires = blockedData.ban_expires_at ? new Date(blockedData.ban_expires_at) : null;
      
      // Ban is active if ban_expires_at is null (permanent) or in the future
      if (!banExpires || banExpires > now) {
        const reason = blockedData.ban_reason || "Без указания причины";
        const expiresText = banExpires 
          ? `до ${banExpires.toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
          : "навсегда";
        
        setCanWrite(false);
        setChatRestrictionMessage(`Вы заблокированы ${expiresText}. Причина: ${reason}`);
        setSettingsLoaded(true);
        return;
      }
      // If ban expired, remove it
      if (banExpires && banExpires <= now) {
        await supabase
          .from("chat_blocked_users")
          .delete()
          .eq("id", blockedData.id);
      }
    }

    const { data } = await supabase
      .from("channels")
      .select("chat_subscribers_only, chat_subscriber_wait_minutes, user_id")
      .eq("id", channelId)
      .single();

    if (data) {
      const settings = {
        chat_subscribers_only: data.chat_subscribers_only || false,
        chat_subscriber_wait_minutes: data.chat_subscriber_wait_minutes || 0,
      };
      
      // Check if user is channel owner
      if (user.id === data.user_id || user.id === channelOwnerId) {
        setCanWrite(true);
        setChatRestrictionMessage("");
        setSettingsLoaded(true);
        return;
      }

      // Check if user is a moderator
      const { data: modData } = await supabase
        .from("channel_moderators")
        .select("id")
        .eq("channel_id", channelId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (modData) {
        setCanWrite(true);
        setChatRestrictionMessage("");
        setSettingsLoaded(true);
        return;
      }
      
      if (settings.chat_subscribers_only) {
        const { data: subscription } = await supabase
          .from("subscriptions")
          .select("created_at")
          .eq("channel_id", channelId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!subscription) {
          setCanWrite(false);
          setChatRestrictionMessage("Подпишитесь на канал, чтобы писать в чат");
          setSettingsLoaded(true);
          return;
        } else if (settings.chat_subscriber_wait_minutes > 0) {
          const subscribedAt = new Date(subscription.created_at);
          const requiredTime = settings.chat_subscriber_wait_minutes * 60 * 1000;
          const timeSinceSubscribed = Date.now() - subscribedAt.getTime();
          
          if (timeSinceSubscribed < requiredTime) {
            const remainingMinutes = Math.ceil((requiredTime - timeSinceSubscribed) / 60000);
            setCanWrite(false);
            setChatRestrictionMessage(`Подождите ${remainingMinutes} мин. для отправки сообщений`);
            setSettingsLoaded(true);
            return;
          }
        }
      }
    }
    
    setCanWrite(true);
    setChatRestrictionMessage("");
    setSettingsLoaded(true);
  }, [user, authLoading, channelId, channelOwnerId]);

  useEffect(() => {
    if (!authLoading) {
      fetchChatSettings();
    }
  }, [user, authLoading, fetchChatSettings]);

  useEffect(() => {
    if (user && !hasJoined) {
      setHasJoined(true);
      const welcomeMsg: ChatMessage = {
        id: `welcome-${Date.now()}`,
        user_id: 'system',
        message: `${t("welcome_to_chat")}`,
        created_at: new Date().toISOString(),
        profiles: {
          username: 'StreamLiveTV',
          avatar_url: null,
        },
        isSystem: true,
      };
      setMessages(prev => [...prev, welcomeMsg]);
    }
  }, [user, hasJoined, t]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select(`
        id,
        user_id,
        message,
        created_at,
        profiles:user_id (
          username,
          avatar_url
        )
      `)
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (!error && data) {
      setMessages(data as any);
    }
  };

  const fetchModerators = async () => {
    const { data } = await supabase
      .from('channel_moderators')
      .select('user_id')
      .eq('channel_id', channelId);

    if (data) {
      setModerators(data.map(m => m.user_id));
    }
  };

  const fetchChannelMembers = async () => {
    const { data } = await supabase
      .from('channel_members')
      .select('user_id, role')
      .eq('channel_id', channelId)
      .eq('status', 'accepted');

    if (data) {
      setChannelMembers(data);
    }
  };

  const fetchDeletedMessages = async () => {
    const { data } = await supabase
      .from('deleted_messages')
      .select('message_id')
      .eq('channel_id', channelId);

    if (data) {
      setDeletedMessageIds(new Set(data.map(d => d.message_id)));
    }
  };

  const fetchBlockedUsers = async () => {
    const { data } = await supabase
      .from('chat_blocked_users')
      .select('user_id, ban_reason, ban_expires_at')
      .eq('channel_id', channelId);

    if (data) {
      // Filter to only include active bans
      const now = new Date();
      const activeBlocks = data.filter(b => {
        if (!b.ban_expires_at) return true; // Permanent ban
        return new Date(b.ban_expires_at) > now;
      });
      setBlockedUsers(activeBlocks);
    }
  };

  const fetchPinnedMessage = async () => {
    const { data } = await supabase
      .from('pinned_messages')
      .select(`
        id,
        message_id,
        chat_messages (
          id,
          user_id,
          message,
          created_at,
          profiles:user_id (
            username,
            avatar_url
          )
        )
      `)
      .eq('channel_id', channelId)
      .single();

    if (data?.chat_messages) {
      setPinnedMessage(data.chat_messages as any);
    } else {
      setPinnedMessage(null);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: t("auth_required"),
        description: t("login_to_send"),
        variant: "destructive",
      });
      return;
    }

    const isBlocked = blockedUsers.some(b => b.user_id === user.id);
    if (isBlocked) {
      toast({
        title: "Вы заблокированы в этом чате",
        variant: "destructive",
      });
      return;
    }

    if (!canWrite) {
      toast({
        title: chatRestrictionMessage || "Вы не можете писать в этот чат",
        variant: "destructive",
      });
      return;
    }

    if (!newMessage.trim()) return;

    setIsLoading(true);
    
    // Award point for sending message
    const { data: points } = await supabase
      .from('channel_points')
      .select('points, messages_sent')
      .eq('channel_id', channelId)
      .eq('user_id', user.id)
      .single();

    if (points) {
      await supabase
        .from('channel_points')
        .update({
          points: points.points + 2,
          messages_sent: points.messages_sent + 1,
        })
        .eq('channel_id', channelId)
        .eq('user_id', user.id);
    } else {
      await supabase.from('channel_points').insert({
        channel_id: channelId,
        user_id: user.id,
        points: 2,
        messages_sent: 1,
      });
    }

    const { error } = await supabase
      .from('chat_messages')
      .insert({
        channel_id: channelId,
        user_id: user.id,
        message: newMessage.trim()
      });

    if (error) {
      toast({
        title: t("error"),
        variant: "destructive",
      });
    } else {
      setNewMessage("");
    }
    setIsLoading(false);
  };

  const toggleModerator = async (userId: string, isCurrentlyMod: boolean) => {
    if (isCurrentlyMod) {
      const { error } = await supabase
        .from('channel_moderators')
        .delete()
        .eq('channel_id', channelId)
        .eq('user_id', userId);

      if (!error) {
        setModerators(prev => prev.filter(id => id !== userId));
        toast({ title: t("remove_moderator") });
      }
    } else {
      const { error } = await supabase
        .from('channel_moderators')
        .insert({ channel_id: channelId, user_id: userId });

      if (!error) {
        setModerators(prev => [...prev, userId]);
        toast({ title: t("make_moderator") });
      }
    }
  };

  const toggleBlockUser = async (userId: string, reason?: string, durationMinutes?: number) => {
    if (!user) return;
    
    const blocked = blockedUsers.find(b => b.user_id === userId);
    
    if (blocked) {
      const { error } = await supabase
        .from('chat_blocked_users')
        .delete()
        .eq('channel_id', channelId)
        .eq('user_id', userId);

      if (!error) {
        setBlockedUsers(prev => prev.filter(b => b.user_id !== userId));
        toast({ title: t("unblock") });
      }
    } else {
      const banExpiresAt = durationMinutes 
        ? new Date(Date.now() + durationMinutes * 60 * 1000).toISOString()
        : null;

      const { error } = await supabase
        .from('chat_blocked_users')
        .insert({ 
          channel_id: channelId, 
          user_id: userId,
          blocked_by: user.id,
          ban_expires_at: banExpiresAt,
          ban_reason: reason || "Нарушение правил чата",
        });

      if (!error) {
        setBlockedUsers(prev => [...prev, { 
          user_id: userId, 
          ban_reason: reason || "Нарушение правил чата",
          ban_expires_at: banExpiresAt,
        }]);
        toast({ title: t("block") });
      }
    }
  };

  const deleteMessageAndBan = async (messageId: string, authorId: string, messageContent: string) => {
    if (!user || !canModerate) return;

    try {
      await supabase.from('deleted_messages').insert({
        channel_id: channelId,
        message_id: messageId,
        message_content: messageContent,
        author_id: authorId,
        deleted_by: user.id,
      });

      await supabase
        .from('chat_messages')
        .delete()
        .eq('id', messageId);

      const banExpiresAt = new Date();
      banExpiresAt.setMinutes(banExpiresAt.getMinutes() + 6000);

      await supabase.from('chat_blocked_users').upsert({
        channel_id: channelId,
        user_id: authorId,
        blocked_by: user.id,
        ban_expires_at: banExpiresAt.toISOString(),
        ban_reason: 'Сообщение удалено модератором',
      });

      setDeletedMessageIds(prev => new Set([...prev, messageId]));
      setBlockedUsers(prev => [...prev, { 
        user_id: authorId, 
        ban_reason: "Сообщение удалено модератором",
        ban_expires_at: banExpiresAt.toISOString(),
      }]);
      setMessages(prev => prev.filter(m => m.id !== messageId));

      toast({ title: "Сообщение удалено, пользователь заблокирован на 6000 минут" });
    } catch (error) {
      console.error("Error deleting message:", error);
      toast({ title: "Ошибка удаления", variant: "destructive" });
    }
  };

  const grantSubscription = async () => {
    if (!user || !grantUserId || !selectedSubscription) return;

    try {
      const subscription = availableSubscriptions.find(s => s.id === selectedSubscription);
      if (!subscription) return;

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + subscription.duration_days);

      const { error } = await supabase.from("user_premium_subscriptions").insert({
        user_id: grantUserId,
        channel_id: channelId,
        subscription_id: selectedSubscription,
        expires_at: expiresAt.toISOString(),
        granted_by: user.id,
        is_manual_grant: true,
      });

      if (error) throw error;

      // Send chat message
      await supabase.from("chat_messages").insert({
        channel_id: channelId,
        user_id: user.id,
        message: `🎁 ${grantUsername} получил подписку "${subscription.title}" на ${subscription.duration_days} дней!`,
      });

      toast({ title: "Подписка выдана!" });
      setShowGrantDialog(false);
      setGrantUserId(null);
      setGrantUsername("");
      setSelectedSubscription("");
      fetchSubscribers();
    } catch (error) {
      console.error("Error granting subscription:", error);
      toast({ title: "Ошибка выдачи подписки", variant: "destructive" });
    }
  };

  const openGrantDialog = (userId: string, username: string) => {
    setGrantUserId(userId);
    setGrantUsername(username);
    setShowGrantDialog(true);
  };

  const pinMessage = async (messageId: string) => {
    if (!user) return;

    await supabase
      .from('pinned_messages')
      .delete()
      .eq('channel_id', channelId);

    const { error } = await supabase
      .from('pinned_messages')
      .insert({
        channel_id: channelId,
        message_id: messageId,
        pinned_by: user.id
      });

    if (!error) {
      toast({ title: t("pin") });
      fetchPinnedMessage();
    }
  };

  const unpinMessage = async () => {
    const { error } = await supabase
      .from('pinned_messages')
      .delete()
      .eq('channel_id', channelId);

    if (!error) {
      setPinnedMessage(null);
      toast({ title: t("unpin") });
    }
  };

  const isOwner = user?.id === channelOwnerId;
  const isModerator = (userId: string) => moderators.includes(userId);
  const isChannelOwner = (userId: string) => userId === channelOwnerId;
  const isChannelAdmin = (userId: string) => channelMembers.some(m => m.user_id === userId && m.role === 'admin');
  const isChannelHost = (userId: string) => channelMembers.some(m => m.user_id === userId && m.role === 'host');
  const isSubscriber = (userId: string) => subscriberUserIds.has(userId);
  const canModerate = isOwner || (user && isModerator(user.id)) || (user && isChannelAdmin(user.id));
  const isUserBlocked = (userId: string) => blockedUsers.some(b => b.user_id === userId);

  const getUserBadge = (userId: string, message?: string) => {
    const badges = [];
    
    if (message?.startsWith('🤖')) {
      return (
        <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
          {t("bot")}
        </span>
      );
    }
    
    if (isChannelOwner(userId)) {
      badges.push(
        <span key="owner" title={t("channel_owner")}>
          <Crown className="w-4 h-4 text-yellow-500 inline-block ml-1" />
        </span>
      );
    }
    
    if (isChannelAdmin(userId)) {
      badges.push(
        <span key="admin" title="Администратор канала">
          <Shield className="w-4 h-4 text-red-500 inline-block ml-1" />
        </span>
      );
    }
    
    if (isChannelHost(userId)) {
      badges.push(
        <span key="host" title="Ведущий канала">
          <Mic className="w-4 h-4 text-blue-500 inline-block ml-1" />
        </span>
      );
    }
    
    if (isModerator(userId) && !isChannelOwner(userId) && !isChannelAdmin(userId)) {
      badges.push(
        <span key="mod" title={t("moderator")}>
          <Shield className="w-4 h-4 text-green-500 inline-block ml-1" />
        </span>
      );
    }
    
    // Show subscriber badge
    if (isSubscriber(userId) && !isChannelOwner(userId)) {
      badges.push(
        <span key="sub" title="Подписчик" className="ml-1 text-sm">
          {subscriberBadge}
        </span>
      );
    }
    
    return badges.length > 0 ? <>{badges}</> : null;
  };

  const getUsernameColor = (userId: string, isSystem?: boolean) => {
    if (isSystem) return "text-purple-400 font-bold";
    if (isChannelOwner(userId)) return "text-yellow-500 font-bold";
    if (isChannelAdmin(userId)) return "text-red-500 font-bold";
    if (isChannelHost(userId)) return "text-blue-500 font-semibold";
    if (isModerator(userId)) return "text-green-500 font-semibold";
    if (isSubscriber(userId)) return "text-primary font-semibold";
    return "font-medium";
  };

  const getBlockInfo = (userId: string) => {
    return blockedUsers.find(b => b.user_id === userId);
  };

  return (
    <div className="flex flex-col h-full bg-background border-l border-border">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            {t("live_chat")}
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          </h3>
          <ViewerCounter channelId={channelId} />
        </div>
        <p className="text-sm text-muted-foreground">{messages.length} {t("messages")}</p>
      </div>

      {/* Pinned Message */}
      {pinnedMessage && (
        <div className="p-3 bg-primary/10 border-b border-primary/20">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Pin className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-primary">{t("pinned")}</span>
            </div>
            {canModerate && (
              <Button variant="ghost" size="sm" onClick={unpinMessage} className="h-6 px-2">
                ✕
              </Button>
            )}
          </div>
          <p className="text-sm mt-1">{pinnedMessage.message}</p>
          <p className="text-xs text-muted-foreground mt-1">
            — {pinnedMessage.profiles?.username}
          </p>
        </div>
      )}

      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-3">
          {messages.map((msg) => {
            const blockInfo = getBlockInfo(msg.user_id);
            
            return (
              <div 
                key={msg.id} 
                className={`flex gap-2 group hover:bg-muted/30 p-2 rounded-lg transition-colors ${
                  msg.isSystem ? 'bg-purple-500/10 border border-purple-500/20' : ''
                } ${blockInfo ? 'opacity-50' : ''}`}
              >
                <Avatar className="h-8 w-8 flex-shrink-0">
                  {msg.isSystem ? (
                    <AvatarFallback className="bg-purple-500/20">
                      <Bot className="w-4 h-4 text-purple-400" />
                    </AvatarFallback>
                  ) : (
                    <>
                      <AvatarImage src={msg.profiles.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {msg.profiles.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </>
                  )}
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className={`text-sm ${getUsernameColor(msg.user_id, msg.isSystem)}`}>
                      {msg.profiles.username}
                    </span>
                    {getUserBadge(msg.user_id, msg.message)}
                    {blockInfo && (
                      <span className="text-xs text-destructive flex items-center gap-1 ml-1">
                        <Ban className="w-3 h-3" />
                        Заблокирован
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(msg.created_at).toLocaleTimeString('ru-RU', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                    
                    {/* Moderation menu */}
                    {canModerate && !isChannelOwner(msg.user_id) && !msg.isSystem && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100">
                            <MoreVertical className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => pinMessage(msg.id)}>
                            <Pin className="w-4 h-4 mr-2" />
                            {t("pin")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {isOwner && availableSubscriptions.length > 0 && (
                            <DropdownMenuItem onClick={() => openGrantDialog(msg.user_id, msg.profiles.username)}>
                              <Gift className="w-4 h-4 mr-2" />
                              Выдать подписку
                            </DropdownMenuItem>
                          )}
                          {isOwner && (
                            <DropdownMenuItem onClick={() => toggleModerator(msg.user_id, isModerator(msg.user_id))}>
                              {isModerator(msg.user_id) ? (
                                <>
                                  <UserMinus className="w-4 h-4 mr-2" />
                                  {t("remove_moderator")}
                                </>
                              ) : (
                                <>
                                  <UserPlus className="w-4 h-4 mr-2" />
                                  {t("make_moderator")}
                                </>
                              )}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem 
                            onClick={() => deleteMessageAndBan(msg.id, msg.user_id, msg.message)}
                            className="text-orange-500"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Удалить и забанить
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => toggleBlockUser(msg.user_id)}
                            className="text-destructive"
                          >
                            <Ban className="w-4 h-4 mr-2" />
                            {isUserBlocked(msg.user_id) ? t("unblock") : t("block")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  <p className="text-sm mt-0.5 break-words">{msg.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <form onSubmit={sendMessage} className="p-4 border-t border-border">
        {!settingsLoaded ? (
          <div className="flex justify-center py-2">
            <span className="text-xs text-muted-foreground">Загрузка...</span>
          </div>
        ) : !canWrite ? (
          <div className="text-center py-2">
            <span className="text-xs text-muted-foreground">{chatRestrictionMessage}</span>
          </div>
        ) : (
          <div className="flex gap-2">
            <div className="flex-1 flex gap-1">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={t("write_message")}
                disabled={isLoading}
                maxLength={500}
                className="bg-muted/50 flex-1"
              />
              <ChatEmojiPicker onEmojiSelect={(emoji) => setNewMessage(prev => prev + emoji)} />
            </div>
            <Button 
              type="submit" 
              size="icon"
              disabled={isLoading || !newMessage.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
      </form>

      {/* Grant Subscription Dialog */}
      <Dialog open={showGrantDialog} onOpenChange={setShowGrantDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5" />
              Выдать подписку
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Выдать подписку пользователю <strong>{grantUsername}</strong>:
            </p>
            <Select value={selectedSubscription} onValueChange={setSelectedSubscription}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите подписку" />
              </SelectTrigger>
              <SelectContent>
                {availableSubscriptions.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id}>
                    <div className="flex items-center gap-2">
                      <span>{sub.badge_emoji}</span>
                      <span>{sub.title}</span>
                      <span className="text-muted-foreground">({sub.duration_days} дней)</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={grantSubscription} className="w-full" disabled={!selectedSubscription}>
              <Gift className="w-4 h-4 mr-2" />
              Выдать подписку
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EnhancedLiveChat;
