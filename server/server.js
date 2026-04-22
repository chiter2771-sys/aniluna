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

const cache = { list: {}, anime: {}, player: {}, episodes: {}, character: {}, search: {} };
const CACHE_TIME = 1000 * 60 * 10;

const isCacheFresh = (entry) => entry && Date.now() - entry.time < CACHE_TIME;
const normalize = (text = "") => text.toLowerCase().replace(/ё/g, "е").replace(/[^\p{L}\p{N}\s]/gu, "").trim();

const headers = {
  "User-Agent": "Mozilla/5.0",
  Accept: "application/json"
};

function parseYoutubeId(url = "") {
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
  return match ? match[1] : null;
}

function fallbackFilter(list, query) {
  const needle = normalize(query);
  return list.filter((anime) => {
    const title = normalize(`${anime.russian || ""} ${anime.name || ""}`);
    return title.includes(needle);
  });
}

app.get("/", (_, res) => res.sendFile(path.join(root, "html", "index.html")));
app.get("/title", (_, res) => res.sendFile(path.join(root, "pages", "anime.html")));

app.get("/api/list", async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Math.min(Number(req.query.limit || 20), 50);
  const order = (req.query.order || "ranked").toString();

  try {
    const key = JSON.stringify({ page, limit, order });
    if (isCacheFresh(cache.list[key])) return res.json(cache.list[key].data);

    const response = await axios.get("https://shikimori.one/api/animes", {
      params: { page, limit, order },
      headers,
      timeout: 10000
    });

    const payload = { page, limit, hasMore: (response.data || []).length === limit, data: response.data || [] };
    cache.list[key] = { data: payload, time: Date.now() };
    return res.json(payload);
  } catch (err) {
    const start = (page - 1) * limit;
    const chunk = fallbackAnime.slice(start, start + limit);
    return res.json({ page, limit, hasMore: start + limit < fallbackAnime.length, data: chunk, source: "fallback" });
  }
});

app.get("/api/search", async (req, res) => {
  const query = (req.query.query || "").toString().trim();
  const limit = Math.min(Number(req.query.limit || 120), 200);

  if (!query) return res.json({ data: [] });

  try {
    const key = `${normalize(query)}::${limit}`;
    if (isCacheFresh(cache.search[key])) return res.json(cache.search[key].data);

    const variants = [...new Set([query, query.replace(/ё/gi, "е"), query.replace(/е/gi, "ё")])];
    const requests = [];
    for (const searchValue of variants) {
      for (let page = 1; page <= 6; page += 1) {
        requests.push(axios.get("https://shikimori.one/api/animes", {
          params: { page, limit: 50, search: searchValue, order: "popularity" },
          headers,
          timeout: 10000
        }).then((r) => r.data || []).catch(() => []));
      }
    }

    const chunks = await Promise.all(requests);
    const merged = new Map();
    chunks.flat().forEach((item) => merged.set(item.id, item));

    const needle = normalize(query);
    const data = [...merged.values()]
      .filter((item) => normalize(`${item.russian || ""} ${item.name || ""}`).includes(needle))
      .slice(0, limit);

    const payload = { data };
    cache.search[key] = { data: payload, time: Date.now() };
    return res.json(payload);
  } catch (err) {
    return res.json({ data: fallbackFilter(fallbackAnime, query).slice(0, limit), source: "fallback" });
  }
});

app.get("/api/anime/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (isCacheFresh(cache.anime[id])) return res.json(cache.anime[id].data);

    const [animeRes, rolesRes, relatedRes] = await Promise.all([
      axios.get(`https://shikimori.one/api/animes/${id}`, { headers, timeout: 10000 }),
      axios.get(`https://shikimori.one/api/animes/${id}/roles`, { headers, timeout: 10000 }).catch(() => ({ data: [] })),
      axios.get(`https://shikimori.one/api/animes/${id}/related`, { headers, timeout: 10000 }).catch(() => ({ data: [] }))
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

    const response = await axios.get(`https://shikimori.one/api/animes/${id}/episodes`, { headers, timeout: 10000 });
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
    if (isCacheFresh(cache.character[id])) return res.json(cache.character[id].data);

    const response = await axios.get(`https://shikimori.one/api/characters/${id}`, { headers, timeout: 10000 });
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

    const response = await axios.get(`https://shikimori.one/api/animes/${id}/videos`, { headers, timeout: 10000 });
    const sources = (response.data || []).map((item) => {
      const raw = item.player_url || item.url || "";
      const yid = parseYoutubeId(raw);
      return {
        label: (item.kind || "video").toUpperCase(),
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
        dubs: ["AniLibria", "StudioBand", "Оригинал"],
        qualities: ["1080p", "720p", "480p"],
        seasons: ["Сезон 1"]
      }
    };

    cache.player[id] = { data: payload, time: Date.now() };
    return res.json(payload);
  } catch {
    return res.json({ sources: [], controls: {} });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
