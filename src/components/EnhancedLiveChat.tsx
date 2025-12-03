import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Crown, Shield, UserPlus, UserMinus, Pin, Ban, MoreVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface ChatMessage {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
}

interface PinnedMessage {
  id: string;
  message_id: string;
  chat_messages: ChatMessage;
}

interface EnhancedLiveChatProps {
  channelId: string;
  channelOwnerId?: string;
}

const EnhancedLiveChat = ({ channelId, channelOwnerId }: EnhancedLiveChatProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [moderators, setModerators] = useState<string[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [pinnedMessage, setPinnedMessage] = useState<ChatMessage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
    fetchModerators();
    fetchBlockedUsers();
    fetchPinnedMessage();
    
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId]);

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

  const fetchBlockedUsers = async () => {
    const { data } = await supabase
      .from('chat_blocked_users')
      .select('user_id')
      .eq('channel_id', channelId);

    if (data) {
      setBlockedUsers(data.map(b => b.user_id));
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
        title: "Требуется авторизация",
        description: "Войдите чтобы отправлять сообщения",
        variant: "destructive",
      });
      return;
    }

    if (blockedUsers.includes(user.id)) {
      toast({
        title: "Заблокировано",
        description: "Вы заблокированы в этом чате",
        variant: "destructive",
      });
      return;
    }

    if (!newMessage.trim()) return;

    setIsLoading(true);
    const { error } = await supabase
      .from('chat_messages')
      .insert({
        channel_id: channelId,
        user_id: user.id,
        message: newMessage.trim()
      });

    if (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось отправить сообщение",
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
        toast({ title: "Модератор удален" });
      }
    } else {
      const { error } = await supabase
        .from('channel_moderators')
        .insert({ channel_id: channelId, user_id: userId });

      if (!error) {
        setModerators(prev => [...prev, userId]);
        toast({ title: "Модератор назначен" });
      }
    }
  };

  const toggleBlockUser = async (userId: string) => {
    if (!user) return;
    
    const isBlocked = blockedUsers.includes(userId);
    
    if (isBlocked) {
      const { error } = await supabase
        .from('chat_blocked_users')
        .delete()
        .eq('channel_id', channelId)
        .eq('user_id', userId);

      if (!error) {
        setBlockedUsers(prev => prev.filter(id => id !== userId));
        toast({ title: "Пользователь разблокирован" });
      }
    } else {
      const { error } = await supabase
        .from('chat_blocked_users')
        .insert({ 
          channel_id: channelId, 
          user_id: userId,
          blocked_by: user.id
        });

      if (!error) {
        setBlockedUsers(prev => [...prev, userId]);
        toast({ title: "Пользователь заблокирован" });
      }
    }
  };

  const pinMessage = async (messageId: string) => {
    if (!user) return;

    // First unpin existing
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
      toast({ title: "Сообщение закреплено" });
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
      toast({ title: "Сообщение откреплено" });
    }
  };

  const isOwner = user?.id === channelOwnerId;
  const isModerator = (userId: string) => moderators.includes(userId);
  const isChannelOwner = (userId: string) => userId === channelOwnerId;
  const canModerate = isOwner || (user && isModerator(user.id));

  const getUserBadge = (userId: string) => {
    if (isChannelOwner(userId)) {
      return (
        <span title="Владелец канала">
          <Crown className="w-4 h-4 text-yellow-500 inline-block ml-1" />
        </span>
      );
    }
    if (isModerator(userId)) {
      return (
        <span title="Модератор">
          <Shield className="w-4 h-4 text-green-500 inline-block ml-1" />
        </span>
      );
    }
    return null;
  };

  const getUsernameColor = (userId: string) => {
    if (isChannelOwner(userId)) return "text-yellow-500 font-bold";
    if (isModerator(userId)) return "text-green-500 font-semibold";
    return "font-medium";
  };

  return (
    <div className="flex flex-col h-full bg-background border-l border-border">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          Live чат
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        </h3>
        <p className="text-sm text-muted-foreground">{messages.length} сообщений</p>
      </div>

      {/* Pinned Message */}
      {pinnedMessage && (
        <div className="p-3 bg-primary/10 border-b border-primary/20">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Pin className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-primary">Закреплено</span>
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
          {messages.map((msg) => (
            <div key={msg.id} className="flex gap-2 group hover:bg-muted/30 p-2 rounded-lg transition-colors">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarImage src={msg.profiles.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {msg.profiles.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className={`text-sm ${getUsernameColor(msg.user_id)}`}>
                    {msg.profiles.username}
                  </span>
                  {getUserBadge(msg.user_id)}
                  <span className="text-xs text-muted-foreground">
                    {new Date(msg.created_at).toLocaleTimeString('ru-RU', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                  
                  {/* Moderation menu */}
                  {canModerate && !isChannelOwner(msg.user_id) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100">
                          <MoreVertical className="w-3 h-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => pinMessage(msg.id)}>
                          <Pin className="w-4 h-4 mr-2" />
                          Закрепить
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {isOwner && (
                          <DropdownMenuItem onClick={() => toggleModerator(msg.user_id, isModerator(msg.user_id))}>
                            {isModerator(msg.user_id) ? (
                              <>
                                <UserMinus className="w-4 h-4 mr-2" />
                                Убрать модератора
                              </>
                            ) : (
                              <>
                                <UserPlus className="w-4 h-4 mr-2" />
                                Назначить модератором
                              </>
                            )}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          onClick={() => toggleBlockUser(msg.user_id)}
                          className="text-destructive"
                        >
                          <Ban className="w-4 h-4 mr-2" />
                          {blockedUsers.includes(msg.user_id) ? "Разблокировать" : "Заблокировать"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <p className="text-sm mt-0.5 break-words">{msg.message}</p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <form onSubmit={sendMessage} className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={user ? "Написать сообщение..." : "Войдите для отправки"}
            disabled={!user || isLoading}
            maxLength={500}
            className="bg-muted/50"
          />
          <Button 
            type="submit" 
            size="icon"
            disabled={!user || isLoading || !newMessage.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default EnhancedLiveChat;
