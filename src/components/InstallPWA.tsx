import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, X, Smartphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const InstallPWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isInStandaloneMode = window.matchMedia("(display-mode: standalone)").matches 
      || (window.navigator as any).standalone 
      || document.referrer.includes("android-app://");
    
    setIsStandalone(isInStandaloneMode);

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Listen for beforeinstallprompt event
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Auto-show install prompt after 30 seconds for first-time visitors
    const hasSeenPrompt = localStorage.getItem("pwa-prompt-shown");
    if (!hasSeenPrompt && !isInStandaloneMode) {
      const timer = setTimeout(() => {
        setShowInstallDialog(true);
        localStorage.setItem("pwa-prompt-shown", "true");
      }, 30000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // Show iOS instructions
      if (isIOS) {
        setShowInstallDialog(true);
      }
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setShowInstallDialog(false);
    }
  };

  // Don't show if already installed
  if (isStandalone) return null;

  return (
    <>
      {/* Floating install button on mobile */}
      <div className="fixed bottom-20 right-4 z-40 md:hidden">
        <Button
          onClick={() => setShowInstallDialog(true)}
          size="icon"
          className="w-12 h-12 rounded-full shadow-lg bg-gradient-to-r from-primary to-accent"
        >
          <Download className="w-5 h-5" />
        </Button>
      </div>

      <Dialog open={showInstallDialog} onOpenChange={setShowInstallDialog}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              Установить приложение
            </DialogTitle>
            <DialogDescription>
              Установите StreamLiveTV на устройство для быстрого доступа
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {isIOS ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Чтобы установить на iPhone/iPad:
                </p>
                <ol className="text-sm space-y-2 list-decimal list-inside">
                  <li>Нажмите кнопку <strong>Поделиться</strong> (□↑) внизу экрана</li>
                  <li>Прокрутите вниз и выберите <strong>"На экран Домой"</strong></li>
                  <li>Нажмите <strong>"Добавить"</strong></li>
                </ol>
              </div>
            ) : deferredPrompt ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Приложение будет доступно с главного экрана вашего устройства
                </p>
                <Button onClick={handleInstall} className="w-full gap-2">
                  <Download className="w-4 h-4" />
                  Установить
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Откройте меню браузера и выберите "Установить приложение" или "Добавить на главный экран"
                </p>
              </div>
            )}

            <Button
              variant="outline"
              onClick={() => setShowInstallDialog(false)}
              className="w-full"
            >
              Позже
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InstallPWA;
