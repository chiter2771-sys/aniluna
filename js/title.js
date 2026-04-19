const params = new URLSearchParams(window.location.search);
const id = Number(params.get("id"));

const anime = animeList.find(a => a.id === id);

if (anime) {
  document.getElementById("title").textContent = anime.title;
  document.getElementById("image").src = anime.image;
  document.getElementById("desc").textContent = anime.desc;

  document.getElementById("year").textContent = anime.year;
  document.getElementById("status").textContent = anime.status;
  document.getElementById("episodesCount").textContent = anime.episodesCount;
  document.getElementById("duration").textContent = anime.duration;
  document.getElementById("rating").textContent = anime.rating;
  document.getElementById("studio").textContent = anime.studio;

  // теги
  const tagsContainer = document.getElementById("tags");
  anime.tags.forEach(tag => {
    const el = document.createElement("span");
    el.className = "tag";
    el.textContent = tag;
    tagsContainer.appendChild(el);
  });

  // плеер
  const player = document.getElementById("player");
  player.src = anime.episodes[0];

  // серии
  const epList = document.getElementById("episodes");

  anime.episodes.forEach((ep, i) => {
    const btn = document.createElement("div");
    btn.className = "ep";
    btn.textContent = "Серия " + (i + 1);

    btn.onclick = () => {
      player.src = ep;
      document.querySelectorAll(".ep").forEach(e => e.classList.remove("active"));
      btn.classList.add("active");
    };

    if (i === 0) btn.classList.add("active");

    epList.appendChild(btn);
  });

} else {
  document.body.innerHTML = "<h1>Аниме не найдено</h1>";
}