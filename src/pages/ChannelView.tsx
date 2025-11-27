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

  useEffect(() => {
    fetchChannel();
    fetchMediaContent();
  }, [id]);

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

        {/* Like/Dislike and Embed Code */}
        <div className="flex items-center gap-4 mb-6">
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
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                {mediaContent.length > 0 ? (
                  <div className="text-center">
                    <p className="text-lg font-semibold mb-2">
                      {mediaContent[0].title}
                    </p>
                    {channel.channel_type === "tv" ? (
                      <video
                        src={mediaContent[0].file_url}
                        controls
                        className="w-full max-h-[450px]"
                      />
                    ) : (
                      <audio src={mediaContent[0].file_url} controls className="w-full" />
                    )}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground">
                    <p className="text-lg mb-2">Медиа контент пока не загружен</p>
                    {isOwner && (
                      <p className="text-sm">
                        Загрузите медиа файлы во вкладке "Медиа файлы"
                      </p>
                    )}
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
              <div className="bg-card border-2 border-border rounded-lg p-6 space-y-4">
                <h3 className="text-xl font-bold">Настройки для OBS Studio</h3>
                <div className="space-y-2">
                  <Label>Stream URL (RTMP):</Label>
                  <Input
                    value={`rtmp://${window.location.hostname}/live`}
                    readOnly
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Stream Key:</Label>
                  <Input
                    value={channel.stream_key || ""}
                    readOnly
                    className="font-mono"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Используйте эти данные в OBS Studio для настройки стриминга
                </p>
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
