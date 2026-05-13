import { useEffect, useState } from 'react';
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

  if (!anime) return <p className="page">Loading...</p>;

  return (
    <main className="page">
      <h1>{anime.title}</h1>
      <p>{anime.description}</p>
      {player?.playerLink && (
        <iframe className="player" src={player.playerLink} title={anime.title} allowFullScreen />
      )}
    </main>
  );
}
