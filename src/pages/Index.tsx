import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { TrendingUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import ChannelPreviewCard from "@/components/ChannelPreviewCard";

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
  const { t } = useLanguage();

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

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
      <main className="container mx-auto px-3 md:px-4 py-4 md:py-8">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            StreamLiveTV
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Создай собственный телеканал или радио
          </p>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-4 md:mb-6 flex flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="all" className="text-xs md:text-sm">{t("all_channels") || "Все каналы"}</TabsTrigger>
            <TabsTrigger value="trending" className="text-xs md:text-sm">
              <TrendingUp className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              {t("trending") || "Популярные"}
            </TabsTrigger>
            <TabsTrigger value="tv" className="text-xs md:text-sm">{t("tv")}</TabsTrigger>
            <TabsTrigger value="radio" className="text-xs md:text-sm">{t("radio")}</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            {loading ? (
              <div className="text-center py-12">Загрузка...</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
                {channels.map((channel) => (
                  <ChannelPreviewCard key={channel.id} channel={channel} t={t} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="trending">
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
              {trendingChannels.map((channel) => (
                <ChannelPreviewCard key={channel.id} channel={channel} t={t} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="tv">
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
              {channels
                .filter((ch) => ch.channel_type === "tv")
                .map((channel) => (
                  <ChannelPreviewCard key={channel.id} channel={channel} t={t} />
                ))}
            </div>
          </TabsContent>

          <TabsContent value="radio">
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
              {channels
                .filter((ch) => ch.channel_type === "radio")
                .map((channel) => (
                  <ChannelPreviewCard key={channel.id} channel={channel} t={t} />
                ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;