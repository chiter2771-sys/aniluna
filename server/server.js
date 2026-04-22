const express = require("express");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const cors = require("cors");

const app = express();
const root = path.join(__dirname, "..");

app.use(cors());
app.use(express.static(root));

const fallbackPath = path.join(root, "json", "fallback-anime.json");
const fallbackAnime = fs.existsSync(fallbackPath)
  ? JSON.parse(fs.readFileSync(fallbackPath, "utf-8"))
  : [];

const cache = { list: {}, anime: {}, player: {}, episodes: {}, character: {}, search: {}, genres: {} };
const CACHE_TIME = 1000 * 60 * 10;

const isCacheFresh = (entry) => entry && Date.now() - entry.time < CACHE_TIME;
const normalize = (text = "") => text.toLowerCase().replace(/ё/g, "е").replace(/[^\p{L}\p{N}\s]/gu, "").trim();

const headers = {
  "User-Agent": "Mozilla/5.0",
  Accept: "application/json"
};

const SHIKI = "https://shikimori.one/api";
const JIKAN = "https://api.jikan.moe/v4";

function parseYoutubeId(url = "") {
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
  return match ? match[1] : null;
}

function fallbackFilter(list, query, genre) {
  const needle = normalize(query);
  const genreNeedle = normalize(genre);
  return list.filter((anime) => {
    const title = normalize(`${anime.russian || ""} ${anime.name || ""}`);
    const hasQuery = needle ? title.includes(needle) : true;
    if (!hasQuery) return false;
    if (!genreNeedle) return true;
    const genres = (anime.genres || []).map((g) => normalize(g.russian || g.name || ""));
    return genres.some((g) => g.includes(genreNeedle));
  });
}

function mapJikanToAnime(item) {
  const genres = [...(item.genres || []), ...(item.explicit_genres || []), ...(item.themes || [])]
    .map((genre) => ({ id: genre.mal_id, name: genre.name, russian: genre.name }));
  return {
    id: `mal-${item.mal_id}`,
    name: item.title_english || item.title,
    russian: item.title,
    image: {
      original: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url,
      preview: item.images?.jpg?.small_image_url,
      x96: item.images?.jpg?.small_image_url
    },
    score: item.score,
    kind: item.type ? item.type.toLowerCase() : "tv",
    episodes: item.episodes,
    episodes_aired: item.episodes,
    aired_on: item.aired?.from ? item.aired.from.slice(0, 10) : null,
    status: item.status,
    genres,
    source: "jikan"
  };
}

app.get("/", (_, res) => res.sendFile(path.join(root, "html", "index.html")));
app.get("/title", (_, res) => res.sendFile(path.join(root, "pages", "anime.html")));
app.get("/search", (_, res) => res.sendFile(path.join(root, "pages", "search.html")));

app.get("/api/list", async (req, res) => {
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 50);
  const order = (req.query.order || "ranked").toString();
  const genre = (req.query.genre || "").toString().trim();

  try {
    const key = JSON.stringify({ page, limit, order, genre: normalize(genre) });
    if (isCacheFresh(cache.list[key])) return res.json(cache.list[key].data);

    const params = { page, limit, order };
    if (genre) params.genre = genre;

    const response = await axios.get(`${SHIKI}/animes`, { params, headers, timeout: 10000 });
    const payload = {
      page,
      limit,
      hasMore: (response.data || []).length === limit,
      data: response.data || []
    };
    cache.list[key] = { data: payload, time: Date.now() };
    return res.json(payload);
  } catch {
    const filtered = fallbackFilter(fallbackAnime, "", genre);
    const start = (page - 1) * limit;
    const chunk = filtered.slice(start, start + limit);
    return res.json({ page, limit, hasMore: start + limit < filtered.length, data: chunk, source: "fallback" });
  }
});

app.get("/api/genres", async (_, res) => {
  const key = "all";
  if (isCacheFresh(cache.genres[key])) return res.json(cache.genres[key].data);

  try {
    const response = await axios.get(`${SHIKI}/genres`, { headers, timeout: 10000 });
    const data = (response.data || [])
      .filter((item) => item.kind === "anime")
      .map((item) => ({ id: item.id, name: item.name, russian: item.russian || item.name }))
      .sort((a, b) => a.russian.localeCompare(b.russian, "ru"));

    const payload = { data };
    cache.genres[key] = { data: payload, time: Date.now() };
    return res.json(payload);
  } catch {
    const map = new Map();
    fallbackAnime.flatMap((item) => item.genres || []).forEach((genre) => {
      const id = genre.id || normalize(genre.russian || genre.name);
      if (!map.has(id)) map.set(id, { id, name: genre.name || genre.russian, russian: genre.russian || genre.name });
    });
    return res.json({ data: [...map.values()] });
  }
});

