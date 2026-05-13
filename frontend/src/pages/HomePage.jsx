import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

export default function HomePage() {
  const [query, setQuery] = useState('naruto');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.search(query).then((data) => {
      if (active) setItems(data.items || []);
    }).catch(() => {
      if (active) setItems([]);
    }).finally(() => active && setLoading(false));

    return () => {
      active = false;
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
