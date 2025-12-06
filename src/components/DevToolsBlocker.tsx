import { useEffect, useState } from "react";

const DevToolsBlocker = () => {
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    // Skip in iframe (for embed player)
    const isInIframe = window !== window.parent;
    if (isInIframe) return;

    // Skip in development and preview
    if (import.meta.env.DEV) return;
    
    // Skip on Lovable preview domains
    if (window.location.hostname.includes('lovable.app') || 
        window.location.hostname.includes('localhost')) return;

    // Disable right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // Disable keyboard shortcuts for DevTools
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12
      if (e.key === "F12") {
        e.preventDefault();
        return false;
      }
      
      // Ctrl+Shift+I (DevTools)
      if (e.ctrlKey && e.shiftKey && e.key === "I") {
        e.preventDefault();
        return false;
      }
      
      // Ctrl+Shift+J (Console)
      if (e.ctrlKey && e.shiftKey && e.key === "J") {
        e.preventDefault();
        return false;
      }
      
      // Ctrl+Shift+C (Element Inspector)
      if (e.ctrlKey && e.shiftKey && e.key === "C") {
        e.preventDefault();
        return false;
      }
      
      // Ctrl+U (View Source)
      if (e.ctrlKey && e.key === "u") {
        e.preventDefault();
        return false;
      }
      
      // Cmd+Option+I (Mac DevTools)
      if (e.metaKey && e.altKey && e.key === "i") {
        e.preventDefault();
        return false;
      }
      
      // Cmd+Option+J (Mac Console)
      if (e.metaKey && e.altKey && e.key === "j") {
        e.preventDefault();
        return false;
      }
      
      // Cmd+Option+U (Mac View Source)
      if (e.metaKey && e.altKey && e.key === "u") {
        e.preventDefault();
        return false;
      }
    };

    // Detect DevTools opening via size change (more reliable check)
    const detectDevTools = () => {
      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      
      // Also check if window is docked
      const isMinimized = window.outerWidth < 200 || window.outerHeight < 200;
      
      if ((widthThreshold || heightThreshold) && !isMinimized) {
        setIsBlocked(true);
      } else {
        setIsBlocked(false);
      }
    };

    // Disable console methods in production
    if (import.meta.env.PROD) {
      const noop = () => {};
      console.log = noop;
      console.warn = noop;
      console.error = noop;
      console.info = noop;
      console.debug = noop;
    }

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    
    const intervalId = setInterval(detectDevTools, 1000);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      clearInterval(intervalId);
    };
  }, []);

  if (isBlocked) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-destructive mb-4">
            DevTools обнаружены
          </h1>
          <p className="text-muted-foreground">
            Пожалуйста, закройте инструменты разработчика для продолжения.
          </p>
        </div>
      </div>
    );
  }

  return null;
};

export default DevToolsBlocker;
