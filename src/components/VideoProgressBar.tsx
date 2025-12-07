import { useState, useEffect, useRef } from "react";
import { Progress } from "@/components/ui/progress";
import { Play, Pause, Volume2 } from "lucide-react";

interface VideoProgressBarProps {
  mediaTitle?: string;
  duration?: number;
  videoRef?: React.RefObject<HTMLVideoElement>;
  audioRef?: React.RefObject<HTMLAudioElement>;
  isLive?: boolean;
}

const VideoProgressBar = ({
  mediaTitle,
  duration,
  videoRef,
  audioRef,
  isLive = false,
}: VideoProgressBarProps) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    const element = videoRef?.current || audioRef?.current;
    if (!element) return;

    const handleTimeUpdate = () => {
      const current = element.currentTime;
      const total = element.duration || duration || 0;
      setCurrentTime(current);
      if (total > 0) {
        setProgress((current / total) * 100);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    element.addEventListener("timeupdate", handleTimeUpdate);
    element.addEventListener("play", handlePlay);
    element.addEventListener("pause", handlePause);

    return () => {
      element.removeEventListener("timeupdate", handleTimeUpdate);
      element.removeEventListener("play", handlePlay);
      element.removeEventListener("pause", handlePause);
    };
  }, [videoRef, audioRef, duration]);

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const element = videoRef?.current || audioRef?.current;
  const totalDuration = element?.duration || duration || 0;

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 pointer-events-none">
      <div className="flex items-center gap-3 text-white">
        {/* Play/Pause indicator */}
        <div className="flex items-center justify-center w-8 h-8">
          {isPlaying ? (
            <Volume2 className="w-5 h-5 animate-pulse" />
          ) : (
            <Pause className="w-5 h-5" />
          )}
        </div>

        {/* Media title */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {mediaTitle || "Прямой эфир"}
          </p>
          <div className="flex items-center gap-2 text-xs text-white/70">
            {isLive ? (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                LIVE
              </span>
            ) : (
              <>
                <span>{formatTime(currentTime)}</span>
                <span>/</span>
                <span>{formatTime(totalDuration)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {!isLive && totalDuration > 0 && (
        <div className="mt-2">
          <Progress value={progress} className="h-1 bg-white/20" />
        </div>
      )}
    </div>
  );
};

export default VideoProgressBar;