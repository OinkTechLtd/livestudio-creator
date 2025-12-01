import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const channelId = url.searchParams.get('channelId');

    if (!channelId) {
      return new Response('Channel ID required', { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch channel and media content
    const { data: channel } = await supabase
      .from('channels')
      .select('*, media_content(*)')
      .eq('id', channelId)
      .single();

    if (!channel || !channel.media_content || channel.media_content.length === 0) {
      return new Response('No media found', { status: 404, headers: corsHeaders });
    }

    // Generate HLS playlist
    let playlist = '#EXTM3U\n';
    playlist += '#EXT-X-VERSION:3\n';
    playlist += '#EXT-X-TARGETDURATION:10\n';
    playlist += '#EXT-X-MEDIA-SEQUENCE:0\n';
    playlist += '#EXT-X-PLAYLIST-TYPE:EVENT\n\n';

    for (const media of channel.media_content) {
      const duration = media.duration || 180; // Default 3 minutes if not set
      playlist += `#EXTINF:${duration}.0,\n`;
      playlist += `${media.file_url}\n`;
    }

    // Loop playlist for 24/7 streaming
    playlist += '#EXT-X-ENDLIST\n';

    return new Response(playlist, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('Error generating playlist:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});