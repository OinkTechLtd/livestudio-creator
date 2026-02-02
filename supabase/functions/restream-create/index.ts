import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESTREAM_CLIENT_ID = Deno.env.get("RESTREAM_CLIENT_ID");
    const RESTREAM_CLIENT_SECRET = Deno.env.get("RESTREAM_CLIENT_SECRET");
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

    let rtmpServer: string;
    let streamKey: string;
    let platformInfo: any = null;

    // If user wants to use Twitch or YouTube directly
    if (platform === "twitch") {
      rtmpServer = PLATFORMS.twitch.rtmpServer;
      streamKey = `YOUR_TWITCH_STREAM_KEY`;
      platformInfo = PLATFORMS.twitch;
    } else if (platform === "youtube") {
      rtmpServer = PLATFORMS.youtube.rtmpServer;
      streamKey = `YOUR_YOUTUBE_STREAM_KEY`;
      platformInfo = PLATFORMS.youtube;
    }
    // Use Restream API if credentials are available
    else if (RESTREAM_CLIENT_ID && RESTREAM_CLIENT_SECRET) {
      console.log("Using Restream API with client credentials");

      try {
        // OAuth: client_credentials flow
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
        const accessToken = tokenData.access_token;

        // Get ingest info (server + key)
        const ingestResponse = await fetch("https://api.restream.io/v2/user/ingest", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!ingestResponse.ok) {
          const errorText = await ingestResponse.text();
          console.error("Restream ingest error:", ingestResponse.status, errorText);
          throw new Error(`Restream ingest failed: ${ingestResponse.status}`);
        }

        const ingestData = await ingestResponse.json();
        console.log("Restream ingest data:", JSON.stringify(ingestData));

        rtmpServer = ingestData?.rtmp?.url || ingestData?.ingestEndpoint || RESTREAM_SERVERS[region as keyof typeof RESTREAM_SERVERS] || RESTREAM_SERVERS.global;
        streamKey = ingestData?.rtmp?.key || ingestData?.streamKey || `${channelId}_${Date.now()}`;

        platformInfo = {
          ...PLATFORMS.restream,
          connectedPlatforms: ingestData?.platforms || [],
        };
      } catch (apiError: any) {
        console.error("Restream API error:", apiError);
        // Fallback to manual configuration
        rtmpServer = RESTREAM_SERVERS[region as keyof typeof RESTREAM_SERVERS] || RESTREAM_SERVERS.global;
        streamKey = `${channelId}_${Date.now()}`;
        platformInfo = {
          ...PLATFORMS.restream,
          note: "Используйте ключ из Restream Dashboard вручную",
        };
      }
    } else {
      // No Restream credentials - use fallback servers
      console.log("No Restream credentials, using fallback");
      rtmpServer = RESTREAM_SERVERS[region as keyof typeof RESTREAM_SERVERS] || RESTREAM_SERVERS.global;
      streamKey = `streamlivetv_${channelId}_${Date.now()}`;
      platformInfo = {
        note: "Restream API не настроен. Получите ключ вручную на restream.io",
      };
    }

    // Update channel with streaming info
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

    return new Response(
      JSON.stringify({
        success: true,
        rtmpServer,
        streamKey,
        fullRtmpUrl: `${rtmpServer}/${streamKey}`,
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
        hint: "Проверьте, что RESTREAM_CLIENT_ID и RESTREAM_CLIENT_SECRET настроены правильно",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
