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

const normalizeForDuplicateKey = (value: string | null | undefined) =>
  normalize(value)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const LOW_QUALITY_DESCRIPTIONS = new Set([
  "да",
  "ага",
  "yes",
  "ok",
  "...",
  ".",
  "-",
]);

const LOW_QUALITY_TITLES = new Set([
  "канал",
  "channel",
  "test",
  "тест",
]);

const JUNK_DISCOVERY_KEYWORDS = [
  "spam",
  "scam",
  "скам",
  "мусор",
  "фейк",
  "fake",
  "дубликат",
  "clone",
  "клон",
  "накрут",
  "казино",
  "ставк",
  "18+",
  "xxx",
  "porn",
  "порно",
  "ебан",
  "долбо",
  "хз",
  "лохотр",
  "обман",
  "развод",
  "crypto",
  "крипт",
  "pump",
  "dump",
];

export const BLOCKED_CHANNEL_TEXT = "Данный канал был заблокирован за нарушение правил платформы.";

export const isOfficialProtectedAccount = (username: string | null | undefined) => {
  const normalized = normalize(username);
  return PROTECTED_BRAND_NAMES.some((brand) => normalized === brand);
};

const hasProtectedBrandMention = (...parts: Array<string | null | undefined>) => {
  const text = normalize(parts.filter(Boolean).join(" "));
  return PROTECTED_BRAND_NAMES.some((brand) => text.includes(brand));
};

const normalizeUsernameForBrandCheck = (username: string | null | undefined) => {
  return normalize(username).replace(/[^\p{L}\p{N}]+/gu, "");
};

const isSuspiciousBrandUsername = (username: string | null | undefined) => {
  const normalized = normalizeUsernameForBrandCheck(username);
  if (!normalized) return false;

  return PROTECTED_BRAND_NAMES.some((brand) => normalized.includes(brand) && normalized !== brand);
};

export const hasDuplicateModerationReason = (hiddenReason: string | null | undefined) => {
  const normalized = normalize(hiddenReason);
  return DUPLICATE_REASON_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

export const hasBlockedModerationReason = (hiddenReason: string | null | undefined) => {
  const normalized = normalize(hiddenReason);
  return DUPLICATE_REASON_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

const hasSuspiciousLowEffortText = (title?: string | null, description?: string | null) => {
  const normalizedTitle = normalize(title);
  const normalizedDescription = normalize(description);

  const hasLowQualityDescription = LOW_QUALITY_DESCRIPTIONS.has(normalizedDescription);
  const hasLowQualityTitle = LOW_QUALITY_TITLES.has(normalizedTitle);

  return hasLowQualityDescription || (hasLowQualityTitle && normalizedDescription.length <= 8);
};

const hasJunkDiscoveryKeyword = (...parts: Array<string | null | undefined>) => {
  const normalized = normalize(parts.filter(Boolean).join(" "));
  if (!normalized) return false;
  return JUNK_DISCOVERY_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

interface DiscoveryCensorshipInput {
  username?: string | null;
  title?: string | null;
  description?: string | null;
  isHidden?: boolean | null;
  hiddenReason?: string | null;
}



export const getDiscoveryCensorshipReason = ({
  username,
  title,
  description,
  isHidden,
  hiddenReason,
}: DiscoveryCensorshipInput) => {
  if (isOfficialProtectedAccount(username)) {
    return null;
  }

  if (isHidden && hasDuplicateModerationReason(hiddenReason)) {
    return hiddenReason || "Дубликат или выдача себя за другой канал";
  }

  if (hasBlockedModerationReason(hiddenReason)) {
    return hiddenReason || "Канал скрыт модерацией";
  }

  if (isSuspiciousBrandUsername(username)) {
    return "Канал выглядит как дубликат защищённого бренда";
  }

  if (hasSuspiciousLowEffortText(title, description)) {
    return "Низкокачественное или пустое описание канала";
  }

  if (hasJunkDiscoveryKeyword(username, title, description, hiddenReason)) {
    return "Канал отфильтрован как мусорный по ключевым словам";
  }

  return null;
};
export const shouldCensorChannelFromDiscovery = (input: DiscoveryCensorshipInput) => {
  return Boolean(getDiscoveryCensorshipReason(input));
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
  const suspiciousUsername = isSuspiciousBrandUsername(username);

  if (!mentionsProtectedBrand && !suspiciousUsername) {
    return false;
  }

  return !isOfficialProtectedAccount(username);
};

interface DeduplicateInput {
  id: string;
  title?: string | null;
  channel_type?: string | null;
  viewer_count?: number | null;
  username?: string | null;
  profiles?: {
    username?: string | null;
  } | null;
}

const getChannelUsername = <T extends DeduplicateInput>(channel: T) => {
  return channel.username ?? channel.profiles?.username ?? null;
};

const shouldCurrentChannelWin = <T extends DeduplicateInput>(current: T, existing: T) => {
  const currentIsOfficial = isOfficialProtectedAccount(getChannelUsername(current));
  const existingIsOfficial = isOfficialProtectedAccount(getChannelUsername(existing));

  if (currentIsOfficial !== existingIsOfficial) {
    return currentIsOfficial;
  }

  const currentViewerCount = current.viewer_count || 0;
  const existingViewerCount = existing.viewer_count || 0;
  return currentViewerCount > existingViewerCount;
};

export const deduplicateChannelsByTitle = <T extends DeduplicateInput>(channels: T[]): T[] => {
  const winners = new Map<string, T>();

  for (const channel of channels) {
    const titleKey = normalizeForDuplicateKey(channel.title);
    if (!titleKey) {
      continue;
    }

    const key = `${titleKey}|${normalize(channel.channel_type)}`;
    const existing = winners.get(key);
    if (!existing) {
      winners.set(key, channel);
      continue;
    }

    if (shouldCurrentChannelWin(channel, existing)) {
      winners.set(key, channel);
    }
  }

  return Array.from(winners.values());
};
