const express = require('express');
const { kodikGet } = require('../services/kodikClient');
const { normalizeAnime, normalizeTranslation } = require('../utils/normalize');

const router = express.Router();

router.get('/search', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ items: [] });

    const payload = await kodikGet('/search', { title: q, with_material_data: true, limit: 24 });
    const items = (payload.results || []).map(normalizeAnime);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.get('/anime/:id', async (req, res, next) => {
  try {
    const payload = await kodikGet('/list', { shikimori_id: req.params.id, with_material_data: true, limit: 1 });
    const first = payload.results?.[0];
    if (!first) return res.status(404).json({ error: 'Anime not found' });
    res.json(normalizeAnime(first));
  } catch (err) {
    next(err);
  }
});

router.get('/player/:id', async (req, res, next) => {
  try {
    const [translations, episodes] = await Promise.all([
      kodikGet('/translations/v2', { shikimori_id: req.params.id }),
      kodikGet('/list', { shikimori_id: req.params.id, with_episodes: true, limit: 1 })
    ]);

    const playerData = episodes.results?.[0];
    res.json({
      translations: (translations.results || []).map(normalizeTranslation),
      episodes: playerData?.episodes || [],
      playerLink: playerData?.link || null
    });
  } catch (err) {
    next(err);
  }
});

router.get('/genres', async (req, res, next) => {
  try {
    const payload = await kodikGet('/genres');
    res.json({ items: payload.results || [] });
  } catch (err) {
    next(err);
  }
});

router.get('/years', async (req, res, next) => {
  try {
    const payload = await kodikGet('/years');
    res.json({ items: payload.results || [] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
