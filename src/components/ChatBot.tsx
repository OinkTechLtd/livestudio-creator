import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Bot, Trash2, Plus, Settings, Play, Pause } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface BotMessage {
  id: string;
  message: string;
  interval_seconds: number;
  is_active: boolean;
}

interface ChatBotProps {
  channelId: string;
  isOwner: boolean;
}

const ChatBot = ({ channelId, isOwner }: ChatBotProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [botMessages, setBotMessages] = useState<BotMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [newInterval, setNewInterval] = useState(60);
  const [isBotRunning, setIsBotRunning] = useState(false);
  const intervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    if (isOwner) {
      fetchBotMessages();
    }
    
    return () => {
      // Clear all intervals on unmount
      intervalsRef.current.forEach(interval => clearInterval(interval));
      intervalsRef.current.clear();
    };
  }, [channelId, isOwner]);

  const fetchBotMessages = async () => {
    const { data } = await supabase
      .from("chat_bot_messages")
      .select("*")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: true });

    if (data) {
      setBotMessages(data);
    }
  };

  const sendBotMessage = useCallback(async (message: string) => {
    if (!user) return;

    try {
      await supabase.from("chat_messages").insert({
        channel_id: channelId,
        user_id: user.id,
        message: `🤖 ${message}`,
      });
      console.log("Bot message sent:", message);
    } catch (error) {
      console.error("Error sending bot message:", error);
    }
  }, [channelId, user]);

  const startBot = useCallback(() => {
    if (!user) {
      toast({
        title: "Ошибка",
        description: "Необходимо авторизоваться",
        variant: "destructive",
      });
      return;
    }

    // Clear existing intervals
    intervalsRef.current.forEach(interval => clearInterval(interval));
    intervalsRef.current.clear();

    const activeMessages = botMessages.filter(m => m.is_active);
    
    if (activeMessages.length === 0) {
      toast({
        title: "Нет активных сообщений",
        description: "Активируйте хотя бы одно сообщение",
        variant: "destructive",
      });
      return;
    }

    activeMessages.forEach((bot) => {
      // Send first message immediately
      sendBotMessage(bot.message);
      
      // Then set interval for subsequent messages
      const intervalId = setInterval(() => {
        sendBotMessage(bot.message);
      }, bot.interval_seconds * 1000);

      intervalsRef.current.set(bot.id, intervalId);
    });

    setIsBotRunning(true);
    toast({
      title: "Бот запущен",
      description: `Активно ${activeMessages.length} сообщений`,
    });
  }, [botMessages, sendBotMessage, toast, user]);

  const stopBot = useCallback(() => {
    intervalsRef.current.forEach(interval => clearInterval(interval));
    intervalsRef.current.clear();
    setIsBotRunning(false);
    toast({ title: "Бот остановлен" });
  }, [toast]);

  const addBotMessage = async () => {
    if (!newMessage.trim()) return;

    const { error } = await supabase.from("chat_bot_messages").insert({
      channel_id: channelId,
      message: newMessage.trim(),
      interval_seconds: Math.max(30, Math.min(3600, newInterval)),
      is_active: true,
    });

    if (!error) {
      toast({ title: "Сообщение бота добавлено" });
      setNewMessage("");
      setNewInterval(60);
      fetchBotMessages();
    } else {
      toast({ 
        title: "Ошибка", 
        description: error.message,
        variant: "destructive" 
      });
    }
  };

  const toggleBotMessage = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from("chat_bot_messages")
      .update({ is_active: !isActive })
      .eq("id", id);

    if (!error) {
      fetchBotMessages();
      // If bot is running, restart to apply changes
      if (isBotRunning) {
        stopBot();
      }
    }
  };

  const deleteBotMessage = async (id: string) => {
    // Clear interval if exists
    const interval = intervalsRef.current.get(id);
    if (interval) {
      clearInterval(interval);
      intervalsRef.current.delete(id);
    }

    const { error } = await supabase
      .from("chat_bot_messages")
      .delete()
      .eq("id", id);

    if (!error) {
      toast({ title: "Сообщение бота удалено" });
      fetchBotMessages();
    }
  };

  if (!isOwner) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Bot className="w-5 h-5" />
          Чат-бот
        </h3>
        <div className="flex gap-2">
          {!isBotRunning ? (
            <Button onClick={startBot} size="sm" className="gap-2">
              <Play className="w-4 h-4" />
              Запустить бота
            </Button>
          ) : (
            <Button onClick={stopBot} size="sm" variant="destructive" className="gap-2">
              <Pause className="w-4 h-4" />
              Остановить
            </Button>
          )}
        </div>
      </div>

      {isBotRunning && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm text-green-400">Бот работает и отправляет сообщения в чат</span>
        </div>
      )}

      {/* Add new bot message */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Добавить новое сообщение
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Текст сообщения</Label>
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Например: Подпишитесь на канал! 🔔"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Интервал отправки (секунды)</Label>
            <Input
              type="number"
              min={30}
              max={3600}
              value={newInterval}
              onChange={(e) => setNewInterval(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Минимум 30 секунд, максимум 1 час
            </p>
          </div>
          <Button onClick={addBotMessage} className="w-full" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Добавить
          </Button>
        </CardContent>
      </Card>

      {/* Existing bot messages */}
      <div className="space-y-2">
        <h4 className="font-medium flex items-center gap-2 text-sm">
          <Settings className="w-4 h-4" />
          Сообщения бота ({botMessages.length})
        </h4>
        
        {botMessages.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Нет настроенных сообщений бота
          </p>
        ) : (
          <div className="space-y-2">
            {botMessages.map((bot) => (
              <Card key={bot.id} className={!bot.is_active ? "opacity-50" : ""}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm break-words">{bot.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Каждые {bot.interval_seconds} сек
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Switch
                        checked={bot.is_active}
                        onCheckedChange={() => toggleBotMessage(bot.id, bot.is_active)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteBotMessage(bot.id)}
                        className="text-destructive hover:text-destructive h-8 w-8"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatBot;
