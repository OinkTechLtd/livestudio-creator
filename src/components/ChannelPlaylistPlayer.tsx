import { Button } from "@/components/ui/button";
import UniversalPlayer, { SourceType } from "@/components/UniversalPlayer";
import { cn } from "@/lib/utils";

interface PlaylistItem {
  id: string;
  title: string;
  file_url: string;
  source_type?: string | null;
  is_24_7?: boolean;
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
  const current = items[currentIndex];

  if (!current) {
    return (
      <div className={cn("aspect-video bg-muted rounded-lg flex items-center justify-center", className)}>
        <p className="text-sm text-muted-foreground">Нет доступного контента</p>
      </div>
    );
  }

  const sourceType = (current.source_type as SourceType) || "mp4";

  return (
    <div className={cn("space-y-4", className)}>
      <UniversalPlayer
        src={current.file_url}
        sourceType={sourceType}
        channelType={channelType}
        autoPlay
        onEnded={onEnded}
        useProxy={useProxy}
      />

      <div className="bg-card border border-border rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold">Плейлист ({items.length})</p>
          {!canControl && (
            <p className="text-xs text-muted-foreground">Только просмотр</p>
          )}
        </div>
        <div className="grid gap-2">
          {items.map((it, idx) => {
            const isActive = idx === currentIndex;
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => canControl && onSelect(idx)}
                className={cn(
                  "w-full text-left rounded-md border px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "border-primary/40 bg-primary/10"
                    : "border-border bg-background hover:bg-muted",
                  !canControl && "cursor-default",
                )}
                aria-current={isActive ? "true" : "false"}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={cn("truncate", isActive && "font-semibold")}>{it.title}</span>
                  {it.is_24_7 && (
                    <span className="text-xs text-secondary">24/7</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {canControl && items.length > 1 && (
          <div className="flex gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelect((currentIndex - 1 + items.length) % items.length)}
              className="flex-1"
            >
              Назад
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelect((currentIndex + 1) % items.length)}
              className="flex-1"
            >
              Вперёд
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChannelPlaylistPlayer;
