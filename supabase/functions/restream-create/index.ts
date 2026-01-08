import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESTREAM_CLIENT_ID = Deno.env.get("RESTREAM_CLIENT_ID");
    const RESTREAM_CLIENT_SECRET = Deno.env.get("RESTREAM_CLIENT_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    if (!RESTREAM_CLIENT_ID || !RESTREAM_CLIENT_SECRET) {
      throw new Error("Restream credentials not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { channelId } = await req.json();
    if (!channelId) {
      throw new Error("Channel ID required");
    }

    // Verify channel ownership
    const { data: channel, error: channelError } = await supabase
      .from("channels")
      .select("id, user_id, title")
      .eq("id", channelId)
      .single();

    if (channelError || !channel) {
      throw new Error("Channel not found");
    }

    if (channel.user_id !== user.id) {
      throw new Error("Not channel owner");
    }

    // Get Restream access token using client credentials
    const tokenResponse = await fetch("https://api.restream.io/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: RESTREAM_CLIENT_ID,
        client_secret: RESTREAM_CLIENT_SECRET,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Restream token error:", errorText);
      throw new Error("Failed to get Restream token");
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get Restream ingest info
    const ingestResponse = await fetch("https://api.restream.io/v2/user/ingest", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!ingestResponse.ok) {
      throw new Error("Failed to get Restream ingest info");
    }

    const ingestData = await ingestResponse.json();

    // Generate a unique stream key for this channel
    const streamKey = `${channelId}_${Date.now()}`;
    const rtmpUrl = ingestData.rtmp?.url || "rtmp://live.restream.io/live";
    const fullStreamKey = ingestData.rtmp?.key || streamKey;

    // Update channel with Restream credentials
    const { error: updateError } = await supabase
      .from("channels")
      .update({
        stream_key: fullStreamKey,
        mux_playback_id: null, // Clear Mux playback ID
        streaming_method: "live",
      })
      .eq("id", channelId);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        rtmpUrl,
        streamKey: fullStreamKey,
        message: "Restream credentials created successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
