import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Dices, Plus, Trash2, Sparkles, History, Trophy, Settings } from "lucide-react";
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

interface Prize {
  id: string;
  title: string;
  description: string | null;
  prize_type: string;
  prize_value: string | null;
  chance_percent: number;
  is_active: boolean;
}

interface SpinHistory {
  id: string;
  prize_title: string;
  promocode: string | null;
  spun_at: string;
  cost_points: number;
  was_free: boolean;
}

interface ChannelRouletteProps {
  channelId: string;
  isOwner: boolean;
  userPoints?: number;
  onPointsChange?: () => void;
}

const ChannelRoulette = ({ channelId, isOwner, userPoints = 0, onPointsChange }: ChannelRouletteProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [history, setHistory] = useState<SpinHistory[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [wonPrize, setWonPrize] = useState<Prize | null>(null);
  const [wonPromocode, setWonPromocode] = useState<string | null>(null);
  const [canFreeSpin, setCanFreeSpin] = useState(false);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [rotation, setRotation] = useState(0);
  
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPrizeType, setNewPrizeType] = useState("internal");
  const [newPrizeValue, setNewPrizeValue] = useState("");
  const [newChance, setNewChance] = useState(10);

  const SPIN_COST = 500;
  const wheelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPrizes();
    if (user) {
      checkFreeSpin();
      fetchHistory();
    }
  }, [channelId, user]);

  const fetchPrizes = async () => {
    const { data } = await supabase
      .from("roulette_prizes")
      .select("*")
      .eq("channel_id", channelId)
      .eq("is_active", true)
      .order("chance_percent", { ascending: false });

    if (data) {
      setPrizes(data);
    }
  };

  const fetchHistory = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("roulette_spins")
      .select("*")
      .eq("channel_id", channelId)
      .eq("user_id", user.id)
      .order("spun_at", { ascending: false })
      .limit(20);

    if (data) {
      setHistory(data);
    }
  };

  const checkFreeSpin = async () => {
    if (!user) return;

    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    const { data } = await supabase
      .from("free_spin_claims")
      .select("id")
      .eq("channel_id", channelId)
      .eq("user_id", user.id)
      .gte("claimed_at", yesterday.toISOString())
      .maybeSingle();

    setCanFreeSpin(!data);
  };

  const addPrize = async () => {
    if (!newTitle.trim()) return;

    const { error } = await supabase.from("roulette_prizes").insert({
      channel_id: channelId,
      title: newTitle.trim(),
      description: newDescription.trim() || null,
      prize_type: newPrizeType,
      prize_value: newPrizeValue.trim() || null,
      chance_percent: newChance,
      is_active: true,
    });

    if (!error) {
      toast({ title: "Приз добавлен" });
      setNewTitle("");
      setNewDescription("");
      setNewPrizeType("internal");
      setNewPrizeValue("");
      setNewChance(10);
      fetchPrizes();
    }
  };

  const deletePrize = async (prizeId: string) => {
    const { error } = await supabase
      .from("roulette_prizes")
      .delete()
      .eq("id", prizeId);

    if (!error) {
      toast({ title: "Приз удалён" });
      fetchPrizes();
    }
  };

  const spinRoulette = async (useFree: boolean) => {
    if (!user || prizes.length === 0) return;

    if (!useFree && userPoints < SPIN_COST) {
      toast({
        title: "Недостаточно баллов",
        description: `Нужно ${SPIN_COST} баллов`,
        variant: "destructive",
      });
      return;
    }

    setIsSpinning(true);
    setWonPrize(null);
    setWonPromocode(null);

    // Deduct points if not free
    if (!useFree) {
      const { data: points } = await supabase
        .from("channel_points")
        .select("points")
        .eq("channel_id", channelId)
        .eq("user_id", user.id)
        .single();

      if (points) {
        await supabase
          .from("channel_points")
          .update({ points: points.points - SPIN_COST })
          .eq("channel_id", channelId)
          .eq("user_id", user.id);
      }
    } else {
      // Record free spin claim
      await supabase.from("free_spin_claims").insert({
        user_id: user.id,
        channel_id: channelId,
      });
      setCanFreeSpin(false);
    }

    // Calculate winner based on chances
    const totalChance = prizes.reduce((sum, p) => sum + p.chance_percent, 0);
    let random = Math.random() * totalChance;
    let selectedPrize = prizes[0];
    
    for (const prize of prizes) {
      random -= prize.chance_percent;
      if (random <= 0) {
        selectedPrize = prize;
        break;
      }
    }

    // Animate wheel
    const prizeIndex = prizes.findIndex(p => p.id === selectedPrize.id);
    const segmentAngle = 360 / prizes.length;
    const targetRotation = 360 * 5 + (360 - prizeIndex * segmentAngle - segmentAngle / 2);
    
    setRotation(prev => prev + targetRotation);

    // Generate promocode if needed
    let promocode: string | null = null;
    if (selectedPrize.prize_type === "promocode" && selectedPrize.prize_value) {
      promocode = selectedPrize.prize_value;
    }

    // Wait for animation
    setTimeout(async () => {
      setWonPrize(selectedPrize);
      setWonPromocode(promocode);
      setIsSpinning(false);

      // Save spin history
      await supabase.from("roulette_spins").insert({
        user_id: user.id,
        channel_id: channelId,
        prize_id: selectedPrize.id,
        prize_title: selectedPrize.title,
        promocode,
        cost_points: useFree ? 0 : SPIN_COST,
        was_free: useFree,
      });

      // Add points if internal prize
      if (selectedPrize.prize_type === "internal" && selectedPrize.prize_value) {
        const bonusPoints = parseInt(selectedPrize.prize_value) || 0;
        if (bonusPoints > 0) {
          const { data: points } = await supabase
            .from("channel_points")
            .select("points")
            .eq("channel_id", channelId)
            .eq("user_id", user.id)
            .single();

          if (points) {
            await supabase
              .from("channel_points")
              .update({ points: points.points + bonusPoints })
              .eq("channel_id", channelId)
              .eq("user_id", user.id);
          }
        }
      }

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
        message: `🎰 ${profile?.username || "Пользователь"} выиграл "${selectedPrize.title}" в рулетке!`,
      });

      toast({
        title: "🎉 Поздравляем!",
        description: `Вы выиграли: ${selectedPrize.title}`,
      });

      fetchHistory();
      onPointsChange?.();
    }, 4000);
  };

  const getWheelColors = () => {
    const colors = [
      "from-rose-500 to-pink-500",
      "from-amber-500 to-orange-500",
      "from-emerald-500 to-teal-500",
      "from-blue-500 to-indigo-500",
      "from-purple-500 to-violet-500",
      "from-cyan-500 to-sky-500",
    ];
    return colors;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Dices className="w-5 h-5 text-purple-500" />
          Рулетка
        </h3>
        <div className="flex gap-2">
          <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <History className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  История выигрышей
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {history.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    Пока нет выигрышей
                  </p>
                ) : (
                  history.map((spin) => (
                    <Card key={spin.id}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium flex items-center gap-2">
                              <Trophy className="w-4 h-4 text-yellow-500" />
                              {spin.prize_title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(spin.spun_at).toLocaleDateString("ru-RU", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <Badge variant={spin.was_free ? "secondary" : "outline"}>
                            {spin.was_free ? "Бесплатно" : `${spin.cost_points} б.`}
                          </Badge>
                        </div>
                        {spin.promocode && (
                          <p className="mt-2 text-sm font-mono bg-muted p-2 rounded">
                            Промокод: {spin.promocode}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>
          
          {isOwner && (
            <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Settings className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Управление призами</DialogTitle>
                </DialogHeader>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Новый приз</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Название</Label>
                        <Input
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          placeholder="100 баллов"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Шанс (%)</Label>
                        <Input
                          type="number"
                          min={0.01}
                          max={100}
                          step={0.01}
                          value={newChance}
                          onChange={(e) => setNewChance(Number(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Тип приза</Label>
                      <select
                        value={newPrizeType}
                        onChange={(e) => setNewPrizeType(e.target.value)}
                        className="w-full p-2 border rounded-md bg-background"
                      >
                        <option value="internal">Баллы канала</option>
                        <option value="promocode">Промокод</option>
                        <option value="custom">Пользовательский приз</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>
                        {newPrizeType === "internal" ? "Количество баллов" : 
                         newPrizeType === "promocode" ? "Промокод" : "Описание приза"}
                      </Label>
                      <Input
                        value={newPrizeValue}
                        onChange={(e) => setNewPrizeValue(e.target.value)}
                        placeholder={newPrizeType === "internal" ? "100" : "PROMO2026"}
                      />
                    </div>
                    <Button onClick={addPrize} className="w-full">
                      <Plus className="w-4 h-4 mr-2" />
                      Добавить приз
                    </Button>
                  </CardContent>
                </Card>

                <div className="space-y-2">
                  <h4 className="font-medium">Текущие призы</h4>
                  {prizes.map((prize) => (
                    <Card key={prize.id}>
                      <CardContent className="p-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium">{prize.title}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{prize.chance_percent}% шанс</span>
                            <Badge variant="outline" className="text-xs">
                              {prize.prize_type === "internal" ? "Баллы" : 
                               prize.prize_type === "promocode" ? "Промокод" : "Приз"}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deletePrize(prize.id)}
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
      </div>

      {prizes.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Dices className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Призы рулетки пока не добавлены</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Wheel */}
          <div className="relative w-64 h-64 mx-auto">
            {/* Pointer */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
              <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-primary" />
            </div>
            
            {/* Wheel */}
            <div 
              ref={wheelRef}
              className="w-full h-full rounded-full border-4 border-primary/20 overflow-hidden relative"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: isSpinning ? "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
              }}
            >
              {prizes.map((prize, index) => {
                const colors = getWheelColors();
                const segmentAngle = 360 / prizes.length;
                const rotation = index * segmentAngle;
                
                return (
                  <div
                    key={prize.id}
                    className={`absolute w-1/2 h-1/2 origin-bottom-right bg-gradient-to-br ${colors[index % colors.length]}`}
                    style={{
                      transform: `rotate(${rotation}deg) skewY(${90 - segmentAngle}deg)`,
                      transformOrigin: "bottom right",
                      left: 0,
                      top: 0,
                    }}
                  >
                    <div 
                      className="absolute text-white text-xs font-bold whitespace-nowrap"
                      style={{
                        transform: `skewY(${segmentAngle - 90}deg) rotate(${segmentAngle / 2}deg)`,
                        left: "50%",
                        top: "40%",
                      }}
                    >
                      {prize.title.slice(0, 12)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chances Display */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Шансы выпадения
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {prizes.map((prize) => (
                <div key={prize.id} className="flex items-center gap-2">
                  <span className="text-sm flex-1 truncate">{prize.title}</span>
                  <span className="text-xs text-muted-foreground w-12 text-right">
                    {prize.chance_percent}%
                  </span>
                  <Progress value={prize.chance_percent} className="w-20 h-2" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Won Prize Display */}
          {wonPrize && (
            <Card className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/30">
              <CardContent className="p-4 text-center">
                <Trophy className="w-12 h-12 mx-auto mb-2 text-yellow-500" />
                <h4 className="text-xl font-bold">Вы выиграли!</h4>
                <p className="text-lg">{wonPrize.title}</p>
                {wonPromocode && (
                  <div className="mt-2 p-2 bg-background rounded font-mono">
                    Промокод: {wonPromocode}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Spin Buttons */}
          {user && (
            <div className="flex gap-2 justify-center">
              {canFreeSpin && (
                <Button
                  onClick={() => spinRoulette(true)}
                  disabled={isSpinning}
                  variant="outline"
                  className="border-primary text-primary"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Бесплатная прокрутка
                </Button>
              )}
              <Button
                onClick={() => spinRoulette(false)}
                disabled={isSpinning || userPoints < SPIN_COST}
              >
                <Dices className="w-4 h-4 mr-2" />
                Крутить ({SPIN_COST} баллов)
              </Button>
            </div>
          )}

          {!canFreeSpin && user && (
            <p className="text-center text-sm text-muted-foreground">
              Бесплатная прокрутка доступна каждые 24 часа
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ChannelRoulette;
