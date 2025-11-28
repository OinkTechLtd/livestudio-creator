import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Edit, 
  Save, 
  X, 
  Code, 
  Upload, 
  Trash2,
  Radio as RadioIcon,
  Tv
} from "lucide-react";
import Header from "@/components/Header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LikeDislikeSection from "@/components/LikeDislikeSection";
import CommentsSection from "@/components/CommentsSection";
import SubscribeButton from "@/components/SubscribeButton";

interface Channel {
  id: string;
  title: string;
  description: string | null;
  channel_type: "tv" | "radio";
  streaming_method: "upload" | "live" | "scheduled";
  thumbnail_url: string | null;
  stream_key: string | null;
  is_live: boolean;
  user_id: string;
}

interface MediaContent {
  id: string;
  title: string;
  file_url: string;
  file_type: string | null;
  duration: number | null;
  is_24_7: boolean;
  scheduled_at: string | null;
}

const ChannelView = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [channel, setChannel] = useState<Channel | null>(null);
  const [mediaContent, setMediaContent] = useState<MediaContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>("");
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [muxStreamKey, setMuxStreamKey] = useState<string>("");
  const [muxPlaybackId, setMuxPlaybackId] = useState<string>("");
  const [isCreatingStream, setIsCreatingStream] = useState(false);

  useEffect(() => {
    fetchChannel();
    fetchMediaContent();
  }, [id]);

  useEffect(() => {
    // Load existing stream key if available
    if (channel?.stream_key) {
      setMuxStreamKey(channel.stream_key);
    }
  }, [channel]);

  const fetchChannel = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from("channels")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      setChannel(data);
      setEditedTitle(data.title);
      setEditedDescription(data.description || "");
      setThumbnailPreview(data.thumbnail_url || "");
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить канал",
        variant: "destructive",
      });
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const fetchMediaContent = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from("media_content")
        .select("*")
        .eq("channel_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMediaContent(data || []);
    } catch (error) {
      console.error("Error fetching media:", error);
    }
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Ошибка",
          description: "Размер файла не должен превышать 5MB",
          variant: "destructive",
        });
        return;
      }
      setThumbnailFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadThumbnail = async (): Promise<string | null> => {
    if (!thumbnailFile || !channel) return null;

    const fileExt = thumbnailFile.name.split(".").pop();
    const fileName = `${channel.id}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    // Delete old thumbnail if exists
    if (channel.thumbnail_url) {
      const oldPath = channel.thumbnail_url.split("/").pop();
      if (oldPath) {
        await supabase.storage.from("channel-thumbnails").remove([oldPath]);
      }
    }

    const { error: uploadError } = await supabase.storage
      .from("channel-thumbnails")
      .upload(filePath, thumbnailFile);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from("channel-thumbnails")
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!channel || !user) return;

    try {
      let thumbnailUrl = channel.thumbnail_url;

      if (thumbnailFile) {
        thumbnailUrl = await uploadThumbnail();
      }

      const { error } = await supabase
        .from("channels")
        .update({
          title: editedTitle,
          description: editedDescription || null,
          thumbnail_url: thumbnailUrl,
        })
        .eq("id", channel.id);

      if (error) throw error;

      setChannel({
        ...channel,
        title: editedTitle,
        description: editedDescription || null,
        thumbnail_url: thumbnailUrl,
      });

      setIsEditing(false);
      setThumbnailFile(null);

      toast({
        title: "Сохранено",
        description: "Изменения успешно сохранены",
      });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось сохранить изменения",
        variant: "destructive",
      });
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !channel) return;

    const maxSize = 500 * 1024 * 1024; // 500MB
    if (file.size > maxSize) {
      toast({
        title: "Ошибка",
        description: "Размер файла не должен превышать 500MB",
        variant: "destructive",
      });
      return;
    }

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${channel.id}/${Date.now()}.${fileExt}`;

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
          channel_id: channel.id,
          title: file.name,
          file_url: data.publicUrl,
          file_type: file.type,
          is_24_7: false,
        });

      if (insertError) throw insertError;

      toast({
        title: "Успешно",
        description: "Медиа файл загружен",
      });

      fetchMediaContent();
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось загрузить файл",
        variant: "destructive",
      });
    }
  };

  const deleteMedia = async (mediaId: string, fileUrl: string) => {
    try {
      // Delete from storage
      const fileName = fileUrl.split("/").slice(-2).join("/");
      await supabase.storage.from("media-uploads").remove([fileName]);

      // Delete from database
      const { error } = await supabase
        .from("media_content")
        .delete()
        .eq("id", mediaId);

      if (error) throw error;

      toast({
        title: "Удалено",
        description: "Медиа файл удален",
      });

      fetchMediaContent();
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить файл",
        variant: "destructive",
      });
    }
  };

  const getEmbedCode = () => {
    const embedUrl = `${window.location.origin}/embed/${channel?.id}`;
    return `<iframe src="${embedUrl}" width="800" height="450" frameborder="0" allowfullscreen></iframe>`;
  };

  const copyEmbedCode = () => {
    navigator.clipboard.writeText(getEmbedCode());
    toast({
      title: "Скопировано",
      description: "Код для встраивания скопирован в буфер обмена",
    });
  };

  const createMuxStream = async () => {
    if (!channel) return;

    setIsCreatingStream(true);
    try {
      const { data, error } = await supabase.functions.invoke('mux-create-stream', {
        body: { channelId: channel.id },
      });

      if (error) throw error;

      setMuxStreamKey(data.streamKey);
      setMuxPlaybackId(data.playbackId);

      // Update local channel state
      setChannel({
        ...channel,
        stream_key: data.streamKey,
      });

      toast({
        title: "Успешно",
        description: "Live stream создан! Теперь вы можете стримить через OBS",
      });
    } catch (error: any) {
      console.error('Error creating stream:', error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось создать stream",
        variant: "destructive",
      });
    } finally {
      setIsCreatingStream(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Скопировано",
      description: `${label} скопирован в буфер обмена`,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <div className="animate-pulse text-4xl mb-4">⚡</div>
            <p className="text-muted-foreground">Загрузка канала...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!channel) return null;

  const isOwner = user?.id === channel.user_id;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        {/* Channel Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              {channel.channel_type === "tv" ? (
                <Tv className="w-8 h-8 text-primary" />
              ) : (
                <RadioIcon className="w-8 h-8 text-primary" />
              )}
              {isEditing ? (
                <Input
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="text-2xl font-bold"
                />
              ) : (
                <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
                  {channel.title}
                </h1>
              )}
            </div>

            {isOwner && (
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <Button onClick={handleSave} size="sm">
                      <Save className="w-4 h-4 mr-2" />
                      Сохранить
                    </Button>
                    <Button
                      onClick={() => {
                        setIsEditing(false);
                        setEditedTitle(channel.title);
                        setEditedDescription(channel.description || "");
                        setThumbnailFile(null);
                        setThumbnailPreview(channel.thumbnail_url || "");
                      }}
                      variant="outline"
                      size="sm"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Отмена
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
                    <Edit className="w-4 h-4 mr-2" />
                    Редактировать
                  </Button>
                )}
              </div>
            )}
          </div>

          {isEditing ? (
            <Textarea
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              placeholder="Описание канала"
              rows={3}
            />
          ) : (
            channel.description && (
              <p className="text-muted-foreground">{channel.description}</p>
            )
          )}
        </div>

        {/* Thumbnail */}
        <div className="mb-8">
          {isEditing && (
            <div className="mb-4">
              <Label htmlFor="edit-thumbnail">Обновить обложку</Label>
              <Input
                id="edit-thumbnail"
                type="file"
                accept="image/*"
                onChange={handleThumbnailChange}
                className="mt-2"
              />
            </div>
          )}
          {thumbnailPreview && (
            <img
              src={thumbnailPreview}
              alt={channel.title}
              className="w-full max-w-2xl rounded-lg border-2 border-border"
            />
          )}
        </div>

        {/* Subscribe, Like/Dislike and Embed Code */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          {!isOwner && <SubscribeButton channelId={channel.id} channelTitle={channel.title} />}
          <LikeDislikeSection channelId={channel.id} />
          
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Code className="w-4 h-4 mr-2" />
                Код для встраивания
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Встроить плеер на сайт</DialogTitle>
                <DialogDescription>
                  Скопируйте этот код и вставьте его на ваш сайт
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <code className="text-sm break-all">{getEmbedCode()}</code>
                </div>
                <Button onClick={copyEmbedCode} className="w-full">
                  Скопировать код
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tabs for content */}
        <Tabs defaultValue="player" className="w-full">
          <TabsList>
            <TabsTrigger value="player">Плеер</TabsTrigger>
            {isOwner && <TabsTrigger value="media">Медиа файлы</TabsTrigger>}
            {isOwner && channel.streaming_method === "live" && (
              <TabsTrigger value="obs">OBS настройки</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="player" className="mt-6">
            <div className="bg-card border-2 border-border rounded-lg p-8">
              <div className="space-y-4">
                {channel.streaming_method === "live" && muxPlaybackId ? (
                  <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                    <iframe
                      src={`https://stream.mux.com/${muxPlaybackId}.html?autoplay=true`}
                      style={{ width: '100%', height: '100%', border: 0 }}
                      allow="autoplay; fullscreen"
                      allowFullScreen
                    />
                  </div>
                ) : mediaContent.length > 0 ? (
                  <>
                    <div className="aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                      {channel.channel_type === "tv" ? (
                        <video
                          key={mediaContent[currentMediaIndex].id}
                          src={mediaContent[currentMediaIndex].file_url}
                          controls
                          autoPlay
                          className="w-full h-full object-contain"
                          onEnded={() => {
                            // Auto-play next video
                            if (currentMediaIndex < mediaContent.length - 1) {
                              setCurrentMediaIndex(currentMediaIndex + 1);
                            } else {
                              // Loop back to first video
                              setCurrentMediaIndex(0);
                            }
                          }}
                          onError={(e) => {
                            console.error("Video error:", e);
                            // Skip to next video on error
                            if (currentMediaIndex < mediaContent.length - 1) {
                              setCurrentMediaIndex(currentMediaIndex + 1);
                            }
                          }}
                        />
                      ) : (
                        <audio
                          key={mediaContent[currentMediaIndex].id}
                          src={mediaContent[currentMediaIndex].file_url}
                          controls
                          autoPlay
                          className="w-full"
                          onEnded={() => {
                            // Auto-play next audio
                            if (currentMediaIndex < mediaContent.length - 1) {
                              setCurrentMediaIndex(currentMediaIndex + 1);
                            } else {
                              // Loop back to first audio
                              setCurrentMediaIndex(0);
                            }
                          }}
                          onError={(e) => {
                            console.error("Audio error:", e);
                            // Skip to next audio on error
                            if (currentMediaIndex < mediaContent.length - 1) {
                              setCurrentMediaIndex(currentMediaIndex + 1);
                            }
                          }}
                        />
                      )}
                    </div>
                    
                    {/* Playlist */}
                    <div>
                      <h3 className="text-lg font-semibold mb-2">
                        Плейлист ({mediaContent.length} {mediaContent.length === 1 ? "файл" : "файлов"})
                      </h3>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {mediaContent.map((media, index) => (
                          <div
                            key={media.id}
                            onClick={() => setCurrentMediaIndex(index)}
                            className={`p-3 rounded-lg cursor-pointer transition-colors ${
                              index === currentMediaIndex
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted hover:bg-muted/80"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-semibold">
                                {index + 1}
                              </span>
                              <span className="flex-1 truncate">{media.title}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <p className="text-lg mb-2">Медиа контент пока не загружен</p>
                      {isOwner && (
                        <p className="text-sm">
                          Загрузите медиа файлы во вкладке "Медиа файлы"
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {isOwner && (
            <TabsContent value="media" className="mt-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="media-upload" className="cursor-pointer">
                    <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors">
                      <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="font-semibold mb-2">Загрузить медиа файл</p>
                      <p className="text-sm text-muted-foreground">
                        {channel.channel_type === "tv"
                          ? "Видео файлы (MP4, WebM, до 500MB)"
                          : "Аудио файлы (MP3, WAV, до 500MB)"}
                      </p>
                    </div>
                  </Label>
                  <Input
                    id="media-upload"
                    type="file"
                    accept={channel.channel_type === "tv" ? "video/*" : "audio/*"}
                    onChange={handleMediaUpload}
                    className="hidden"
                  />
                </div>

                {mediaContent.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold">Загруженные файлы:</h3>
                    {mediaContent.map((media) => (
                      <div
                        key={media.id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg"
                      >
                        <span>{media.title}</span>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteMedia(media.id, media.file_url)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          )}

          {isOwner && channel.streaming_method === "live" && (
            <TabsContent value="obs" className="mt-6">
              <div className="bg-card border-2 border-border rounded-lg p-6 space-y-6">
                <div>
                  <h3 className="text-xl font-bold mb-2">Настройки для OBS Studio</h3>
                  <p className="text-sm text-muted-foreground">
                    Используйте эти данные для настройки live стриминга через OBS
                  </p>
                </div>

                {!muxStreamKey ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">
                      Создайте live stream для получения настроек RTMP
                    </p>
                    <Button 
                      onClick={createMuxStream} 
                      disabled={isCreatingStream}
                      size="lg"
                    >
                      {isCreatingStream ? "Создание..." : "Создать Live Stream"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-muted/50 p-4 rounded-lg space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-base font-semibold">RTMP Server URL:</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard("rtmp://global-live.mux.com:5222/app", "RTMP URL")}
                          >
                            Копировать
                          </Button>
                        </div>
                        <Input
                          value="rtmp://global-live.mux.com:5222/app"
                          readOnly
                          className="font-mono text-sm bg-background"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-base font-semibold">Stream Key:</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(muxStreamKey, "Stream Key")}
                          >
                            Копировать
                          </Button>
                        </div>
                        <Input
                          value={muxStreamKey}
                          readOnly
                          className="font-mono text-sm bg-background"
                          type="password"
                        />
                        <p className="text-xs text-muted-foreground">
                          ⚠️ Не делитесь Stream Key с другими людьми
                        </p>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="font-semibold mb-3">Инструкция по настройке OBS:</h4>
                      <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                        <li>Откройте OBS Studio</li>
                        <li>Перейдите в Settings → Stream</li>
                        <li>Выберите "Custom" в Service</li>
                        <li>Вставьте RTMP Server URL в поле "Server"</li>
                        <li>Вставьте Stream Key в поле "Stream Key"</li>
                        <li>Нажмите "OK" и начните стриминг</li>
                      </ol>
                    </div>

                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                      <p className="text-sm">
                        <strong>Статус:</strong> Stream готов к использованию. 
                        Начните трансляцию в OBS, и ваш контент будет доступен зрителям через несколько секунд.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>

        {/* Comments Section */}
        <div className="mt-8">
          <CommentsSection channelId={channel.id} />
        </div>
      </main>
    </div>
  );
};

export default ChannelView;