app.get("/api/search", async (req, res) => {
  const query = (req.query.query || "").toString().trim();
  const genre = (req.query.genre || "").toString().trim();
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 24), 1), 60);

  if (!query) return res.json({ page, limit, total: 0, hasMore: false, data: [] });

  try {
    const key = `${normalize(query)}::${normalize(genre)}::${page}::${limit}`;
    if (isCacheFresh(cache.search[key])) return res.json(cache.search[key].data);

    const variants = [...new Set([query, query.replace(/ё/gi, "е"), query.replace(/е/gi, "ё")])];

    const shikiRequests = variants.map((searchValue) =>
      axios.get(`${SHIKI}/animes`, {
        params: { page, limit: Math.min(limit, 50), search: searchValue, order: "popularity" },
        headers,
        timeout: 10000
      }).then((r) => r.data || []).catch(() => [])
    );

    const jikanRequest = axios.get(`${JIKAN}/anime`, {
      params: { q: query, page, limit: Math.min(limit, 25), order_by: "score", sort: "desc", sfw: false },
      timeout: 10000
    }).then((r) => (r.data?.data || []).map(mapJikanToAnime)).catch(() => []);

    const [shikiChunks, jikanChunk] = await Promise.all([Promise.all(shikiRequests), jikanRequest]);
    const merged = new Map();
    shikiChunks.flat().forEach((item) => merged.set(`shiki-${item.id}`, item));
    jikanChunk.forEach((item) => merged.set(item.id, item));

    const needle = normalize(query);
    const genreNeedle = normalize(genre);
    const filtered = [...merged.values()].filter((item) => {
      const byTitle = normalize(`${item.russian || ""} ${item.name || ""}`).includes(needle);
      if (!byTitle) return false;
      if (!genreNeedle) return true;
      const names = (item.genres || []).map((g) => normalize(g.russian || g.name));
      return names.some((name) => name.includes(genreNeedle));
    });

    const data = filtered.slice(0, limit);
    const payload = {
      page,
      limit,
      total: filtered.length,
      hasMore: filtered.length > limit,
      data
    };

    cache.search[key] = { data: payload, time: Date.now() };
    return res.json(payload);
  } catch {
    const filtered = fallbackFilter(fallbackAnime, query, genre);
    const start = (page - 1) * limit;
    const data = filtered.slice(start, start + limit);
    return res.json({
      page,
      limit,
      total: filtered.length,
      hasMore: start + limit < filtered.length,
      data,
      source: "fallback"
    });
  }
});

app.get("/api/anime/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (id.startsWith("mal-")) {
      const malId = id.replace("mal-", "");
      const [animeRes, charsRes] = await Promise.all([
        axios.get(`${JIKAN}/anime/${malId}/full`, { timeout: 10000 }),
        axios.get(`${JIKAN}/anime/${malId}/characters`, { timeout: 10000 }).catch(() => ({ data: { data: [] } }))
      ]);

      const item = animeRes.data?.data;
      const result = {
        id,
        title: item.title,
        originalTitle: item.title_english || item.title_japanese || item.title,
        image: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || "",
        description: item.synopsis || "",
        aired_on: item.aired?.from ? item.aired.from.slice(0, 10) : null,
        status: item.status,
        episodes: item.episodes,
        episodesAired: item.episodes,
        duration: Number.parseInt(item.duration, 10) || 24,
        score: item.score,
        rating: item.rating,
        kind: item.type?.toLowerCase() || "tv",
        studios: (item.studios || []).map((studio) => studio.name),
        genres: [...(item.genres || []), ...(item.explicit_genres || []), ...(item.themes || [])]
          .map((genre) => ({ id: genre.mal_id, name: genre.name, russian: genre.name })),
        characters: (charsRes.data?.data || []).slice(0, 24).map((entry) => ({
          id: `mal-char-${entry.character?.mal_id}`,
          name: entry.character?.name,
          role: entry.role || "Персонаж",
          image: entry.character?.images?.jpg?.image_url || ""
        })),
        related: []
      };

      cache.anime[id] = { data: result, time: Date.now() };
      return res.json(result);
    }

    if (isCacheFresh(cache.anime[id])) return res.json(cache.anime[id].data);

    const [animeRes, rolesRes, relatedRes] = await Promise.all([
      axios.get(`${SHIKI}/animes/${id}`, { headers, timeout: 10000 }),
      axios.get(`${SHIKI}/animes/${id}/roles`, { headers, timeout: 10000 }).catch(() => ({ data: [] })),
      axios.get(`${SHIKI}/animes/${id}/related`, { headers, timeout: 10000 }).catch(() => ({ data: [] }))
    ]);

    const anime = animeRes.data;
    const characters = (rolesRes.data || []).filter((item) => item.character).slice(0, 24).map((item) => ({
      id: item.character.id,
      name: item.character.russian || item.character.name,
      role: item.roles_russian?.[0] || item.roles_en?.[0] || "Персонаж",
      image: item.character.image?.original ? `https://shikimori.one${item.character.image.original}` : ""
    }));

    const related = (relatedRes.data || []).filter((item) => item.anime).slice(0, 12).map((item) => ({
      id: item.anime.id,
      title: item.anime.russian || item.anime.name,
      relation: item.relation_russian || item.relation,
      image: item.anime.image?.original ? `https://shikimori.one${item.anime.image.original}` : ""
    }));

    const result = {
      id: anime.id,
      title: anime.russian || anime.name,
      originalTitle: anime.name,
      image: anime.image?.original ? `https://shikimori.one${anime.image.original}` : "",
      description: anime.description,
      aired_on: anime.aired_on,
      status: anime.status,
      episodes: anime.episodes,
      episodesAired: anime.episodes_aired,
      duration: anime.duration,
      score: anime.score,
      rating: anime.rating,
      kind: anime.kind,
      studios: (anime.studios || []).map((studio) => studio.name),
      genres: anime.genres || [],
      characters,
      related
    };

    cache.anime[id] = { data: result, time: Date.now() };
    return res.json(result);
  } catch {
    return res.status(500).json({ error: "Ошибка получения аниме" });
  }
});

