import { Link, useLocation } from "react-router-dom";
import { Home, Tv, Radio, Search, PlusCircle, User, Download } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

const MobileNavigation = () => {
  const { user } = useAuth();
  const location = useLocation();
  const { t } = useLanguage();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-lg border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        <Link
          to="/"
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 p-2 transition-colors min-w-0 flex-1",
            isActive("/") ? "text-primary" : "text-muted-foreground"
          )}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] truncate">{t("main")}</span>
        </Link>

        <Link
          to="/?tab=tv"
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 p-2 transition-colors min-w-0 flex-1",
            location.search.includes("tab=tv") ? "text-primary" : "text-muted-foreground"
          )}
        >
          <Tv className="w-5 h-5" />
          <span className="text-[10px] truncate">{t("tv")}</span>
        </Link>

        {user ? (
          <Link
            to="/create-channel"
            className="flex items-center justify-center -mt-5 mx-1"
          >
            <div className="w-12 h-12 rounded-full bg-destructive flex items-center justify-center shadow-lg shadow-destructive/40 hover:scale-105 transition-transform active:scale-95">
              <PlusCircle className="w-6 h-6 text-white" />
            </div>
          </Link>
        ) : (
          <Link
            to="/auth"
            className="flex items-center justify-center -mt-5 mx-1"
          >
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/40 hover:scale-105 transition-transform active:scale-95">
              <User className="w-6 h-6 text-white" />
            </div>
          </Link>
        )}

        <Link
          to="/?tab=radio"
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 p-2 transition-colors min-w-0 flex-1",
            location.search.includes("tab=radio") ? "text-secondary" : "text-muted-foreground"
          )}
        >
          <Radio className="w-5 h-5" />
          <span className="text-[10px] truncate">{t("radio")}</span>
        </Link>

        <Link
          to="/search"
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 p-2 transition-colors min-w-0 flex-1",
            isActive("/search") ? "text-accent" : "text-muted-foreground"
          )}
        >
          <Search className="w-5 h-5" />
          <span className="text-[10px] truncate">{t("search")}</span>
        </Link>
      </div>
    </nav>
  );
};

export default MobileNavigation;
