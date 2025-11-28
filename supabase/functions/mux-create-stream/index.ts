import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const MUX_TOKEN_ID = Deno.env.get('MUX_TOKEN_ID');
    const MUX_TOKEN_SECRET = Deno.env.get('MUX_TOKEN_SECRET');
    
    if (!MUX_TOKEN_ID || !MUX_TOKEN_SECRET) {
      throw new Error('Mux credentials not configured');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { channelId } = await req.json();

    // Verify user owns the channel
    const { data: channel, error: channelError } = await supabaseClient
      .from('channels')
      .select('*')
      .eq('id', channelId)
      .eq('user_id', user.id)
      .single();

    if (channelError || !channel) {
      throw new Error('Channel not found or unauthorized');
    }

    // Create live stream in Mux
    const muxAuth = btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`);
    
    const muxResponse = await fetch('https://api.mux.com/video/v1/live-streams', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${muxAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        playback_policy: ['public'],
        new_asset_settings: {
          playback_policy: ['public'],
        },
        reconnect_window: 60,
        latency_mode: 'standard',
      }),
    });

    if (!muxResponse.ok) {
      const errorText = await muxResponse.text();
      console.error('Mux API error:', errorText);
      throw new Error(`Mux API error: ${muxResponse.status}`);
    }

    const muxData = await muxResponse.json();
    console.log('Mux stream created:', muxData.data.id);

    // Update channel with stream key and playback ID
    const { error: updateError } = await supabaseClient
      .from('channels')
      .update({
        stream_key: muxData.data.stream_key,
        // Store Mux stream ID and playback ID in description for now
        // In production, you'd want a separate table for this
      })
      .eq('id', channelId);

    if (updateError) {
      console.error('Error updating channel:', updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        streamKey: muxData.data.stream_key,
        rtmpUrl: `rtmp://global-live.mux.com:5222/app`,
        playbackId: muxData.data.playback_ids[0].id,
        streamId: muxData.data.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in mux-create-stream:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
