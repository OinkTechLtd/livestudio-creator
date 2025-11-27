import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Tv, Radio as RadioIcon, Upload, Wifi } from "lucide-react";
import Header from "@/components/Header";
import { z } from "zod";

const channelSchema = z.object({
  title: z.string().min(3, "Название должно быть минимум 3 символа").max(100, "Название слишком длинное"),
  description: z.string().max(500, "Описание слишком длинное").optional(),
  channel_type: z.union([z.literal("tv"), z.literal("radio")]),
  streaming_method: z.union([z.literal("upload"), z.literal("live")]),
});

const CreateChannel = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [channelType, setChannelType] = useState<"tv" | "radio">("tv");
  const [streamingMethod, setStreamingMethod] = useState<"upload" | "live">("upload");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>("");

  if (!authLoading && !user) {
    navigate("/auth");
    return null;
  }

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

  const uploadThumbnail = async (channelId: string): Promise<string | null> => {
    if (!thumbnailFile) return null;

    const fileExt = thumbnailFile.name.split(".").pop();
    const fileName = `${channelId}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("channel-thumbnails")
      .upload(filePath, thumbnailFile);

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from("channel-thumbnails")
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    
    setLoading(true);

    try {
      const validatedData = channelSchema.parse({
        title,
        description,
        channel_type: channelType,
        streaming_method: streamingMethod,
      });

      // Generate stream key for live streaming method
      const streamKey = streamingMethod === "live" 
        ? `sk_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`
        : null;

      // Insert channel first to get the ID
      const { data: channelData, error: channelError } = await supabase
        .from("channels")
        .insert([{
          user_id: user.id,
          title: validatedData.title,
          description: validatedData.description || null,
          channel_type: validatedData.channel_type,
          streaming_method: validatedData.streaming_method,
          stream_key: streamKey,
          is_live: false,
        }])
        .select()
        .single();

      if (channelError) throw channelError;

      // Upload thumbnail if provided
      let thumbnailUrl = null;
      if (thumbnailFile && channelData) {
        thumbnailUrl = await uploadThumbnail(channelData.id);
        
        // Update channel with thumbnail URL
        const { error: updateError } = await supabase
          .from("channels")
          .update({ thumbnail_url: thumbnailUrl })
          .eq("id", channelData.id);

        if (updateError) throw updateError;
      }

      toast({
        title: "Успешно!",
        description: "Канал создан. Перенаправляем...",
      });

      navigate(`/channel/${channelData.id}`);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Ошибка валидации",
          description: error.issues[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Ошибка",
          description: error.message || "Не удалось создать канал",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
            Создать канал
          </h1>
          <p className="text-muted-foreground mb-8">
            Создайте свой собственный ТВ-канал или радиостанцию
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Channel Type */}
            <div className="space-y-3">
              <Label>Тип канала</Label>
              <RadioGroup value={channelType} onValueChange={(value: "tv" | "radio") => setChannelType(value)}>
                <div className="grid grid-cols-2 gap-4">
                  <Label
                    htmlFor="tv"
                    className={`flex flex-col items-center justify-center p-6 border-2 rounded-lg cursor-pointer transition-all ${
                      channelType === "tv"
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <RadioGroupItem value="tv" id="tv" className="sr-only" />
                    <Tv className="w-12 h-12 mb-2" />
                    <span className="font-semibold">ТВ-канал</span>
                    <span className="text-sm text-muted-foreground">Видео стриминг</span>
                  </Label>
                  
                  <Label
                    htmlFor="radio"
                    className={`flex flex-col items-center justify-center p-6 border-2 rounded-lg cursor-pointer transition-all ${
                      channelType === "radio"
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <RadioGroupItem value="radio" id="radio" className="sr-only" />
                    <RadioIcon className="w-12 h-12 mb-2" />
                    <span className="font-semibold">Радио</span>
                    <span className="text-sm text-muted-foreground">Аудио стриминг</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Название канала</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Введите название"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Описание (необязательно)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Расскажите о вашем канале"
                rows={4}
              />
            </div>

            {/* Thumbnail Upload */}
            <div className="space-y-2">
              <Label htmlFor="thumbnail">Обложка канала</Label>
              <div className="flex items-start gap-4">
                <Input
                  id="thumbnail"
                  type="file"
                  accept="image/*"
                  onChange={handleThumbnailChange}
                  className="flex-1"
                />
              </div>
              {thumbnailPreview && (
                <div className="mt-4">
                  <img
                    src={thumbnailPreview}
                    alt="Preview"
                    className="w-full max-w-md rounded-lg border-2 border-border"
                  />
                </div>
              )}
            </div>

            {/* Streaming Method */}
            <div className="space-y-3">
              <Label>Метод стриминга</Label>
              <RadioGroup value={streamingMethod} onValueChange={(value: "upload" | "live") => setStreamingMethod(value)}>
                <div className="grid grid-cols-2 gap-4">
                  <Label
                    htmlFor="upload"
                    className={`flex flex-col items-center justify-center p-6 border-2 rounded-lg cursor-pointer transition-all ${
                      streamingMethod === "upload"
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <RadioGroupItem value="upload" id="upload" className="sr-only" />
                    <Upload className="w-12 h-12 mb-2" />
                    <span className="font-semibold">Загрузка файлов</span>
                    <span className="text-sm text-muted-foreground text-center">
                      Загружайте видео/аудио
                    </span>
                  </Label>
                  
                  <Label
                    htmlFor="live"
                    className={`flex flex-col items-center justify-center p-6 border-2 rounded-lg cursor-pointer transition-all ${
                      streamingMethod === "live"
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <RadioGroupItem value="live" id="live" className="sr-only" />
                    <Wifi className="w-12 h-12 mb-2" />
                    <span className="font-semibold">Live стриминг</span>
                    <span className="text-sm text-muted-foreground text-center">
                      Стрим через OBS/RTMP
                    </span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? "Создание..." : "Создать канал"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default CreateChannel;
