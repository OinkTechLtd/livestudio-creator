const PROTECTED_BRAND_NAMES = ["twixoff", "oinktech"] as const;

const DUPLICATE_REASON_KEYWORDS = [
  "duplicate",
  "дубликат",
  "fake",
  "фейк",
  "imperson",
  "поддел",
  "клон",
  "копи",
  "мусор",
  "спам",
  "spam",
  "scam",
  "скам",
];

const normalize = (value: string | null | undefined) => (value || "").trim().toLowerCase();

export const BLOCKED_CHANNEL_TEXT = "Данный канал был заблокирован за нарушение правил платформы.";

export const isOfficialProtectedAccount = (username: string | null | undefined) => {
  const normalized = normalize(username);
  return PROTECTED_BRAND_NAMES.some((brand) => normalized === brand);
};

const hasProtectedBrandMention = (...parts: Array<string | null | undefined>) => {
  const text = normalize(parts.filter(Boolean).join(" "));
  return PROTECTED_BRAND_NAMES.some((brand) => text.includes(brand));
};

export const hasDuplicateModerationReason = (hiddenReason: string | null | undefined) => {
  const normalized = normalize(hiddenReason);
  return DUPLICATE_REASON_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

export const hasBlockedModerationReason = (hiddenReason: string | null | undefined) => {
  const normalized = normalize(hiddenReason);
  return DUPLICATE_REASON_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

interface DuplicateGuardInput {
  username?: string | null;
  title?: string | null;
  description?: string | null;
  isHidden?: boolean | null;
  hiddenReason?: string | null;
}

export const isBlockedDuplicateChannel = ({
  username,
  title,
  description,
  isHidden,
  hiddenReason,
}: DuplicateGuardInput) => {
  if (isHidden && hasDuplicateModerationReason(hiddenReason)) {
    return true;
  }

  const mentionsProtectedBrand = hasProtectedBrandMention(username, title, description);
  if (!mentionsProtectedBrand) {
    return false;
  }

  return !isOfficialProtectedAccount(username);
};

interface DeduplicateInput {
  id: string;
  title?: string | null;
  channel_type?: string | null;
  viewer_count?: number | null;
}

export const deduplicateChannelsByTitle = <T extends DeduplicateInput>(channels: T[]): T[] => {
  const winners = new Map<string, T>();

  for (const channel of channels) {
    const key = `${normalize(channel.title)}|${normalize(channel.channel_type)}`;
    const existing = winners.get(key);
    if (!existing) {
      winners.set(key, channel);
      continue;
    }

    const currentViewerCount = channel.viewer_count || 0;
    const existingViewerCount = existing.viewer_count || 0;
    if (currentViewerCount > existingViewerCount) {
      winners.set(key, channel);
    }
  }

  return Array.from(winners.values());
};
