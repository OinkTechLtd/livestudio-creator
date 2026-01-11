import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { AlertCircle, ExternalLink, Radio, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const ULTRA_AGGREGATOR_URLS = [
  "/ultra-aggregator.html", // Local fallback first
  "https://raw.githack.com/OinkTechLtd/Services-OinkPlatforms/main/video_aggregator%20(2)%20—%20копия%20—%20копия.html",
  "https://html-preview.github.io/?url=https://github.com/OinkTechLtd/Services-OinkPlatforms/blob/main/video_aggregator%20(2)%20—%20копия%20—%20копия.html",
  "https://htmlpreview.github.io/?url=https://github.com/OinkTechLtd/Services-OinkPlatforms/blob/main/video_aggregator%20(2)%20—%20копия%20—%20копия.html",
];

export type SourceType = "mp4" | "m3u8" | "youtube" | "ultra_aggregator" | "upload" | "external_url";

interface UniversalPlayerProps {
  src: string;
  sourceType: SourceType;
  title?: string;
  channelType?: "tv" | "radio";
  autoPlay?: boolean;
  poster?: string;
  onEnded?: () => void;
  onError?: (error: any) => void;
  useProxy?: boolean;
  className?: string;
}

// YouTube IFrame API state
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

let ytApiLoaded = false;
let ytApiLoading = false;
const ytApiCallbacks: (() => void)[] = [];

function loadYouTubeAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (ytApiLoaded) {
      resolve();
      return;
    }

    ytApiCallbacks.push(resolve);

    if (ytApiLoading) return;

    ytApiLoading = true;

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      ytApiLoaded = true;
      ytApiCallbacks.forEach((cb) => cb());
      ytApiCallbacks.length = 0;
    };
  });
}

