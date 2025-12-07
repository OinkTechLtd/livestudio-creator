import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, Link, Play, Shuffle } from "lucide-react";
import TorrentUploader from "@/components/TorrentUploader";
import DraggableMediaList from "@/components/DraggableMediaList";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useNotifySubscribers } from "@/hooks/useNotifySubscribers";

interface MediaContent {
  id: string;
  title: string;
  file_url: string;
  file_type: string | null;
  duration: number | null;
  is_24_7: boolean;
  scheduled_at: string | null;
  source_type: string;
  source_url: string | null;
  start_time: string | null;
  end_time: string | null;
}

interface MediaManagerProps {
  channelId: string;
  channelType: "tv" | "radio";
  channelTitle: string;
  storageUsage: number;
  onStorageUpdate: () => void;
}

const MediaManager = ({ 
  channelId, 
  channelType, 
  channelTitle,
  storageUsage, 
  onStorageUpdate 
}: MediaManagerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { notifySubscribers } = useNotifySubscribers();
  const [mediaContent, setMediaContent] = useState<MediaContent[]>([]);
  const [isAddUrlOpen, setIsAddUrlOpen] = useState(false);
  
  const [urlTitle, setUrlTitle] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [sourceType, setSourceType] = useState<"external_url" | "m3u8">("external_url");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  useEffect(() => {
    fetchMediaContent();
  }, [channelId]);

  const fetchMediaContent = async () => {
    try {
      const { data, error } = await supabase
        .from("media_content")
        .select("*")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMediaContent((data || []) as MediaContent[]);
    } catch (error) {
      console.error("Error fetching media:", error);
    }
  };

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb.toFixed(2);
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "Ошибка",
        description: "Размер файла не должен превышать 500MB",
        variant: "destructive",
      });
      return;
    }

    const storageLimit = 5 * 1024 * 1024 * 1024;
    if (storageUsage + file.size > storageLimit) {
      toast({
        title: "Превышен лимит хранилища",
        description: "Удалите старые файлы для освобождения места.",
        variant: "destructive",
      });
      return;
    }

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("media-uploads")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("media-uploads")
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase
        .from("media_content")
        .insert({
          channel_id: channelId,
          title: file.name,
          file_url: data.publicUrl,
          file_type: file.type,
          is_24_7: false,
          source_type: "upload",
        });

      if (insertError) throw insertError;

      toast({ title: "Успешно", description: "Медиа файл загружен" });
      
      // Notify subscribers
      await notifySubscribers({
        channelId,
        type: "new_content",
        title: `Новый контент на ${channelTitle}`,
        message: `Загружен новый ${channelType === "tv" ? "видео" : "аудио"} контент: ${file.name}`,
      });

      fetchMediaContent();
      onStorageUpdate();
      e.target.value = "";
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось загрузить файл",
        variant: "destructive",
      });
    }
  };

  const handleAddUrl = async () => {
    if (!urlTitle || !externalUrl) {
      toast({
        title: "Ошибка",
        description: "Заполните название и URL",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("media_content")
        .insert({
          channel_id: channelId,
          title: urlTitle,
          file_url: externalUrl,
          file_type: sourceType === "m3u8" ? "application/x-mpegURL" : "video/mp4",
          is_24_7: false,
          source_type: sourceType,
          source_url: externalUrl,
          start_time: startTime || null,
          end_time: endTime || null,
        });

      if (error) throw error;

      toast({ title: "Добавлено" });
      
      // Notify subscribers
      await notifySubscribers({
        channelId,
        type: "new_content",
        title: `Новый контент на ${channelTitle}`,
        message: `Добавлен новый контент: ${urlTitle}`,
      });

      setUrlTitle("");
      setExternalUrl("");
      setStartTime("");
      setEndTime("");
      setIsAddUrlOpen(false);
      fetchMediaContent();
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteMedia = async (mediaId: string, fileUrl: string, sourceType: string) => {
    try {
      // Only delete from storage if it's an uploaded file
      if (sourceType === "upload") {
        const fileName = fileUrl.split("/").slice(-2).join("/");
        await supabase.storage.from("media-uploads").remove([fileName]);
      }

      const { error } = await supabase
        .from("media_content")
        .delete()
        .eq("id", mediaId);

      if (error) throw error;

      toast({ title: "Удалено" });
      fetchMediaContent();
      onStorageUpdate();
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleMedia = async (media: MediaContent) => {
    const { error } = await supabase
      .from("media_content")
      .update({ is_24_7: !media.is_24_7 })
      .eq("id", media.id);

    if (!error) {
      // Notify if starting broadcast
      if (!media.is_24_7) {
        await notifySubscribers({
          channelId,
          type: "new_stream",
          title: `${channelTitle} начал трансляцию`,
          message: `Сейчас в эфире: ${media.title}`,
        });
      }
      
      fetchMediaContent();
      toast({
        title: media.is_24_7 ? "Остановлено" : "Запущено",
        description: media.is_24_7 ? "Файл убран из трансляции" : "Файл запущен в трансляцию 24/7"
      });
    }
  };

  const activateAllMedia = async () => {
    const { error } = await supabase
      .from("media_content")
      .update({ is_24_7: true })
      .eq("channel_id", channelId);

    if (!error) {
      fetchMediaContent();
      toast({ title: "Все файлы добавлены в эфир" });
    }
  };

  const shufflePlaylist = async () => {
    if (mediaContent.length < 2) {
      toast({ title: "Добавьте больше файлов для перемешивания" });
      return;
    }

    // Fisher-Yates shuffle
    const shuffled = [...mediaContent];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Update order by updating created_at
    const now = new Date();
    for (let i = 0; i < shuffled.length; i++) {
      await supabase
        .from("media_content")
        .update({ created_at: new Date(now.getTime() - i * 1000).toISOString() })
        .eq("id", shuffled[i].id);
    }

    fetchMediaContent();
    toast({ title: "Плейлист перемешан" });
  };

  const handleReorder = async (reorderedItems: MediaContent[]) => {
    // Update order by updating created_at based on new positions
    const now = new Date();
    for (let i = 0; i < reorderedItems.length; i++) {
      await supabase
        .from("media_content")
        .update({ created_at: new Date(now.getTime() - i * 1000).toISOString() })
        .eq("id", reorderedItems[i].id);
    }

    setMediaContent(reorderedItems);
    toast({ title: "Порядок обновлён" });
  };


  return (
    <div className="space-y-4">
      {/* Storage Usage */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold">Использование хранилища:</span>
          <span className="text-sm font-mono">{formatBytes(storageUsage)} / 5.00 GB</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div 
            className="bg-primary h-2 rounded-full transition-all"
            style={{ width: `${Math.min((storageUsage / (5 * 1024 * 1024 * 1024)) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Upload & Add URL */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="media-upload" className="cursor-pointer">
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors">
              <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-semibold mb-1">Загрузить файл</p>
              <p className="text-xs text-muted-foreground">
                {channelType === "tv" ? "MP4, WebM до 500MB" : "MP3, WAV до 500MB"}
              </p>
            </div>
          </Label>
          <Input
            id="media-upload"
            type="file"
            accept={channelType === "tv" ? "video/*" : "audio/*"}
            onChange={handleMediaUpload}
            className="hidden"
          />
        </div>

        <Dialog open={isAddUrlOpen} onOpenChange={setIsAddUrlOpen}>
          <DialogTrigger asChild>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer">
              <Link className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-semibold mb-1">Добавить по URL</p>
              <p className="text-xs text-muted-foreground">
                YouTube, MP4, M3U8 ссылки
              </p>
            </div>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Добавить внешний источник</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Название</Label>
                <Input
                  value={urlTitle}
                  onChange={(e) => setUrlTitle(e.target.value)}
                  placeholder="Название контента"
                />
              </div>
              <div>
                <Label>Тип источника</Label>
                <select
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value as "external_url" | "m3u8")}
                  className="w-full p-2 border rounded-md bg-background"
                >
                  <option value="external_url">Прямая ссылка (MP4/MP3)</option>
                  <option value="m3u8">M3U8 ретрансляция</option>
                </select>
              </div>
              <div>
                <Label>URL</Label>
                <Input
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder={sourceType === "m3u8" ? "https://...m3u8" : "https://...mp4"}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Время начала (опц.)</Label>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Время конца (опц.)</Label>
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={handleAddUrl} className="w-full">
                Добавить
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <TorrentUploader 
          channelId={channelId} 
          onTorrentParsed={(files) => {
            console.log("Parsed torrent files:", files);
          }} 
        />
      </div>

      {/* Media List */}
      {mediaContent.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">
              Медиафайлы ({mediaContent.length}):
            </h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={activateAllMedia}
                className="gap-1"
              >
                <Play className="w-3 h-3" />
                Все в эфир
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={shufflePlaylist}
                className="gap-1"
              >
                <Shuffle className="w-3 h-3" />
                Перемешать
              </Button>
            </div>
          </div>
          <DraggableMediaList
            mediaContent={mediaContent}
            onReorder={handleReorder}
            onToggle={toggleMedia}
            onDelete={deleteMedia}
          />
        </div>
      )}
    </div>
  );
};

export default MediaManager;
