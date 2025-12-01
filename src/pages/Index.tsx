import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Eye, Radio, Tv, TrendingUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  subscriptions: { count: number }[];
}

const Index = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [trendingChannels, setTrendingChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChannels();
    fetchTrendingChannels();
  }, []);

  const fetchChannels = async () => {
    const { data, error } = await supabase
      .from("channels")
      .select(`
        *,
        profiles:user_id (username),
        subscriptions (count)
      `)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!error && data) {
      setChannels(data as any);
    }
    setLoading(false);
  };

  const fetchTrendingChannels = async () => {
    const { data, error } = await supabase
      .from("channels")
      .select(`
        *,
        profiles:user_id (username),
        subscriptions (count)
      `)
      .order("viewer_count", { ascending: false })
      .limit(10);

    if (!error && data) {
      setTrendingChannels(data as any);
    }
  };

  const ChannelCard = ({ channel }: { channel: Channel }) => (
    <Link to={`/channel/${channel.id}`}>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow group">
        <div className="relative aspect-video bg-muted">
          {channel.thumbnail_url ? (
            <img
              src={channel.thumbnail_url}
              alt={channel.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
              {channel.channel_type === "tv" ? (
                <Tv className="w-16 h-16 text-muted-foreground" />
              ) : (
                <Radio className="w-16 h-16 text-muted-foreground" />
              )}
            </div>
          )}
          {channel.is_live && (
            <Badge className="absolute top-2 left-2 bg-red-600 animate-pulse">
              <span className="w-2 h-2 bg-white rounded-full mr-1" />
              LIVE
            </Badge>
          )}
          <Badge variant="secondary" className="absolute top-2 right-2">
            {channel.channel_type === "tv" ? "ТВ" : "Радио"}
          </Badge>
        </div>
        <CardContent className="p-4">
          <h3 className="font-semibold mb-1 line-clamp-1">{channel.title}</h3>
          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
            {channel.description || "Описание отсутствует"}
          </p>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{channel.profiles.username}</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                {channel.viewer_count || 0}
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {channel.subscriptions[0]?.count || 0}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            StreamLiveTV
          </h1>
          <p className="text-muted-foreground">
            Создай собственный телеканал или радио
          </p>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="all">Все каналы</TabsTrigger>
            <TabsTrigger value="trending">
              <TrendingUp className="w-4 h-4 mr-2" />
              Популярные
            </TabsTrigger>
            <TabsTrigger value="tv">ТВ каналы</TabsTrigger>
            <TabsTrigger value="radio">Радио</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            {loading ? (
              <div className="text-center py-12">Загрузка...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {channels.map((channel) => (
                  <ChannelCard key={channel.id} channel={channel} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="trending">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {trendingChannels.map((channel) => (
                <ChannelCard key={channel.id} channel={channel} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="tv">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {channels
                .filter((ch) => ch.channel_type === "tv")
                .map((channel) => (
                  <ChannelCard key={channel.id} channel={channel} />
                ))}
            </div>
          </TabsContent>

          <TabsContent value="radio">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {channels
                .filter((ch) => ch.channel_type === "radio")
                .map((channel) => (
                  <ChannelCard key={channel.id} channel={channel} />
                ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;