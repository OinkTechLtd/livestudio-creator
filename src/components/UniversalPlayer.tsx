import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { AlertCircle, ExternalLink, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";

const ULTRA_AGGREGATOR_URLS = [
  "https://html-preview.github.io/?url=https://github.com/OinkTechLtd/Services-OinkPlatforms/blob/main/video_aggregator%20(2)%20—%20копия%20—%20копия.html",
  "https://htmlpreview.github.io/?url=https://github.com/OinkTechLtd/Services-OinkPlatforms/blob/main/video_aggregator%20(2)%20—%20копия%20—%20копия.html",
  "https://raw.githack.com/OinkTechLtd/Services-OinkPlatforms/main/video_aggregator%20(2)%20—%20копия%20—%20копия.html",
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
  const [error, setError] = useState<string | null>(null);
  const [currentMirror, setCurrentMirror] = useState(0);

  // Determine actual source type
  const getActualSourceType = (): SourceType => {
    if (sourceType === "ultra_aggregator") return "ultra_aggregator";
    if (src.includes("youtube.com") || src.includes("youtu.be")) return "youtube";
    if (src.includes(".m3u8")) return "m3u8";
    if (src.includes(".mp4") || src.includes(".webm") || src.includes(".mp3") || src.includes(".wav")) return "mp4";
    return sourceType;
  };

  const actualType = getActualSourceType();

  // Apply proxy if enabled
  const getProxiedUrl = (url: string): string => {
    if (!useProxy) return url;
    // Using a simple CORS proxy - in production, use your own proxy server
    return `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  };

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

  useEffect(() => {
    setError(null);

    if (actualType === "youtube" || actualType === "ultra_aggregator") {
      // These use iframes, no cleanup needed
      return;
    }

    const video = videoRef.current;
    const audio = audioRef.current;
    const element = channelType === "tv" ? video : audio;

    if (!element || !src) return;

    // Cleanup previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const finalSrc = getProxiedUrl(src);

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
          if (autoPlay) {
            element.play().catch(console.error);
          }
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            console.error("HLS Fatal Error:", data);
            setError("Ошибка загрузки потока");
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
        if (autoPlay) {
          element.play().catch(console.error);
        }
      }
    } else {
      // Regular video/audio file
      element.src = finalSrc;
      if (autoPlay) {
        element.play().catch(console.error);
      }
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, actualType, autoPlay, useProxy, channelType]);

  const tryNextMirror = () => {
    if (currentMirror < ULTRA_AGGREGATOR_URLS.length - 1) {
      setCurrentMirror(currentMirror + 1);
      setError(null);
    }
  };

  // YouTube Player
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
      <div className={`aspect-video bg-muted rounded-lg overflow-hidden ${className}`}>
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  // Ultra Aggregator Player
  if (actualType === "ultra_aggregator") {
    // Extract watch parameter if present
    const watchParam = src.includes("?watch=") ? src.split("?watch=")[1] : "";
    const iframeSrc = watchParam 
      ? `${ULTRA_AGGREGATOR_URLS[currentMirror]}?watch=${watchParam}`
      : ULTRA_AGGREGATOR_URLS[currentMirror];

    return (
      <div className={`aspect-video bg-muted rounded-lg overflow-hidden relative ${className}`}>
        <iframe
          src={iframeSrc}
          className="w-full h-full"
          allow="fullscreen"
          allowFullScreen
          onError={() => {
            setError("Зеркало недоступно");
            tryNextMirror();
          }}
        />
        {error && currentMirror < ULTRA_AGGREGATOR_URLS.length - 1 && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
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
        {error && (
          <div className="text-destructive text-sm mt-2">{error}</div>
        )}
      </div>
    );
  }

  // Default Video Player (MP4/M3U8)
  return (
    <div className={`aspect-video bg-muted rounded-lg overflow-hidden relative ${className}`}>
      <video
        ref={videoRef}
        autoPlay={autoPlay}
        playsInline
        poster={poster}
        onEnded={onEnded}
        onError={(e) => {
          setError("Ошибка воспроизведения видео");
          onError?.(e);
        }}
        onContextMenu={(e) => e.preventDefault()}
        controlsList="nodownload nofullscreen noremoteplayback noplaybackrate"
        disablePictureInPicture
        style={{ pointerEvents: "none" }}
        className="w-full h-full object-contain"
      />
      {error && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
          <div className="text-center text-destructive">
            <AlertCircle className="w-12 h-12 mx-auto mb-2" />
            <p>{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default UniversalPlayer;
