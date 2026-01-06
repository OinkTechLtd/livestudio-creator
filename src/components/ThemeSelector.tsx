import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Palette } from "lucide-react";

const ThemeSelector = () => {
  const { user } = useAuth();
  const [showDialog, setShowDialog] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<string>("default");

  useEffect(() => {
    const checkThemePreference = async () => {
      // Check localStorage first
      const savedTheme = localStorage.getItem("streamlivetv-theme");
      const hasAsked = localStorage.getItem("streamlivetv-theme-asked");

      if (savedTheme) {
        setCurrentTheme(savedTheme);
        applyTheme(savedTheme);
        return;
      }

      // If not asked yet, show dialog
      if (!hasAsked) {
        setShowDialog(true);
      }
    };

    checkThemePreference();
  }, []);

  const applyTheme = (theme: string) => {
    const root = document.documentElement;
    
    if (theme === "liquid-glass") {
      // Liquid Glass theme - iOS inspired
      root.style.setProperty("--background", "220 20% 12%");
      root.style.setProperty("--card", "220 20% 15%");
      root.style.setProperty("--popover", "220 20% 15%");
      root.style.setProperty("--primary", "210 100% 60%");
      root.style.setProperty("--primary-glow", "210 100% 70%");
      root.style.setProperty("--secondary", "280 80% 60%");
      root.style.setProperty("--secondary-glow", "280 80% 70%");
      root.style.setProperty("--accent", "190 100% 50%");
      root.style.setProperty("--muted", "220 15% 20%");
      root.style.setProperty("--border", "220 15% 25%");
      document.body.classList.add("liquid-glass-theme");
      document.body.classList.remove("default-theme");
    } else {
      // Default Neon Cyberpunk theme
      root.style.setProperty("--background", "220 25% 8%");
      root.style.setProperty("--card", "220 25% 10%");
      root.style.setProperty("--popover", "220 25% 10%");
      root.style.setProperty("--primary", "320 100% 58%");
      root.style.setProperty("--primary-glow", "320 100% 68%");
      root.style.setProperty("--secondary", "190 100% 50%");
      root.style.setProperty("--secondary-glow", "190 100% 60%");
      root.style.setProperty("--accent", "280 100% 65%");
      root.style.setProperty("--muted", "220 20% 15%");
      root.style.setProperty("--border", "220 20% 20%");
      document.body.classList.add("default-theme");
      document.body.classList.remove("liquid-glass-theme");
    }
  };

  const selectTheme = async (theme: string) => {
    setCurrentTheme(theme);
    applyTheme(theme);
    localStorage.setItem("streamlivetv-theme", theme);
    localStorage.setItem("streamlivetv-theme-asked", "true");
    setShowDialog(false);

    // Save to database if logged in
    if (user) {
      await supabase.from("user_preferences").upsert({
        user_id: user.id,
        theme: theme,
        updated_at: new Date().toISOString(),
      });
    }
  };

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" />
            Выберите тему оформления
          </DialogTitle>
          <DialogDescription>
            Вы можете сменить тему в любое время в настройках профиля
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-4 py-4">
          {/* Default Theme */}
          <button
            onClick={() => selectTheme("default")}
            className="group relative p-4 rounded-xl border-2 border-border hover:border-primary transition-all"
          >
            <div className="h-24 rounded-lg bg-gradient-to-br from-pink-500 via-purple-600 to-cyan-500 mb-3" />
            <h4 className="font-semibold text-sm">Neon Cyberpunk</h4>
            <p className="text-xs text-muted-foreground">Классическая тема</p>
          </button>

          {/* Liquid Glass Theme */}
          <button
            onClick={() => selectTheme("liquid-glass")}
            className="group relative p-4 rounded-xl border-2 border-border hover:border-primary transition-all"
          >
            <div className="h-24 rounded-lg relative overflow-hidden mb-3">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400/50 via-purple-400/50 to-cyan-400/50 backdrop-blur-xl" />
              <div className="absolute inset-0 bg-white/10" />
              <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-white/80" />
            </div>
            <h4 className="font-semibold text-sm flex items-center gap-1">
              Liquid Glass
              <span className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary rounded">NEW</span>
            </h4>
            <p className="text-xs text-muted-foreground">Стиль iOS</p>
          </button>
        </div>

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => {
              localStorage.setItem("streamlivetv-theme-asked", "true");
              setShowDialog(false);
            }}
          >
            Оставить текущую
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ThemeSelector;
