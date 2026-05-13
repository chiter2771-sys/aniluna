const get = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Request failed');
  return response.json();
};

export const api = {
  search: (q) => get(`/api/search?q=${encodeURIComponent(q)}`),
  anime: (id) => get(`/api/anime/${id}`),
  player: (id) => get(`/api/player/${id}`),
  genres: () => get('/api/genres')
};
