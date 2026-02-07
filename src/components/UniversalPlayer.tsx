import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { AlertCircle, ExternalLink, Radio, RefreshCw, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import YouTubeIFramePlayer from "./YouTubeIFramePlayer";

const ULTRA_AGGREGATOR_PATH = "/ultra-aggregator.html";

export type SourceType = "mp4" | "m3u8" | "youtube" | "ultra_aggregator" | "upload" | "external_url" | "torrent";

interface UniversalPlayerProps {
  src: string;
  sourceType: SourceType;
  title?: string;
  channelType?: "tv" | "radio";
  autoPlay?: boolean;
  muted?: boolean;
  poster?: string;
  onEnded?: () => void;
  onError?: (error: any) => void;
  useProxy?: boolean;
  className?: string;
}

const UniversalPlayer = ({
  src,
  sourceType,
  title,
  channelType = "tv",
  autoPlay = true,
  muted = false,
  poster,
  onEnded,
  onError,
  useProxy = false,
  className = "",
}: UniversalPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [proxyUrl, setProxyUrl] = useState<string | null>(null);

  // Determine actual source type from URL
  const getActualSourceType = (): SourceType => {
    if (sourceType === "ultra_aggregator") return "ultra_aggregator";
    if (sourceType === "youtube" || src.includes("youtube.com") || src.includes("youtu.be")) return "youtube";
    if (src.includes(".m3u8") || src.endsWith(".m3u8")) return "m3u8";
    if (src.includes(".mp4") || src.includes(".webm") || src.includes(".mp3") || src.includes(".wav")) return "mp4";
    return sourceType;
  };

  const actualType = getActualSourceType();

  // Extract YouTube video ID
  const getYouTubeVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
      /youtube\.com\/shorts\/([^&\n?#]+)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  // Get proxied URL via edge function
  const getProxiedUrl = useCallback(async (url: string): Promise<string> => {
    if (!useProxy) return url;

    try {
      const { data, error } = await supabase.functions.invoke("proxy-stream", {
        body: { url, action: "getProxyUrl" },
      });

      if (error || !data?.proxyUrl) {
        console.warn("Failed to get proxy URL, using original");
        return url;
      }

      return data.proxyUrl;
    } catch {
      return url;
    }
  }, [useProxy]);

  // HLS / MP4 / Audio playback
  useEffect(() => {
    if (actualType === "youtube") {
      setIsLoading(false);
      return;
    }
    if (actualType === "ultra_aggregator") {
      // iframe handles its own loading state
      return;
    }

    setError(null);
    setIsLoading(true);

    const video = videoRef.current;
    const audio = audioRef.current;
    const element = channelType === "tv" ? video : audio;

    if (!element || !src) return;

    // Cleanup previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const setupMedia = async () => {
      const finalSrc = await getProxiedUrl(src);
      setProxyUrl(useProxy ? finalSrc : null);

      if (actualType === "m3u8") {
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
            xhrSetup: (xhr) => {
              xhr.withCredentials = false;
            },
          });

          hlsRef.current = hls;
          hls.loadSource(finalSrc);
          hls.attachMedia(element);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            setIsLoading(false);
            if (autoPlay) {
              element.play().catch(console.error);
            }
          });

          hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) {
              console.error("HLS Fatal Error:", data);
              setError("Ошибка загрузки потока");
              setIsLoading(false);
              onError?.(data);

              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  hls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  hls.recoverMediaError();
                  break;
                default:
                  hls.destroy();
                  break;
              }
            }
          });
        } else if (element.canPlayType("application/vnd.apple.mpegurl")) {
          element.src = finalSrc;
          setIsLoading(false);
          if (autoPlay) {
            element.play().catch(console.error);
          }
        }
      } else {
        // Regular video/audio file
        element.src = finalSrc;
        element.onloadeddata = () => setIsLoading(false);
        if (autoPlay) {
          element.play().catch(console.error);
        }
      }
    };

    setupMedia();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, actualType, autoPlay, useProxy, channelType, getProxiedUrl]);

  const retry = () => {
    setError(null);
    setIsLoading(true);
  };

  useEffect(() => {
    if (actualType === "ultra_aggregator") {
      setError(null);
      setIsLoading(true);
    }
  }, [actualType, src]);

  // YouTube Player - Using YouTube IFrame Player API with proxy fallback for Russia
  if (actualType === "youtube") {
    const videoId = getYouTubeVideoId(src);
    if (!videoId) {
      return (
        <div className={`aspect-video bg-muted rounded-lg flex items-center justify-center ${className}`}>
          <div className="text-center text-destructive">
            <AlertCircle className="w-12 h-12 mx-auto mb-2" />
            <p>Неверная ссылка YouTube</p>
            <p className="text-xs text-muted-foreground mt-1">{src}</p>
          </div>
        </div>
      );
    }

    // If proxy mode is on, try alternative YouTube embeds that work in Russia
    if (useProxy) {
      const proxyEmbedUrls = [
        `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=${muted ? 1 : 0}&rel=0`,
        `https://invidious.snopyta.org/embed/${videoId}?autoplay=1`,
        `https://vid.puffyan.us/embed/${videoId}?autoplay=1`,
        `https://inv.tux.pizza/embed/${videoId}?autoplay=1`,
      ];

      return (
        <div className={`aspect-video bg-black rounded-lg overflow-hidden relative ${className}`}>
          <div className="absolute top-2 left-2 bg-background/80 px-2 py-1 rounded text-xs flex items-center gap-1 z-10">
            <Globe className="w-3 h-3" />
            Прокси YouTube
          </div>
          <iframe
            src={proxyEmbedUrls[0]}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
      );
    }

    return (
      <YouTubeIFramePlayer
        videoId={videoId}
        autoPlay={autoPlay}
        muted={muted || true}
        onEnded={onEnded}
        onError={onError}
        className={className}
      />
    );
  }

  // Ultra Aggregator Player - ALWAYS iframe (like website)
  if (actualType === "ultra_aggregator") {
    // Pass ALL query params via the iframe address bar (1:1 behavior)
    // If src already has ?params, forward them to /ultra-aggregator.html
    // Otherwise, treat src as watch value.
    let iframeSrc = ULTRA_AGGREGATOR_PATH;
    try {
      const u = new URL(src, window.location.origin);
      const forwarded = `${u.search || ""}${u.hash || ""}`;
      if (forwarded) {
        iframeSrc = `${ULTRA_AGGREGATOR_PATH}${forwarded}`;
      } else if (src && src !== "ultra_aggregator" && !src.startsWith("http") && !src.startsWith("/")) {
        iframeSrc = `${ULTRA_AGGREGATOR_PATH}?watch=${encodeURIComponent(src)}`;
      }
    } catch {
      if (src && src !== "ultra_aggregator") {
        iframeSrc = `${ULTRA_AGGREGATOR_PATH}?watch=${encodeURIComponent(src)}`;
      }
    }

    return (
      <div className={`aspect-video bg-black rounded-lg overflow-hidden relative ${className}`}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="text-center">
              <Globe className="w-8 h-8 animate-pulse mx-auto mb-2 text-primary" />
              <p className="text-sm text-muted-foreground">Загрузка Ultra Aggregator...</p>
            </div>
          </div>
        )}
        <iframe
          src={iframeSrc}
          className="w-full h-full border-0"
          allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setError("Ultra Aggregator недоступен");
            setIsLoading(false);
          }}
        />
        {error && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-20">
            <div className="text-center text-destructive">
              <AlertCircle className="w-12 h-12 mx-auto mb-2" />
              <p>{error}</p>
              <div className="flex gap-2 justify-center mt-2">
                <Button variant="outline" size="sm" onClick={retry}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Повторить
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => window.open(ULTRA_AGGREGATOR_PATH, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Открыть отдельно
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Radio Player
  if (channelType === "radio") {
    return (
      <div className={`aspect-video bg-gradient-to-br from-background to-primary/10 rounded-lg flex flex-col items-center justify-center ${className}`}>
        <Radio className="w-16 h-16 md:w-24 md:h-24 text-primary mb-4 animate-pulse" />
        <h2 className="text-xl md:text-2xl font-bold mb-2">{title || "Радио"}</h2>
        <p className="text-sm text-muted-foreground mb-4">В прямом эфире</p>
        {useProxy && proxyUrl && (
          <p className="text-xs text-muted-foreground">🔒 Через прокси</p>
        )}
        <audio
          ref={audioRef}
          autoPlay={autoPlay}
          onEnded={onEnded}
          onError={(e) => {
            setError("Ошибка воспроизведения аудио");
            onError?.(e);
          }}
          onContextMenu={(e) => e.preventDefault()}
        />
        {error && <div className="text-destructive text-sm mt-2">{error}</div>}
      </div>
    );
  }

  // Default Video Player (MP4/M3U8)
  return (
    <div className={`aspect-video bg-black rounded-lg overflow-hidden relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
            <p className="text-sm text-muted-foreground">Загрузка видео...</p>
          </div>
        </div>
      )}
      {useProxy && proxyUrl && !isLoading && (
        <div className="absolute top-2 left-2 bg-background/80 px-2 py-1 rounded text-xs flex items-center gap-1 z-10">
          <Globe className="w-3 h-3" />
          Прокси
        </div>
      )}
      <video
        ref={videoRef}
        autoPlay={autoPlay}
        muted={muted}
        playsInline
        controls
        poster={poster}
        onEnded={onEnded}
        onError={(e) => {
          setError("Ошибка воспроизведения видео");
          setIsLoading(false);
          onError?.(e);
        }}
        onContextMenu={(e) => e.preventDefault()}
        className="w-full h-full object-contain"
      />
      {error && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-20">
          <div className="text-center text-destructive">
            <AlertCircle className="w-12 h-12 mx-auto mb-2" />
            <p>{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={retry}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Повторить
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UniversalPlayer;
