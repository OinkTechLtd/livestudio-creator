import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Monitor, Camera, StopCircle, Video, Eye, Loader2 } from "lucide-react";
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

interface ScreenShareStreamingProps {
  channelId: string;
  isOwner?: boolean;
  onStreamStart?: () => void;
  onStreamStop?: () => void;
}

// Simple WebRTC signaling using Supabase Realtime
const ScreenShareStreaming = ({ channelId, isOwner = true, onStreamStart, onStreamStop }: ScreenShareStreamingProps) => {
  const { toast } = useToast();
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [streamType, setStreamType] = useState<"screen" | "camera">("screen");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewerVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const realtimeChannelRef = useRef<any>(null);

  // Viewer notifications for streamer
  useViewerNotifications({
    channelId,
    isOwner,
    isStreaming
  });

  useEffect(() => {
    // Get available video devices
    navigator.mediaDevices.enumerateDevices().then(deviceList => {
      const videoDevices = deviceList.filter(d => d.kind === "videoinput");
      setDevices(videoDevices);
      if (videoDevices.length > 0) {
        setSelectedDevice(videoDevices[0].deviceId);
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
      .channel(`screen-stream-${channelId}`)
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
    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }
  };

  const setupViewerConnection = async () => {
    setIsLoading(true);
    
    const viewerId = `viewer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const signaling = supabase.channel(`webrtc-${channelId}`, {
      config: { broadcast: { self: false } }
    });
    
    realtimeChannelRef.current = signaling;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        // Free TURN servers for NAT traversal
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
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        clearInterval(keepAliveInterval);
        // Try to reconnect after brief delay
        setTimeout(() => {
          if (isLive && !isOwner) {
            console.log('Attempting reconnection...');
            cleanup();
            setupViewerConnection();
          }
        }, 2000);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'disconnected') {
        // ICE restart
        pc.restartIce();
      }
    };

    pc.ontrack = (event) => {
      console.log('Received track:', event.track.kind);
      if (viewerVideoRef.current && event.streams[0]) {
        viewerVideoRef.current.srcObject = event.streams[0];
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

      // Setup signaling for broadcaster
      const signaling = supabase.channel(`webrtc-${channelId}`, {
        config: { broadcast: { self: false } }
      });
      
      realtimeChannelRef.current = signaling;

      signaling.on('broadcast', { event: 'viewer-joined' }, async (payload: any) => {
        const viewerId = payload.payload.viewerId;
        console.log('Viewer joined:', viewerId);
        
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

        // Add tracks to peer connection
        stream.getTracks().forEach(track => {
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
        title: "Трансляция запущена",
        description: streamType === "screen" ? "Трансляция экрана активна" : "Веб-камера активна",
      });

      // Handle stream end (user clicks stop sharing)
      stream.getVideoTracks()[0].onended = () => {
        stopStreaming();
      };

    } catch (error: any) {
      console.error("Streaming error:", error);
      setIsLoading(false);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось запустить трансляцию",
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

  // Viewer mode - show the stream
  if (!isOwner) {
    return (
      <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
        {isLive ? (
          <>
            <div className="absolute top-4 left-4 bg-destructive text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2 z-10">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              LIVE
            </div>
            {isLoading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
                  <p className="text-white">Подключение к трансляции...</p>
                </div>
              </div>
            ) : (
              <video
                ref={viewerVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
            <div className="text-center">
              <Eye className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Ожидание начала трансляции...</p>
            </div>
          </div>
        )}
      </div>
    );
  }

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
          <Button onClick={startStreaming} className="gap-2" disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
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
      <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
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
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
            <p className="text-muted-foreground">
              {streamType === "screen" ? "Нажмите чтобы начать трансляцию экрана" : "Нажмите чтобы начать трансляцию веб-камеры"}
            </p>
          </div>
        )}
      </div>

      {/* WebRTC Stats */}
      <WebRTCStats 
        peerConnections={peerConnectionsRef.current} 
        isStreaming={isStreaming} 
      />

      <p className="text-sm text-muted-foreground">
        💡 Зрители увидят вашу трансляцию в реальном времени после запуска
      </p>
    </div>
  );
};

export default ScreenShareStreaming;
