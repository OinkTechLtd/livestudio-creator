import { useState, useEffect, useCallback } from "react";

const CONSENT_KEY = "shorts_data_consent";
const VIEW_HISTORY_KEY = "shorts_view_history";
const SEARCH_HISTORY_KEY = "shorts_search_history";
const INTERESTS_KEY = "shorts_interest_tags";
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

const splitToTokens = (value: string) =>
  value
    .toLowerCase()
    .split(/[\s,.;:!?()\[\]{}"'`~@#$%^&*+=|\\/<>\-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

const normalizeInterestTag = (value: string) =>
  value
    .toLowerCase()
    .replace(/[\s_\-]+/g, " ")
    .trim();

const withUserScope = (baseKey: string, userId?: string | null) => (userId ? `${baseKey}:${userId}` : baseKey);

export function useShortsRecommendations(userId?: string | null) {
  const [consentGiven, setConsentGiven] = useState<boolean | null>(null);
  const [showConsentBanner, setShowConsentBanner] = useState(false);
  const [interestTags, setInterestTags] = useState<string[]>([]);

  useEffect(() => {
    const scopedConsentKey = withUserScope(CONSENT_KEY, userId);
    const scopedInterestsKey = withUserScope(INTERESTS_KEY, userId);
    const stored = localStorage.getItem(scopedConsentKey);
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

    try {
      const rawInterests = localStorage.getItem(scopedInterestsKey);
      if (rawInterests) {
        const parsed = JSON.parse(rawInterests);
        if (Array.isArray(parsed)) {
          setInterestTags(parsed.filter((item) => typeof item === "string"));
        }
      }
    } catch {
      // silently fail
    }
  }, [userId]);

  const acceptConsent = useCallback(() => {
    localStorage.setItem(withUserScope(CONSENT_KEY, userId), "true");
    setConsentGiven(true);
    setShowConsentBanner(false);
  }, [userId]);

  const declineConsent = useCallback(() => {
    localStorage.setItem(withUserScope(CONSENT_KEY, userId), "false");
    setConsentGiven(false);
    setShowConsentBanner(false);
    // Clear any existing data
    localStorage.removeItem(withUserScope(VIEW_HISTORY_KEY, userId));
    localStorage.removeItem(withUserScope(SEARCH_HISTORY_KEY, userId));
    localStorage.removeItem(withUserScope(INTERESTS_KEY, userId));
    setInterestTags([]);
  }, [userId]);

  const saveInterestTags = useCallback((tags: string[]) => {
    const cleaned = Array.from(new Set(tags.map((tag) => normalizeInterestTag(tag)).filter((tag) => tag.length >= 2))).slice(0, 20);
    setInterestTags(cleaned);
    try {
      localStorage.setItem(withUserScope(INTERESTS_KEY, userId), JSON.stringify(cleaned));
    } catch {
      // silently fail
    }
  }, [userId]);

  const clearRecommendationProfile = useCallback(() => {
    try {
      localStorage.removeItem(withUserScope(VIEW_HISTORY_KEY, userId));
      localStorage.removeItem(withUserScope(SEARCH_HISTORY_KEY, userId));
      localStorage.removeItem(withUserScope(INTERESTS_KEY, userId));
    } catch {
      // silently fail
    }
    setInterestTags([]);
  }, [userId]);

  const trackView = useCallback(
    (channelId: string, categoryId: string | null, channelType: "tv" | "radio", title: string) => {
      if (!consentGiven) return;
      try {
        const raw = localStorage.getItem(withUserScope(VIEW_HISTORY_KEY, userId));
        const history: ViewEntry[] = raw ? JSON.parse(raw) : [];
        history.push({ channelId, categoryId, channelType, title, ts: Date.now() });
        // Keep only last MAX_HISTORY entries
        const trimmed = history.slice(-MAX_HISTORY);
        localStorage.setItem(withUserScope(VIEW_HISTORY_KEY, userId), JSON.stringify(trimmed));
      } catch {
        // silently fail
      }
    },
    [consentGiven, userId]
  );

  const trackSearch = useCallback(
    (query: string) => {
      if (!consentGiven) return;
      try {
        const raw = localStorage.getItem(withUserScope(SEARCH_HISTORY_KEY, userId));
        const history: SearchEntry[] = raw ? JSON.parse(raw) : [];
        history.push({ query: query.toLowerCase().trim(), ts: Date.now() });
        const trimmed = history.slice(-MAX_HISTORY);
        localStorage.setItem(withUserScope(SEARCH_HISTORY_KEY, userId), JSON.stringify(trimmed));
      } catch {
        // silently fail
      }
    },
    [consentGiven, userId]
  );

  /**
   * Score channels based on user history.
   * Higher score = more relevant.
   */
  const scoreChannel = useCallback(
    (channel: { id: string; title: string; description: string | null; category_id: string | null; channel_type: "tv" | "radio" }): number => {
      let score = 0;

      const canUseBehavioralSignals = consentGiven === true;

      try {
        const now = Date.now();
        const titleLower = (channel.title || "").toLowerCase();
        const descLower = (channel.description || "").toLowerCase();

        if (canUseBehavioralSignals) {
          // Category match from view history
          const viewRaw = localStorage.getItem(withUserScope(VIEW_HISTORY_KEY, userId));
          const viewHistory: ViewEntry[] = viewRaw ? JSON.parse(viewRaw) : [];

          // Count category appearances (more recent = higher weight)
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
          const searchRaw = localStorage.getItem(withUserScope(SEARCH_HISTORY_KEY, userId));
          const searchHistory: SearchEntry[] = searchRaw ? JSON.parse(searchRaw) : [];

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
        }

        if (interestTags.length > 0) {
          const normalizedContent = `${channel.title || ""} ${channel.description || ""}`.toLowerCase();
          const contentTokens = new Set(splitToTokens(normalizedContent));
          for (const tag of interestTags) {
            const normalizedTag = normalizeInterestTag(tag);
            const tagTokens = splitToTokens(normalizedTag);

            const hasTokenMatch = tagTokens.some((token) =>
              Array.from(contentTokens).some((contentToken) => contentToken.includes(token) || token.includes(contentToken))
            );
            const hasPhraseMatch = normalizedTag.length >= 3 && normalizedContent.includes(normalizedTag);

            if (hasTokenMatch || hasPhraseMatch) {
              score += 15;
            }
          }
        }
      } catch {
        // silently fail
      }

      return score;
    },
    [consentGiven, interestTags, userId]
  );

  return {
    consentGiven,
    showConsentBanner,
    acceptConsent,
    declineConsent,
    trackView,
    trackSearch,
    scoreChannel,
    interestTags,
    saveInterestTags,
    clearRecommendationProfile,
  };
}
