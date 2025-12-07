import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { GripVertical, Play, Pause, Trash2, Clock } from "lucide-react";

interface MediaContent {
  id: string;
  title: string;
  file_url: string;
  file_type: string | null;
  is_24_7: boolean;
  source_type: string;
  start_time: string | null;
  end_time: string | null;
}

interface DraggableMediaListProps {
  mediaContent: MediaContent[];
  onReorder: (reorderedItems: MediaContent[]) => void;
  onToggle: (media: MediaContent) => void;
  onDelete: (mediaId: string, fileUrl: string, sourceType: string) => void;
}

const DraggableMediaList = ({ 
  mediaContent, 
  onReorder, 
  onToggle, 
  onDelete 
}: DraggableMediaListProps) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragRef = useRef<HTMLDivElement | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
    
    // Make drag image slightly transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDragOverIndex(null);
      return;
    }

    const newItems = [...mediaContent];
    const [draggedItem] = newItems.splice(draggedIndex, 1);
    newItems.splice(dropIndex, 0, draggedItem);
    
    onReorder(newItems);
    setDragOverIndex(null);
    setDraggedIndex(null);
  };

  // Touch support for mobile
  const touchStartRef = useRef<{ index: number; y: number } | null>(null);
  const [touchDragIndex, setTouchDragIndex] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent, index: number) => {
    touchStartRef.current = { index, y: e.touches[0].clientY };
    setTouchDragIndex(index);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    
    const touch = e.touches[0];
    const elements = document.elementsFromPoint(touch.clientX, touch.clientY);
    const mediaItem = elements.find(el => el.hasAttribute('data-media-index'));
    
    if (mediaItem) {
      const newIndex = parseInt(mediaItem.getAttribute('data-media-index') || '0');
      setDragOverIndex(newIndex);
    }
  };

  const handleTouchEnd = () => {
    if (touchStartRef.current && dragOverIndex !== null && touchStartRef.current.index !== dragOverIndex) {
      const newItems = [...mediaContent];
      const [draggedItem] = newItems.splice(touchStartRef.current.index, 1);
      newItems.splice(dragOverIndex, 0, draggedItem);
      onReorder(newItems);
    }
    
    touchStartRef.current = null;
    setTouchDragIndex(null);
    setDragOverIndex(null);
  };

  if (mediaContent.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Загрузите медиафайлы для формирования плейлиста
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {mediaContent.map((media, index) => (
        <div
          key={media.id}
          ref={dragRef}
          data-media-index={index}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, index)}
          onTouchStart={(e) => handleTouchStart(e, index)}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`
            p-4 border rounded-lg bg-card cursor-move transition-all duration-200
            ${draggedIndex === index ? 'opacity-50 scale-95' : ''}
            ${dragOverIndex === index && draggedIndex !== index 
              ? 'border-primary border-2 bg-primary/5' 
              : 'border-border'}
            ${touchDragIndex === index ? 'scale-95 shadow-lg' : ''}
          `}
        >
          <div className="flex items-center gap-3">
            {/* Drag Handle */}
            <div className="text-muted-foreground hover:text-foreground transition-colors cursor-grab active:cursor-grabbing">
              <GripVertical className="w-5 h-5" />
            </div>

            {/* Order Number */}
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-mono">
              {index + 1}
            </div>

            {/* Media Info */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{media.title}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <span className={media.is_24_7 ? "text-green-500" : ""}>
                  {media.is_24_7 ? "🟢 В эфире" : "⏸️ Не активен"}
                </span>
                {media.source_type !== "upload" && (
                  <span className="text-primary">
                    {media.source_type === "m3u8" ? "📺 M3U8" : "🔗 URL"}
                  </span>
                )}
                {media.start_time && media.end_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {media.start_time} - {media.end_time}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant={media.is_24_7 ? "default" : "outline"}
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(media);
                }}
              >
                {media.is_24_7 ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(media.id, media.file_url, media.source_type);
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      ))}

      <p className="text-xs text-muted-foreground text-center pt-2">
        Перетащите файлы для изменения порядка воспроизведения
      </p>
    </div>
  );
};

export default DraggableMediaList;
