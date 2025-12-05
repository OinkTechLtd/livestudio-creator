import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import DevToolsBlocker from "@/components/DevToolsBlocker";
import MobileNavigation from "@/components/MobileNavigation";
import AppSidebar from "@/components/AppSidebar";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import CreateChannel from "./pages/CreateChannel";
import ChannelView from "./pages/ChannelView";
import EmbedPlayer from "./pages/EmbedPlayer";
import PopoutPlayer from "./pages/PopoutPlayer";
import Profile from "./pages/Profile";
import Search from "./pages/Search";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <DevToolsBlocker />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppSidebar />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/create-channel" element={<CreateChannel />} />
            <Route path="/channel/:id" element={<ChannelView />} />
            <Route path="/embed/:id" element={<EmbedPlayer />} />
            <Route path="/popout/:id" element={<PopoutPlayer />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:id" element={<Profile />} />
            <Route path="/search" element={<Search />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <MobileNavigation />
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
