function normalizeAnime(item) {
  const material = item.material_data || {};
  return {
    id: item.shikimori_id || item.id,
    title: material.title || material.title_ru || material.title_en || 'Unknown title',
    poster: material.poster_url || material.screenshots?.[0] || null,
    episodes: material.episodes_total || material.episodes_aired || null,
    description: material.description || '',
    genres: Array.isArray(material.anime_genres) ? material.anime_genres : [],
    year: material.year || null,
    status: material.anime_status || null,
    rating: material.rating_mpaa || null
  };
}

function normalizeTranslation(item) {
  return {
    translationId: item.translation?.id || item.translation_id,
    title: item.translation?.title || item.title || 'Unknown translation',
    type: item.translation?.type || item.type || null,
    episodesCount: item.episodes_count || 0,
    lastEpisode: item.last_episode || 0,
    link: item.link || null
  };
}

module.exports = { normalizeAnime, normalizeTranslation };
