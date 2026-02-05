import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Restream RTMP servers by region
const RESTREAM_SERVERS = {
  global: "rtmp://live.restream.io/live",
  europe: "rtmp://fra.restream.io/live",
  asia: "rtmp://sgp.restream.io/live",
  us_east: "rtmp://nyc.restream.io/live",
  us_west: "rtmp://lax.restream.io/live",
};

// Platform configurations
const PLATFORMS = {
  twitch: {
    name: "Twitch",
    rtmpServer: "rtmp://live.twitch.tv/app",
    instructions: "Получите Stream Key из Twitch Dashboard → Settings → Stream",
  },
  youtube: {
    name: "YouTube Live",
    rtmpServer: "rtmp://a.rtmp.youtube.com/live2",
    instructions: "Получите Stream Key из YouTube Studio → Go Live → Stream Settings",
  },
  restream: {
    name: "Restream.io",
    rtmpServer: RESTREAM_SERVERS.global,
    instructions: "Подключите аккаунт Restream для автоматической настройки",
  },
};

serve(async (req) => {
  console.log("=== restream-create function called ===");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RESTREAM_CLIENT_ID = Deno.env.get("RESTREAM_CLIENT_ID");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    console.log("RESTREAM_CLIENT_ID exists:", !!RESTREAM_CLIENT_ID);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      throw new Error("No authorization header");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Auth error:", authError);
      throw new Error("Unauthorized");
    }

    console.log("User authenticated:", user.id);

    const { channelId, platform = "restream", region = "global" } = await req.json();

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

    // Handle different platforms
    if (platform === "twitch") {
      return new Response(
        JSON.stringify({
          success: true,
          requiresManualSetup: true,
          rtmpServer: PLATFORMS.twitch.rtmpServer,
          streamKey: null,
          platform: PLATFORMS.twitch,
          note: "Для Twitch вставьте Stream Key из Twitch Dashboard → Settings → Stream",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (platform === "youtube") {
      return new Response(
        JSON.stringify({
          success: true,
          requiresManualSetup: true,
          rtmpServer: PLATFORMS.youtube.rtmpServer,
          streamKey: null,
          platform: PLATFORMS.youtube,
          note: "Для YouTube Live вставьте Stream Key из YouTube Studio → Go Live",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Restream OAuth flow
    if (!RESTREAM_CLIENT_ID) {
      return new Response(
        JSON.stringify({
          success: false,
          requiresManualSetup: true,
          rtmpServer: RESTREAM_SERVERS[region as keyof typeof RESTREAM_SERVERS] || RESTREAM_SERVERS.global,
          streamKey: null,
          platform: PLATFORMS.restream,
          note: "RESTREAM_CLIENT_ID не настроен. Вставьте Stream Key из Restream Dashboard вручную.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate OAuth URL for Restream
    // Redirect back into the app (NOT the backend function URL) to avoid exposing internal URLs
    // and to keep redirect_uri stable for Restream settings.
    const state = `${channelId}`;

    const originHeader = req.headers.get("origin") || "";
    const refererHeader = req.headers.get("referer") || "";
    const fallbackOrigin = refererHeader ? new URL(refererHeader).origin : "";
    const appOrigin = originHeader || fallbackOrigin;

    if (!appOrigin) {
      throw new Error("Missing request origin (cannot build redirect_uri)");
    }

    const redirectUri = `${appOrigin.replace(/\/$/, "")}/restream/callback`;
    
    const oauthUrl = `https://api.restream.io/login?response_type=code&client_id=${RESTREAM_CLIENT_ID}&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&state=${encodeURIComponent(state)}`;

    console.log("Generated OAuth URL for Restream");

    return new Response(
      JSON.stringify({
        success: true,
        oauthUrl,
        redirectUri,
        rtmpServer: RESTREAM_SERVERS[region as keyof typeof RESTREAM_SERVERS] || RESTREAM_SERVERS.global,
        platform: PLATFORMS.restream,
        note: "Нажмите кнопку ниже для авторизации в Restream. После этого RTMP Server и Stream Key будут настроены автоматически.",
        availableServers: RESTREAM_SERVERS,
        availablePlatforms: Object.keys(PLATFORMS),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        hint: "Если OBS не подключается, попробуйте: 1) Подключить аккаунт Restream через OAuth, 2) Или вставить Stream Key вручную из Restream/Twitch/YouTube.",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
