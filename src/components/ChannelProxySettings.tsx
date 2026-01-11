import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, Wifi, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface ChannelProxySettingsProps {
  channelId: string;
  canManage: boolean;
}

interface ProxyStatus {
  available: boolean;
  lastChecked: Date | null;
  checking: boolean;
}

const ChannelProxySettings = ({ channelId, canManage }: ChannelProxySettingsProps) => {
  const { toast } = useToast();
  const [useProxy, setUseProxy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [proxyStatus, setProxyStatus] = useState<ProxyStatus>({
    available: false,
    lastChecked: null,
    checking: false,
  });

  useEffect(() => {
    const saved = localStorage.getItem(`channel_proxy_${channelId}`);
    if (saved) setUseProxy(saved === "true");
    setLoading(false);
  }, [channelId]);

  const checkProxyAvailability = useCallback(async () => {
    setProxyStatus(prev => ({ ...prev, checking: true }));

    try {
      const { data, error } = await supabase.functions.invoke("proxy-stream", {
        body: { url: "https://www.google.com", action: "check" },
      });

      setProxyStatus({
        available: !error && data?.available,
        lastChecked: new Date(),
        checking: false,
      });
    } catch {
      setProxyStatus({
        available: false,
        lastChecked: new Date(),
        checking: false,
      });
    }
  }, []);

  useEffect(() => {
    if (useProxy) {
      checkProxyAvailability();
    }
  }, [useProxy, checkProxyAvailability]);

  const toggleProxy = async () => {
    if (!canManage) return;

    setSaving(true);
    const newValue = !useProxy;

    try {
      localStorage.setItem(`channel_proxy_${channelId}`, String(newValue));
      setUseProxy(newValue);

      // Dispatch custom event for other components to react
      window.dispatchEvent(new CustomEvent('proxy-settings-changed', {
        detail: { channelId, enabled: newValue }
      }));

      toast({
        title: newValue ? "Прокси включено" : "Прокси отключено",
        description: newValue
          ? "Источники будут загружаться через проксирование с кешированием."
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
          {useProxy && (
            <Badge variant="secondary" className="ml-auto">
              Активен
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="proxy-toggle" className="cursor-pointer">
              Использовать проксирование
            </Label>
            <p className="text-xs text-muted-foreground">
              Все источники (MP4, M3U8, YouTube, Aggregator) будут загружаться через прокси-сервер.
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
            {/* Proxy status */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                {proxyStatus.checking ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                ) : proxyStatus.available ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-destructive" />
                )}
                <span className="text-sm">
                  {proxyStatus.checking 
                    ? "Проверка доступности..." 
                    : proxyStatus.available 
                      ? "Прокси-сервер доступен" 
                      : "Прокси-сервер недоступен"}
                </span>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={checkProxyAvailability}
                disabled={proxyStatus.checking}
              >
                <RefreshCw className={`w-4 h-4 ${proxyStatus.checking ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            <div className="flex items-start gap-2 p-3 bg-secondary/10 border border-secondary/20 rounded-lg">
              <Wifi className="w-4 h-4 text-secondary mt-0.5" />
              <div className="text-xs">
                <p className="font-medium text-secondary">Мониторинг и кеширование</p>
                <p className="text-muted-foreground">
                  Источники проверяются на доступность перед воспроизведением. 
                  Ответы кешируются на 5 минут для оптимизации.
                </p>
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
