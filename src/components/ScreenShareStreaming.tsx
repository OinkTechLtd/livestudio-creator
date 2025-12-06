import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Monitor, Camera, StopCircle, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ScreenShareStreamingProps {
  channelId: string;
  onStreamStart?: () => void;
  onStreamStop?: () => void;
}

const ScreenShareStreaming = ({ channelId, onStreamStart, onStreamStop }: ScreenShareStreamingProps) => {
  const { toast } = useToast();
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamType, setStreamType] = useState<"screen" | "camera">("screen");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Get available video devices
    navigator.mediaDevices.enumerateDevices().then(deviceList => {
      const videoDevices = deviceList.filter(d => d.kind === "videoinput");
      setDevices(videoDevices);
      if (videoDevices.length > 0) {
        setSelectedDevice(videoDevices[0].deviceId);
      }
    });
  }, []);

  const startStreaming = async () => {
    try {
      let stream: MediaStream;

      if (streamType === "screen") {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { 
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          },
          audio: true
        });
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          },
          audio: true
        });
      }

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Update channel to live status
      await supabase
        .from("channels")
        .update({ is_live: true })
        .eq("id", channelId);

      setIsStreaming(true);
      onStreamStart?.();

      toast({
        title: "Трансляция запущена",
        description: streamType === "screen" ? "Трансляция экрана активна" : "Веб-камера активна",
      });

      // Handle stream end (user clicks stop sharing)
      stream.getVideoTracks()[0].onended = () => {
        stopStreaming();
      };

    } catch (error: any) {
      console.error("Streaming error:", error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось запустить трансляцию",
        variant: "destructive",
      });
    }
  };

  const stopStreaming = async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    // Update channel status
    await supabase
      .from("channels")
      .update({ is_live: false })
      .eq("id", channelId);

    setIsStreaming(false);
    onStreamStop?.();

    toast({
      title: "Трансляция остановлена",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3">
        <Select
          value={streamType}
          onValueChange={(v: "screen" | "camera") => setStreamType(v)}
          disabled={isStreaming}
        >
          <SelectTrigger className="w-full md:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="screen">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4" />
                Экран
              </div>
            </SelectItem>
            <SelectItem value="camera">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4" />
                Веб-камера
              </div>
            </SelectItem>
          </SelectContent>
        </Select>

        {streamType === "camera" && devices.length > 0 && (
          <Select
            value={selectedDevice}
            onValueChange={setSelectedDevice}
            disabled={isStreaming}
          >
            <SelectTrigger className="w-full md:w-64">
              <SelectValue placeholder="Выберите камеру" />
            </SelectTrigger>
            <SelectContent>
              {devices.map(device => (
                <SelectItem key={device.deviceId} value={device.deviceId}>
                  {device.label || `Камера ${devices.indexOf(device) + 1}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {!isStreaming ? (
          <Button onClick={startStreaming} className="gap-2">
            <Video className="w-4 h-4" />
            Начать трансляцию
          </Button>
        ) : (
          <Button onClick={stopStreaming} variant="destructive" className="gap-2">
            <StopCircle className="w-4 h-4" />
            Остановить
          </Button>
        )}
      </div>

      {/* Preview */}
      <div className="aspect-video bg-muted rounded-lg overflow-hidden relative">
        {isStreaming && (
          <div className="absolute top-4 left-4 bg-destructive text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2 z-10">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            LIVE
          </div>
        )}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-contain"
        />
        {!isStreaming && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-muted-foreground">
              {streamType === "screen" ? "Нажмите чтобы начать трансляцию экрана" : "Нажмите чтобы начать трансляцию веб-камеры"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScreenShareStreaming;
