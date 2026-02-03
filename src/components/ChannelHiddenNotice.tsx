import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ChannelHiddenNoticeProps {
  channelId: string;
  hiddenReason: string | null;
  isOwner: boolean;
}

const ChannelHiddenNotice = ({ channelId, hiddenReason, isOwner }: ChannelHiddenNoticeProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [appealReason, setAppealReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAppealed, setHasAppealed] = useState(false);

  const submitAppeal = async () => {
    if (!user || !appealReason.trim()) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("channel_appeals").insert({
        channel_id: channelId,
        user_id: user.id,
        reason: appealReason.trim(),
        status: "pending",
      });

      if (error) throw error;

      toast({
        title: "Апелляция отправлена",
        description: "Мы рассмотрим вашу апелляцию в ближайшее время",
      });
      setHasAppealed(true);
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось отправить апелляцию",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOwner) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="max-w-md w-full bg-destructive/10 border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Канал скрыт
            </CardTitle>
            <CardDescription>
              {hiddenReason
                ? `Этот канал был скрыт: ${hiddenReason}`
                : "Этот канал был скрыт из-за нарушения правил платформы"}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[50vh] p-4">
      <Card className="max-w-lg w-full bg-destructive/10 border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Ваш канал скрыт
          </CardTitle>
          <CardDescription>
            Ваш канал скрыт. Причина указана ниже.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hiddenReason && (
            <div className="p-3 bg-background rounded-lg border border-border">
              <p className="text-sm font-medium mb-1">Причина:</p>
              <p className="text-sm text-muted-foreground">{hiddenReason}</p>
            </div>
          )}

          {!hasAppealed ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Если вы считаете, что это ошибка, вы можете подать апелляцию. 
                Наша система проанализирует вашу заявку и примет решение.
              </p>
              <Textarea
                value={appealReason}
                onChange={(e) => setAppealReason(e.target.value)}
                placeholder="Объясните, почему ваш канал не должен быть скрыт..."
                rows={4}
              />
              <Button 
                onClick={submitAppeal} 
                disabled={isSubmitting || !appealReason.trim()}
                className="w-full"
              >
                <Send className="w-4 h-4 mr-2" />
                Обжаловать
              </Button>
            </div>
          ) : (
            <div className="p-3 bg-primary/10 rounded-lg border border-primary/30">
              <p className="text-sm text-primary">
                Ваша апелляция отправлена и находится на рассмотрении. 
                Мы уведомим вас о результате.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ChannelHiddenNotice;
