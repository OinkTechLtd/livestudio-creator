import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Users, Crown, Shield, Mic, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ChannelMember {
  id: string;
  user_id: string;
  role: string;
  status: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
}

interface ChannelMemberManagerProps {
  channelId: string;
  channelOwnerId: string;
  isOwner: boolean;
}

const roleIcons = {
  owner: Crown,
  admin: Shield,
  host: Mic,
};

const roleLabels = {
  owner: "Владелец",
  admin: "Администратор",
  host: "Ведущий",
};

const roleColors = {
  owner: "text-yellow-500",
  admin: "text-blue-500",
  host: "text-green-500",
};

// Role permissions - admin has full access, host can only start streams
export const rolePermissions = {
  owner: ["all"],
  admin: ["all"], // Full access like owner
  host: ["start_stream", "stop_stream", "view_chat", "send_chat"], // Limited to streaming only
};

export const hasPermission = (role: string, permission: string): boolean => {
  const perms = rolePermissions[role as keyof typeof rolePermissions];
  if (!perms) return false;
  return perms.includes("all") || perms.includes(permission);
};

const ChannelMemberManager = ({ channelId, channelOwnerId, isOwner }: ChannelMemberManagerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchUsername, setSearchUsername] = useState("");
  const [selectedRole, setSelectedRole] = useState<"admin" | "host">("host");
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, [channelId]);

  const fetchMembers = async () => {
    const { data } = await supabase
      .from("channel_members")
      .select(`
        id,
        user_id,
        role,
        status,
        profiles:user_id (
          username,
          avatar_url
        )
      `)
      .eq("channel_id", channelId)
      .eq("status", "accepted");

    if (data) {
      setMembers(data as any);
    }
  };

  const inviteMember = async () => {
    if (!searchUsername.trim()) return;

    setIsSearching(true);

    // Find user by username
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("username", searchUsername.trim())
      .single();

    if (!profile) {
      toast({
        title: "Пользователь не найден",
        description: "Проверьте правильность никнейма",
        variant: "destructive",
      });
      setIsSearching(false);
      return;
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from("channel_members")
      .select("id")
      .eq("channel_id", channelId)
      .eq("user_id", profile.id)
      .single();

    if (existing) {
      toast({
        title: "Уже участник",
        description: "Этот пользователь уже является участником канала",
        variant: "destructive",
      });
      setIsSearching(false);
      return;
    }

    // Create invitation
    const { error } = await supabase.from("channel_members").insert({
      channel_id: channelId,
      user_id: profile.id,
      role: selectedRole,
      status: "pending",
      invited_by: user?.id,
    });

    if (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось отправить приглашение",
        variant: "destructive",
      });
    } else {
      // Create notification
      await supabase.from("notifications").insert({
        user_id: profile.id,
        channel_id: channelId,
        type: "channel_invite",
        title: "Приглашение в канал",
        message: `Вас приглашают стать ${roleLabels[selectedRole]}ом канала`,
      });

      toast({
        title: "Приглашение отправлено",
        description: `${profile.username} получит уведомление`,
      });
      setSearchUsername("");
    }

    setIsSearching(false);
  };

  const removeMember = async (memberId: string) => {
    const { error } = await supabase
      .from("channel_members")
      .delete()
      .eq("id", memberId);

    if (!error) {
      toast({ title: "Участник удален" });
      fetchMembers();
    }
  };

  const updateRole = async (memberId: string, newRole: string) => {
    const { error } = await supabase
      .from("channel_members")
      .update({ role: newRole })
      .eq("id", memberId);

    if (!error) {
      toast({ title: "Роль обновлена" });
      fetchMembers();
    }
  };

  if (!isOwner) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Users className="w-4 h-4" />
          Команда канала
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Управление командой
          </DialogTitle>
        </DialogHeader>

        {/* Invite new member */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-2">
              <Label>Никнейм пользователя</Label>
              <Input
                value={searchUsername}
                onChange={(e) => setSearchUsername(e.target.value)}
                placeholder="Введите никнейм"
              />
            </div>
            <div className="space-y-2">
              <Label>Роль</Label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-500" />
                      Администратор
                    </div>
                  </SelectItem>
                  <SelectItem value="host">
                    <div className="flex items-center gap-2">
                      <Mic className="w-4 h-4 text-green-500" />
                      Ведущий
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                <strong>Администратор</strong> — полный доступ как у владельца (настройки, медиа, аналитика, команда)<br />
                <strong>Ведущий</strong> — может только запускать/останавливать трансляции
              </p>
            </div>
            <Button onClick={inviteMember} disabled={isSearching} className="w-full">
              <UserPlus className="w-4 h-4 mr-2" />
              Пригласить
            </Button>
          </CardContent>
        </Card>

        {/* Current members */}
        <div className="space-y-2">
          <h4 className="font-medium">Участники канала</h4>
          
          {/* Owner */}
          <Card className="bg-yellow-500/10 border-yellow-500/30">
            <CardContent className="p-3 flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback>
                  <Crown className="w-5 h-5 text-yellow-500" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium">Вы</p>
                <Badge variant="secondary" className="gap-1">
                  <Crown className="w-3 h-3 text-yellow-500" />
                  Владелец
                </Badge>
              </div>
            </CardContent>
          </Card>

          {members.map((member) => {
            const RoleIcon = roleIcons[member.role as keyof typeof roleIcons] || Users;
            return (
              <Card key={member.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.profiles.avatar_url || undefined} />
                    <AvatarFallback>
                      {member.profiles.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{member.profiles.username}</p>
                    <Select
                      value={member.role}
                      onValueChange={(v) => updateRole(member.id, v)}
                    >
                      <SelectTrigger className="h-7 w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Администратор</SelectItem>
                        <SelectItem value="host">Ведущий</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeMember(member.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}

          {members.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              В команде пока только вы
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChannelMemberManager;
