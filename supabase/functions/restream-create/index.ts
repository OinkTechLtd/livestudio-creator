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

// Additional platform configurations for multi-streaming
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
    instructions: "Используйте ключ из Restream Dashboard для мультистриминга",
  },
};

serve(async (req) => {
  console.log("=== restream-create function called ===");
  
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RESTREAM_CLIENT_ID = Deno.env.get("RESTREAM_CLIENT_ID");
    const RESTREAM_CLIENT_SECRET = Deno.env.get("RESTREAM_CLIENT_SECRET");
    // Optional: if user provides a bearer token for Restream API (recommended)
    const RESTREAM_API_TOKEN = Deno.env.get("RESTREAM_API_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    console.log("RESTREAM_CLIENT_ID exists:", !!RESTREAM_CLIENT_ID);
    console.log("RESTREAM_CLIENT_SECRET exists:", !!RESTREAM_CLIENT_SECRET);

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

    let rtmpServer: string | null = null;
    let streamKey: string | null = null;
    let platformInfo: any = null;
    let requiresManualSetup = false;
    let note: string | undefined;

    // If user wants to use Twitch or YouTube directly
    if (platform === "twitch") {
      rtmpServer = PLATFORMS.twitch.rtmpServer;
      streamKey = null;
      requiresManualSetup = true;
      note = "Для Twitch нужно вставить ваш Stream Key из Twitch Dashboard";
      platformInfo = PLATFORMS.twitch;
    } else if (platform === "youtube") {
      rtmpServer = PLATFORMS.youtube.rtmpServer;
      streamKey = null;
      requiresManualSetup = true;
      note = "Для YouTube Live нужно вставить ваш Stream Key из YouTube Studio";
      platformInfo = PLATFORMS.youtube;
    }
    // Restream: try API (preferred: bearer token; fallback: client_credentials)
    else {
      rtmpServer = RESTREAM_SERVERS[region as keyof typeof RESTREAM_SERVERS] || RESTREAM_SERVERS.global;
      platformInfo = PLATFORMS.restream;

      try {
        let accessToken: string | null = null;

        if (RESTREAM_API_TOKEN) {
          console.log("Using Restream API with RESTREAM_API_TOKEN");
          accessToken = RESTREAM_API_TOKEN;
        } else if (RESTREAM_CLIENT_ID && RESTREAM_CLIENT_SECRET) {
          console.log("Using Restream OAuth client_credentials");
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
            console.error("Restream OAuth error:", tokenResponse.status, errorText);
            throw new Error(`Restream OAuth failed: ${tokenResponse.status}`);
          }

          const tokenData = await tokenResponse.json();
          accessToken = tokenData?.access_token || null;
        }

        if (!accessToken) {
          requiresManualSetup = true;
          note = "Restream API не настроен: добавьте RESTREAM_API_TOKEN (рекомендуется) или настройте OAuth. Пока используйте Stream Key из Restream вручную.";
        } else {
          const ingestResponse = await fetch("https://api.restream.io/v2/user/ingest", {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

          if (!ingestResponse.ok) {
            const errorText = await ingestResponse.text();
            console.error("Restream ingest error:", ingestResponse.status, errorText);
            requiresManualSetup = true;
            note = `Restream API не вернул ingest для RTMP (HTTP ${ingestResponse.status}). Используйте Stream Key из Restream вручную.`;
          } else {
            const ingestData = await ingestResponse.json();
            console.log("Restream ingest data:", JSON.stringify(ingestData));

            const apiRtmpServer = ingestData?.rtmp?.url || ingestData?.ingestEndpoint;
            const apiStreamKey = ingestData?.rtmp?.key || ingestData?.streamKey;

            if (apiRtmpServer) rtmpServer = apiRtmpServer;

            if (!apiStreamKey) {
              requiresManualSetup = true;
              note = "Restream API ответил без streamKey. Нужна ручная настройка ключа из Restream.";
            } else {
              streamKey = apiStreamKey;
              platformInfo = {
                ...PLATFORMS.restream,
                connectedPlatforms: ingestData?.platforms || [],
              };
            }
          }
        }
      } catch (apiError: any) {
        console.error("Restream API exception:", apiError);
        requiresManualSetup = true;
        note = "Restream API недоступен/неавторизован. Используйте Stream Key из Restream вручную.";
      }
    }


    // Only persist if we actually have a real stream key
    if (!requiresManualSetup && rtmpServer && streamKey) {
      const { error: updateError } = await supabase
        .from("channels")
        .update({
          mux_playback_id: rtmpServer,
          stream_key: streamKey,
          streaming_method: "live",
        })
        .eq("id", channelId);

      if (updateError) {
        console.error("Database update error:", updateError);
        throw updateError;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        requiresManualSetup,
        note,
        rtmpServer,
        streamKey,
        fullRtmpUrl: rtmpServer && streamKey ? `${rtmpServer}/${streamKey}` : null,
        platform: platformInfo,
        availableServers: RESTREAM_SERVERS,
        availablePlatforms: Object.keys(PLATFORMS),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        hint: "Если OBS не подключается, чаще всего причина — невалидный Stream Key. Нужен ключ из Restream или RESTREAM_API_TOKEN для авто-получения.",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
