const axios = require("axios");

const KODIK_SEARCH_URL = "https://kodikapi.com/search";
const TOKENS_JSON_URL = "https://github.com/YaNesyTortiK/AnimeParsers/raw/refs/tags/1.15.1/kdk_tokns/tokens.json";
const TOKEN_SOURCES = [
  "https://raw.githubusercontent.com/YaNesyTortiK/AnimeParsers/main/kdk_tokns/tkns.txt",
  "https://raw.githubusercontent.com/YaNesyTortiK/AnimeParsers/main/kdk_tokns/tokens.txt",
  TOKENS_JSON_URL
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

function decryptToken(tkn = "") {
  if (!tkn || tkn.length < 4) return "";

  try {
    const midpoint = Math.floor(tkn.length / 2);
    const p1 = Buffer.from(tkn.slice(0, midpoint).split("").reverse().join(""), "base64").toString("utf-8");
    const p2 = Buffer.from(tkn.slice(midpoint).split("").reverse().join(""), "base64").toString("utf-8");
    return `${p2}${p1}`.trim();
  } catch {
    return "";
  }
}

async function fetchTokenFromSources() {
  for (const source of TOKEN_SOURCES) {
    try {
      const response = await axios.get(source, { timeout: 6000 });
      const raw = response.data;
      let token = "";

      if (source.endsWith("tokens.json")) {
        const payload = typeof raw === "string" ? JSON.parse(raw) : raw;
        const candidate = payload?.stable?.[0]?.tokn || payload?.unstable?.[0]?.tokn || "";
        token = decryptToken(candidate);
      } else {
        token = String(raw || "")
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find((line) => /^[A-Za-z0-9_-]{10,}$/.test(line));
      }

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

function extractEpisodeNumbers(item = {}, fallbackCount = 1) {
  const fromSeasons = [];
  const seasons = item.seasons || {};
  Object.values(seasons).forEach((season) => {
    const episodes = season?.episodes || {};
    Object.keys(episodes).forEach((episode) => {
      const value = Number(episode);
      if (Number.isFinite(value) && value > 0) fromSeasons.push(value);
    });
  });

  const unique = [...new Set(fromSeasons)].sort((a, b) => a - b);
  if (unique.length) return unique;

  const count = Math.max(1, Number(fallbackCount) || 1);
  return Array.from({ length: count }, (_, idx) => idx + 1);
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
    const sources = results
      .map((result) => {
        const source = mapKodikResultToSource(result);
        source.episodeNumbers = extractEpisodeNumbers(result, source.episodesCount);
        return source;
      })
      .filter((item) => item.embedUrl);

    const mergedEpisodes = [...new Set(sources.flatMap((item) => item.episodeNumbers || []))].sort((a, b) => a - b);
    const episodes = (mergedEpisodes.length ? mergedEpisodes : [1]).map((value) => ({
      episode: value,
      name: `Серия ${value}`
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
