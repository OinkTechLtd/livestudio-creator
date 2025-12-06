import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Check, X, UserPlus } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Invitation {
  id: string;
  channel_id: string;
  role: string;
  status: string;
  created_at: string;
  channels: {
    id: string;
    title: string;
    channel_type: string;
  };
  inviter: {
    username: string;
  } | null;
}

interface InvitationHandlerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const InvitationHandler = ({ open, onOpenChange }: InvitationHandlerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && open) {
      fetchInvitations();
    }
  }, [user, open]);

  const fetchInvitations = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("channel_members")
      .select(`
        id,
        channel_id,
        role,
        status,
        created_at,
        channels (
          id,
          title,
          channel_type
        ),
        inviter:invited_by (
          username
        )
      `)
      .eq("user_id", user.id)
      .eq("status", "pending");

    if (!error && data) {
      setInvitations(data as any);
    }
    setLoading(false);
  };

  const handleInvitation = async (invitationId: string, accept: boolean) => {
    const { error } = await supabase
      .from("channel_members")
      .update({ status: accept ? "accepted" : "rejected" })
      .eq("id", invitationId);

    if (!error) {
      toast({
        title: accept ? "Приглашение принято" : "Приглашение отклонено",
        description: accept ? "Вы теперь член команды канала" : "",
      });
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
    } else {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case "admin": return "Администратор";
      case "presenter": return "Ведущий";
      case "moderator": return "Модератор";
      default: return role;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Приглашения в команду
          </DialogTitle>
          <DialogDescription>
            Управление приглашениями на каналы
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-pulse text-2xl mb-2">📬</div>
            <p className="text-muted-foreground">Загрузка...</p>
          </div>
        ) : invitations.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Нет активных приглашений</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {invitations.map((invitation) => (
              <Card key={invitation.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {invitation.channels?.title || "Канал"}
                  </CardTitle>
                  <CardDescription>
                    Роль: <span className="font-semibold">{getRoleName(invitation.role)}</span>
                    {invitation.inviter && (
                      <span className="block mt-1">
                        Приглашение от: {invitation.inviter.username}
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleInvitation(invitation.id, true)}
                    className="gap-2 flex-1"
                  >
                    <Check className="w-4 h-4" />
                    Принять
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleInvitation(invitation.id, false)}
                    className="gap-2 flex-1"
                  >
                    <X className="w-4 h-4" />
                    Отклонить
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default InvitationHandler;
