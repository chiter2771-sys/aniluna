const get = async (url, options = {}) => {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error('Request failed');
  return response.json();
};

export const api = {
  health: (options) => get('/api/health', options),
  list: (options) => get('/api/list', options),
  search: (q, options) => get(`/api/search?q=${encodeURIComponent(q)}`, options),
  anime: (id, options) => get(`/api/anime/${id}`, options),
  player: (id, options) => get(`/api/player/${id}`, options),
  genres: (options) => get('/api/genres', options)
};
