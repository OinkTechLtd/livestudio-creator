import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Crown, Plus, Trash2, Clock, Gift, UserPlus } from "lucide-react";
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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PremiumSubscription {
  id: string;
  title: string;
  description: string | null;
  cost: number;
  duration_days: number;
  badge_emoji: string;
  is_active: boolean;
}

interface UserPremiumSub {
  id: string;
  subscription_id: string;
  purchased_at: string;
  expires_at: string;
  is_manual_grant: boolean;
  premium_subscriptions: PremiumSubscription;
}

interface PremiumSubscriptionsProps {
  channelId: string;
  isOwner: boolean;
  userPoints?: number;
  onPointsChange?: () => void;
}

const PremiumSubscriptions = ({ channelId, isOwner, userPoints = 0, onPointsChange }: PremiumSubscriptionsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subscriptions, setSubscriptions] = useState<PremiumSubscription[]>([]);
  const [userSubs, setUserSubs] = useState<UserPremiumSub[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isManageOpen, setIsManageOpen] = useState(false);
  
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCost, setNewCost] = useState(500);
  const [newDuration, setNewDuration] = useState(30);
  const [newBadge, setNewBadge] = useState("⭐");

  useEffect(() => {
    fetchSubscriptions();
    if (user) {
      fetchUserSubscriptions();
    }
  }, [channelId, user]);

  const fetchSubscriptions = async () => {
    const { data } = await supabase
      .from("premium_subscriptions")
      .select("*")
      .eq("channel_id", channelId)
      .eq("is_active", true)
      .order("cost", { ascending: true });

    if (data) {
      setSubscriptions(data);
    }
  };

  const fetchUserSubscriptions = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("user_premium_subscriptions")
      .select(`
        *,
        premium_subscriptions (*)
      `)
      .eq("channel_id", channelId)
      .eq("user_id", user.id)
      .gte("expires_at", new Date().toISOString());

    if (data) {
      setUserSubs(data as any);
    }
  };

  const addSubscription = async () => {
    if (!newTitle.trim()) return;

    const { error } = await supabase.from("premium_subscriptions").insert({
      channel_id: channelId,
      title: newTitle.trim(),
      description: newDescription.trim() || null,
      cost: newCost,
      duration_days: newDuration,
      badge_emoji: newBadge,
      is_active: true,
    });

    if (!error) {
      toast({ title: "Подписка создана" });
      setNewTitle("");
      setNewDescription("");
      setNewCost(500);
      setNewDuration(30);
      setNewBadge("⭐");
      fetchSubscriptions();
    }
  };

  const deleteSubscription = async (subId: string) => {
    const { error } = await supabase
      .from("premium_subscriptions")
      .delete()
      .eq("id", subId);

    if (!error) {
      toast({ title: "Подписка удалена" });
      fetchSubscriptions();
    }
  };

  const purchaseSubscription = async (sub: PremiumSubscription) => {
    if (!user) return;

    if (userPoints < sub.cost) {
      toast({
        title: "Недостаточно баллов",
        description: `Нужно ${sub.cost}, у вас ${userPoints}`,
        variant: "destructive",
      });
      return;
    }

    // Deduct points
    const { data: points } = await supabase
      .from("channel_points")
      .select("points")
      .eq("channel_id", channelId)
      .eq("user_id", user.id)
      .single();

    if (!points) return;

    await supabase
      .from("channel_points")
      .update({ points: points.points - sub.cost })
      .eq("channel_id", channelId)
      .eq("user_id", user.id);

    // Create subscription
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + sub.duration_days);

    const { error } = await supabase.from("user_premium_subscriptions").insert({
      user_id: user.id,
      channel_id: channelId,
      subscription_id: sub.id,
      expires_at: expiresAt.toISOString(),
    });

    if (!error) {
      // Get user profile for chat message
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();

      // Send chat message
      await supabase.from("chat_messages").insert({
        channel_id: channelId,
        user_id: user.id,
        message: `🎉 ${profile?.username || "Пользователь"} купил подписку "${sub.title}" сроком на ${sub.duration_days} дней!`,
      });

      toast({
        title: "Подписка оформлена!",
        description: `Вы получили: ${sub.title} на ${sub.duration_days} дней`,
      });
      
      fetchUserSubscriptions();
      onPointsChange?.();
    }
  };

  const hasActiveSubscription = (subId: string) => {
    return userSubs.some(s => s.subscription_id === subId);
  };

  const getExpirationDate = (subId: string) => {
    const sub = userSubs.find(s => s.subscription_id === subId);
    if (sub) {
      return new Date(sub.expires_at).toLocaleDateString("ru-RU");
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Crown className="w-5 h-5 text-yellow-500" />
          Подписки
        </h3>
        {isOwner && (
          <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Управление
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Управление подписками</DialogTitle>
              </DialogHeader>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Новая подписка</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Название</Label>
                      <Input
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="VIP подписка"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Значок</Label>
                      <Input
                        value={newBadge}
                        onChange={(e) => setNewBadge(e.target.value)}
                        placeholder="⭐"
                        maxLength={2}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Описание</Label>
                    <Input
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="Описание подписки"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Стоимость (баллы)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={newCost}
                        onChange={(e) => setNewCost(Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Длительность (дней)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={newDuration}
                        onChange={(e) => setNewDuration(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <Button onClick={addSubscription} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Создать подписку
                  </Button>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <h4 className="font-medium">Текущие подписки ({subscriptions.length})</h4>
                {subscriptions.map((sub) => (
                  <Card key={sub.id}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{sub.badge_emoji}</span>
                        <div>
                          <p className="font-medium">{sub.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {sub.cost} баллов • {sub.duration_days} дней
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteSubscription(sub.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {subscriptions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Crown className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Подписки пока не добавлены</p>
        </div>
      ) : (
        <div className="space-y-2">
          {subscriptions.map((sub) => (
            <Card key={sub.id} className={hasActiveSubscription(sub.id) ? "border-primary bg-primary/5" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{sub.badge_emoji}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{sub.title}</span>
                        {hasActiveSubscription(sub.id) && (
                          <Badge variant="default" className="text-xs">
                            Активна до {getExpirationDate(sub.id)}
                          </Badge>
                        )}
                      </div>
                      {sub.description && (
                        <p className="text-sm text-muted-foreground">{sub.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Gift className="w-3 h-3" />
                          {sub.cost} баллов
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {sub.duration_days} дней
                        </span>
                      </div>
                    </div>
                  </div>
                  {user && !hasActiveSubscription(sub.id) && (
                    <Button
                      size="sm"
                      onClick={() => purchaseSubscription(sub)}
                      disabled={userPoints < sub.cost}
                    >
                      Купить
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PremiumSubscriptions;
