import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Coins, Gift, Plus, Trash2, Star } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";

interface Reward {
  id: string;
  title: string;
  description: string | null;
  cost: number;
  is_active: boolean;
}

interface UserPoints {
  points: number;
  total_watch_time: number;
  messages_sent: number;
}

interface PointsRewardsSystemProps {
  channelId: string;
  isOwner: boolean;
}

const PointsRewardsSystem = ({ channelId, isOwner }: PointsRewardsSystemProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [userPoints, setUserPoints] = useState<UserPoints | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [newRewardTitle, setNewRewardTitle] = useState("");
  const [newRewardDescription, setNewRewardDescription] = useState("");
  const [newRewardCost, setNewRewardCost] = useState(100);

  useEffect(() => {
    fetchRewards();
    if (user) {
      fetchUserPoints();
      startPointsAccumulation();
    }
  }, [channelId, user]);

  const fetchRewards = async () => {
    const { data } = await supabase
      .from("channel_rewards")
      .select("*")
      .eq("channel_id", channelId)
      .eq("is_active", true)
      .order("cost", { ascending: true });

    if (data) {
      setRewards(data);
    }
  };

  const fetchUserPoints = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("channel_points")
      .select("points, total_watch_time, messages_sent")
      .eq("channel_id", channelId)
      .eq("user_id", user.id)
      .single();

    if (data) {
      setUserPoints(data);
    } else {
      // Create initial points record
      await supabase.from("channel_points").insert({
        channel_id: channelId,
        user_id: user.id,
        points: 0,
        total_watch_time: 0,
        messages_sent: 0,
      });
      setUserPoints({ points: 0, total_watch_time: 0, messages_sent: 0 });
    }
  };

  const startPointsAccumulation = () => {
    if (!user) return;

    // Award points for watching every minute
    const watchInterval = setInterval(async () => {
      try {
        // Update points directly
        const { data: currentPoints } = await supabase
          .from("channel_points")
          .select("points, total_watch_time")
          .eq("channel_id", channelId)
          .eq("user_id", user.id)
          .single();

        if (currentPoints) {
          await supabase
            .from("channel_points")
            .update({
              points: currentPoints.points + 1,
              total_watch_time: currentPoints.total_watch_time + 60,
              updated_at: new Date().toISOString(),
            })
            .eq("channel_id", channelId)
            .eq("user_id", user.id);
        }
      } catch (error) {
        console.error("Error updating points:", error);
      }

      // Refresh points
      fetchUserPoints();
    }, 60000); // Every minute

    return () => clearInterval(watchInterval);
  };

  const addReward = async () => {
    if (!newRewardTitle.trim()) return;

    const { error } = await supabase.from("channel_rewards").insert({
      channel_id: channelId,
      title: newRewardTitle.trim(),
      description: newRewardDescription.trim() || null,
      cost: newRewardCost,
      is_active: true,
    });

    if (!error) {
      toast({ title: "Награда добавлена" });
      setNewRewardTitle("");
      setNewRewardDescription("");
      setNewRewardCost(100);
      fetchRewards();
    }
  };

  const deleteReward = async (rewardId: string) => {
    const { error } = await supabase
      .from("channel_rewards")
      .delete()
      .eq("id", rewardId);

    if (!error) {
      toast({ title: "Награда удалена" });
      fetchRewards();
    }
  };

  const redeemReward = async (reward: Reward) => {
    if (!user || !userPoints) return;

    if (userPoints.points < reward.cost) {
      toast({
        title: "Недостаточно баллов",
        description: `Нужно ${reward.cost}, у вас ${userPoints.points}`,
        variant: "destructive",
      });
      return;
    }

    // Deduct points
    const { error: pointsError } = await supabase
      .from("channel_points")
      .update({ points: userPoints.points - reward.cost })
      .eq("channel_id", channelId)
      .eq("user_id", user.id);

    if (pointsError) {
      toast({ title: "Ошибка", variant: "destructive" });
      return;
    }

    // Create redemption record
    const { error: redemptionError } = await supabase
      .from("reward_redemptions")
      .insert({
        reward_id: reward.id,
        user_id: user.id,
        channel_id: channelId,
        status: "pending",
      });

    if (!redemptionError) {
      toast({
        title: "Награда получена!",
        description: `Вы получили: ${reward.title}`,
      });
      fetchUserPoints();
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* User Points Display */}
      {user && userPoints && (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Coins className="w-4 h-4 text-yellow-500" />
              <span className="font-bold">{userPoints.points}</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Gift className="w-5 h-5" />
                Награды канала
              </DialogTitle>
            </DialogHeader>

            {/* User Stats */}
            <Card className="bg-gradient-to-br from-primary/10 to-secondary/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Ваши баллы</p>
                    <p className="text-3xl font-bold flex items-center gap-2">
                      <Coins className="w-6 h-6 text-yellow-500" />
                      {userPoints.points}
                    </p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>Время просмотра: {Math.floor(userPoints.total_watch_time / 60)} мин</p>
                    <p>Сообщений: {userPoints.messages_sent}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Available Rewards */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {rewards.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Награды пока не добавлены
                </p>
              ) : (
                rewards.map((reward) => (
                  <Card key={reward.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Star className="w-4 h-4 text-yellow-500" />
                            <span className="font-medium">{reward.title}</span>
                          </div>
                          {reward.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {reward.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="gap-1">
                            <Coins className="w-3 h-3" />
                            {reward.cost}
                          </Badge>
                          <Button
                            size="sm"
                            onClick={() => redeemReward(reward)}
                            disabled={userPoints.points < reward.cost}
                          >
                            Получить
                          </Button>
                        </div>
                      </div>
                      {userPoints.points < reward.cost && (
                        <Progress
                          value={(userPoints.points / reward.cost) * 100}
                          className="mt-2 h-1"
                        />
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Owner: Manage Rewards */}
      {isOwner && (
        <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Gift className="w-4 h-4" />
              Управление наградами
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Управление наградами</DialogTitle>
            </DialogHeader>

            {/* Add New Reward */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Добавить награду</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Название</Label>
                  <Input
                    value={newRewardTitle}
                    onChange={(e) => setNewRewardTitle(e.target.value)}
                    placeholder="Например: VIP статус на неделю"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Описание (опционально)</Label>
                  <Input
                    value={newRewardDescription}
                    onChange={(e) => setNewRewardDescription(e.target.value)}
                    placeholder="Описание награды"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Стоимость (баллы)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={newRewardCost}
                    onChange={(e) => setNewRewardCost(Number(e.target.value))}
                  />
                </div>
                <Button onClick={addReward} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Добавить награду
                </Button>
              </CardContent>
            </Card>

            {/* Existing Rewards */}
            <div className="space-y-2">
              <h4 className="font-medium">Текущие награды ({rewards.length})</h4>
              {rewards.map((reward) => (
                <Card key={reward.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{reward.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {reward.cost} баллов
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteReward(reward.id)}
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
  );
};

export default PointsRewardsSystem;
