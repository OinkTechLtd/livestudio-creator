import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// In-memory cache for availability checks
const availabilityCache = new Map<string, { available: boolean; checkedAt: number }>();
const CACHE_TTL_MS = 300000; // 5 minutes

// CORS proxy list for fallback
const CORS_PROXIES = [
  "https://api.allorigins.win/raw?url=",
  "https://corsproxy.io/?",
  "https://api.codetabs.com/v1/proxy?quest=",
];

// User agents for bypassing restrictions
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

async function checkAvailability(url: string): Promise<{ available: boolean; status?: number; error?: string }> {
  const cached = availabilityCache.get(url);
  if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
    return { available: cached.available };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9,ru;q=0.8",
      },
    });

    clearTimeout(timeoutId);
    
    // Consider 2xx and 3xx as available
    const available = response.status >= 200 && response.status < 400;
    
    availabilityCache.set(url, { available, checkedAt: Date.now() });
    return { available, status: response.status };
  } catch (error: any) {
    // Try with GET request (some servers don't support HEAD)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "User-Agent": USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
          "Range": "bytes=0-1024", // Only get first 1KB
        },
      });

      clearTimeout(timeoutId);
      const available = response.status >= 200 && response.status < 400;
      
      availabilityCache.set(url, { available, checkedAt: Date.now() });
      return { available, status: response.status };
    } catch {
      availabilityCache.set(url, { available: false, checkedAt: Date.now() });
      return { available: false, error: error.message };
    }
  }
}

async function proxyContent(url: string): Promise<Response> {
  const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

  // First, try direct fetch
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9,ru;q=0.8",
        "Referer": new URL(url).origin,
        "Origin": new URL(url).origin,
      },
    });

    if (response.ok) {
      const contentType = response.headers.get("Content-Type") || "application/octet-stream";
      const body = await response.arrayBuffer();

      return new Response(body, {
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=300",
          "X-Proxy-Status": "direct",
        },
      });
    }
  } catch (directError) {
    console.log("Direct fetch failed, trying CORS proxies:", directError);
  }

  // Try CORS proxies as fallback
  for (const proxy of CORS_PROXIES) {
    try {
      const proxyUrl = proxy + encodeURIComponent(url);
      const response = await fetch(proxyUrl, {
        headers: {
          "User-Agent": userAgent,
        },
      });

      if (response.ok) {
        const contentType = response.headers.get("Content-Type") || "application/octet-stream";
        const body = await response.arrayBuffer();

        return new Response(body, {
          headers: {
            ...corsHeaders,
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=300",
            "X-Proxy-Status": "cors-proxy",
            "X-Proxy-Used": proxy,
          },
        });
      }
    } catch (proxyError) {
      console.log(`Proxy ${proxy} failed:`, proxyError);
    }
  }

  throw new Error("All proxy methods failed");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, action } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: check availability only
    if (action === "check") {
      const result = await checkAvailability(url);
      return new Response(
        JSON.stringify({ 
          available: result.available, 
          url,
          status: result.status,
          error: result.error,
          cached: availabilityCache.has(url),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: get proxied URL (return URL for client to use)
    if (action === "getProxyUrl") {
      // Return the best working proxy URL
      const proxyUrl = `${CORS_PROXIES[0]}${encodeURIComponent(url)}`;
      return new Response(
        JSON.stringify({ 
          proxyUrl,
          originalUrl: url,
          proxies: CORS_PROXIES.map(p => p + encodeURIComponent(url)),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default: proxy the content
    console.log("Proxying URL:", url);
    return await proxyContent(url);

  } catch (error: any) {
    console.error("Proxy error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        hint: "Попробуйте использовать другой источник или отключите прокси",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
