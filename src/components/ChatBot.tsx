import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Bot, Trash2, Plus, Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  const [isOpen, setIsOpen] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [newInterval, setNewInterval] = useState(60);

  useEffect(() => {
    if (isOwner) {
      fetchBotMessages();
    }
  }, [channelId, isOwner]);

  // Run bot messages
  useEffect(() => {
    if (!botMessages.length) return;

    const intervals: NodeJS.Timeout[] = [];

    botMessages.forEach((bot) => {
      if (bot.is_active) {
        const intervalId = setInterval(async () => {
          // Send bot message to chat
          await supabase.from("chat_messages").insert({
            channel_id: channelId,
            user_id: user?.id || "00000000-0000-0000-0000-000000000000",
            message: `🤖 ${bot.message}`,
          });
        }, bot.interval_seconds * 1000);

        intervals.push(intervalId);
      }
    });

    return () => {
      intervals.forEach(clearInterval);
    };
  }, [botMessages, channelId]);

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

  const addBotMessage = async () => {
    if (!newMessage.trim()) return;

    const { error } = await supabase.from("chat_bot_messages").insert({
      channel_id: channelId,
      message: newMessage.trim(),
      interval_seconds: newInterval,
      is_active: true,
    });

    if (!error) {
      toast({ title: "Сообщение бота добавлено" });
      setNewMessage("");
      setNewInterval(60);
      fetchBotMessages();
    }
  };

  const toggleBotMessage = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from("chat_bot_messages")
      .update({ is_active: !isActive })
      .eq("id", id);

    if (!error) {
      fetchBotMessages();
    }
  };

  const deleteBotMessage = async (id: string) => {
    const { error } = await supabase.from("chat_bot_messages").delete().eq("id", id);

    if (!error) {
      toast({ title: "Сообщение бота удалено" });
      fetchBotMessages();
    }
  };

  if (!isOwner) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Bot className="w-4 h-4" />
          Чат-бот
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            Настройка чат-бота
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add new bot message */}
          <Card>
            <CardHeader>
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
                  rows={3}
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
              <Button onClick={addBotMessage} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Добавить
              </Button>
            </CardContent>
          </Card>

          {/* Existing bot messages */}
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Активные сообщения ({botMessages.length})
            </h4>
            
            {botMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Нет настроенных сообщений бота
              </p>
            ) : (
              <div className="space-y-2">
                {botMessages.map((bot) => (
                  <Card key={bot.id} className={!bot.is_active ? "opacity-50" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-sm">{bot.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Каждые {bot.interval_seconds} сек
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={bot.is_active}
                            onCheckedChange={() => toggleBotMessage(bot.id, bot.is_active)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteBotMessage(bot.id)}
                            className="text-destructive hover:text-destructive"
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
      </DialogContent>
    </Dialog>
  );
};

export default ChatBot;
