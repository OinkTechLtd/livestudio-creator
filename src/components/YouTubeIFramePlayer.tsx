import { useEffect, useRef, useState, useCallback } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface YouTubeIFramePlayerProps {
  videoId: string;
  autoPlay?: boolean;
  muted?: boolean;
  onEnded?: () => void;
  onError?: (error: any) => void;
  className?: string;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

let apiLoaded = false;
let apiLoadPromise: Promise<void> | null = null;

const loadYouTubeAPI = (): Promise<void> => {
  if (apiLoaded && window.YT?.Player) {
    return Promise.resolve();
  }

  if (apiLoadPromise) {
    return apiLoadPromise;
  }

  apiLoadPromise = new Promise<void>((resolve) => {
    if (window.YT?.Player) {
      apiLoaded = true;
      resolve();
      return;
    }

    const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (existingScript) {
      const checkReady = () => {
        if (window.YT?.Player) {
          apiLoaded = true;
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };
      checkReady();
      return;
    }

    window.onYouTubeIframeAPIReady = () => {
      apiLoaded = true;
      resolve();
    };

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  });

  return apiLoadPromise;
};

const YouTubeIFramePlayer = ({
  videoId,
  autoPlay = true,
  muted = true,
  onEnded,
  onError,
  className = "",
}: YouTubeIFramePlayerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const playerIdRef = useRef(`yt-player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

  const initPlayer = useCallback(async () => {
    try {
      await loadYouTubeAPI();

      if (!containerRef.current) return;

      // Destroy existing player
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.warn("Error destroying player:", e);
        }
        playerRef.current = null;
      }

      // Create container element
      const playerId = playerIdRef.current;
      containerRef.current.innerHTML = `<div id="${playerId}"></div>`;

      playerRef.current = new window.YT.Player(playerId, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: autoPlay ? 1 : 0,
          mute: muted ? 1 : 0,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          controls: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            setIsLoading(false);
            setError(null);
            if (autoPlay) {
              event.target.playVideo();
            }
          },
          onStateChange: (event: any) => {
            // YT.PlayerState.ENDED = 0
            if (event.data === 0) {
              onEnded?.();
            }
          },
          onError: (event: any) => {
            console.error("YouTube Player Error:", event.data);
            const errorMessages: { [key: number]: string } = {
              2: "Неверный ID видео",
              5: "Ошибка HTML5 плеера",
              100: "Видео не найдено или удалено",
              101: "Владелец запретил встраивание",
              150: "Владелец запретил встраивание",
            };
            const msg = errorMessages[event.data] || `Ошибка YouTube (код: ${event.data})`;
            setError(msg);
            setIsLoading(false);
            onError?.(event);
          },
        },
      });
    } catch (err) {
      console.error("Failed to initialize YouTube player:", err);
      setError("Не удалось загрузить YouTube плеер");
      setIsLoading(false);
      onError?.(err);
    }
  }, [videoId, autoPlay, muted, onEnded, onError]);

  useEffect(() => {
    initPlayer();

    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.warn("Error destroying player on unmount:", e);
        }
        playerRef.current = null;
      }
    };
  }, [initPlayer]);

  const retry = () => {
    setError(null);
    setIsLoading(true);
    initPlayer();
  };

  return (
    <div className={`aspect-video bg-black rounded-lg overflow-hidden relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
            <p className="text-sm text-muted-foreground">Загрузка YouTube...</p>
          </div>
        </div>
      )}
      
      <div ref={containerRef} className="w-full h-full" />
      
      {error && (
        <div className="absolute inset-0 bg-background/90 flex items-center justify-center z-20">
          <div className="text-center text-destructive p-4">
            <AlertCircle className="w-12 h-12 mx-auto mb-2" />
            <p className="mb-2">{error}</p>
            <Button variant="outline" size="sm" onClick={retry}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Повторить
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default YouTubeIFramePlayer;
