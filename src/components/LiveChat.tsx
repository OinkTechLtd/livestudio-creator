import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Crown, Shield, UserPlus, UserMinus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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

interface LiveChatProps {
  channelId: string;
  channelOwnerId?: string;
}

const LiveChat = ({ channelId, channelOwnerId }: LiveChatProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [moderators, setModerators] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
    fetchModerators();
    
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

  const isOwner = user?.id === channelOwnerId;
  const isModerator = (userId: string) => moderators.includes(userId);
  const isChannelOwner = (userId: string) => userId === channelOwnerId;

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
                  {isOwner && !isChannelOwner(msg.user_id) ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className={`text-sm hover:underline ${getUsernameColor(msg.user_id)}`}>
                          {msg.profiles.username}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
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
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <span className={`text-sm ${getUsernameColor(msg.user_id)}`}>
                      {msg.profiles.username}
                    </span>
                  )}
                  {getUserBadge(msg.user_id)}
                  <span className="text-xs text-muted-foreground">
                    {new Date(msg.created_at).toLocaleTimeString('ru-RU', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
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

export default LiveChat;
