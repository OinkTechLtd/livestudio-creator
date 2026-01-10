import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Shield, AlertTriangle, Wifi } from "lucide-react";

interface ChannelProxySettingsProps {
  channelId: string;
  canManage: boolean;
}

const ChannelProxySettings = ({ channelId, canManage }: ChannelProxySettingsProps) => {
  const { toast } = useToast();
  const [useProxy, setUseProxy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Пока без колонки в БД: храним настройку локально
    const saved = localStorage.getItem(`channel_proxy_${channelId}`);
    if (saved) setUseProxy(saved === "true");
    setLoading(false);
  }, [channelId]);

  const toggleProxy = async () => {
    if (!canManage) return;

    setSaving(true);
    const newValue = !useProxy;

    try {
      localStorage.setItem(`channel_proxy_${channelId}`, String(newValue));
      setUseProxy(newValue);

      toast({
        title: newValue ? "Прокси включено" : "Прокси отключено",
        description: newValue
          ? "Источники будут загружаться через проксирование."
          : "Источники будут загружаться напрямую.",
      });
    } catch {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить настройки",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) return null;

  return (
    <Card className="border-accent/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="w-5 h-5 text-accent" />
          VPN-прокси для источников
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="proxy-toggle" className="cursor-pointer">
              Использовать проксирование
            </Label>
            <p className="text-xs text-muted-foreground">
              Если включено — источники будут запрашиваться через прокси-слой (может помочь при CORS/блокировках).
            </p>
          </div>
          <Switch
            id="proxy-toggle"
            checked={useProxy}
            onCheckedChange={toggleProxy}
            disabled={loading || saving}
          />
        </div>

        {useProxy && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 bg-secondary/10 border border-secondary/20 rounded-lg">
              <Wifi className="w-4 h-4 text-secondary mt-0.5" />
              <div className="text-xs">
                <p className="font-medium text-secondary">Прокси активен</p>
                <p className="text-muted-foreground">Источники могут кешироваться для повышения стабильности.</p>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
              <div className="text-xs">
                <p className="font-medium text-destructive">Юридическое уведомление</p>
                <p className="text-muted-foreground">
                  Использование прокси для обхода географических ограничений может нарушать условия сервисов.
                  Убедитесь, что у вас есть право на доступ к контенту.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ChannelProxySettings;

