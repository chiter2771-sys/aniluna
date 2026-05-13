import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

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

    const timer = setTimeout(load, 350);

    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <main className="page">
      <h1>AniLuna</h1>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search anime" />
      {loading ? <p className="skeleton">Loading...</p> : (
        <div className="grid">
          {items.map((anime) => (
            <Link key={anime.id} className="card" to={`/anime/${anime.id}`}>
              <img src={anime.poster || ''} alt={anime.title} loading="lazy" />
              <h3>{anime.title}</h3>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
