import { Link, useLocation } from "react-router-dom";
import { Home, Tv, Radio, Search, PlusCircle, User, Globe, Play } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const MobileNavigation = () => {
  const { user } = useAuth();
  const location = useLocation();
  const { t, language, setLanguage, availableLanguages } = useLanguage();

  const isActive = (path: string) => location.pathname === path;

  // Don't show navigation on Shorts page (fullscreen experience)
  if (location.pathname === "/shorts") {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-lg border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-1">
        <Link
          to="/"
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 p-1.5 transition-colors min-w-0",
            isActive("/") && !location.search ? "text-primary" : "text-muted-foreground"
          )}
        >
          <Home className="w-5 h-5" />
          <span className="text-[9px] truncate">{t("main")}</span>
        </Link>

        <Link
          to="/shorts"
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 p-1.5 transition-colors min-w-0",
            isActive("/shorts") ? "text-destructive" : "text-muted-foreground"
          )}
        >
          <Play className="w-5 h-5" />
          <span className="text-[9px] truncate">Shorts</span>
        </Link>

        {user ? (
          <Link
            to="/create-channel"
            className="flex items-center justify-center -mt-4"
          >
            <div className="w-11 h-11 rounded-full bg-destructive flex items-center justify-center shadow-lg shadow-destructive/40 hover:scale-105 transition-transform active:scale-95">
              <PlusCircle className="w-5 h-5 text-destructive-foreground" />
            </div>
          </Link>
        ) : (
          <Link
            to="/auth"
            className="flex items-center justify-center -mt-4"
          >
            <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/40 hover:scale-105 transition-transform active:scale-95">
              <User className="w-5 h-5 text-primary-foreground" />
            </div>
          </Link>
        )}

        <Link
          to="/browse"
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 p-1.5 transition-colors min-w-0",
            isActive("/browse") ? "text-primary" : "text-muted-foreground"
          )}
        >
          <Tv className="w-5 h-5" />
          <span className="text-[9px] truncate">Каналы</span>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex flex-col items-center justify-center gap-0.5 p-1.5 transition-colors min-w-0 text-muted-foreground">
              <Globe className="w-5 h-5" />
              <span className="text-[9px] truncate">{language.toUpperCase()}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="mb-2">
            {availableLanguages.map((lang) => (
              <DropdownMenuItem
                key={lang.code}
                onClick={() => setLanguage(lang.code as any)}
                className={cn(
                  "cursor-pointer",
                  language === lang.code && "bg-primary/10 text-primary"
                )}
              >
                {lang.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
};

export default MobileNavigation;
