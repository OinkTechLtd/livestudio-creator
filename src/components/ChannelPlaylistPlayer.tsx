import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import UniversalPlayer, { SourceType } from "@/components/UniversalPlayer";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Play, Pause, List } from "lucide-react";

interface PlaylistItem {
  id: string;
  title: string;
  file_url: string;
  source_type?: string | null;
  is_24_7?: boolean;
  duration?: number | null;
}

interface ChannelPlaylistPlayerProps {
  channelType: "tv" | "radio";
  items: PlaylistItem[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onEnded?: () => void;
  useProxy?: boolean;
  canControl?: boolean;
  className?: string;
}

const ChannelPlaylistPlayer = ({
  channelType,
  items,
  currentIndex,
  onSelect,
  onEnded,
  useProxy = false,
  canControl = false,
  className,
}: ChannelPlaylistPlayerProps) => {
  const [showPlaylist, setShowPlaylist] = useState(true);
  const [proxyEnabled, setProxyEnabled] = useState(useProxy);
  const current = items[currentIndex];

  // Load proxy setting from localStorage
  useEffect(() => {
    const channelId = items[0]?.id?.split('_')[0]; // Extract channel ID if available
    if (channelId) {
      const saved = localStorage.getItem(`channel_proxy_${channelId}`);
      if (saved) setProxyEnabled(saved === "true");
    }
  }, [items]);

  if (!current) {
    return (
      <div className={cn("aspect-video bg-muted rounded-lg flex items-center justify-center", className)}>
        <p className="text-sm text-muted-foreground">Нет доступного контента</p>
      </div>
    );
  }

  const sourceType = (current.source_type as SourceType) || "mp4";
  const activeItems = items.filter(item => item.is_24_7);
  const currentActiveIndex = activeItems.findIndex(item => item.id === current.id);

  const handlePrev = () => {
    if (activeItems.length > 0) {
      const prevIndex = (currentActiveIndex - 1 + activeItems.length) % activeItems.length;
      const fullIndex = items.findIndex(item => item.id === activeItems[prevIndex].id);
      if (fullIndex !== -1) onSelect(fullIndex);
    }
  };

  const handleNext = () => {
    if (activeItems.length > 0) {
      const nextIndex = (currentActiveIndex + 1) % activeItems.length;
      const fullIndex = items.findIndex(item => item.id === activeItems[nextIndex].id);
      if (fullIndex !== -1) onSelect(fullIndex);
    }
  };

  const formatDuration = (seconds: number | null | undefined): string => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn("flex flex-col lg:flex-row gap-4", className)}>
      {/* Player */}
      <div className="flex-1">
        <UniversalPlayer
          src={current.file_url}
          sourceType={sourceType}
          title={current.title}
          channelType={channelType}
          autoPlay
          onEnded={onEnded}
          useProxy={proxyEnabled}
        />

        {/* Controls */}
        {canControl && activeItems.length > 1 && (
          <div className="flex items-center justify-center gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={handlePrev}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground px-3">
              {currentActiveIndex + 1} / {activeItems.length}
            </span>
            <Button variant="outline" size="sm" onClick={handleNext}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Playlist sidebar */}
      <div className="lg:w-80 shrink-0">
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div 
            className="flex items-center justify-between p-3 border-b border-border cursor-pointer hover:bg-muted/50"
            onClick={() => setShowPlaylist(!showPlaylist)}
          >
            <div className="flex items-center gap-2">
              <List className="w-4 h-4" />
              <span className="text-sm font-semibold">Плейлист ({activeItems.length})</span>
            </div>
            {!canControl && (
              <span className="text-xs text-muted-foreground">Только просмотр</span>
            )}
          </div>

          {showPlaylist && (
            <ScrollArea className="h-[300px] lg:h-[400px]">
              <div className="p-2 space-y-1">
                {items.map((item, idx) => {
                  const isActive = idx === currentIndex;
                  const isEnabled = item.is_24_7;

                  if (!isEnabled) return null; // Only show active playlist items

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => canControl && onSelect(idx)}
                      disabled={!canControl}
                      className={cn(
                        "w-full text-left rounded-md border px-3 py-2.5 text-sm transition-all",
                        isActive
                          ? "border-primary/40 bg-primary/10 shadow-sm"
                          : "border-transparent bg-transparent hover:bg-muted/50",
                        !canControl && "cursor-default opacity-80",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {/* Play indicator */}
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                          isActive ? "bg-primary text-primary-foreground" : "bg-muted"
                        )}>
                          {isActive ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </div>

                        {/* Title and duration */}
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "truncate",
                            isActive && "font-semibold text-primary"
                          )}>
                            {item.title}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {item.duration && (
                              <span>{formatDuration(item.duration)}</span>
                            )}
                            {item.source_type && item.source_type !== "upload" && (
                              <span className="px-1.5 py-0.5 bg-muted rounded text-[10px] uppercase">
                                {item.source_type}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChannelPlaylistPlayer;
