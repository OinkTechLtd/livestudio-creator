import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
}

const LiveChat = ({ channelId }: LiveChatProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
    
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

  return (
    <div className="flex flex-col h-full bg-background border-l border-border">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-lg">Live чат</h3>
        <p className="text-sm text-muted-foreground">{messages.length} сообщений</p>
      </div>

      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className="flex gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={msg.profiles.avatar_url || undefined} />
                <AvatarFallback>
                  {msg.profiles.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-sm">{msg.profiles.username}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(msg.created_at).toLocaleTimeString('ru-RU', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                </div>
                <p className="text-sm mt-1 break-words">{msg.message}</p>
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
            placeholder="Написать сообщение..."
            disabled={!user || isLoading}
            maxLength={500}
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