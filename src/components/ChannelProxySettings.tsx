import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Shield, AlertTriangle, Wifi } from "lucide-react";

interface ChannelProxySettingsProps {
  channelId: string;
  isOwner: boolean;
}

const ChannelProxySettings = ({ channelId, isOwner }: ChannelProxySettingsProps) => {
  const { toast } = useToast();
  const [useProxy, setUseProxy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [channelId]);

  const fetchSettings = async () => {
    // For now, store in localStorage since we don't have a DB column
    const saved = localStorage.getItem(`channel_proxy_${channelId}`);
    if (saved) {
      setUseProxy(saved === "true");
    }
    setLoading(false);
  };

  const toggleProxy = async () => {
    if (!isOwner) return;
    
    setSaving(true);
    const newValue = !useProxy;
    
    try {
      // Store in localStorage for now
      localStorage.setItem(`channel_proxy_${channelId}`, String(newValue));
      setUseProxy(newValue);
      
      toast({
        title: newValue ? "Прокси включено" : "Прокси отключено",
        description: newValue 
          ? "Все источники будут загружаться через StreamLiveTV Proxy" 
          : "Прямое подключение к источникам",
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить настройки",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isOwner) return null;

  return (
    <Card className="border-orange-500/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="w-5 h-5 text-orange-500" />
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
              Все источники будут загружаться через StreamLiveTV Proxy Server
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
            <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <Wifi className="w-4 h-4 text-green-500 mt-0.5" />
              <div className="text-xs">
                <p className="font-medium text-green-500">Прокси активен</p>
                <p className="text-muted-foreground">
                  Источники кешируются для повышения производительности
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5" />
              <div className="text-xs">
                <p className="font-medium text-yellow-500">Юридическое уведомление</p>
                <p className="text-muted-foreground">
                  Использование прокси для обхода географических ограничений может нарушать 
                  условия использования некоторых сервисов. Убедитесь, что вы имеете право 
                  на доступ к контенту.
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
