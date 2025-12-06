import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Tv, Radio, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface Channel {
  id: string;
  title: string;
  description: string | null;
  channel_type: "tv" | "radio";
  thumbnail_url: string | null;
  is_live: boolean;
}

const FavoriteChannels = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchFavorites();
    }
  }, [user]);

  const fetchFavorites = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("favorite_channels")
        .select(`
          channel_id,
          channels (*)
        `)
        .eq("user_id", user.id);

      if (error) throw error;

      const channelData = data?.map((fav: any) => fav.channels).filter(Boolean) || [];
      setFavorites(channelData);
    } catch (error) {
      console.error("Error fetching favorites:", error);
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (channelId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from("favorite_channels")
      .delete()
      .eq("user_id", user.id)
      .eq("channel_id", channelId);

    if (!error) {
      setFavorites(prev => prev.filter(c => c.id !== channelId));
      toast({
        title: "Удалено из избранного",
      });
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-pulse text-2xl mb-2">❤️</div>
        <p className="text-muted-foreground">Загрузка избранного...</p>
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <Card className="glass-strong text-center py-12">
        <CardContent>
          <Heart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">
            У вас пока нет избранных каналов
          </p>
          <Button onClick={() => navigate("/")}>
            Найти каналы
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Heart className="w-6 h-6 text-pink-500 fill-pink-500" />
        Избранные каналы
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {favorites.map((channel) => (
          <Card key={channel.id} className="group glass hover:glass-strong transition-all">
            <Link to={`/channel/${channel.id}`}>
              <div className="relative aspect-video bg-muted overflow-hidden rounded-t-lg">
                {channel.thumbnail_url ? (
                  <img
                    src={channel.thumbnail_url}
                    alt={channel.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {channel.channel_type === "tv" ? (
                      <Tv className="w-12 h-12 text-primary/50" />
                    ) : (
                      <Radio className="w-12 h-12 text-secondary/50" />
                    )}
                  </div>
                )}
                {channel.is_live && (
                  <div className="absolute top-2 left-2 bg-destructive text-white px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    LIVE
                  </div>
                )}
              </div>
            </Link>
            <CardHeader className="pb-2">
              <CardTitle className="line-clamp-1 text-base">{channel.title}</CardTitle>
              <CardDescription className="line-clamp-2 text-sm">
                {channel.description || "Описание отсутствует"}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFavorite(channel.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Удалить
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default FavoriteChannels;
