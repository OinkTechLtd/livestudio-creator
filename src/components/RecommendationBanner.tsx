import { useState, useEffect } from "react";
import { X, ExternalLink, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const ULTRA_AGGREGATOR_URLS = [
  "https://html-preview.github.io/?url=https://github.com/OinkTechLtd/Services-OinkPlatforms/blob/main/video_aggregator%20(2)%20—%20копия%20—%20копия.html",
  "https://htmlpreview.github.io/?url=https://github.com/OinkTechLtd/Services-OinkPlatforms/blob/main/video_aggregator%20(2)%20—%20копия%20—%20копия.html",
  "https://raw.githack.com/OinkTechLtd/Services-OinkPlatforms/main/video_aggregator%20(2)%20—%20копия%20—%20копия.html",
];

const RecommendationBanner = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);

  useEffect(() => {
    // Check if banner was already shown in this session
    const shown = sessionStorage.getItem("recommendation_banner_shown");
    if (!shown) {
      setIsVisible(true);
      sessionStorage.setItem("recommendation_banner_shown", "true");
    }
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsVisible(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isVisible]);

  const handleClose = () => {
    setIsVisible(false);
  };

  const openAggregator = () => {
    window.open(ULTRA_AGGREGATOR_URLS[0], "_blank");
  };

  if (!isVisible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 gradient-animate text-primary-foreground shadow-lg">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <Sparkles className="w-5 h-5 flex-shrink-0 animate-pulse" />
            <div className="flex-1">
              <p className="font-semibold text-sm md:text-base">
                Ретрансляции через Ultra Aggregator
              </p>
              <p className="text-xs md:text-sm opacity-90">
                Фильмы, сериалы и спорт в реальном времени
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="gap-1 text-xs md:text-sm"
              onClick={openAggregator}
            >
              <ExternalLink className="w-3 h-3" />
              Открыть
            </Button>
            <div className="text-xs bg-primary-foreground/20 px-2 py-1 rounded hidden md:block">
              {timeLeft}с
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 hover:bg-primary-foreground/20"
              onClick={handleClose}
              aria-label="Закрыть баннер"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecommendationBanner;