const UniversalPlayer = ({
  src,
  sourceType,
  title,
  channelType = "tv",
  autoPlay = true,
  poster,
  onEnded,
  onError,
  useProxy = false,
  className = "",
}: UniversalPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytContainerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentMirror, setCurrentMirror] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Determine actual source type
  const getActualSourceType = (): SourceType => {
    if (sourceType === "ultra_aggregator") return "ultra_aggregator";
    if (src.includes("youtube.com") || src.includes("youtu.be")) return "youtube";
    if (src.includes(".m3u8")) return "m3u8";
    if (src.includes(".mp4") || src.includes(".webm") || src.includes(".mp3") || src.includes(".wav")) return "mp4";
    return sourceType;
  };

  const actualType = getActualSourceType();

  // Apply proxy via edge function if enabled
  const getProxiedUrl = useCallback(async (url: string): Promise<string> => {
    if (!useProxy) return url;

    try {
      const { data, error } = await supabase.functions.invoke("proxy-stream", {
        body: { url, action: "check" },
      });

      if (error || !data?.available) {
        console.warn("Source not available, using original URL");
        return url;
      }

      // For actual streaming, use CORS proxy
      return `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    } catch {
      return url;
    }
  }, [useProxy]);

  // Extract YouTube video ID
  const getYouTubeVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  // YouTube IFrame Player API initialization
  useEffect(() => {
    if (actualType !== "youtube") return;

    const videoId = getYouTubeVideoId(src);
    if (!videoId || !ytContainerRef.current) return;

    let isMounted = true;

    const initPlayer = async () => {
      await loadYouTubeAPI();

      if (!isMounted || !ytContainerRef.current) return;

      // Destroy previous player
      if (ytPlayerRef.current) {
        ytPlayerRef.current.destroy();
        ytPlayerRef.current = null;
      }

      ytPlayerRef.current = new window.YT.Player(ytContainerRef.current, {
        videoId,
        playerVars: {
          autoplay: autoPlay ? 1 : 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            setIsLoading(false);
            setError(null);
          },
          onStateChange: (event: any) => {
            if (event.data === window.YT.PlayerState.ENDED) {
              onEnded?.();
            }
          },
          onError: (event: any) => {
            console.error("YouTube Player Error:", event.data);
            setError("Ошибка воспроизведения YouTube");
            onError?.(event);
          },
        },
      });
    };

    initPlayer();

    return () => {
      isMounted = false;
      if (ytPlayerRef.current) {
        ytPlayerRef.current.destroy();
        ytPlayerRef.current = null;
      }
    };
  }, [src, actualType, autoPlay, onEnded, onError]);

  // HLS / MP4 / Audio playback
  useEffect(() => {
    if (actualType === "youtube" || actualType === "ultra_aggregator") {
      setIsLoading(false);
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

      if (actualType === "m3u8") {
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
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

  const tryNextMirror = () => {
    if (currentMirror < ULTRA_AGGREGATOR_URLS.length - 1) {
      setCurrentMirror(currentMirror + 1);
      setError(null);
    }
  };

  const retry = () => {
    setError(null);
    setCurrentMirror(0);
    setIsLoading(true);
  };

  // YouTube Player with IFrame API
  if (actualType === "youtube") {
    const videoId = getYouTubeVideoId(src);
    if (!videoId) {
      return (
        <div className={`aspect-video bg-muted rounded-lg flex items-center justify-center ${className}`}>
          <div className="text-center text-destructive">
            <AlertCircle className="w-12 h-12 mx-auto mb-2" />
            <p>Неверная ссылка YouTube</p>
          </div>
        </div>
      );
    }

    return (
      <div className={`aspect-video bg-muted rounded-lg overflow-hidden relative ${className}`}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
              <p className="text-sm text-muted-foreground">Загрузка YouTube...</p>
            </div>
          </div>
        )}
        <div ref={ytContainerRef} className="w-full h-full" />
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
  }

  // Ultra Aggregator Player - ALWAYS iframe
  if (actualType === "ultra_aggregator") {
    // Extract watch parameter if present
    let watchParam = "";
    if (src.includes("?watch=")) {
      watchParam = src.split("?watch=")[1];
    } else if (src && src !== "ultra_aggregator" && !src.startsWith("http")) {
      // If src is just a domain name, use it as watch param
      watchParam = src;
    }

    const iframeSrc = watchParam
      ? `${ULTRA_AGGREGATOR_URLS[currentMirror]}?watch=${encodeURIComponent(watchParam)}`
      : ULTRA_AGGREGATOR_URLS[currentMirror];

    return (
      <div className={`aspect-video bg-muted rounded-lg overflow-hidden relative ${className}`}>
        <iframe
          src={iframeSrc}
          className="w-full h-full border-0"
          allow="fullscreen; autoplay; encrypted-media"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setError("Зеркало недоступно");
            tryNextMirror();
          }}
        />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
              <p className="text-sm text-muted-foreground">Загрузка Ultra Aggregator...</p>
            </div>
          </div>
        )}
        {error && currentMirror < ULTRA_AGGREGATOR_URLS.length - 1 && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-20">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-2 text-yellow-500" />
              <p className="mb-2">Переключение на резервное зеркало...</p>
              <Button variant="outline" size="sm" onClick={tryNextMirror}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Попробовать следующее
              </Button>
            </div>
          </div>
        )}
        {error && currentMirror >= ULTRA_AGGREGATOR_URLS.length - 1 && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-20">
            <div className="text-center text-destructive">
              <AlertCircle className="w-12 h-12 mx-auto mb-2" />
              <p className="mb-2">Все зеркала недоступны</p>
              <Button variant="outline" size="sm" onClick={retry}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Повторить
              </Button>
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
    <div className={`aspect-video bg-muted rounded-lg overflow-hidden relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
            <p className="text-sm text-muted-foreground">Загрузка видео...</p>
          </div>
        </div>
      )}
      <video
        ref={videoRef}
        autoPlay={autoPlay}
        playsInline
        poster={poster}
        onEnded={onEnded}
        onError={(e) => {
          setError("Ошибка воспроизведения видео");
          setIsLoading(false);
          onError?.(e);
        }}
        onContextMenu={(e) => e.preventDefault()}
        controlsList="nodownload nofullscreen noremoteplayback noplaybackrate"
        disablePictureInPicture
        style={{ pointerEvents: "none" }}
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
