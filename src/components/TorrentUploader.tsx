import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Download, FileVideo, Film, Tv, AlertCircle, Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface TorrentFile {
  name: string;
  size: number;
  type: "movie" | "series" | "video" | "unsupported";
}

interface TorrentUploaderProps {
  channelId: string;
  onTorrentParsed?: (files: TorrentFile[]) => void;
  onMediaAdded?: () => void;
}

const TorrentUploader = ({ channelId, onTorrentParsed, onMediaAdded }: TorrentUploaderProps) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingMedia, setIsAddingMedia] = useState(false);
  const [parsedFiles, setParsedFiles] = useState<TorrentFile[]>([]);
  const [magnetLink, setMagnetLink] = useState("");

  // Detect content type based on file name and structure
  const detectContentType = (fileName: string, files: string[]): "movie" | "series" | "video" | "unsupported" => {
    const lowerName = fileName.toLowerCase();
    const ext = lowerName.split('.').pop() || '';
    
    // Check if video file
    const videoExtensions = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v'];
    if (!videoExtensions.includes(ext)) {
      return "unsupported";
    }
    
    // Check for series patterns
    const seriesPatterns = [
      /s\d{1,2}e\d{1,2}/i,  // S01E01
      /season\s*\d+/i,       // Season 1
      /episode\s*\d+/i,      // Episode 1
      /\d+x\d+/,             // 1x01
      /ep\d+/i,              // EP01
    ];
    
    for (const pattern of seriesPatterns) {
      if (pattern.test(lowerName)) {
        return "series";
      }
    }
    
    // Check if multiple video files (likely series)
    const videoFiles = files.filter(f => {
      const fExt = f.toLowerCase().split('.').pop() || '';
      return videoExtensions.includes(fExt);
    });
    
    if (videoFiles.length > 3) {
      return "series";
    }
    
    // Check for movie patterns
    const moviePatterns = [
      /\b(19|20)\d{2}\b/,    // Year like 2023
      /\b(720p|1080p|4k|uhd|hdr|bluray|bdrip|dvdrip)\b/i,
    ];
    
    for (const pattern of moviePatterns) {
      if (pattern.test(lowerName)) {
        return "movie";
      }
    }
    
    return "video";
  };

  const formatSize = (bytes: number): string => {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const parseTorrentFile = async (file: File) => {
    setIsLoading(true);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      
      // Simple bencode parser for torrent files
      const decoded = decodeBencode(bytes);
      
      if (!decoded || !decoded.info) {
        throw new Error("Invalid torrent file");
      }
      
      const info = decoded.info;
      const files: TorrentFile[] = [];
      
      if (info.files) {
        // Multi-file torrent
        const fileNames = info.files.map((f: any) => f.path?.join('/') || f.name);
        
        for (const f of info.files) {
          const fileName = f.path?.join('/') || f.name;
          const type = detectContentType(fileName, fileNames);
          
          files.push({
            name: fileName,
            size: f.length,
            type,
          });
        }
      } else {
        // Single file torrent
        files.push({
          name: info.name,
          size: info.length,
          type: detectContentType(info.name, [info.name]),
        });
      }
      
      setParsedFiles(files);
      onTorrentParsed?.(files);
      
      const supportedCount = files.filter(f => f.type !== "unsupported").length;
      
      toast({
        title: "Торрент проанализирован",
        description: `Найдено ${supportedCount} видео файлов`,
      });
      
    } catch (error: any) {
      console.error("Torrent parse error:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось прочитать торрент-файл",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Simple bencode decoder
  const decodeBencode = (bytes: Uint8Array): any => {
    let pos = 0;
    
    const decode = (): any => {
      const char = String.fromCharCode(bytes[pos]);
      
      if (char === 'd') {
        // Dictionary
        pos++;
        const dict: any = {};
        while (String.fromCharCode(bytes[pos]) !== 'e') {
          const key = decode();
          const value = decode();
          dict[key] = value;
        }
        pos++;
        return dict;
      }
      
      if (char === 'l') {
        // List
        pos++;
        const list: any[] = [];
        while (String.fromCharCode(bytes[pos]) !== 'e') {
          list.push(decode());
        }
        pos++;
        return list;
      }
      
      if (char === 'i') {
        // Integer
        pos++;
        let numStr = '';
        while (String.fromCharCode(bytes[pos]) !== 'e') {
          numStr += String.fromCharCode(bytes[pos]);
          pos++;
        }
        pos++;
        return parseInt(numStr, 10);
      }
      
      if (char >= '0' && char <= '9') {
        // String
        let lenStr = '';
        while (String.fromCharCode(bytes[pos]) !== ':') {
          lenStr += String.fromCharCode(bytes[pos]);
          pos++;
        }
        pos++;
        const len = parseInt(lenStr, 10);
        const str = new TextDecoder().decode(bytes.slice(pos, pos + len));
        pos += len;
        return str;
      }
      
      return null;
    };
    
    return decode();
  };

  const getTypeIcon = (type: TorrentFile["type"]) => {
    switch (type) {
      case "movie": return <Film className="w-4 h-4 text-primary" />;
      case "series": return <Tv className="w-4 h-4 text-blue-500" />;
      case "video": return <FileVideo className="w-4 h-4 text-green-500" />;
      default: return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getTypeBadge = (type: TorrentFile["type"]) => {
    switch (type) {
      case "movie": return <Badge variant="default">Фильм</Badge>;
      case "series": return <Badge variant="secondary">Сериал</Badge>;
      case "video": return <Badge variant="outline">Видео</Badge>;
      default: return <Badge variant="destructive">Не поддерживается</Badge>;
    }
  };

  // Add parsed video files to media content
  const addToMediaLibrary = async () => {
    const supportedFiles = parsedFiles.filter(f => f.type !== "unsupported");
    
    if (supportedFiles.length === 0) {
      toast({
        title: "Нет подходящих файлов",
        description: "Торрент не содержит видеофайлов",
        variant: "destructive",
      });
      return;
    }

    setIsAddingMedia(true);

    try {
      const mediaItems = supportedFiles.map(file => ({
        channel_id: channelId,
        title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension for cleaner title
        file_url: `torrent://${encodeURIComponent(file.name)}`,
        file_type: file.name.toLowerCase().endsWith('.mkv') ? "video/x-matroska" : "video/mp4",
        source_type: "torrent",
        is_24_7: false,
      }));

      const { error } = await supabase
        .from("media_content")
        .insert(mediaItems);

      if (error) throw error;

      toast({
        title: "Файлы добавлены",
        description: `${supportedFiles.length} видео добавлено в библиотеку. Для воспроизведения загрузите файлы на сервер.`,
      });

      onMediaAdded?.();
      setIsOpen(false);
      setParsedFiles([]);
      setMagnetLink("");
    } catch (error: any) {
      console.error("Error adding media:", error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось добавить файлы",
        variant: "destructive",
      });
    } finally {
      setIsAddingMedia(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer">
          <Download className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <p className="font-semibold mb-1">Торрент-файл</p>
          <p className="text-xs text-muted-foreground">
            Загрузить .torrent для анализа
          </p>
        </div>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Загрузка через торрент</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="torrent-file">Торрент-файл (.torrent)</Label>
            <Input
              id="torrent-file"
              type="file"
              accept=".torrent"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) parseTorrentFile(file);
              }}
              disabled={isLoading}
            />
          </div>

          <div className="text-center text-sm text-muted-foreground">или</div>

          <div>
            <Label>Magnet-ссылка</Label>
            <Input
              value={magnetLink}
              onChange={(e) => setMagnetLink(e.target.value)}
              placeholder="magnet:?xt=urn:btih:..."
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              ⚠️ Magnet-ссылки требуют серверной обработки
            </p>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span>Анализ торрент-файла...</span>
            </div>
          )}

          {parsedFiles.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Содержимое торрента:</h4>
                <Button
                  onClick={addToMediaLibrary}
                  disabled={isAddingMedia || parsedFiles.filter(f => f.type !== "unsupported").length === 0}
                  size="sm"
                  className="gap-2"
                >
                  {isAddingMedia ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Добавить в библиотеку
                </Button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {parsedFiles.map((file, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${
                      file.type === "unsupported" 
                        ? "bg-muted/50 border-muted" 
                        : "bg-card border-border"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {getTypeIcon(file.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {formatSize(file.size)}
                          </span>
                          {getTypeBadge(file.type)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">
              💡 Система автоматически определяет тип контента (фильм/сериал) по названию файла.
              Игры, программы и другие неподдерживаемые файлы будут помечены и исключены.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TorrentUploader;
