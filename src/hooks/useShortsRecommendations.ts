import { useState, useEffect, useCallback } from "react";

const CONSENT_KEY = "shorts_data_consent";
const VIEW_HISTORY_KEY = "shorts_view_history";
const SEARCH_HISTORY_KEY = "shorts_search_history";
const MAX_HISTORY = 200;

interface ViewEntry {
  channelId: string;
  categoryId: string | null;
  channelType: "tv" | "radio";
  title: string;
  ts: number;
}

interface SearchEntry {
  query: string;
  ts: number;
}

export function useShortsRecommendations() {
  const [consentGiven, setConsentGiven] = useState<boolean | null>(null);
  const [showConsentBanner, setShowConsentBanner] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (stored === "true") {
      setConsentGiven(true);
      setShowConsentBanner(false);
    } else if (stored === "false") {
      setConsentGiven(false);
      setShowConsentBanner(false);
    } else {
      // Not decided yet
      setConsentGiven(null);
      setShowConsentBanner(true);
    }
  }, []);

  const acceptConsent = useCallback(() => {
    localStorage.setItem(CONSENT_KEY, "true");
    setConsentGiven(true);
    setShowConsentBanner(false);
  }, []);

  const declineConsent = useCallback(() => {
    localStorage.setItem(CONSENT_KEY, "false");
    setConsentGiven(false);
    setShowConsentBanner(false);
    // Clear any existing data
    localStorage.removeItem(VIEW_HISTORY_KEY);
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  }, []);

  const trackView = useCallback(
    (channelId: string, categoryId: string | null, channelType: "tv" | "radio", title: string) => {
      if (!consentGiven) return;
      try {
        const raw = localStorage.getItem(VIEW_HISTORY_KEY);
        const history: ViewEntry[] = raw ? JSON.parse(raw) : [];
        history.push({ channelId, categoryId, channelType, title, ts: Date.now() });
        // Keep only last MAX_HISTORY entries
        const trimmed = history.slice(-MAX_HISTORY);
        localStorage.setItem(VIEW_HISTORY_KEY, JSON.stringify(trimmed));
      } catch {
        // silently fail
      }
    },
    [consentGiven]
  );

  const trackSearch = useCallback(
    (query: string) => {
      if (!consentGiven) return;
      try {
        const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
        const history: SearchEntry[] = raw ? JSON.parse(raw) : [];
        history.push({ query: query.toLowerCase().trim(), ts: Date.now() });
        const trimmed = history.slice(-MAX_HISTORY);
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(trimmed));
      } catch {
        // silently fail
      }
    },
    [consentGiven]
  );

  /**
   * Score channels based on user history.
   * Higher score = more relevant.
   */
  const scoreChannel = useCallback(
    (channel: { id: string; title: string; description: string | null; category_id: string | null; channel_type: "tv" | "radio" }): number => {
      if (!consentGiven) return 0;

      let score = 0;

      try {
        // Category match from view history
        const viewRaw = localStorage.getItem(VIEW_HISTORY_KEY);
        const viewHistory: ViewEntry[] = viewRaw ? JSON.parse(viewRaw) : [];

        // Count category appearances (more recent = higher weight)
        const now = Date.now();
        for (const entry of viewHistory) {
          if (entry.categoryId && entry.categoryId === channel.category_id) {
            // Recency weight: last 24h = 3x, last week = 2x, older = 1x
            const ageHours = (now - entry.ts) / (1000 * 60 * 60);
            if (ageHours < 24) score += 3;
            else if (ageHours < 168) score += 2;
            else score += 1;
          }
          // Same channel type preference
          if (entry.channelType === channel.channel_type) {
            score += 0.5;
          }
        }

        // Search keyword match
        const searchRaw = localStorage.getItem(SEARCH_HISTORY_KEY);
        const searchHistory: SearchEntry[] = searchRaw ? JSON.parse(searchRaw) : [];
        const titleLower = (channel.title || "").toLowerCase();
        const descLower = (channel.description || "").toLowerCase();

        for (const entry of searchHistory) {
          const q = entry.query;
          if (q.length < 2) continue;
          if (titleLower.includes(q) || descLower.includes(q)) {
            const ageHours = (now - entry.ts) / (1000 * 60 * 60);
            if (ageHours < 24) score += 5;
            else if (ageHours < 168) score += 3;
            else score += 1;
          }
        }
      } catch {
        // silently fail
      }

      return score;
    },
    [consentGiven]
  );

  return {
    consentGiven,
    showConsentBanner,
    acceptConsent,
    declineConsent,
    trackView,
    trackSearch,
    scoreChannel,
  };
}
