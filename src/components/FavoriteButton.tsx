import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Heart } from "lucide-react";

interface FavoriteButtonProps {
  channelId: string;
  channelTitle: string;
}

const FavoriteButton = ({ channelId, channelTitle }: FavoriteButtonProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      checkFavoriteStatus();
    }
  }, [user, channelId]);

  const checkFavoriteStatus = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("favorite_channels")
      .select("id")
      .eq("user_id", user.id)
      .eq("channel_id", channelId)
      .single();

    setIsFavorite(!!data);
  };

  const toggleFavorite = async () => {
    if (!user) {
      toast({
        title: "Требуется авторизация",
        description: "Войдите, чтобы добавить в избранное",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      if (isFavorite) {
        await supabase
          .from("favorite_channels")
          .delete()
          .eq("user_id", user.id)
          .eq("channel_id", channelId);

        setIsFavorite(false);
        toast({
          title: "Удалено из избранного",
          description: `${channelTitle} удален из вашего списка`,
        });
      } else {
        await supabase.from("favorite_channels").insert({
          user_id: user.id,
          channel_id: channelId,
        });

        setIsFavorite(true);
        toast({
          title: "Добавлено в избранное",
          description: `${channelTitle} добавлен в ваш список`,
        });
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={isFavorite ? "default" : "outline"}
      size="sm"
      onClick={toggleFavorite}
      disabled={loading}
      className={`gap-2 ${isFavorite ? "bg-pink-500 hover:bg-pink-600 text-white" : ""}`}
    >
      <Heart className={`w-4 h-4 ${isFavorite ? "fill-current" : ""}`} />
      <span className="hidden md:inline">{isFavorite ? "В избранном" : "В избранное"}</span>
    </Button>
  );
};

export default FavoriteButton;
