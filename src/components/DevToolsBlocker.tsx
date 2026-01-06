import { useEffect, useRef } from "react";

const DevToolsBlocker = () => {
  const hasClosedRef = useRef(false);

  useEffect(() => {
    // Skip in iframe (for embed player)
    const isInIframe = window !== window.parent;
    if (isInIframe) return;

    // Skip in development and preview
    if (import.meta.env.DEV) return;
    
    // Skip on Lovable preview domains
    if (window.location.hostname.includes('lovable.app') || 
        window.location.hostname.includes('localhost')) return;

    // Close tab when DevTools detected
    const closeSite = () => {
      if (hasClosedRef.current) return;
      hasClosedRef.current = true;
      
      // Try multiple methods to close
      window.location.href = "about:blank";
      window.open('', '_self');
      window.close();
      
      // If close fails, redirect to blank and freeze
      document.body.innerHTML = '';
      document.head.innerHTML = '';
      while(true) {} // Freeze the page
    };

    // Disable right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    // Disable keyboard shortcuts for DevTools - close on attempt
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12
      if (e.key === "F12") {
        e.preventDefault();
        closeSite();
        return false;
      }
      
      // Ctrl+Shift+I (DevTools)
      if (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i")) {
        e.preventDefault();
        closeSite();
        return false;
      }
      
      // Ctrl+Shift+J (Console)
      if (e.ctrlKey && e.shiftKey && (e.key === "J" || e.key === "j")) {
        e.preventDefault();
        closeSite();
        return false;
      }
      
      // Ctrl+Shift+C (Element Inspector)
      if (e.ctrlKey && e.shiftKey && (e.key === "C" || e.key === "c")) {
        e.preventDefault();
        closeSite();
        return false;
      }
      
      // Ctrl+U (View Source)
      if (e.ctrlKey && (e.key === "u" || e.key === "U")) {
        e.preventDefault();
        closeSite();
        return false;
      }
      
      // Cmd+Option+I (Mac DevTools)
      if (e.metaKey && e.altKey && (e.key === "i" || e.key === "I")) {
        e.preventDefault();
        closeSite();
        return false;
      }
      
      // Cmd+Option+J (Mac Console)
      if (e.metaKey && e.altKey && (e.key === "j" || e.key === "J")) {
        e.preventDefault();
        closeSite();
        return false;
      }
      
      // Cmd+Option+C (Mac Inspect)
      if (e.metaKey && e.altKey && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        closeSite();
        return false;
      }
    };

    // Detect DevTools opening via debugger
    const detectDevTools = () => {
      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      
      const isMinimized = window.outerWidth < 200 || window.outerHeight < 200;
      
      if ((widthThreshold || heightThreshold) && !isMinimized) {
        closeSite();
      }
    };

    // Advanced detection using console.log timing
    const detectByTiming = () => {
      const start = performance.now();
      console.log('%c', 'font-size:0;');
      console.clear();
      const end = performance.now();
      
      if (end - start > 100) {
        closeSite();
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
      console.clear = noop;
    }

    // Prevent debugger statement detection
    setInterval(() => {
      const startTime = new Date().getTime();
      // debugger detection
      const endTime = new Date().getTime();
      if (endTime - startTime > 100) {
        closeSite();
      }
    }, 1000);

    document.addEventListener("contextmenu", handleContextMenu, true);
    document.addEventListener("keydown", handleKeyDown, true);
    
    const sizeIntervalId = setInterval(detectDevTools, 500);
    const timingIntervalId = setInterval(detectByTiming, 2000);

    // Prevent text selection for additional protection
    document.onselectstart = () => false;
    document.ondragstart = () => false;

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      clearInterval(sizeIntervalId);
      clearInterval(timingIntervalId);
    };
  }, []);

  return null;
};

export default DevToolsBlocker;
