import { useState, useEffect } from "react";
import { Bell, Check, X, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface Notification {
  id: string;
  channel_id: string | null;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface PendingInvitation {
  id: string;
  channel_id: string;
  role: string;
  channels: {
    title: string;
    channel_type: string;
  } | null;
}

export function NotificationBell() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    fetchNotifications();
    fetchInvitations();

    // Subscribe to realtime notifications
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications((prev) => [newNotification, ...prev]);
          setUnreadCount((prev) => prev + 1);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "channel_members",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchInvitations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!error && data) {
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.is_read).length);
    }
  };

  const fetchInvitations = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("channel_members")
      .select(`
        id,
        channel_id,
        role,
        channels (
          title,
          channel_type
        )
      `)
      .eq("user_id", user.id)
      .eq("status", "pending");

    if (!error && data) {
      setInvitations(data as any);
    }
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

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    if (!user) return;

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const clearAll = async () => {
    if (!user) return;

    await supabase.from("notifications").delete().eq("user_id", user.id);

    setNotifications([]);
    setUnreadCount(0);
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case "admin": return "Администратор";
      case "presenter": return "Ведущий";
      case "moderator": return "Модератор";
      default: return role;
    }
  };

  if (!user) return null;

  const totalBadge = unreadCount + invitations.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {totalBadge > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
              {totalBadge > 9 ? "9+" : totalBadge}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Уведомления</h3>
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                Прочитать все
              </Button>
            )}
            {notifications.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                Очистить
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="h-[350px]">
          {/* Pending Invitations */}
          {invitations.length > 0 && (
            <div className="border-b">
              <div className="px-4 py-2 bg-primary/5">
                <p className="text-xs font-semibold text-primary flex items-center gap-1">
                  <UserPlus className="w-3 h-3" />
                  Приглашения ({invitations.length})
                </p>
              </div>
              <div className="divide-y">
                {invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="p-3 bg-primary/5"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">
                          {invitation.channels?.title || "Канал"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Роль: {getRoleName(invitation.role)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 h-7 text-xs gap-1"
                        onClick={() => handleInvitation(invitation.id, true)}
                      >
                        <Check className="w-3 h-3" />
                        Принять
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-7 text-xs gap-1"
                        onClick={() => handleInvitation(invitation.id, false)}
                      >
                        <X className="w-3 h-3" />
                        Отклонить
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Regular Notifications */}
          {notifications.length === 0 && invitations.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              Нет уведомлений
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
                    !notification.is_read ? "bg-primary/5" : ""
                  }`}
                  onClick={() => {
                    markAsRead(notification.id);
                    if (notification.channel_id) {
                      setOpen(false);
                    }
                  }}
                >
                  {notification.channel_id ? (
                    <Link
                      to={`/channel/${notification.channel_id}`}
                      className="block"
                    >
                      <NotificationContent notification={notification} />
                    </Link>
                  ) : (
                    <NotificationContent notification={notification} />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function NotificationContent({ notification }: { notification: Notification }) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-sm line-clamp-1">{notification.title}</p>
        {!notification.is_read && (
          <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
        )}
      </div>
      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
        {notification.message}
      </p>
      <p className="text-xs text-muted-foreground mt-2">
        {formatDistanceToNow(new Date(notification.created_at), {
          addSuffix: true,
          locale: ru,
        })}
      </p>
    </>
  );
}
