import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Settings, MessageSquare, Clock, Save } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ChatSettingsProps {
  channelId: string;
  isOwner: boolean;
}

const ChatSettings = ({ channelId, isOwner }: ChatSettingsProps) => {
  const { toast } = useToast();
  const [subscribersOnly, setSubscribersOnly] = useState(false);
  const [waitMinutes, setWaitMinutes] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [channelId]);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("channels")
      .select("chat_subscribers_only, chat_subscriber_wait_minutes")
      .eq("id", channelId)
      .single();

    if (data) {
      setSubscribersOnly(data.chat_subscribers_only || false);
      setWaitMinutes(data.chat_subscriber_wait_minutes || 0);
    }
  };

  const saveSettings = async () => {
    setLoading(true);
    
    const { error } = await supabase
      .from("channels")
      .update({
        chat_subscribers_only: subscribersOnly,
        chat_subscriber_wait_minutes: waitMinutes,
      })
      .eq("id", channelId);

    setLoading(false);

    if (!error) {
      toast({
        title: "Настройки сохранены",
        description: "Настройки чата успешно обновлены",
      });
    } else {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить настройки",
        variant: "destructive",
      });
    }
  };

  if (!isOwner) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Настройки чата
        </CardTitle>
        <CardDescription>
          Управление доступом к чату канала
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Чат только для подписчиков
            </Label>
            <p className="text-sm text-muted-foreground">
              Только подписчики канала могут писать в чат
            </p>
          </div>
          <Switch
            checked={subscribersOnly}
            onCheckedChange={setSubscribersOnly}
          />
        </div>

        {subscribersOnly && (
          <div className="space-y-2 pl-6 border-l-2 border-muted">
            <Label className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Время ожидания (минуты)
            </Label>
            <p className="text-sm text-muted-foreground mb-2">
              Сколько минут должен быть подписан пользователь, чтобы писать в чат
            </p>
            <Input
              type="number"
              min={0}
              max={10080}
              value={waitMinutes}
              onChange={(e) => setWaitMinutes(Number(e.target.value))}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              0 = сразу, 60 = 1 час, 1440 = 1 день
            </p>
          </div>
        )}

        <Button onClick={saveSettings} disabled={loading} className="gap-2">
          <Save className="w-4 h-4" />
          Сохранить настройки
        </Button>
      </CardContent>
    </Card>
  );
};

export default ChatSettings;
