import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tv, Radio, LogOut, User, PlusCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const Header = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-lg">
      <div className="container flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Tv className="w-8 h-8 text-primary" />
            <h1 className="text-2xl font-display font-bold neon-text-primary">
              StreamLiveTV
            </h1>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link
            to="/?tab=tv"
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary"
          >
            <Tv className="w-4 h-4" />
            ТВ Каналы
          </Link>
          <Link
            to="/?tab=radio"
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-secondary"
          >
            <Radio className="w-4 h-4" />
            Радио
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <Button
                onClick={() => navigate("/create-channel")}
                variant="default"
                className="hidden md:flex items-center gap-2"
              >
                <PlusCircle className="w-4 h-4" />
                Создать канал
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10 border-2 border-primary/50">
                      <AvatarImage src={user.user_metadata?.avatar_url} />
                      <AvatarFallback className="bg-primary/20">
                        {user.email?.[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 glass-strong">
                  <DropdownMenuItem onClick={() => navigate("/profile")}>
                    <User className="mr-2 h-4 w-4" />
                    <span>Профиль</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/create-channel")} className="md:hidden">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    <span>Создать канал</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Выйти</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button onClick={() => navigate("/auth")} variant="default">
              Войти
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;