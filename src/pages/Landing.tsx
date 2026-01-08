import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tv, Radio, Users, Zap, Play, Star, Globe, Shield, Code } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface Channel {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  channel_type: "tv" | "radio";
  is_live: boolean;
  viewer_count: number;
  profiles: {
    username: string;
  };
}

const Landing = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    const { data, error } = await supabase
      .from("channels")
      .select(`
        id, title, description, thumbnail_url, channel_type, is_live, viewer_count,
        profiles:user_id (username)
      `)
      .eq("is_hidden", false)
      .order("viewer_count", { ascending: false })
      .limit(8);

    if (!error && data) {
      setChannels(data as any);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-accent/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        
        <div className="relative container mx-auto px-4 py-16 md:py-24">
          <div className="text-center max-w-4xl mx-auto">
            <Badge variant="secondary" className="mb-4 px-4 py-1">
              <Zap className="w-3 h-3 mr-1" />
              StreamLiveTV v2.0.0
            </Badge>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
              Создай свой телеканал
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Запускай 24/7 трансляции, общайся с аудиторией в чате, зарабатывай баллы и получай призы в рулетке.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="gap-2" onClick={() => navigate("/")}>
                <Play className="w-5 h-5" />
                Открыть платформу
              </Button>
              <Button size="lg" variant="outline" className="gap-2" onClick={() => navigate("/create-channel")}>
                <Tv className="w-5 h-5" />
                Создать канал
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Возможности платформы</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="glass border-primary/20">
            <CardContent className="p-6 text-center">
              <Tv className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h3 className="font-semibold mb-2">ТВ и Радио</h3>
              <p className="text-sm text-muted-foreground">
                Создавай видео и аудио каналы с 24/7 вещанием
              </p>
            </CardContent>
          </Card>
          
          <Card className="glass border-accent/20">
            <CardContent className="p-6 text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-accent" />
              <h3 className="font-semibold mb-2">Чат и сообщество</h3>
              <p className="text-sm text-muted-foreground">
                Общайся с зрителями в реальном времени
              </p>
            </CardContent>
          </Card>
          
          <Card className="glass border-yellow-500/20">
            <CardContent className="p-6 text-center">
              <Star className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
              <h3 className="font-semibold mb-2">Баллы и подписки</h3>
              <p className="text-sm text-muted-foreground">
                Зарабатывай баллы и покупай премиум-подписки
              </p>
            </CardContent>
          </Card>
          
          <Card className="glass border-purple-500/20">
            <CardContent className="p-6 text-center">
              <Globe className="w-12 h-12 mx-auto mb-4 text-purple-500" />
              <h3 className="font-semibold mb-2">Множество источников</h3>
              <p className="text-sm text-muted-foreground">
                YouTube, MP4, M3U8, Ultra Aggregator
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Channels Preview */}
      <div className="container mx-auto px-4 py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold">Популярные каналы</h2>
          <Button variant="outline" onClick={() => navigate("/")}>
            Все каналы
          </Button>
        </div>
        
        {loading ? (
          <div className="text-center py-12">Загрузка...</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {channels.map((channel) => (
              <Card 
                key={channel.id} 
                className="glass cursor-pointer hover:border-primary/50 transition-all"
                onClick={() => navigate(`/channel/${channel.id}`)}
              >
                <CardContent className="p-4">
                  <div className="aspect-video bg-muted rounded-lg mb-3 overflow-hidden relative">
                    {channel.thumbnail_url ? (
                      <img 
                        src={channel.thumbnail_url} 
                        alt={channel.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {channel.channel_type === "tv" ? (
                          <Tv className="w-8 h-8 text-muted-foreground" />
                        ) : (
                          <Radio className="w-8 h-8 text-muted-foreground" />
                        )}
                      </div>
                    )}
                    {channel.is_live && (
                      <Badge className="absolute top-2 left-2 bg-destructive">LIVE</Badge>
                    )}
                  </div>
                  <h3 className="font-semibold truncate">{channel.title}</h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {channel.profiles?.username}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* About Section */}
      <div className="container mx-auto px-4 py-16">
        <Card className="glass">
          <CardContent className="p-8 md:p-12">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1">
                <h2 className="text-3xl font-bold mb-4">О проекте</h2>
                <p className="text-muted-foreground mb-4">
                  StreamLiveTV — это платформа для создания и управления онлайн-телеканалами и радиостанциями.
                  Разработано TOO Oink Tech Ltd Co. для сообщества стримеров и создателей контента.
                </p>
                <p className="text-muted-foreground mb-6">
                  Используйте наш API для интеграции с вашими сервисами и получайте призы в рулетке.
                </p>
                <div className="flex gap-4">
                  <Button variant="outline" className="gap-2" onClick={() => navigate("/api-docs")}>
                    <Code className="w-4 h-4" />
                    API Документация
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={() => navigate("/changelog")}>
                    <Shield className="w-4 h-4" />
                    История обновлений
                  </Button>
                </div>
              </div>
              <div className="flex-shrink-0">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Tv className="w-16 h-16 text-white" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p className="mb-2">© 2024-2026 StreamLiveTV. TOO Oink Tech Ltd Co.</p>
          <p className="text-sm">Все права защищены.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
