import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Mic, MicOff, Radio, Headphones, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import WebRTCStats from "@/components/WebRTCStats";
import { useViewerNotifications } from "@/hooks/useViewerNotifications";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface VoiceStreamingProps {
  channelId: string;
  isOwner?: boolean;
  onStreamStart?: () => void;
  onStreamStop?: () => void;
}

const VoiceStreaming = ({ channelId, isOwner = true, onStreamStart, onStreamStop }: VoiceStreamingProps) => {
  const { toast } = useToast();
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);
  const viewerAudioRef = useRef<HTMLAudioElement>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const realtimeChannelRef = useRef<any>(null);

  // Viewer notifications for streamer
  useViewerNotifications({
    channelId,
    isOwner,
    isStreaming
  });

  useEffect(() => {
    // Get available audio devices
    navigator.mediaDevices.enumerateDevices().then(deviceList => {
      const audioDevices = deviceList.filter(d => d.kind === "audioinput");
      setDevices(audioDevices);
      if (audioDevices.length > 0) {
        setSelectedDevice(audioDevices[0].deviceId);
      }
    });

    // Check if channel is live
    const checkLiveStatus = async () => {
      const { data } = await supabase
        .from("channels")
        .select("is_live")
        .eq("id", channelId)
        .single();
      
      if (data) {
        setIsLive(data.is_live || false);
      }
    };

    checkLiveStatus();

    // Subscribe to live status changes
    const channel = supabase
      .channel(`voice-stream-${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "channels",
          filter: `id=eq.${channelId}`,
        },
        (payload: any) => {
          if (payload.new) {
            setIsLive(payload.new.is_live || false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      cleanup();
    };
  }, [channelId]);

  // Setup WebRTC signaling for viewers
  useEffect(() => {
    if (!isOwner && isLive) {
      setupViewerConnection();
    }
  }, [isOwner, isLive]);

  const cleanup = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }
  };

  const setupViewerConnection = async () => {
    setIsLoading(true);
    
    const viewerId = `viewer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const signaling = supabase.channel(`webrtc-voice-${channelId}`, {
      config: { broadcast: { self: false } }
    });
    
    realtimeChannelRef.current = signaling;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ],
      iceCandidatePoolSize: 10
    });

    peerConnectionsRef.current.set(viewerId, pc);

    // Keep-alive for WebView - prevent connection timeout
    const keepAliveInterval = setInterval(() => {
      if (pc.connectionState === 'connected') {
        signaling.send({
          type: 'broadcast',
          event: 'keep-alive',
          payload: { viewerId, timestamp: Date.now() }
        });
      }
    }, 5000);

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('Voice connection state:', pc.connectionState);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        clearInterval(keepAliveInterval);
        setTimeout(() => {
          if (isLive && !isOwner) {
            console.log('Attempting voice reconnection...');
            cleanup();
            setupViewerConnection();
          }
        }, 2000);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('Voice ICE state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'disconnected') {
        pc.restartIce();
      }
    };

    pc.ontrack = (event) => {
      console.log('Received audio track');
      if (viewerAudioRef.current && event.streams[0]) {
        viewerAudioRef.current.srcObject = event.streams[0];
        viewerAudioRef.current.play().catch(console.error);
        setIsLoading(false);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        signaling.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: {
            candidate: event.candidate,
            viewerId,
            target: 'broadcaster'
          }
        });
      }
    };

    signaling.on('broadcast', { event: 'offer' }, async (payload: any) => {
      if (payload.payload.targetViewerId === viewerId) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.payload.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          
          signaling.send({
            type: 'broadcast',
            event: 'answer',
            payload: {
              answer,
              viewerId
            }
          });
        } catch (error) {
          console.error('Error handling offer:', error);
        }
      }
    });

    signaling.on('broadcast', { event: 'ice-candidate' }, async (payload: any) => {
      if (payload.payload.target === 'viewer' && payload.payload.targetViewerId === viewerId) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.payload.candidate));
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      }
    });

    await signaling.subscribe();

    // Request offer from broadcaster
    signaling.send({
      type: 'broadcast',
      event: 'viewer-joined',
      payload: { viewerId }
    });
  };

  const startStreaming = async () => {
    try {
      setIsLoading(true);
      
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
      audioContextRef.current = audioContext;
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

      // Setup signaling for broadcaster
      const signaling = supabase.channel(`webrtc-voice-${channelId}`, {
        config: { broadcast: { self: false } }
      });
      
      realtimeChannelRef.current = signaling;

      signaling.on('broadcast', { event: 'viewer-joined' }, async (payload: any) => {
        const viewerId = payload.payload.viewerId;
        console.log('Voice viewer joined:', viewerId);
        
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            {
              urls: 'turn:openrelay.metered.ca:80',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            },
            {
              urls: 'turn:openrelay.metered.ca:443',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            },
            {
              urls: 'turn:openrelay.metered.ca:443?transport=tcp',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            }
          ],
          iceCandidatePoolSize: 10
        });

        peerConnectionsRef.current.set(viewerId, pc);

        // Add audio track to peer connection
        stream.getAudioTracks().forEach(track => {
          pc.addTrack(track, stream);
        });

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            signaling.send({
              type: 'broadcast',
              event: 'ice-candidate',
              payload: {
                candidate: event.candidate,
                target: 'viewer',
                targetViewerId: viewerId
              }
            });
          }
        };

        // Create and send offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        signaling.send({
          type: 'broadcast',
          event: 'offer',
          payload: {
            offer,
            targetViewerId: viewerId
          }
        });
      });

      signaling.on('broadcast', { event: 'answer' }, async (payload: any) => {
        const pc = peerConnectionsRef.current.get(payload.payload.viewerId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.payload.answer));
        }
      });

      signaling.on('broadcast', { event: 'ice-candidate' }, async (payload: any) => {
        if (payload.payload.target === 'broadcaster') {
          const pc = peerConnectionsRef.current.get(payload.payload.viewerId);
          if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(payload.payload.candidate));
          }
        }
      });

      await signaling.subscribe();

      // Update channel to live status
      await supabase
        .from("channels")
        .update({ is_live: true })
        .eq("id", channelId);

      setIsStreaming(true);
      setIsLoading(false);
      onStreamStart?.();

      toast({
        title: "Голосовой эфир запущен",
        description: "Микрофон активен, зрители слышат вас",
      });

    } catch (error: any) {
      console.error("Voice streaming error:", error);
      setIsLoading(false);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось запустить эфир",
        variant: "destructive",
      });
    }
  };

  const stopStreaming = async () => {
    cleanup();

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

  // Viewer mode - show listening UI
  if (!isOwner) {
    return (
      <div className="bg-muted rounded-lg p-6 md:p-8">
        <audio ref={viewerAudioRef} autoPlay playsInline className="hidden" />
        <div className="flex flex-col items-center gap-4">
          <div className={`relative w-24 h-24 md:w-32 md:h-32 rounded-full flex items-center justify-center transition-all ${
            isLive ? 'bg-primary/20' : 'bg-muted-foreground/10'
          }`}>
            {isLive && (
              <>
                <div 
                  className="absolute inset-0 rounded-full bg-primary/30 animate-ping"
                  style={{ animationDuration: '1.5s' }}
                />
              </>
            )}
            {isLoading ? (
              <Loader2 className="w-12 h-12 md:w-16 md:h-16 text-primary animate-spin" />
            ) : isLive ? (
              <Headphones className="w-12 h-12 md:w-16 md:h-16 text-primary" />
            ) : (
              <Radio className="w-12 h-12 md:w-16 md:h-16 text-muted-foreground" />
            )}
          </div>

          {isLive ? (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
              <span className="text-sm font-medium">В ПРЯМОМ ЭФИРЕ</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Ожидание начала эфира...</p>
          )}

          <p className="text-sm text-muted-foreground text-center">
            {isLoading 
              ? "Подключение к эфиру..."
              : isLive 
                ? "Радио транслируется в прямом эфире" 
                : "Ведущий пока не начал эфир"}
          </p>
        </div>
      </div>
    );
  }

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
          <Button onClick={startStreaming} className="gap-2" disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
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

      {/* WebRTC Stats */}
      <WebRTCStats 
        peerConnections={peerConnectionsRef.current} 
        isStreaming={isStreaming} 
      />

      <p className="text-sm text-muted-foreground">
        💡 Зрители услышат ваш голос в реальном времени после запуска эфира
      </p>
    </div>
  );
};

export default VoiceStreaming;
