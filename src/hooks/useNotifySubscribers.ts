import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface NotifyOptions {
  channelId: string;
  type: "new_stream" | "new_content" | "channel_update";
  title: string;
  message: string;
}

export function useNotifySubscribers() {
  const notifySubscribers = async ({ channelId, type, title, message }: NotifyOptions) => {
    try {
      const { data, error } = await supabase.functions.invoke("send-notification", {
        body: { channelId, type, title, message },
      });

      if (error) {
        console.error("Failed to send notifications:", error);
        return { success: false, error };
      }

      console.log(`Notifications sent to ${data?.notified || 0} subscribers`);
      return { success: true, notified: data?.notified || 0 };
    } catch (error) {
      console.error("Error sending notifications:", error);
      return { success: false, error };
    }
  };

  return { notifySubscribers };
}
