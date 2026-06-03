import { CardData } from "./types";

export type YgoCardImage = {
  id: number;
  image_url: string;
  image_url_small: string;
  image_url_cropped: string;
};

export type YgoCardInfo = {
  id: number;
  name: string;
  type: string;
  desc: string;
  race?: string;
  attribute?: string;
  level?: number;
  atk?: number;
  def?: number;
  archetype?: string;
  card_images?: YgoCardImage[];
};

const cardInfoCache = new Map<string, Promise<YgoCardInfo | null>>();

export function getLookupName(card: CardData) {
  return card.apiName ?? card.name;
}

export function getCardImageUrl(card: CardData, size: "small" | "full" | "cropped" = "small") {
  if (!card.apiId) return undefined;

  const folder = size === "full" ? "cards" : size === "cropped" ? "cards_cropped" : "cards_small";
  return `https://images.ygoprodeck.com/images/${folder}/${card.apiId}.jpg`;
}

export function fetchYgoCardInfo(card: CardData, signal?: AbortSignal) {
  const lookupName = getLookupName(card);
  const cacheKey = lookupName.toLowerCase();
  const cached = cardInfoCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const request = fetch(
    `https://db.ygoprodeck.com/api/v7/cardinfo.php?name=${encodeURIComponent(lookupName)}`,
    { signal },
  )
    .then((response) => {
      if (!response.ok) return null;
      return response.json() as Promise<{ data?: YgoCardInfo[] }>;
    })
    .then((payload) => payload?.data?.[0] ?? null)
    .catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }

      return null;
    });

  cardInfoCache.set(cacheKey, request);
  return request;
}
