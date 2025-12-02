import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  channelId: string;
  type: "new_stream" | "new_content" | "channel_update";
  title: string;
  message: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { channelId, type, title, message }: NotificationRequest = await req.json();

    console.log(`Processing notification for channel ${channelId}, type: ${type}`);

    // Get channel info
    const { data: channel, error: channelError } = await supabase
      .from("channels")
      .select("title, user_id")
      .eq("id", channelId)
      .single();

    if (channelError || !channel) {
      console.error("Channel not found:", channelError);
      return new Response(
        JSON.stringify({ error: "Channel not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all subscribers of this channel
    const { data: subscribers, error: subsError } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("channel_id", channelId);

    if (subsError) {
      console.error("Error fetching subscribers:", subsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch subscribers" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${subscribers?.length || 0} subscribers`);

    if (!subscribers || subscribers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, notified: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create in-app notifications for all subscribers
    const notifications = subscribers.map((sub) => ({
      user_id: sub.user_id,
      channel_id: channelId,
      type,
      title,
      message,
    }));

    const { error: insertError } = await supabase
      .from("notifications")
      .insert(notifications);

    if (insertError) {
      console.error("Error creating notifications:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create notifications" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get subscriber emails for email notifications
    const userIds = subscribers.map((s) => s.user_id);
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      console.error("Error fetching users:", usersError);
    }

    // Send email notifications (optional, won't fail if emails fail)
    if (users?.users) {
      const subscriberEmails = users.users
        .filter((u) => userIds.includes(u.id) && u.email)
        .map((u) => u.email!);

      console.log(`Sending emails to ${subscriberEmails.length} subscribers`);

      for (const email of subscriberEmails.slice(0, 50)) { // Limit to 50 emails
        try {
          await resend.emails.send({
            from: "StreamLiveTV <onboarding@resend.dev>",
            to: [email],
            subject: title,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">${title}</h2>
                <p style="color: #666; font-size: 16px;">${message}</p>
                <p style="color: #999; font-size: 14px;">Канал: ${channel.title}</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="color: #999; font-size: 12px;">
                  Вы получили это письмо, потому что подписаны на канал "${channel.title}".
                </p>
              </div>
            `,
          });
        } catch (emailError) {
          console.error(`Failed to send email to ${email}:`, emailError);
        }
      }
    }

    console.log(`Successfully notified ${subscribers.length} subscribers`);

    return new Response(
      JSON.stringify({ success: true, notified: subscribers.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in send-notification:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
