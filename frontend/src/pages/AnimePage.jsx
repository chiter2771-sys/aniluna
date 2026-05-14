import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api';

export default function AnimePage() {
  const { id } = useParams();
  const [anime, setAnime] = useState(null);
  const [player, setPlayer] = useState(null);

  useEffect(() => {
    api.anime(id).then(setAnime).catch(() => setAnime(null));
    api.player(id).then(setPlayer).catch(() => setPlayer(null));
  }, [id]);

  const characters = useMemo(() => (anime?.characters || anime?.persons || []).slice(0, 12), [anime]);

  if (!anime) return <p className="page skeleton">Загрузка тайтла...</p>;

  return (
    <main className="page anime-page">
      <header className="anime-head">
        <img src={anime.poster || ''} alt={anime.title} />
        <div>
          <h1>{anime.title}</h1>
          <p>{anime.description || 'Описание скоро появится.'}</p>
          <div className="tags">
            {(anime.genres || []).map((genre) => <span key={genre}>{genre}</span>)}
          </div>
        </div>
      </header>

      {player?.playerLink && (
        <section className="player-wrap">
          <h2>Онлайн-плеер</h2>
          <iframe className="player" src={player.playerLink} title={anime.title} allowFullScreen />
        </section>
      )}

      <section className="characters">
        <h2>Персонажи</h2>
        <div className="character-row">
          {characters.length ? characters.map((ch, idx) => (
            <article key={ch.id || ch.name || idx} className="character-card">
              <img src={ch.poster || ch.photo || anime.poster || ''} alt={ch.name || 'Character'} loading="lazy" />
              <h3>{ch.name || ch.russian || `Character ${idx + 1}`}</h3>
            </article>
          )) : <p className="skeleton">Персонажи пока недоступны.</p>}
        </div>
      </section>
    </main>
  );
}
