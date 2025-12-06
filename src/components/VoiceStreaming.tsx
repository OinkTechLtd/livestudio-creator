import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Mic, MicOff, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface VoiceStreamingProps {
  channelId: string;
  onStreamStart?: () => void;
  onStreamStop?: () => void;
}

const VoiceStreaming = ({ channelId, onStreamStart, onStreamStop }: VoiceStreamingProps) => {
  const { toast } = useToast();
  const [isStreaming, setIsStreaming] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    // Get available audio devices
    navigator.mediaDevices.enumerateDevices().then(deviceList => {
      const audioDevices = deviceList.filter(d => d.kind === "audioinput");
      setDevices(audioDevices);
      if (audioDevices.length > 0) {
        setSelectedDevice(audioDevices[0].deviceId);
      }
    });

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const startStreaming = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      streamRef.current = stream;

      // Create audio context for visualization
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Start level visualization
      const visualize = () => {
        if (!analyserRef.current) return;
        
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(average / 255);
        
        animationRef.current = requestAnimationFrame(visualize);
      };
      visualize();

      // Update channel to live status
      await supabase
        .from("channels")
        .update({ is_live: true })
        .eq("id", channelId);

      setIsStreaming(true);
      onStreamStart?.();

      toast({
        title: "Голосовой эфир запущен",
        description: "Микрофон активен",
      });

    } catch (error: any) {
      console.error("Voice streaming error:", error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось запустить эфир",
        variant: "destructive",
      });
    }
  };

  const stopStreaming = async () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    analyserRef.current = null;
    setAudioLevel(0);

    // Update channel status
    await supabase
      .from("channels")
      .update({ is_live: false })
      .eq("id", channelId);

    setIsStreaming(false);
    onStreamStop?.();

    toast({
      title: "Эфир остановлен",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3">
        <Select
          value={selectedDevice}
          onValueChange={setSelectedDevice}
          disabled={isStreaming}
        >
          <SelectTrigger className="w-full md:w-64">
            <SelectValue placeholder="Выберите микрофон" />
          </SelectTrigger>
          <SelectContent>
            {devices.map(device => (
              <SelectItem key={device.deviceId} value={device.deviceId}>
                {device.label || `Микрофон ${devices.indexOf(device) + 1}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!isStreaming ? (
          <Button onClick={startStreaming} className="gap-2">
            <Mic className="w-4 h-4" />
            Выйти в эфир
          </Button>
        ) : (
          <Button onClick={stopStreaming} variant="destructive" className="gap-2">
            <MicOff className="w-4 h-4" />
            Завершить эфир
          </Button>
        )}
      </div>

      {/* Audio Visualization */}
      <div className="bg-muted rounded-lg p-6 md:p-8">
        <div className="flex flex-col items-center gap-4">
          <div className={`relative w-24 h-24 md:w-32 md:h-32 rounded-full flex items-center justify-center transition-all ${
            isStreaming ? 'bg-primary/20' : 'bg-muted-foreground/10'
          }`}>
            {isStreaming && (
              <>
                <div 
                  className="absolute inset-0 rounded-full bg-primary/30 animate-ping"
                  style={{ animationDuration: '1.5s' }}
                />
                <div 
                  className="absolute rounded-full bg-primary/20 transition-all duration-75"
                  style={{ 
                    width: `${100 + audioLevel * 50}%`,
                    height: `${100 + audioLevel * 50}%`,
                  }}
                />
              </>
            )}
            <Radio className={`w-12 h-12 md:w-16 md:h-16 ${isStreaming ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>

          {isStreaming && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
              <span className="text-sm font-medium">В ЭФИРЕ</span>
            </div>
          )}

          {/* Audio level bars */}
          {isStreaming && (
            <div className="flex items-end gap-1 h-8">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2 rounded-full transition-all duration-75 ${
                    i / 20 < audioLevel ? 'bg-primary' : 'bg-muted-foreground/20'
                  }`}
                  style={{ 
                    height: `${Math.max(4, (i / 20) * 32)}px`,
                  }}
                />
              ))}
            </div>
          )}

          <p className="text-sm text-muted-foreground text-center">
            {isStreaming 
              ? "Ваш голос транслируется в прямом эфире" 
              : "Нажмите 'Выйти в эфир' чтобы начать трансляцию"}
          </p>
        </div>
      </div>
    </div>
  );
};

export default VoiceStreaming;
