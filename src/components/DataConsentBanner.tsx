import { Button } from "@/components/ui/button";
import { Shield, X } from "lucide-react";

interface DataConsentBannerProps {
  onAccept: () => void;
  onDecline: () => void;
}

const DataConsentBanner = ({ onAccept, onDecline }: DataConsentBannerProps) => {
  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-lg mx-auto">
      <div className="bg-card border border-border rounded-xl p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <Shield className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-3">
            <div>
              <h4 className="font-semibold text-sm">Персональные рекомендации</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Мы хотим использовать историю просмотров и поиска, чтобы показывать вам
                контент, который вам понравится. Данные хранятся только на вашем устройстве.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={onAccept} className="text-xs">
                Разрешить
              </Button>
              <Button size="sm" variant="ghost" onClick={onDecline} className="text-xs">
                Нет, спасибо
              </Button>
            </div>
          </div>
          <button onClick={onDecline} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataConsentBanner;
