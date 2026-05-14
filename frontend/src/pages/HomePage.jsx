import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

const splitBy = (items, size) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [genres, setGenres] = useState([]);
  const [activeGenre, setActiveGenre] = useState('all');
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    api.genres().then((data) => setGenres(data.items || data || [])).catch(() => setGenres([]));
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      try {
        const data = query.trim()
          ? await api.search(query.trim(), { signal: controller.signal })
          : await api.list({ signal: controller.signal });
        if (active) setItems(data.items || []);
      } catch {
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    const timer = setTimeout(load, 280);
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const normalizedGenres = useMemo(() => genres.map((g) => typeof g === 'string' ? g : g.title || g.name).filter(Boolean), [genres]);

  const filtered = useMemo(() => {
    if (activeGenre === 'all') return items;
    return items.filter((anime) => (anime.genres || []).map((g) => String(g).toLowerCase()).includes(activeGenre.toLowerCase()));
  }, [items, activeGenre]);

  const rails = useMemo(() => splitBy(filtered, 10), [filtered]);

  return (
    <main className="page page-home">
      <section className="hero">
        <div>
          <p className="label">Railway • Kodik Player</p>
          <h1>AniLuna Reborn</h1>
          <p className="hero-sub">Современный аниме-портал с фокусом на скорость, эргономику и плавные анимации.</p>
        </div>
        <button className="cta" onClick={() => setSearchOpen((s) => !s)}>Поиск и фильтры</button>
      </section>

      <section className={`search-panel ${searchOpen ? 'open' : ''}`}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Искать тайтлы, студии, синонимы"
          aria-label="Search anime"
        />
        <div className="genre-row">
          <button className={activeGenre === 'all' ? 'active' : ''} onClick={() => setActiveGenre('all')}>Все</button>
          {normalizedGenres.slice(0, 18).map((genre) => (
            <button key={genre} className={activeGenre === genre ? 'active' : ''} onClick={() => setActiveGenre(genre)}>{genre}</button>
          ))}
        </div>
      </section>

      {loading ? <p className="skeleton">Загружаем контент...</p> : (
        <section className="rails">
          {rails.length === 0 ? <p className="skeleton">Ничего не найдено.</p> : rails.map((row, idx) => (
            <article key={idx} className="rail">
              <h2>{idx === 0 ? 'Тренды' : `Подборка #${idx + 1}`}</h2>
              <div className="rail-scroll">
                {row.map((anime) => (
                  <Link key={anime.id} className="card" to={`/anime/${anime.id}`}>
                    <img src={anime.poster || ''} alt={anime.title} loading="lazy" />
                    <div className="card-meta">
                      <h3>{anime.title}</h3>
                      <p>{(anime.genres || []).slice(0, 2).join(' • ') || 'Без жанров'}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
