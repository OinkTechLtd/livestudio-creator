import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Eye, Radio, Tv, Play } from "lucide-react";

interface Channel {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  channel_type: "tv" | "radio";
  is_live: boolean;
  viewer_count: number;
  profiles: {
    username: string;
  };
  subscriptions: { count: number }[];
  media_preview_url?: string;
}

interface ChannelPreviewCardProps {
  channel: Channel;
  t: (key: string) => string;
}

const ChannelPreviewCard = ({ channel, t }: ChannelPreviewCardProps) => {
  const [isHovering, setIsHovering] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleMouseEnter = () => {
    setIsHovering(true);
    if (videoRef.current && channel.channel_type === "tv") {
      videoRef.current.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  // Build preview URL from the HLS playlist endpoint
  const previewUrl = `https://aqeleulwobgamdffkfri.functions.supabase.co/hls-playlist?channelId=${channel.id}`;

  return (
    <Link to={`/channel/${channel.id}`}>
      <Card 
        className="overflow-hidden hover:shadow-lg transition-shadow group"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="relative aspect-video bg-muted">
          {/* Thumbnail image */}
          {channel.thumbnail_url && !isHovering && (
            <img
              src={channel.thumbnail_url}
              alt={channel.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          )}
          
          {/* Video preview on hover for TV channels */}
          {channel.channel_type === "tv" && isHovering && (
            <div className="absolute inset-0 bg-black">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                muted
                loop
                playsInline
                onLoadedData={() => setPreviewLoaded(true)}
              >
                <source src={previewUrl} type="application/x-mpegURL" />
              </video>
              {!previewLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <Play className="w-12 h-12 text-white animate-pulse" />
                </div>
              )}
            </div>
          )}

          {/* Fallback for no thumbnail */}
          {!channel.thumbnail_url && !isHovering && (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
              {channel.channel_type === "tv" ? (
                <Tv className="w-12 h-12 md:w-16 md:h-16 text-muted-foreground" />
              ) : (
                <Radio className="w-12 h-12 md:w-16 md:h-16 text-muted-foreground" />
              )}
            </div>
          )}

          {/* Hover indicator */}
          {isHovering && channel.channel_type === "tv" && (
            <div className="absolute bottom-2 left-2 right-2 flex justify-center">
              <Badge variant="secondary" className="bg-black/70 text-white text-xs">
                <Play className="w-3 h-3 mr-1" />
                Предпросмотр
              </Badge>
            </div>
          )}

          {channel.is_live && (
            <Badge className="absolute top-2 left-2 bg-red-600 animate-pulse text-xs">
              <span className="w-2 h-2 bg-white rounded-full mr-1" />
              LIVE
            </Badge>
          )}
          <Badge variant="secondary" className="absolute top-2 right-2 text-xs">
            {channel.channel_type === "tv" ? t("tv") : t("radio")}
          </Badge>
        </div>
        <CardContent className="p-3 md:p-4">
          <h3 className="font-semibold mb-1 line-clamp-1 text-sm md:text-base">{channel.title}</h3>
          <p className="text-xs md:text-sm text-muted-foreground mb-2 line-clamp-2">
            {channel.description || "Описание отсутствует"}
          </p>
          <div className="flex items-center justify-between text-xs md:text-sm text-muted-foreground">
            <span className="truncate max-w-[80px] md:max-w-none">{channel.profiles.username}</span>
            <div className="flex items-center gap-2 md:gap-3">
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3 md:w-4 md:h-4" />
                {channel.viewer_count || 0}
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3 md:w-4 md:h-4" />
                {channel.subscriptions[0]?.count || 0}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

export default ChannelPreviewCard;