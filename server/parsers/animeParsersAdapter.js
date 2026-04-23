const axios = require("axios");
const cheerio = require("cheerio");

const KODIK_API_BASE = "https://kodikapi.com";
const TOKEN_SOURCES = [
  "https://raw.githubusercontent.com/YaNesyTortiK/AnimeParsers/main/kdk_tokns/tkns.txt",
  "https://raw.githubusercontent.com/YaNesyTortiK/AnimeParsers/main/kdk_tokns/tokens.txt",
  "https://github.com/YaNesyTortiK/AnimeParsers/raw/refs/tags/1.15.1/kdk_tokns/tokens.json"
];

const parserCache = {
  token: process.env.KODIK_TOKEN || "",
  tokenFetchedAt: 0,
  byShiki: new Map(),
  streamByKey: new Map()
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

function parseTokensFromRaw(raw = "") {
  return String(raw || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[A-Za-z0-9_-]{10,}$/.test(line));
}

async function fetchTokenFromSources() {
  for (const source of TOKEN_SOURCES) {
    try {
      const response = await axios.get(source, { timeout: 7000 });
      const raw = response.data;

      if (source.endsWith("tokens.json")) {
        const payload = typeof raw === "string" ? JSON.parse(raw) : raw;
        const encrypted = [
          ...(payload?.stable || []).map((item) => item?.tokn),
          ...(payload?.unstable || []).map((item) => item?.tokn)
        ].filter(Boolean);

        for (const encryptedToken of encrypted) {
          const token = decryptToken(encryptedToken);
          if (token) return token;
        }
      } else {
        const tokens = parseTokensFromRaw(raw);
        if (tokens.length) return tokens[0];
      }
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

function mapKodikResultToSource(item = {}) {
  const translation = item.translation?.title || item.translation?.type || "Озвучка";
  const episodesCount = Number(item.last_episode || item.last_season_episode || 0) || 1;
  const baseLink = normalizeUrl(item.link);
  const hasQuery = baseLink.includes("?");
  const separator = hasQuery ? "&" : "?";

  return {
    id: item.id || item.shikimori_id,
    translationId: item.translation?.id || null,
    label: translation,
    kind: "episode",
    translation,
    episodesCount,
    embedUrl: baseLink,
    episodeTemplate: baseLink ? `${baseLink}${separator}episode={episode}` : "",
    quality: item.quality || "auto",
    lastEpisode: Number(item.last_episode || item.last_season_episode || 1),
    camrip: Boolean(item.camrip)
  };
}

function extractMediaUrls(html = "") {
  const urls = new Set();
  const patterns = [
    new RegExp("https?://[^\"'\\\\s]+\\\\.m3u8[^\"'\\\\s]*", "g"),
    new RegExp("https?://[^\"'\\\\s]+\\\\.mp4[^\"'\\\\s]*", "g"),
    new RegExp("\"//[^\"'\\\\s]+\\\\.(?:m3u8|mp4)[^\"'\\\\s]*\"", "g")
  ];

  patterns.forEach((pattern) => {
    const matches = html.match(pattern) || [];
    matches.forEach((raw) => {
      const cleaned = raw.replace(/^"|"$/g, "").replace(/\\\//g, "/");
      urls.add(normalizeUrl(cleaned));
    });
  });

  const $ = cheerio.load(html);
  $("source").each((_, el) => {
    const src = normalizeUrl($(el).attr("src"));
    if (src) urls.add(src);
  });

  return [...urls].filter((url) => /\.(m3u8|mp4)/i.test(url));
}

async function resolveStreamFromEmbed(embedUrl, episode = 1) {
  const normalized = normalizeUrl(embedUrl);
  if (!normalized) return { ok: false, media: [], embedUrl: "" };

  const episodeUrl = normalized.includes("{episode}")
    ? normalized.replaceAll("{episode}", String(episode))
    : `${normalized}${normalized.includes("?") ? "&" : "?"}episode=${encodeURIComponent(episode)}`;

  const cacheKey = `${episodeUrl}`;
  const cached = parserCache.streamByKey.get(cacheKey);
  if (cached && Date.now() - cached.time < 1000 * 60 * 10) return cached.data;

  try {
    const response = await axios.get(episodeUrl, {
      timeout: 12000,
      maxRedirects: 5,
      headers: {
        "User-Agent": "Mozilla/5.0",
        Referer: "https://kodikapi.com/"
      }
    });

    const html = String(response.data || "");
    const media = extractMediaUrls(html);
    const data = {
      ok: Boolean(media.length),
      media,
      embedUrl: episodeUrl,
      playerHtmlFetched: true
    };

    parserCache.streamByKey.set(cacheKey, { data, time: Date.now() });
    return data;
  } catch {
    return { ok: false, media: [], embedUrl: episodeUrl, playerHtmlFetched: false };
  }
}

async function fetchKodikList(token, shikimoriId) {
  const requests = ["search", "list"].map((method) =>
    axios
      .get(`${KODIK_API_BASE}/${method}`, {
        params: { token, shikimori_id: shikimoriId, with_material_data: true },
        timeout: 12000
      })
      .then((res) => res.data?.results || [])
      .catch(() => [])
  );

  const chunks = await Promise.all(requests);
  return chunks.flat();
}

async function searchByShikimoriId(shikimoriId) {
  const cacheKey = String(shikimoriId);
  if (parserCache.byShiki.has(cacheKey)) return parserCache.byShiki.get(cacheKey);

  const token = await getKodikToken();
  if (!token) {
    return { ok: false, reason: "missing_token", sources: [], episodes: [] };
  }

  try {
    const results = await fetchKodikList(token, shikimoriId);
    const dedup = new Map();

    results.forEach((result) => {
      const source = mapKodikResultToSource(result);
      if (!source.embedUrl) return;
      const key = `${source.translationId || "no-tr"}:${source.embedUrl}`;
      dedup.set(key, {
        ...source,
        episodeNumbers: extractEpisodeNumbers(result, source.episodesCount)
      });
    });

    const sources = [...dedup.values()].sort((a, b) => {
      if (a.camrip !== b.camrip) return a.camrip ? 1 : -1;
      return (b.lastEpisode || 0) - (a.lastEpisode || 0);
    });

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
  searchByShikimoriId,
  resolveStreamFromEmbed
};
