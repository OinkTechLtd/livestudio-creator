import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Palette, Sparkles, Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ProfileThemeSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentTheme, setCurrentTheme] = useState<string>("default");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("streamlivetv-theme") || "default";
    setCurrentTheme(savedTheme);
  }, []);

  const applyTheme = (theme: string) => {
    const root = document.documentElement;
    
    if (theme === "liquid-glass") {
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
    setSaving(true);
    
    setCurrentTheme(theme);
    applyTheme(theme);
    localStorage.setItem("streamlivetv-theme", theme);

    if (user) {
      await supabase.from("user_preferences").upsert({
        user_id: user.id,
        theme: theme,
        updated_at: new Date().toISOString(),
      });
    }

    toast({
      title: "Тема изменена",
      description: theme === "liquid-glass" ? "Liquid Glass активирована" : "Neon Cyberpunk активирован",
    });
    
    setSaving(false);
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-primary" />
          Тема оформления
        </CardTitle>
        <CardDescription>
          Выберите визуальный стиль платформы
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {/* Default Theme */}
          <button
            onClick={() => selectTheme("default")}
            disabled={saving}
            className={`group relative p-4 rounded-xl border-2 transition-all ${
              currentTheme === "default" 
                ? "border-primary bg-primary/10" 
                : "border-border hover:border-primary/50"
            }`}
          >
            {currentTheme === "default" && (
              <div className="absolute top-2 right-2">
                <Check className="w-5 h-5 text-primary" />
              </div>
            )}
            <div className="h-20 rounded-lg bg-gradient-to-br from-pink-500 via-purple-600 to-cyan-500 mb-3" />
            <h4 className="font-semibold text-sm">Neon Cyberpunk</h4>
            <p className="text-xs text-muted-foreground">Классическая тема</p>
          </button>

          {/* Liquid Glass Theme */}
          <button
            onClick={() => selectTheme("liquid-glass")}
            disabled={saving}
            className={`group relative p-4 rounded-xl border-2 transition-all ${
              currentTheme === "liquid-glass" 
                ? "border-primary bg-primary/10" 
                : "border-border hover:border-primary/50"
            }`}
          >
            {currentTheme === "liquid-glass" && (
              <div className="absolute top-2 right-2">
                <Check className="w-5 h-5 text-primary" />
              </div>
            )}
            <div className="h-20 rounded-lg relative overflow-hidden mb-3">
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
      </CardContent>
    </Card>
  );
};

export default ProfileThemeSettings;
