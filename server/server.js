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
  list: null,
  listTime: 0,
  anime: {},
  player: {}
};

const CACHE_TIME = 1000 * 60 * 10;

function isCacheFresh(entry) {
  return entry && Date.now() - entry.time < CACHE_TIME;
}

function parseYoutubeId(url = "") {
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
  return match ? match[1] : null;
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
    const limit = Math.min(Number(req.query.limit || 50), 50);
    const search = (req.query.search || "").toString().trim();
    const order = (req.query.order || "ranked").toString();
    const genre = (req.query.genre || "").toString();
    const status = (req.query.status || "").toString();
    const kind = (req.query.kind || "").toString();

    const cacheKey = JSON.stringify({ page, limit, search, order, genre, status, kind });

    if (isCacheFresh(cache.list[cacheKey])) {
      return res.json(cache.list[cacheKey].data);
    }

    const params = { page, limit, order };
    if (search) params.search = search;
    if (genre) params.genre = genre;
    if (status) params.status = status;
    if (kind) params.kind = kind;

    const response = await axios.get("https://shikimori.one/api/animes", {
      params,
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 10000
    });

    const payload = {
      page,
      limit,
      hasMore: Array.isArray(response.data) && response.data.length === limit,
      data: response.data || []
    };

    cache.list[cacheKey] = { data: payload, time: Date.now() };

    return res.json(payload);
  } catch (err) {
    console.error("Ошибка списка:", err.message);
    if (cache.list && Date.now() - cache.listTime < CACHE_TIME) {
      return res.json(cache.list);
    }

    const response = await axios.get(
      "https://shikimori.one/api/animes?limit=50&order=popularity",
      {
        headers: { "User-Agent": "Mozilla/5.0" },
        timeout: 7000
      }
    );

    cache.list = response.data;
    cache.listTime = Date.now();

    return res.json(response.data);
  } catch (err) {
    console.error("Ошибка списка:", err.message);

    if (cache.list) {
      return res.json(cache.list);
    }

    return res.status(500).json({ error: "Не удалось загрузить список" });
  }
});

app.get("/api/anime/:id", async (req, res) => {
  try {
    const id = req.params.id;

    if (isCacheFresh(cache.anime[id])) {
      return res.json(cache.anime[id].data);
    }

    const [animeRes, rolesRes, relatedRes] = await Promise.all([
      axios.get(`https://shikimori.one/api/animes/${id}`, {
    if (cache.anime[id] && Date.now() - cache.anime[id].time < CACHE_TIME) {
      return res.json(cache.anime[id].data);
    }

    const animeRes = await axios.get(`https://shikimori.one/api/animes/${id}`,
      {
        headers: { "User-Agent": "Mozilla/5.0" },
        timeout: 10000
      }),
      axios.get(`https://shikimori.one/api/animes/${id}/roles`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        timeout: 10000
      }).catch(() => ({ data: [] })),
      axios.get(`https://shikimori.one/api/animes/${id}/related`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        timeout: 10000
      }).catch(() => ({ data: [] }))
    ]);

    const anime = animeRes.data;
    const characters = (rolesRes.data || [])
      .filter((item) => item.character)
      .slice(0, 18)
      .map((item) => ({
        id: item.character.id,
        name: item.character.russian || item.character.name,
        role: item.roles_russian?.[0] || item.roles_en?.[0] || "Персонаж",
        image: item.character.image?.original ? `https://shikimori.one${item.character.image.original}` : ""
      }));

    const related = (relatedRes.data || [])
      .filter((item) => item.anime)
      .slice(0, 14)
      .map((item) => ({
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
      image: anime.image?.original ? "https://shikimori.one" + anime.image.original : "",
      description: anime.description,
      aired_on: anime.aired_on,
      released_on: anime.released_on,
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
      genres: anime.genres || []
    };

    cache.anime[id] = {
      data: result,
      time: Date.now()
    };

    return res.json(result);
  } catch (err) {
    console.error("Ошибка anime:", err.message);
    return res.status(500).json({ error: "Ошибка получения аниме" });
  }
});

app.get("/api/player/:id", async (req, res) => {
  try {
    const id = req.params.id;

    if (isCacheFresh(cache.player[id])) {
      return res.json(cache.player[id].data);
    }

    const response = await axios.get(`https://shikimori.one/api/animes/${id}/videos`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 10000
    });

    const sources = (response.data || [])
      .map((item, index) => {
        const rawUrl = item.player_url || item.url || "";
        const youtubeId = parseYoutubeId(rawUrl);
        return {
          label: `${(item.kind || "video").toUpperCase()} ${index + 1}`,
          embedUrl: youtubeId ? `https://www.youtube.com/embed/${youtubeId}` : rawUrl,
          kind: item.kind || "video"
        };
      })
      .filter((item) => item.embedUrl);

    const payload = {
      sources,
      fallback: {
        message: "Нет встроенного видео. Добавьте лицензированный iframe-источник на сервере."
      }
    };

    cache.player[id] = { data: payload, time: Date.now() };
    return res.json(payload);
  } catch (err) {
    console.error("Ошибка player:", err.message);
    return res.json({ sources: [], fallback: { message: "Плеер временно недоступен" } });

    if (cache.player[id] && Date.now() - cache.player[id].time < CACHE_TIME) {
      return res.json(cache.player[id].data);
    }

    const response = await axios.get(`https://shikimori.one/api/animes/${id}/videos`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 7000
    });

    const sources = (response.data || [])
      .filter((item) => item.kind === "pv" || item.kind === "op" || item.kind === "ed")
      .slice(0, 4)
      .map((item, idx) => ({
        label: `${(item.kind || "video").toUpperCase()} ${idx + 1}`,
        embedUrl: item.player_url
      }))
      .filter((item) => item.embedUrl);

    const payload = { sources };

    cache.player[id] = {
      data: payload,
      time: Date.now()
    };

    return res.json(payload);
  } catch (err) {
    console.error("Ошибка player:", err.message);
    return res.json({ sources: [] });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Сервер запущен на порту " + PORT);
});
