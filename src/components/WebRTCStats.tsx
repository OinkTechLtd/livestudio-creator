import { useState, useEffect } from "react";
import { Activity, Wifi, Signal, AlertTriangle, Check } from "lucide-react";

interface WebRTCStatsProps {
  peerConnections: Map<string, RTCPeerConnection>;
  isStreaming: boolean;
}

interface ConnectionStats {
  viewerId: string;
  bitrate: number;
  packetsLost: number;
  roundTripTime: number;
  connectionState: string;
  iceState: string;
}

const WebRTCStats = ({ peerConnections, isStreaming }: WebRTCStatsProps) => {
  const [stats, setStats] = useState<ConnectionStats[]>([]);
  const [overallQuality, setOverallQuality] = useState<"excellent" | "good" | "poor" | "disconnected">("excellent");

  useEffect(() => {
    if (!isStreaming || peerConnections.size === 0) {
      setStats([]);
      return;
    }

    const updateStats = async () => {
      const newStats: ConnectionStats[] = [];

      for (const [viewerId, pc] of peerConnections) {
        try {
          const report = await pc.getStats();
          let bitrate = 0;
          let packetsLost = 0;
          let roundTripTime = 0;

          report.forEach((stat) => {
            if (stat.type === "outbound-rtp" && (stat.kind === "video" || stat.kind === "audio")) {
              if (stat.bytesSent) {
                bitrate = Math.round((stat.bytesSent * 8) / 1000); // kbps
              }
            }
            if (stat.type === "remote-inbound-rtp") {
              packetsLost = stat.packetsLost || 0;
              roundTripTime = stat.roundTripTime ? Math.round(stat.roundTripTime * 1000) : 0;
            }
            if (stat.type === "candidate-pair" && stat.state === "succeeded") {
              roundTripTime = stat.currentRoundTripTime 
                ? Math.round(stat.currentRoundTripTime * 1000) 
                : roundTripTime;
            }
          });

          newStats.push({
            viewerId,
            bitrate,
            packetsLost,
            roundTripTime,
            connectionState: pc.connectionState,
            iceState: pc.iceConnectionState,
          });
        } catch (error) {
          console.error("Error getting stats:", error);
        }
      }

      setStats(newStats);

      // Calculate overall quality
      if (newStats.length === 0) {
        setOverallQuality("disconnected");
      } else {
        const avgRtt = newStats.reduce((sum, s) => sum + s.roundTripTime, 0) / newStats.length;
        const totalPacketsLost = newStats.reduce((sum, s) => sum + s.packetsLost, 0);
        
        if (avgRtt < 100 && totalPacketsLost < 10) {
          setOverallQuality("excellent");
        } else if (avgRtt < 300 && totalPacketsLost < 50) {
          setOverallQuality("good");
        } else {
          setOverallQuality("poor");
        }
      }
    };

    const interval = setInterval(updateStats, 2000);
    updateStats();

    return () => clearInterval(interval);
  }, [peerConnections, isStreaming]);

  if (!isStreaming) return null;

  const getQualityColor = () => {
    switch (overallQuality) {
      case "excellent": return "text-green-500";
      case "good": return "text-yellow-500";
      case "poor": return "text-red-500";
      default: return "text-muted-foreground";
    }
  };

  const getQualityIcon = () => {
    switch (overallQuality) {
      case "excellent": return <Check className="w-4 h-4" />;
      case "good": return <Signal className="w-4 h-4" />;
      case "poor": return <AlertTriangle className="w-4 h-4" />;
      default: return <Wifi className="w-4 h-4" />;
    }
  };

  const getQualityText = () => {
    switch (overallQuality) {
      case "excellent": return "Отличное";
      case "good": return "Хорошее";
      case "poor": return "Плохое";
      default: return "Нет соединения";
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="w-5 h-5 text-primary" />
        <h4 className="font-semibold">Статистика соединения</h4>
      </div>

      {/* Overall Quality */}
      <div className={`flex items-center gap-2 ${getQualityColor()}`}>
        {getQualityIcon()}
        <span className="text-sm font-medium">Качество: {getQualityText()}</span>
      </div>

      {/* Connected viewers count */}
      <div className="text-sm text-muted-foreground">
        Подключенных зрителей: <span className="font-mono">{stats.length}</span>
      </div>

      {/* Detailed stats per connection */}
      {stats.length > 0 && (
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {stats.map((s, i) => (
            <div 
              key={s.viewerId} 
              className="text-xs bg-muted/50 rounded p-2 space-y-1"
            >
              <div className="flex justify-between">
                <span className="text-muted-foreground">Зритель {i + 1}</span>
                <span className={
                  s.connectionState === "connected" 
                    ? "text-green-500" 
                    : s.connectionState === "connecting"
                    ? "text-yellow-500"
                    : "text-red-500"
                }>
                  {s.connectionState}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-muted-foreground">
                <div>
                  <span className="block">Битрейт</span>
                  <span className="font-mono text-foreground">{s.bitrate} kbps</span>
                </div>
                <div>
                  <span className="block">Задержка</span>
                  <span className="font-mono text-foreground">{s.roundTripTime} мс</span>
                </div>
                <div>
                  <span className="block">Потери</span>
                  <span className="font-mono text-foreground">{s.packetsLost} пакетов</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {stats.length === 0 && isStreaming && (
        <p className="text-xs text-muted-foreground">Ожидание подключения зрителей...</p>
      )}
    </div>
  );
};

export default WebRTCStats;
