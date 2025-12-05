import { Link, useLocation } from "react-router-dom";
import { Home, Tv, Radio, Search, User, Settings, PlusCircle, TrendingUp, Menu, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const AppSidebar = () => {
  const { user } = useAuth();
  const location = useLocation();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const menuItems = [
    { icon: Home, label: t("main"), path: "/" },
    { icon: TrendingUp, label: t("trending") || "Популярные", path: "/?tab=trending" },
    { icon: Tv, label: t("tv"), path: "/?tab=tv" },
    { icon: Radio, label: t("radio"), path: "/?tab=radio" },
    { icon: Search, label: t("search"), path: "/search" },
  ];

  const userItems = user ? [
    { icon: PlusCircle, label: t("create_channel"), path: "/create-channel" },
    { icon: User, label: t("profile"), path: "/profile" },
  ] : [];

  return (
    <>
      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-20 left-4 z-40 hidden md:flex bg-background/80 backdrop-blur-sm border border-border"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </Button>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-16 left-0 h-[calc(100vh-4rem)] bg-background/95 backdrop-blur-lg border-r border-border z-30 transition-all duration-300 hidden md:block",
          isOpen ? "w-64" : "w-0 overflow-hidden"
        )}
      >
        <div className="flex flex-col h-full py-6 px-4">
          <nav className="space-y-2">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-all",
                  isActive(item.path) || location.search.includes(item.path.split("=")[1] || "none")
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </nav>

          {userItems.length > 0 && (
            <>
              <div className="my-4 border-t border-border" />
              <nav className="space-y-2">
                {userItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg transition-all",
                      isActive(item.path)
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                ))}
              </nav>
            </>
          )}
        </div>
      </aside>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 hidden md:block"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default AppSidebar;
