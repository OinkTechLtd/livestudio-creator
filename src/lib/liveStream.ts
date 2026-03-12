const HLS_PLAYLIST_BASE_URL = "https://aqeleulwobgamdffkfri.functions.supabase.co/hls-playlist";

interface ResolveLiveStreamUrlOptions {
  channelId: string;
  streamingMethod: "upload" | "live" | "scheduled";
  isLive: boolean;
  muxPlaybackId?: string | null;
  requireLive?: boolean;
}

export const resolveLiveStreamUrl = ({
  channelId,
  streamingMethod,
  isLive,
  muxPlaybackId,
  requireLive = true,
}: ResolveLiveStreamUrlOptions): string => {
  if (!channelId || streamingMethod !== "live") return "";
  if (requireLive && !isLive) return "";

  const playbackUrl = (muxPlaybackId || "").trim();

  if (playbackUrl.startsWith("https://") || playbackUrl.startsWith("http://")) {
    return playbackUrl;
  }

  return `${HLS_PLAYLIST_BASE_URL}?channelId=${channelId}`;
};

