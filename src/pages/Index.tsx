import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import Header from "@/components/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tv, Radio, Users, Eye, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "tv";
  const { loading: authLoading } = useAuth();
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChannels();
  }, [activeTab]);

  const fetchChannels = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("channels")
        .select(`
          *,
          profiles:user_id (username, avatar_url),
          subscriptions (count)
        `)
        .eq("channel_type", activeTab === "tv" ? "tv" : "radio")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setChannels(data || []);
    } catch (error) {
      console.error("Error fetching channels:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10 flex items-center justify-center">
        <div className="animate-pulse text-2xl font-display neon-text-primary">
          Загрузка...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10 cyber-grid">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12 space-y-4">
          <h1 className="text-5xl md:text-6xl font-display font-bold mb-4">
            <span className="neon-text-primary">Stream</span>
            <span className="neon-text-secondary">Live</span>
            <span className="text-foreground">TV</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Создавайте собственные телеканалы и радиостанции. 
            Транслируйте видео и аудио контент 24/7 или по расписанию.
          </p>
        </div>

        {/* Tabs for TV/Radio */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8 glass-strong">
            <TabsTrigger value="tv" className="flex items-center gap-2">
              <Tv className="w-4 h-4" />
              ТВ Каналы
            </TabsTrigger>
            <TabsTrigger value="radio" className="flex items-center gap-2">
              <Radio className="w-4 h-4" />
              Радио
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tv" className="space-y-6">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="animate-pulse glass">
                    <div className="aspect-video bg-muted rounded-t-lg" />
                    <CardHeader>
                      <div className="h-6 bg-muted rounded w-3/4" />
                      <div className="h-4 bg-muted rounded w-1/2" />
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : channels.length === 0 ? (
              <Card className="glass-strong text-center py-12">
                <CardContent>
                  <Tv className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">Пока нет ТВ каналов</h3>
                  <p className="text-muted-foreground">
                    Станьте первым, кто создаст телеканал!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {channels.map((channel) => (
                  <Card
                    key={channel.id}
                    className="group glass hover:glass-strong transition-all duration-300 cursor-pointer overflow-hidden border-primary/20 hover:border-primary/40"
                  >
                    <div className="relative aspect-video bg-muted overflow-hidden">
                      {channel.thumbnail_url ? (
                        <img
                          src={channel.thumbnail_url}
                          alt={channel.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
                          <Tv className="w-16 h-16 text-primary/50" />
                        </div>
                      )}
                      {channel.is_live && (
                        <Badge className="absolute top-2 right-2 bg-destructive animate-pulse">
                          <span className="w-2 h-2 bg-white rounded-full mr-1" />
                          LIVE
                        </Badge>
                      )}
                    </div>
                    <CardHeader>
                      <CardTitle className="line-clamp-1 font-display">
                        {channel.title}
                      </CardTitle>
                      <CardDescription className="line-clamp-2">
                        {channel.description || "Описание отсутствует"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span>{channel.subscriptions?.[0]?.count || 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          <span>{channel.viewer_count || 0}</span>
                        </div>
                      </div>
                      <Button className="w-full group-hover:shadow-neon-pink transition-shadow">
                        <Play className="w-4 h-4 mr-2" />
                        Смотреть
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="radio" className="space-y-6">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="animate-pulse glass">
                    <div className="aspect-video bg-muted rounded-t-lg" />
                    <CardHeader>
                      <div className="h-6 bg-muted rounded w-3/4" />
                      <div className="h-4 bg-muted rounded w-1/2" />
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : channels.length === 0 ? (
              <Card className="glass-strong text-center py-12">
                <CardContent>
                  <Radio className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">Пока нет радиостанций</h3>
                  <p className="text-muted-foreground">
                    Станьте первым, кто создаст радиостанцию!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {channels.map((channel) => (
                  <Card
                    key={channel.id}
                    className="group glass hover:glass-strong transition-all duration-300 cursor-pointer overflow-hidden border-secondary/20 hover:border-secondary/40"
                  >
                    <div className="relative aspect-video bg-muted overflow-hidden">
                      {channel.thumbnail_url ? (
                        <img
                          src={channel.thumbnail_url}
                          alt={channel.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary/20 to-accent/20">
                          <Radio className="w-16 h-16 text-secondary/50" />
                        </div>
                      )}
                      {channel.is_live && (
                        <Badge className="absolute top-2 right-2 bg-destructive animate-pulse">
                          <span className="w-2 h-2 bg-white rounded-full mr-1" />
                          LIVE
                        </Badge>
                      )}
                    </div>
                    <CardHeader>
                      <CardTitle className="line-clamp-1 font-display">
                        {channel.title}
                      </CardTitle>
                      <CardDescription className="line-clamp-2">
                        {channel.description || "Описание отсутствует"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span>{channel.subscriptions?.[0]?.count || 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          <span>{channel.viewer_count || 0}</span>
                        </div>
                      </div>
                      <Button variant="secondary" className="w-full group-hover:shadow-neon-cyan transition-shadow">
                        <Play className="w-4 h-4 mr-2" />
                        Слушать
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
