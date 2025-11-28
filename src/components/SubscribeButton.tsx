import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface SubscribeButtonProps {
  channelId: string;
  channelTitle: string;
}

const SubscribeButton = ({ channelId, channelTitle }: SubscribeButtonProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);

  useEffect(() => {
    if (user) {
      checkSubscription();
    }
    fetchSubscriberCount();
  }, [channelId, user]);

  const checkSubscription = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("channel_id", channelId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      setIsSubscribed(!!data);
    } catch (error) {
      console.error("Error checking subscription:", error);
    }
  };

  const fetchSubscriberCount = async () => {
    try {
      const { count, error } = await supabase
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("channel_id", channelId);

      if (error) throw error;
      setSubscriberCount(count || 0);
    } catch (error) {
      console.error("Error fetching subscriber count:", error);
    }
  };

  const handleSubscribe = async () => {
    if (!user) {
      toast({
        title: "Требуется авторизация",
        description: "Войдите, чтобы подписаться на канал",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      if (isSubscribed) {
        // Unsubscribe
        const { error } = await supabase
          .from("subscriptions")
          .delete()
          .eq("channel_id", channelId)
          .eq("user_id", user.id);

        if (error) throw error;

        setIsSubscribed(false);
        setSubscriberCount((prev) => Math.max(0, prev - 1));
        toast({
          title: "Отписка выполнена",
          description: `Вы отписались от канала "${channelTitle}"`,
        });
      } else {
        // Subscribe
        const { error } = await supabase
          .from("subscriptions")
          .insert({
            channel_id: channelId,
            user_id: user.id,
          });

        if (error) throw error;

        setIsSubscribed(true);
        setSubscriberCount((prev) => prev + 1);
        toast({
          title: "Подписка оформлена",
          description: `Вы подписались на канал "${channelTitle}"`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось выполнить операцию",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Button
        onClick={handleSubscribe}
        disabled={loading}
        variant={isSubscribed ? "outline" : "default"}
        size="lg"
      >
        {isSubscribed ? (
          <>
            <BellOff className="w-4 h-4 mr-2" />
            Отписаться
          </>
        ) : (
          <>
            <Bell className="w-4 h-4 mr-2" />
            Подписаться
          </>
        )}
      </Button>
      <span className="text-sm text-muted-foreground">
        {subscriberCount} {subscriberCount === 1 ? "подписчик" : "подписчиков"}
      </span>
    </div>
  );
};

export default SubscribeButton;
