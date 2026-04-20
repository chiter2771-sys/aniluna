const express = require("express");
const path = require("path");
const axios = require("axios");
const cors = require("cors");

const app = express();
const root = path.join(__dirname, "..");

app.use(cors());
app.use(express.static(root));

const cache = {
  list: null,
  listTime: 0,
  anime: {},
  player: {}
};

const CACHE_TIME = 1000 * 60 * 10;

app.get("/", (req, res) => {
  res.sendFile(path.join(root, "html", "index.html"));
});

app.get("/title", (req, res) => {
  res.sendFile(path.join(root, "pages", "anime.html"));
});

app.get("/api/list", async (req, res) => {
  try {
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

    if (cache.anime[id] && Date.now() - cache.anime[id].time < CACHE_TIME) {
      return res.json(cache.anime[id].data);
    }

    const animeRes = await axios.get(`https://shikimori.one/api/animes/${id}`,
      {
        headers: { "User-Agent": "Mozilla/5.0" },
        timeout: 7000
      }
    );

    const anime = animeRes.data;

    const result = {
      title: anime.russian || anime.name,
      image: anime.image?.original ? "https://shikimori.one" + anime.image.original : "",
      description: anime.description,
      aired_on: anime.aired_on,
      status: anime.status,
      episodes: anime.episodes,
      duration: anime.duration,
      score: anime.score,
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
