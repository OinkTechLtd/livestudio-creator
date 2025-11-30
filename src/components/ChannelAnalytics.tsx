import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

interface ChannelAnalyticsProps {
  channelId: string;
}

interface ViewStats {
  total_views: number;
  today_views: number;
  week_views: number;
  daily_views: Array<{ date: string; views: number }>;
}

const ChannelAnalytics = ({ channelId }: ChannelAnalyticsProps) => {
  const [stats, setStats] = useState<ViewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [channelId]);

  const fetchAnalytics = async () => {
    try {
      const { data: views, error } = await supabase
        .from("channel_views")
        .select("viewed_at")
        .eq("channel_id", channelId);

      if (error) throw error;

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const todayViews = views.filter(v => new Date(v.viewed_at) >= today).length;
      const weekViews = views.filter(v => new Date(v.viewed_at) >= weekAgo).length;

      // Group by date for chart
      const dailyMap = new Map<string, number>();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        dailyMap.set(date.toISOString().split('T')[0], 0);
      }

      views.forEach(v => {
        const date = new Date(v.viewed_at).toISOString().split('T')[0];
        if (dailyMap.has(date)) {
          dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
        }
      });

      const dailyViews = Array.from(dailyMap.entries()).map(([date, views]) => ({
        date: new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
        views
      }));

      setStats({
        total_views: views.length,
        today_views: todayViews,
        week_views: weekViews,
        daily_views: dailyViews
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Загрузка аналитики...</div>;
  }

  if (!stats) {
    return <div className="text-muted-foreground">Нет данных</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Всего просмотров</CardDescription>
            <CardTitle className="text-3xl">{stats.total_views}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Просмотров сегодня</CardDescription>
            <CardTitle className="text-3xl">{stats.today_views}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Просмотров за неделю</CardDescription>
            <CardTitle className="text-3xl">{stats.week_views}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Просмотры за последние 7 дней</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats.daily_views}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="views" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChannelAnalytics;
