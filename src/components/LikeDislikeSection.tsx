import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LikeDislikeSectionProps {
  channelId: string;
}

const LikeDislikeSection = ({ channelId }: LikeDislikeSectionProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [likesCount, setLikesCount] = useState(0);
  const [dislikesCount, setDislikesCount] = useState(0);
  const [userReaction, setUserReaction] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLikesData();
  }, [channelId, user]);

  const fetchLikesData = async () => {
    try {
      // Fetch all likes/dislikes for this channel
      const { data: allLikes, error } = await supabase
        .from("likes")
        .select("*")
        .eq("channel_id", channelId);

      if (error) throw error;

      const likes = allLikes?.filter((l) => l.is_like === true) || [];
      const dislikes = allLikes?.filter((l) => l.is_like === false) || [];

      setLikesCount(likes.length);
      setDislikesCount(dislikes.length);

      // Check if current user has reacted
      if (user) {
        const userLike = allLikes?.find((l) => l.user_id === user.id);
        setUserReaction(userLike ? userLike.is_like : null);
      }
    } catch (error) {
      console.error("Error fetching likes:", error);
    }
  };

  const handleReaction = async (isLike: boolean) => {
    if (!user) {
      toast({
        title: "Требуется авторизация",
        description: "Войдите в систему, чтобы оценить канал",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Check if user already has a reaction
      const { data: existingLike } = await supabase
        .from("likes")
        .select("*")
        .eq("channel_id", channelId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingLike) {
        if (existingLike.is_like === isLike) {
          // Remove reaction if clicking the same button
          const { error } = await supabase
            .from("likes")
            .delete()
            .eq("id", existingLike.id);

          if (error) throw error;
          setUserReaction(null);
        } else {
          // Update reaction if clicking different button
          const { error } = await supabase
            .from("likes")
            .update({ is_like: isLike })
            .eq("id", existingLike.id);

          if (error) throw error;
          setUserReaction(isLike);
        }
      } else {
        // Create new reaction
        const { error } = await supabase.from("likes").insert({
          channel_id: channelId,
          user_id: user.id,
          is_like: isLike,
        });

        if (error) throw error;
        setUserReaction(isLike);
      }

      fetchLikesData();
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обработать реакцию",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <Button
        variant={userReaction === true ? "default" : "outline"}
        size="sm"
        onClick={() => handleReaction(true)}
        disabled={loading}
        className="gap-2"
      >
        <ThumbsUp className="w-4 h-4" />
        <span>{likesCount}</span>
      </Button>
      <Button
        variant={userReaction === false ? "default" : "outline"}
        size="sm"
        onClick={() => handleReaction(false)}
        disabled={loading}
        className="gap-2"
      >
        <ThumbsDown className="w-4 h-4" />
        <span>{dislikesCount}</span>
      </Button>
    </div>
  );
};

export default LikeDislikeSection;
