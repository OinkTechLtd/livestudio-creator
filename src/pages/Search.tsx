import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search as SearchIcon, Tv, Radio } from "lucide-react";
import { useShortsRecommendations } from "@/hooks/useShortsRecommendations";
import { deduplicateChannelsByTitle, hasBlockedModerationReason, isBlockedDuplicateChannel } from "@/lib/channelSafety";

interface Channel {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  channel_type: "tv" | "radio";
  thumbnail_url: string | null;
  viewer_count: number;
  profiles: {
    username: string;
  };
}

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const { trackSearch } = useShortsRecommendations();

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) {
      setQuery(q);
      searchChannels(q);
    }
  }, [searchParams]);

  const searchChannels = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setChannels([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("channels")
        .select(`
          id,
          user_id,
          title,
          description,
          channel_type,
          thumbnail_url,
          viewer_count,
          is_hidden,
          hidden_reason,
          profiles!inner (
            username
          )
        `)
        .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
        .eq("is_hidden", false)
        .order("viewer_count", { ascending: false })
        .limit(50);

      if (error) throw error;

      const userIds = Array.from(new Set((data || []).map((channel: any) => channel.user_id).filter(Boolean)));
      let bannedUsers = new Set<string>();
      if (userIds.length > 0) {
        const { data: bannedData } = await supabase
          .from("banned_users")
          .select("user_id")
          .in("user_id", userIds);
        bannedUsers = new Set((bannedData || []).map((row: any) => row.user_id));
      }
      
      const cleanData = (data || [])
        .filter((channel: any) => !bannedUsers.has(channel.user_id))
        .filter((channel: any) => !hasBlockedModerationReason(channel.hidden_reason))
        .filter((channel: any) => !isBlockedDuplicateChannel({
          username: channel.profiles?.username,
          title: channel.title,
          description: channel.description,
          isHidden: channel.is_hidden,
          hiddenReason: channel.hidden_reason,
        }));

      const deduped = deduplicateChannelsByTitle(cleanData as any[]);

      // Sort: OinkTech/Twixoff first, then by viewer count
      const protectedNames = new Set(["oinktech", "twixoff"]);
      const sorted = deduped.sort((a: any, b: any) => {
        const aProtected = Array.from(protectedNames).some(p => 
          (a.profiles?.username || "").toLowerCase().startsWith(p)
        );
        const bProtected = Array.from(protectedNames).some(p => 
          (b.profiles?.username || "").toLowerCase().startsWith(p)
        );
        if (aProtected !== bProtected) return aProtected ? -1 : 1;
        return (b.viewer_count || 0) - (a.viewer_count || 0);
      });
      
      setChannels(sorted);
    } catch (error) {
      console.error("Error searching channels:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchParams({ q: query });
      trackSearch(query.trim());
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
            Поиск каналов
          </h1>

          <form onSubmit={handleSearch} className="mb-8">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Поиск по названию или описанию..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button type="submit">Найти</Button>
            </div>
          </form>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-pulse text-4xl mb-4">🔍</div>
              <p className="text-muted-foreground">Поиск...</p>
            </div>
          ) : channels.length > 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                Найдено результатов: {channels.length}
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {channels.map((channel) => (
                  <Link to={`/channel/${channel.id}`} key={channel.id}>
                    <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                      <CardHeader className="pb-3">
                        {channel.thumbnail_url && (
                          <img
                            src={channel.thumbnail_url}
                            alt={channel.title}
                            className="w-full h-40 object-cover rounded-lg mb-3"
                          />
                        )}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <h3 className="font-bold text-lg line-clamp-1">{channel.title}</h3>
                            <p className="text-sm text-muted-foreground">
                              @{channel.profiles.username}
                            </p>
                          </div>
                          <Badge variant="outline" className="flex items-center gap-1">
                            {channel.channel_type === "tv" ? (
                              <Tv className="w-3 h-3" />
                            ) : (
                              <Radio className="w-3 h-3" />
                            )}
                            {channel.channel_type === "tv" ? "ТВ" : "Радио"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {channel.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {channel.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>👁️ {channel.viewer_count || 0} просмотров</span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ) : query ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                Ничего не найдено по запросу "{query}"
              </p>
            </div>
          ) : (
            <div className="text-center py-12">
              <SearchIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                Введите запрос для поиска каналов
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Search;
