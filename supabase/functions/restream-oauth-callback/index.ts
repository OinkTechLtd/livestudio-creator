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
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!RESTREAM_CLIENT_ID || !RESTREAM_CLIENT_SECRET) {
      throw new Error("Restream credentials not configured");
    }

    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // channelId:userId encoded
    
    if (!code || !state) {
      throw new Error("Missing code or state parameter");
    }

    // Parse state: channelId:userId
    const [channelId, userId] = state.split(":");
    if (!channelId || !userId) {
      throw new Error("Invalid state format");
    }

    console.log("Processing OAuth callback for channel:", channelId);

    // Exchange code for tokens
    const tokenResponse = await fetch("https://api.restream.io/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${RESTREAM_CLIENT_ID}:${RESTREAM_CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: `${SUPABASE_URL}/functions/v1/restream-oauth-callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange error:", tokenResponse.status, errorText);
      throw new Error(`Token exchange failed: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    console.log("Got access token, fetching ingest info...");

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
    console.log("Ingest data:", JSON.stringify(ingestData));

    const rtmpServer = ingestData?.rtmp?.url || ingestData?.ingestEndpoint || "rtmp://live.restream.io/live";
    const streamKey = ingestData?.rtmp?.key || ingestData?.streamKey;

    if (!streamKey) {
      throw new Error("No stream key returned from Restream");
    }

    // Update channel with stream info using service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify ownership
    const { data: channel, error: channelError } = await supabase
      .from("channels")
      .select("id, user_id")
      .eq("id", channelId)
      .single();

    if (channelError || !channel) {
      throw new Error("Channel not found");
    }

    if (channel.user_id !== userId) {
      throw new Error("Not channel owner");
    }

    // Update channel
    const { error: updateError } = await supabase
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

    console.log("Channel updated successfully!");

    // Redirect back to channel page with success
    const redirectUrl = `${url.origin.replace('functions/v1/restream-oauth-callback', '')}channel/${channelId}?restream=success`;
    
    return new Response(
      `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Restream Connected</title>
        <style>
          body { font-family: system-ui; background: #0a0a0a; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #1a1a1a; padding: 2rem; border-radius: 12px; text-align: center; max-width: 400px; }
          h1 { color: #10b981; margin-bottom: 1rem; }
          p { color: #888; margin-bottom: 1.5rem; }
          .btn { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem; text-decoration: none; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>✅ Restream подключён!</h1>
          <p>RTMP Server и Stream Key сохранены. Теперь вы можете стримить через OBS.</p>
          <a href="/channel/${channelId}" class="btn">Вернуться к каналу</a>
        </div>
        <script>
          setTimeout(() => { window.location.href = '/channel/${channelId}'; }, 3000);
        </script>
      </body>
      </html>`,
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      }
    );
  } catch (error: any) {
    console.error("OAuth callback error:", error);
    
    return new Response(
      `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Ошибка Restream</title>
        <style>
          body { font-family: system-ui; background: #0a0a0a; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #1a1a1a; padding: 2rem; border-radius: 12px; text-align: center; max-width: 400px; }
          h1 { color: #ef4444; margin-bottom: 1rem; }
          p { color: #888; margin-bottom: 1.5rem; }
          .error { background: #7f1d1d; color: #fca5a5; padding: 1rem; border-radius: 8px; font-size: 0.875rem; margin-bottom: 1rem; }
          .btn { background: #333; color: #fff; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem; text-decoration: none; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>❌ Ошибка подключения</h1>
          <div class="error">${error.message}</div>
          <p>Попробуйте снова или используйте ручной ввод Stream Key.</p>
          <a href="/" class="btn">На главную</a>
        </div>
      </body>
      </html>`,
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      }
    );
  }
});
