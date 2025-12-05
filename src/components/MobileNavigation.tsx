import { Link, useLocation } from "react-router-dom";
import { Home, Tv, Radio, Search, PlusCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

const MobileNavigation = () => {
  const { user } = useAuth();
  const location = useLocation();
  const { t } = useLanguage();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-lg border-t border-border">
      <div className="flex items-center justify-around h-16">
        <Link
          to="/"
          className={cn(
            "flex flex-col items-center gap-1 p-2 transition-colors",
            isActive("/") ? "text-primary" : "text-muted-foreground"
          )}
        >
          <Home className="w-5 h-5" />
          <span className="text-xs">{t("main")}</span>
        </Link>

        <Link
          to="/?tab=tv"
          className={cn(
            "flex flex-col items-center gap-1 p-2 transition-colors",
            location.search.includes("tab=tv") ? "text-primary" : "text-muted-foreground"
          )}
        >
          <Tv className="w-5 h-5" />
          <span className="text-xs">{t("tv")}</span>
        </Link>

        {user && (
          <Link
            to="/create-channel"
            className="flex items-center justify-center -mt-6"
          >
            <div className="w-14 h-14 rounded-full bg-destructive flex items-center justify-center shadow-lg shadow-destructive/50 hover:scale-105 transition-transform">
              <PlusCircle className="w-7 h-7 text-white" />
            </div>
          </Link>
        )}

        <Link
          to="/?tab=radio"
          className={cn(
            "flex flex-col items-center gap-1 p-2 transition-colors",
            location.search.includes("tab=radio") ? "text-secondary" : "text-muted-foreground"
          )}
        >
          <Radio className="w-5 h-5" />
          <span className="text-xs">{t("radio")}</span>
        </Link>

        <Link
          to="/search"
          className={cn(
            "flex flex-col items-center gap-1 p-2 transition-colors",
            isActive("/search") ? "text-accent" : "text-muted-foreground"
          )}
        >
          <Search className="w-5 h-5" />
          <span className="text-xs">{t("search")}</span>
        </Link>
      </div>
    </nav>
  );
};

export default MobileNavigation;
