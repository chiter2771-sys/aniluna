const axios = require("axios");

const KODIK_SEARCH_URL = "https://kodikapi.com/search";
const TOKEN_SOURCES = [
  "https://raw.githubusercontent.com/YaNesyTortiK/AnimeParsers/main/kdk_tokns/tkns.txt",
  "https://raw.githubusercontent.com/YaNesyTortiK/AnimeParsers/main/kdk_tokns/tokens.txt"
];

const parserCache = {
  token: process.env.KODIK_TOKEN || "",
  tokenFetchedAt: 0,
  byShiki: new Map()
};

function normalizeUrl(url = "") {
  if (!url) return "";
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

async function fetchTokenFromSources() {
  for (const source of TOKEN_SOURCES) {
    try {
      const response = await axios.get(source, { timeout: 6000 });
      const raw = String(response.data || "");
      const token = raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => /^[A-Za-z0-9_-]{10,}$/.test(line));

      if (token) return token;
    } catch {
      // noop
    }
  }

  return "";
}

async function getKodikToken() {
  if (process.env.KODIK_TOKEN) return process.env.KODIK_TOKEN;

  const isFresh = parserCache.token && Date.now() - parserCache.tokenFetchedAt < 1000 * 60 * 30;
  if (isFresh) return parserCache.token;

  const fetched = await fetchTokenFromSources();
  if (fetched) {
    parserCache.token = fetched;
    parserCache.tokenFetchedAt = Date.now();
  }

  return parserCache.token;
}

function mapKodikResultToSource(item = {}) {
  const translation = item.translation?.title || item.translation?.type || "Озвучка";
  const episodesCount = Number(item.last_episode || item.last_season_episode || 0) || 1;
  const baseLink = normalizeUrl(item.link);
  const hasQuery = baseLink.includes("?");
  const separator = hasQuery ? "&" : "?";
  const episodeTemplate = baseLink ? `${baseLink}${separator}episode={episode}` : "";

  return {
    id: item.id || item.shikimori_id,
    translationId: item.translation?.id || null,
    label: translation,
    kind: "episode",
    translation,
    episodesCount,
    embedUrl: baseLink,
    episodeTemplate,
    directUrl: "",
    quality: item.quality || "auto"
  };
}

async function searchByShikimoriId(shikimoriId) {
  const cacheKey = String(shikimoriId);
  if (parserCache.byShiki.has(cacheKey)) return parserCache.byShiki.get(cacheKey);

  const token = await getKodikToken();
  if (!token) {
    return { ok: false, reason: "missing_token", sources: [], episodes: [] };
  }

  try {
    const response = await axios.get(KODIK_SEARCH_URL, {
      params: {
        token,
        with_material_data: true,
        shikimori_id: shikimoriId
      },
      timeout: 10000
    });

    const results = response.data?.results || [];
    const sources = results.map(mapKodikResultToSource).filter((item) => item.embedUrl);
    const maxEpisodes = Math.max(1, ...sources.map((item) => item.episodesCount || 1));

    const episodes = Array.from({ length: maxEpisodes }, (_, idx) => ({
      episode: idx + 1,
      name: `Серия ${idx + 1}`
    }));

    const payload = { ok: true, tokenUsed: token.slice(0, 4), sources, episodes };
    parserCache.byShiki.set(cacheKey, payload);
    return payload;
  } catch (error) {
    return { ok: false, reason: "kodik_unavailable", error: error.message, sources: [], episodes: [] };
  }
}

module.exports = {
  getKodikToken,
  searchByShikimoriId
};
