const HLS_PLAYLIST_BASE_URL = "https://aqeleulwobgamdffkfri.functions.supabase.co/hls-playlist";

interface ResolveLiveStreamUrlOptions {
  channelId: string;
  streamingMethod: "upload" | "live" | "scheduled";
  isLive: boolean;
  muxPlaybackId?: string | null;
  requireLive?: boolean;
}

const isHttpUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
};

const isLikelyHlsPlaybackUrl = (url: string): boolean => {
  const normalized = url.toLowerCase();
  return (
    normalized.includes(".m3u8") ||
    normalized.includes("hls") ||
    normalized.includes("manifest") ||
    normalized.includes("playlist")
  );
};

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

  if (playbackUrl && isHttpUrl(playbackUrl) && isLikelyHlsPlaybackUrl(playbackUrl)) {
    return playbackUrl;
  }

  return `${HLS_PLAYLIST_BASE_URL}?channelId=${encodeURIComponent(channelId)}`;
};
