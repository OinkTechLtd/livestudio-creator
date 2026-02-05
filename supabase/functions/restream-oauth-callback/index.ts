import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  console.log("=== restream-oauth-callback ===");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RESTREAM_CLIENT_ID = Deno.env.get("RESTREAM_CLIENT_ID");
    const RESTREAM_CLIENT_SECRET = Deno.env.get("RESTREAM_CLIENT_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!RESTREAM_CLIENT_ID || !RESTREAM_CLIENT_SECRET) {
      throw new Error("Restream credentials not configured");
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { code, channelId, redirectUri } = await req.json();
    if (!code || !channelId || !redirectUri) {
      throw new Error("Missing code/channelId/redirectUri");
    }

    // Validate user + channel ownership (user session)
    const supabaseAuthed = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userErr,
    } = await supabaseAuthed.auth.getUser();

    if (userErr || !user) {
      throw new Error("Unauthorized");
    }

    const { data: channel, error: channelError } = await supabaseAuthed
      .from("channels")
      .select("id, user_id")
      .eq("id", channelId)
      .single();

    if (channelError || !channel) {
      throw new Error("Channel not found");
    }
    if (channel.user_id !== user.id) {
      throw new Error("Not channel owner");
    }

    // Exchange code for tokens
    const tokenResponse = await fetch("https://api.restream.io/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${RESTREAM_CLIENT_ID}:${RESTREAM_CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: String(code),
        redirect_uri: String(redirectUri),
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange error:", tokenResponse.status, errorText);
      throw new Error(`Token exchange failed: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Fetch ingest/RTMP info
    const ingestResponse = await fetch("https://api.restream.io/v2/user/ingest", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!ingestResponse.ok) {
      const errorText = await ingestResponse.text();
      console.error("Ingest fetch error:", ingestResponse.status, errorText);
      throw new Error(`Failed to fetch ingest info: ${ingestResponse.status}`);
    }

    const ingestData = await ingestResponse.json();
    const rtmpServer = ingestData?.rtmp?.url || ingestData?.ingestEndpoint || "rtmp://live.restream.io/live";
    const streamKey = ingestData?.rtmp?.key || ingestData?.streamKey;

    if (!streamKey) {
      throw new Error("No stream key returned from Restream");
    }

    // Update channel with stream info using service role
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error: updateError } = await supabaseAdmin
      .from("channels")
      .update({
        mux_playback_id: rtmpServer,
        stream_key: streamKey,
        streaming_method: "live",
      })
      .eq("id", channelId);

    if (updateError) {
      console.error("Update error:", updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({ success: true, rtmpServer, streamKey }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("OAuth callback error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
