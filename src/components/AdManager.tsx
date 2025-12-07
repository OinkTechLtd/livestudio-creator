import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Upload, Trash2, Film, Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface AdContent {
  id: string;
  title: string;
  file_url: string;
  file_type: string | null;
  duration: number | null;
  is_active: boolean;
}

interface AdSettings {
  id: string;
  interval_minutes: number;
  is_enabled: boolean;
}

interface AdManagerProps {
  channelId: string;
  channelType: "tv" | "radio";
}

const AdManager = ({ channelId, channelType }: AdManagerProps) => {
  const { toast } = useToast();
  const [adContent, setAdContent] = useState<AdContent[]>([]);
  const [adSettings, setAdSettings] = useState<AdSettings | null>(null);
  const [intervalMinutes, setIntervalMinutes] = useState(15);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchAdContent();
    fetchAdSettings();
  }, [channelId]);

  const fetchAdContent = async () => {
    const { data, error } = await supabase
      .from("ad_content")
      .select("*")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setAdContent(data as AdContent[]);
    }
  };

  const fetchAdSettings = async () => {
    const { data, error } = await supabase
      .from("ad_settings")
      .select("*")
      .eq("channel_id", channelId)
      .single();

    if (!error && data) {
      setAdSettings(data as AdSettings);
      setIntervalMinutes(data.interval_minutes);
      setIsEnabled(data.is_enabled);
    }
  };

  const handleAdUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 100 * 1024 * 1024; // 100MB for ads
    if (file.size > maxSize) {
      toast({
        title: "Ошибка",
        description: "Размер рекламного файла не должен превышать 100MB",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = file.name.split(".").pop();
      const fileName = `ads/${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("media-uploads")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("media-uploads")
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase
        .from("ad_content")
        .insert({
          channel_id: channelId,
          title: file.name,
          file_url: urlData.publicUrl,
          file_type: file.type,
          is_active: true,
        });

      if (insertError) throw insertError;

      toast({ title: "Рекламный ролик загружен" });
      fetchAdContent();
      e.target.value = "";
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteAd = async (adId: string, fileUrl: string) => {
    try {
      const fileName = fileUrl.split("/").slice(-3).join("/");
      await supabase.storage.from("media-uploads").remove([fileName]);

      const { error } = await supabase
        .from("ad_content")
        .delete()
        .eq("id", adId);

      if (error) throw error;

      toast({ title: "Рекламный ролик удалён" });
      fetchAdContent();
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleAd = async (ad: AdContent) => {
    const { error } = await supabase
      .from("ad_content")
      .update({ is_active: !ad.is_active })
      .eq("id", ad.id);

    if (!error) {
      fetchAdContent();
    }
  };

  const saveSettings = async () => {
    try {
      const { error } = await supabase
        .from("ad_settings")
        .upsert({
          channel_id: channelId,
          interval_minutes: intervalMinutes,
          is_enabled: isEnabled,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast({ title: "Настройки сохранены" });
      fetchAdSettings();
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Film className="w-5 h-5" />
          Рекламные паузы
        </h3>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Настройки
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Настройки рекламных пауз</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Включить рекламные паузы</Label>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={setIsEnabled}
                />
              </div>
              <div>
                <Label>Интервал показа (минуты)</Label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={intervalMinutes}
                  onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Рекламный ролик будет показан каждые {intervalMinutes} мин.
                </p>
              </div>
              <Button onClick={saveSettings} className="w-full">
                Сохранить настройки
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Status */}
      <div className={`p-3 rounded-lg ${isEnabled ? 'bg-green-500/10 border border-green-500/20' : 'bg-muted'}`}>
        <p className="text-sm">
          {isEnabled 
            ? `✅ Рекламные паузы активны (каждые ${intervalMinutes} мин)`
            : "⏸️ Рекламные паузы отключены"}
        </p>
      </div>

      {/* Upload */}
      <div>
        <Label htmlFor="ad-upload" className="cursor-pointer">
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors">
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="font-semibold">Загрузить рекламный ролик</p>
            <p className="text-xs text-muted-foreground mt-1">
              {channelType === "tv" ? "MP4, WebM до 100MB" : "MP3, WAV до 100MB"}
            </p>
          </div>
        </Label>
        <Input
          id="ad-upload"
          type="file"
          accept={channelType === "tv" ? "video/*" : "audio/*"}
          onChange={handleAdUpload}
          disabled={isLoading}
          className="hidden"
        />
      </div>

      {/* Ad List */}
      {adContent.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium">Рекламные ролики ({adContent.length}):</h4>
          {adContent.map((ad) => (
            <div
              key={ad.id}
              className="p-3 border border-border rounded-lg bg-card flex items-center justify-between"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{ad.title}</p>
                <span className={`text-xs ${ad.is_active ? 'text-green-500' : 'text-muted-foreground'}`}>
                  {ad.is_active ? "🟢 Активен" : "⏸️ Отключён"}
                </span>
              </div>
              <div className="flex gap-2 ml-4">
                <Switch
                  checked={ad.is_active}
                  onCheckedChange={() => toggleAd(ad)}
                />
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteAd(ad.id, ad.file_url)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {adContent.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Загрузите рекламные ролики для показа во время трансляции
        </p>
      )}
    </div>
  );
};

export default AdManager;