app.get("/api/episodes/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (isCacheFresh(cache.episodes[id])) return res.json(cache.episodes[id].data);

    if (id.startsWith("mal-")) {
      const anime = isCacheFresh(cache.anime[id]) ? cache.anime[id].data : null;
      const total = anime?.episodes || 12;
      const episodes = Array.from({ length: total }, (_, idx) => ({ episode: idx + 1, name: `Серия ${idx + 1}` }));
      const payload = { episodes };
      cache.episodes[id] = { data: payload, time: Date.now() };
      return res.json(payload);
    }

    const response = await axios.get(`${SHIKI}/animes/${id}/episodes`, { headers, timeout: 10000 });
    const episodes = (response.data || []).map((ep) => ({ episode: Number(ep.episode) || 0, name: `Серия ${ep.episode}` }));

    const payload = { episodes };
    cache.episodes[id] = { data: payload, time: Date.now() };
    return res.json(payload);
  } catch {
    return res.json({ episodes: [] });
  }
});

app.get("/api/character/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (id.startsWith("mal-char-")) {
      return res.json({ id, name: "Персонаж", description: "Подробное описание недоступно." });
    }

    if (isCacheFresh(cache.character[id])) return res.json(cache.character[id].data);

    const response = await axios.get(`${SHIKI}/characters/${id}`, { headers, timeout: 10000 });
    const item = response.data || {};
    const payload = {
      id: item.id,
      name: item.russian || item.name,
      image: item.image?.original ? `https://shikimori.one${item.image.original}` : "",
      description: item.description || "Описание недоступно."
    };

    cache.character[id] = { data: payload, time: Date.now() };
    return res.json(payload);
  } catch {
    return res.json({ description: "Описание недоступно." });
  }
});

app.get("/api/player/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (isCacheFresh(cache.player[id])) return res.json(cache.player[id].data);

    if (id.startsWith("mal-")) {
      const payload = {
        sources: [],
        controls: { skipOpening: 85, skipEnding: 90, autoNext: true },
        embed: {
          provider: "kodik",
          url: `https://kodik.cc/find-player?shikimoriID=${encodeURIComponent(id.replace("mal-", ""))}`,
          warning: "Плеер Kodik может не работать без разрешённого домена и реферера."
        }
      };
      cache.player[id] = { data: payload, time: Date.now() };
      return res.json(payload);
    }

    const response = await axios.get(`${SHIKI}/animes/${id}/videos`, { headers, timeout: 10000 });
    const sources = (response.data || []).map((item) => {
      const raw = item.player_url || item.url || "";
      const yid = parseYoutubeId(raw);
      const kind = (item.kind || "video").toLowerCase();
      return {
        label: kind.startsWith("episode") ? "Серия" : (item.kind || "video").toUpperCase(),
        kind,
        embedUrl: yid ? `https://www.youtube.com/embed/${yid}` : raw,
        directUrl: /\.(mp4|webm|m3u8)(\?|$)/i.test(raw) ? raw : ""
      };
    }).filter((x) => x.embedUrl || x.directUrl);

    const payload = {
      sources,
      controls: {
        skipOpening: 85,
        skipEnding: 90,
        autoNext: true,
        dubs: ["Озвучка 1", "Озвучка 2", "Оригинал"],
        qualities: ["1080p", "720p", "480p"],
        seasons: ["Сезон 1"]
      },
      embed: {
        provider: "kodik",
        url: `https://kodik.cc/find-player?shikimoriID=${encodeURIComponent(id)}`,
        warning: "Если iframe пустой — Kodik блокирует домен. Используется резервный встроенный плеер ниже."
      }
    };

    cache.player[id] = { data: payload, time: Date.now() };
    return res.json(payload);
  } catch {
    return res.json({
      sources: [],
      controls: { skipOpening: 85 },
      embed: {
        provider: "kodik",
        url: `https://kodik.cc/find-player?shikimoriID=${encodeURIComponent(req.params.id)}`,
        warning: "Не удалось загрузить источники с API."
      }
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
