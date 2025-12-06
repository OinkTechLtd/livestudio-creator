import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Edit, Save, X, Tv, Radio } from "lucide-react";
import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import FavoriteChannels from "@/components/FavoriteChannels";

interface Profile {
  id: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
}

interface Channel {
  id: string;
  title: string;
  description: string | null;
  channel_type: "tv" | "radio";
  thumbnail_url: string | null;
  is_live: boolean;
  viewer_count: number;
}

const Profile = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [subscribedChannels, setSubscribedChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  const [editedUsername, setEditedUsername] = useState("");
  const [editedBio, setEditedBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");

  const profileId = id || user?.id;
  const isOwnProfile = user?.id === profileId;

  useEffect(() => {
    if (profileId) {
      fetchProfile();
      fetchChannels();
      if (isOwnProfile) {
        fetchSubscribedChannels();
      }
    }
  }, [profileId]);

  const fetchProfile = async () => {
    if (!profileId) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", profileId)
        .single();

      if (error) throw error;

      setProfile(data);
      setEditedUsername(data.username);
      setEditedBio(data.bio || "");
      setAvatarPreview(data.avatar_url || "");
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить профиль",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchChannels = async () => {
    if (!profileId) return;

    try {
      const { data, error } = await supabase
        .from("channels")
        .select("*")
        .eq("user_id", profileId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setChannels(data || []);
    } catch (error) {
      console.error("Error fetching channels:", error);
    }
  };

  const fetchSubscribedChannels = async () => {
    if (!profileId) return;

    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select(`
          channel_id,
          channels (*)
        `)
        .eq("user_id", profileId);

      if (error) throw error;
      const channelData = data?.map((sub: any) => sub.channels).filter(Boolean) || [];
      setSubscribedChannels(channelData);
    } catch (error) {
      console.error("Error fetching subscribed channels:", error);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "Ошибка",
          description: "Размер файла не должен превышать 2MB",
          variant: "destructive",
        });
        return;
      }
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadAvatar = async (): Promise<string | null> => {
    if (!avatarFile || !profile) return null;

    const fileExt = avatarFile.name.split(".").pop();
    const fileName = `${profile.id}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    // Delete old avatar if exists
    if (profile.avatar_url) {
      const oldPath = profile.avatar_url.split("/").pop();
      if (oldPath) {
        await supabase.storage.from("avatars").remove([oldPath]);
      }
    }

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, avatarFile);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!profile || !user) return;

    try {
      let avatarUrl = profile.avatar_url;

      if (avatarFile) {
        avatarUrl = await uploadAvatar();
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          username: editedUsername,
          bio: editedBio || null,
          avatar_url: avatarUrl,
        })
        .eq("id", profile.id);

      if (error) throw error;

      setProfile({
        ...profile,
        username: editedUsername,
        bio: editedBio || null,
        avatar_url: avatarUrl,
      });

      setIsEditing(false);
      setAvatarFile(null);

      toast({
        title: "Сохранено",
        description: "Профиль успешно обновлен",
      });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось сохранить изменения",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <div className="animate-pulse text-4xl mb-4">⚡</div>
            <p className="text-muted-foreground">Загрузка профиля...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const tvChannels = channels.filter((ch) => ch.channel_type === "tv");
  const radioChannels = channels.filter((ch) => ch.channel_type === "radio");

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        {/* Profile Header */}
        <div className="mb-8">
          <Card className="glass-strong">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                {/* Avatar */}
                <div className="relative">
                  <Avatar className="w-32 h-32 border-4 border-primary">
                    <AvatarImage src={avatarPreview} />
                    <AvatarFallback className="text-3xl bg-primary/20">
                      {profile.username[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {isEditing && (
                    <div className="mt-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="text-sm"
                      />
                    </div>
                  )}
                </div>

                {/* Profile Info */}
                <div className="flex-1 text-center md:text-left">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="username">Имя пользователя</Label>
                        <Input
                          id="username"
                          value={editedUsername}
                          onChange={(e) => setEditedUsername(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="bio">Биография</Label>
                        <Textarea
                          id="bio"
                          value={editedBio}
                          onChange={(e) => setEditedBio(e.target.value)}
                          placeholder="Расскажите о себе..."
                          rows={3}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <h1 className="text-3xl font-bold mb-2">{profile.username}</h1>
                      {profile.bio && (
                        <p className="text-muted-foreground mb-4">{profile.bio}</p>
                      )}
                      <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary">
                            {channels.length}
                          </div>
                          <div className="text-sm text-muted-foreground">Каналов</div>
                        </div>
                        {isOwnProfile && (
                          <div className="text-center">
                            <div className="text-2xl font-bold text-secondary">
                              {subscribedChannels.length}
                            </div>
                            <div className="text-sm text-muted-foreground">Подписок</div>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {isOwnProfile && (
                    <div className="flex gap-2 mt-4 justify-center md:justify-start">
                      {isEditing ? (
                        <>
                          <Button onClick={handleSave} size="sm">
                            <Save className="w-4 h-4 mr-2" />
                            Сохранить
                          </Button>
                          <Button
                            onClick={() => {
                              setIsEditing(false);
                              setEditedUsername(profile.username);
                              setEditedBio(profile.bio || "");
                              setAvatarFile(null);
                              setAvatarPreview(profile.avatar_url || "");
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
                          Редактировать профиль
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Channels Tabs */}
        <Tabs defaultValue="channels" className="w-full">
          <TabsList className="grid w-full max-w-lg mx-auto grid-cols-3">
            <TabsTrigger value="channels">Мои каналы</TabsTrigger>
            {isOwnProfile && <TabsTrigger value="favorites">Избранное</TabsTrigger>}
            {isOwnProfile && <TabsTrigger value="subscriptions">Подписки</TabsTrigger>}
          </TabsList>

          <TabsContent value="channels" className="mt-6">
            <div className="space-y-6">
              {/* TV Channels */}
              {tvChannels.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <Tv className="w-6 h-6 text-primary" />
                    ТВ Каналы
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tvChannels.map((channel) => (
                      <Link key={channel.id} to={`/channel/${channel.id}`}>
                        <Card className="group glass hover:glass-strong transition-all cursor-pointer">
                          <div className="relative aspect-video bg-muted overflow-hidden rounded-t-lg">
                            {channel.thumbnail_url ? (
                              <img
                                src={channel.thumbnail_url}
                                alt={channel.title}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Tv className="w-16 h-16 text-primary/50" />
                              </div>
                            )}
                          </div>
                          <CardHeader>
                            <CardTitle className="line-clamp-1">{channel.title}</CardTitle>
                            <CardDescription className="line-clamp-2">
                              {channel.description || "Описание отсутствует"}
                            </CardDescription>
                          </CardHeader>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Radio Channels */}
              {radioChannels.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <Radio className="w-6 h-6 text-secondary" />
                    Радиостанции
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {radioChannels.map((channel) => (
                      <Link key={channel.id} to={`/channel/${channel.id}`}>
                        <Card className="group glass hover:glass-strong transition-all cursor-pointer">
                          <div className="relative aspect-video bg-muted overflow-hidden rounded-t-lg">
                            {channel.thumbnail_url ? (
                              <img
                                src={channel.thumbnail_url}
                                alt={channel.title}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Radio className="w-16 h-16 text-secondary/50" />
                              </div>
                            )}
                          </div>
                          <CardHeader>
                            <CardTitle className="line-clamp-1">{channel.title}</CardTitle>
                            <CardDescription className="line-clamp-2">
                              {channel.description || "Описание отсутствует"}
                            </CardDescription>
                          </CardHeader>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {channels.length === 0 && (
                <Card className="glass-strong text-center py-12">
                  <CardContent>
                    <p className="text-muted-foreground">
                      {isOwnProfile
                        ? "Вы еще не создали ни одного канала"
                        : "Этот пользователь пока не создал ни одного канала"}
                    </p>
                    {isOwnProfile && (
                      <Button
                        onClick={() => navigate("/create-channel")}
                        className="mt-4"
                      >
                        Создать первый канал
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {isOwnProfile && (
            <TabsContent value="favorites" className="mt-6">
              <FavoriteChannels />
            </TabsContent>
          )}

          {isOwnProfile && (
            <TabsContent value="subscriptions" className="mt-6">
              {subscribedChannels.length === 0 ? (
                <Card className="glass-strong text-center py-12">
                  <CardContent>
                    <p className="text-muted-foreground">
                      Вы пока не подписаны ни на один канал
                    </p>
                    <Button onClick={() => navigate("/")} className="mt-4">
                      Найти каналы
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {subscribedChannels.map((channel) => (
                    <Link key={channel.id} to={`/channel/${channel.id}`}>
                      <Card className="group glass hover:glass-strong transition-all cursor-pointer">
                        <div className="relative aspect-video bg-muted overflow-hidden rounded-t-lg">
                          {channel.thumbnail_url ? (
                            <img
                              src={channel.thumbnail_url}
                              alt={channel.title}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              {channel.channel_type === "tv" ? (
                                <Tv className="w-16 h-16 text-primary/50" />
                              ) : (
                                <Radio className="w-16 h-16 text-secondary/50" />
                              )}
                            </div>
                          )}
                        </div>
                        <CardHeader>
                          <CardTitle className="line-clamp-1">{channel.title}</CardTitle>
                          <CardDescription className="line-clamp-2">
                            {channel.description || "Описание отсутствует"}
                          </CardDescription>
                        </CardHeader>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
};

export default Profile;
