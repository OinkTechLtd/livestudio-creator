import { useEffect } from "react";

const DevToolsBlocker = () => {
  useEffect(() => {
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

    // Detect DevTools opening via size change
    const detectDevTools = () => {
      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      
      if (widthThreshold || heightThreshold) {
        document.body.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100vh;background:#0a0a0a;color:#ff0066;font-family:Orbitron,sans-serif;font-size:24px;text-align:center;padding:20px;">DevTools обнаружены. Пожалуйста, закройте их.</div>';
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

    // Add debugger trap
    const debuggerTrap = () => {
      const start = performance.now();
      debugger;
      const end = performance.now();
      if (end - start > 100) {
        document.body.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100vh;background:#0a0a0a;color:#ff0066;font-family:Orbitron,sans-serif;font-size:24px;text-align:center;padding:20px;">Debugger обнаружен. Пожалуйста, закройте DevTools.</div>';
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    
    const intervalId = setInterval(detectDevTools, 1000);
    
    // Run debugger trap periodically in production
    let debugInterval: NodeJS.Timeout | null = null;
    if (import.meta.env.PROD) {
      debugInterval = setInterval(debuggerTrap, 5000);
    }

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      clearInterval(intervalId);
      if (debugInterval) {
        clearInterval(debugInterval);
      }
    };
  }, []);

  return null;
};

export default DevToolsBlocker;
