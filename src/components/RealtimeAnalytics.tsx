import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { Eye, Users, TrendingUp, Clock, Activity } from "lucide-react";

interface RealtimeAnalyticsProps {
  channelId: string;
}

interface ViewerData {
  time: string;
  viewers: number;
}

const RealtimeAnalytics = ({ channelId }: RealtimeAnalyticsProps) => {
  const [currentViewers, setCurrentViewers] = useState(0);
  const [peakViewers, setPeakViewers] = useState(0);
  const [totalViews, setTotalViews] = useState(0);
  const [viewerHistory, setViewerHistory] = useState<ViewerData[]>([]);
  const [averageWatchTime, setAverageWatchTime] = useState(0);

  useEffect(() => {
    fetchInitialData();
    const interval = setInterval(fetchRealtimeData, 5000);

    // Subscribe to realtime viewer updates
    const channel = supabase
      .channel(`analytics-${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "channel_viewers",
          filter: `channel_id=eq.${channelId}`,
        },
        () => {
          fetchRealtimeData();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [channelId]);

  const fetchInitialData = async () => {
    // Fetch total views
    const { count: viewsCount } = await supabase
      .from("channel_views")
      .select("*", { count: "exact", head: true })
      .eq("channel_id", channelId);

    setTotalViews(viewsCount || 0);

    // Calculate average watch time
    const { data: durationData } = await supabase
      .from("channel_views")
      .select("duration_seconds")
      .eq("channel_id", channelId)
      .not("duration_seconds", "is", null);

    if (durationData && durationData.length > 0) {
      const totalSeconds = durationData.reduce((acc, v) => acc + (v.duration_seconds || 0), 0);
      setAverageWatchTime(Math.round(totalSeconds / durationData.length));
    }

    fetchRealtimeData();
  };

  const fetchRealtimeData = async () => {
    // Get active viewers (last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { count } = await supabase
      .from("channel_viewers")
      .select("*", { count: "exact", head: true })
      .eq("channel_id", channelId)
      .gte("last_seen", fiveMinutesAgo);

    const viewers = count || 0;
    setCurrentViewers(viewers);
    
    if (viewers > peakViewers) {
      setPeakViewers(viewers);
    }

    // Update viewer history
    setViewerHistory(prev => {
      const now = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      const newHistory = [...prev, { time: now, viewers }];
      // Keep last 20 data points
      return newHistory.slice(-20);
    });
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds} сек`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} мин`;
    const hours = Math.floor(minutes / 60);
    return `${hours} ч ${minutes % 60} мин`;
  };

  return (
    <div className="space-y-6">
      {/* Live Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Сейчас смотрят</p>
                <p className="text-3xl font-bold flex items-center gap-2">
                  {currentViewers}
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                </p>
              </div>
              <Eye className="w-8 h-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Пиковые зрители</p>
                <p className="text-3xl font-bold">{peakViewers}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Всего просмотров</p>
                <p className="text-3xl font-bold">{totalViews}</p>
              </div>
              <Users className="w-8 h-8 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Среднее время</p>
                <p className="text-2xl font-bold">{formatDuration(averageWatchTime)}</p>
              </div>
              <Clock className="w-8 h-8 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Real-time Viewers Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Зрители в реальном времени
          </CardTitle>
          <CardDescription>Обновляется каждые 5 секунд</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={viewerHistory}>
              <defs>
                <linearGradient id="viewerGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="time" className="text-xs" />
              <YAxis className="text-xs" allowDecimals={false} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
                formatter={(value) => [`${value} зрителей`, 'Онлайн']}
              />
              <Area 
                type="monotone" 
                dataKey="viewers" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                fill="url(#viewerGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default RealtimeAnalytics;
