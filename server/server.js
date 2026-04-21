const express = require("express");
const path = require("path");
const axios = require("axios");
const cors = require("cors");

const app = express();
const root = path.join(__dirname, "..");

app.use(cors());
app.use(express.static(root));

const cache = {
  list: {},
  anime: {},
  player: {},
  chars: {},
  recs: {}
};

const CACHE_TIME = 1000 * 60 * 10;

function setCache(bucket, key, data) {
  bucket[key] = { data, time: Date.now() };
}

function getCache(bucket, key) {
  const cached = bucket[key];
  if (!cached) return null;
  if (Date.now() - cached.time > CACHE_TIME) return null;
  return cached.data;
}

function toYouTubeEmbed(url = "") {
  if (!url) return "";

  const short = url.match(/youtu\.be\/([\w-]+)/i);
  if (short) return `https://www.youtube.com/embed/${short[1]}`;

  const regular = url.match(/[?&]v=([\w-]+)/i);
  if (regular) return `https://www.youtube.com/embed/${regular[1]}`;

  if (url.includes("youtube.com/embed/")) return url;
  return "";
}

app.get("/", (req, res) => {
  res.sendFile(path.join(root, "html", "index.html"));
});

app.get("/title", (req, res) => {
  res.sendFile(path.join(root, "pages", "anime.html"));
});

app.get("/api/list", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 50);
    const order = String(req.query.order || "ranked");
    const key = `${page}:${limit}:${order}`;

    const cached = getCache(cache.list, key);
    if (cached) return res.json(cached);

    const response = await axios.get("https://shikimori.one/api/animes", {
      params: { page, limit, order },
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 9000
    });

    setCache(cache.list, key, response.data);
    return res.json(response.data);
  } catch (err) {
    console.error("Ошибка списка:", err.message);
    return res.status(500).json({ error: "Не удалось загрузить список" });
  }
});

app.get("/api/anime/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const cached = getCache(cache.anime, id);
    if (cached) return res.json(cached);

    const animeRes = await axios.get(`https://shikimori.one/api/animes/${id}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 9000
    });

    const anime = animeRes.data;
    const result = {
      id: anime.id,
      title: anime.russian || anime.name,
      image: anime.image?.original ? `https://shikimori.one${anime.image.original}` : "",
      description: anime.description,
      aired_on: anime.aired_on,
      released_on: anime.released_on,
      status: anime.status,
      episodes: anime.episodes,
      episodesAired: anime.episodes_aired,
      duration: anime.duration,
      score: anime.score,
      genres: anime.genres || [],
      kind: anime.kind,
      rating: anime.rating,
      studios: anime.studios || []
    };

    setCache(cache.anime, id, result);
    return res.json(result);
  } catch (err) {
    console.error("Ошибка anime:", err.message);
    return res.status(500).json({ error: "Ошибка получения аниме" });
  }
});

app.get("/api/player/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const cached = getCache(cache.player, id);
    if (cached) return res.json(cached);

    const response = await axios.get(`https://shikimori.one/api/animes/${id}/videos`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 9000
    });

    const sources = (response.data || [])
      .map((item, idx) => {
        const watchUrl = item.url || item.player_url || "";
        const embedUrl = toYouTubeEmbed(item.url || "") || item.player_url || "";

        return {
          label: `${(item.kind || "video").toUpperCase()} ${idx + 1}`,
          embedUrl,
          watchUrl
        };
      })
      .filter((item) => item.embedUrl || item.watchUrl)
      .slice(0, 8);

    const payload = { sources };
    setCache(cache.player, id, payload);
    return res.json(payload);
  } catch (err) {
    console.error("Ошибка player:", err.message);
    return res.json({ sources: [] });
  }
});

app.get("/api/characters/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const cached = getCache(cache.chars, id);
    if (cached) return res.json(cached);

    const response = await axios.get(`https://shikimori.one/api/animes/${id}/roles`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 9000
    });

    const chars = (response.data || [])
      .filter((role) => role.character)
      .slice(0, 12)
      .map((role) => ({
        name: role.character.russian || role.character.name,
        role: role.roles_russian?.[0] || role.roles_en?.[0] || "Персонаж",
        image: role.character.image?.original ? `https://shikimori.one${role.character.image.original}` : ""
      }));

    setCache(cache.chars, id, chars);
    return res.json(chars);
  } catch (err) {
    console.error("Ошибка characters:", err.message);
    return res.json([]);
  }
});

app.get("/api/recommendations/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const cached = getCache(cache.recs, id);
    if (cached) return res.json(cached);

    const response = await axios.get(`https://shikimori.one/api/animes/${id}/similar`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 9000
    });

    const recs = (response.data || []).slice(0, 12).map((item) => ({
      id: item.id,
      title: item.russian || item.name,
      year: item.aired_on ? item.aired_on.slice(0, 4) : "",
      image: item.image?.original ? `https://shikimori.one${item.image.original}` : ""
    }));

    setCache(cache.recs, id, recs);
    return res.json(recs);
  } catch (err) {
    console.error("Ошибка recommendations:", err.message);
    return res.json([]);
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
