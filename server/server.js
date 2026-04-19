const express = require("express");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");

const app = express();
const root = path.join(__dirname, "..");

app.use(cors());
app.use(express.static(root));

/* =========================
   КЭШ
========================= */

const cache = {
  list: null,
  listTime: 0,
  anime: {}
};

const CACHE_TIME = 1000 * 60 * 10; // 10 минут

/* =========================
   СТРАНИЦЫ
========================= */

app.get("/", (req, res) => {
  res.sendFile(path.join(root, "html", "index.html"));
});

app.get("/title", (req, res) => {
  res.sendFile(path.join(root, "pages", "anime.html"));
});

/* =========================
   API: СПИСОК
========================= */

app.get("/api/list", async (req, res) => {
  try {
    if (cache.list && Date.now() - cache.listTime < CACHE_TIME) {
      console.log("📦 list из кеша");
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

    console.log("🌐 list с API");

    res.json(response.data);

  } catch (err) {
    console.log("❌ Ошибка списка:", err.message);

    if (cache.list) {
      console.log("⚠️ отдаю старый кеш");
      return res.json(cache.list);
    }

    res.status(500).json({ error: "API умер" });
  }
});

/* =========================
   API: АНИМЕ
========================= */

app.get("/api/anime/:id", async (req, res) => {
  try {
    const id = req.params.id;

    if (cache.anime[id] && Date.now() - cache.anime[id].time < CACHE_TIME) {
      console.log("📦 anime из кеша:", id);
      return res.json(cache.anime[id].data);
    }

    const animeRes = await axios.get(
      `https://shikimori.one/api/animes/${id}`,
      {
        headers: { "User-Agent": "Mozilla/5.0" },
        timeout: 7000
      }
    );

    const anime = animeRes.data;

    // JUT (не критично)
    let episodes = [];

    try {
      const query = anime.name.replace(/\s+/g, "-").toLowerCase();
      const url = `https://jut.su/${query}/`;

      const { data } = await axios.get(url, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });

      const $ = cheerio.load(data);

      $(".short-btn").each((i, el) => {
        const link = $(el).attr("href");
        if (link) episodes.push("https://jut.su" + link);
      });

    } catch {
      console.log("⚠️ JUT не доступен");
    }

    const result = {
      title: anime.russian || anime.name,
      image: "https://shikimori.one" + anime.image.original,
      description: anime.description,
      aired_on: anime.aired_on,
      status: anime.status,
      episodes: anime.episodes,
      duration: anime.duration,
      score: anime.score,
      genres: anime.genres,
      episodesList: episodes
    };

    cache.anime[id] = {
      data: result,
      time: Date.now()
    };

    res.json(result);

  } catch (err) {
    console.log("❌ Ошибка anime:", err.message);
    res.status(500).json({ error: "Ошибка аниме" });
  }
});

/* =========================
   ПЛЕЕР (ОТКЛЮЧАЕМ ЭТУ ХЕРНЮ)
========================= */

app.get("/api/player/:id", (req, res) => {
  res.status(404).send("Плеер отключен");
});

/* ========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🔥 Сервер запущен на порту " + PORT);
});