let allAnime = [];

// 🔥 Загрузка через ТВОЙ сервер (важно для РФ)
async function loadAnime() {
  try {
    const res = await fetch("/api/list");

    if (!res.ok) throw new Error("API умер");

    const data = await res.json();

    allAnime = data;
    renderAnime(data);

  } catch (err) {
    console.log("Ошибка загрузки:", err.message);

    document.getElementById("grid").innerHTML = `
      <div style="text-align:center; padding:40px;">
        <h2>😢 Не удалось загрузить аниме</h2>
        <p>Без VPN тут всё разваливается, добро пожаловать в реальность</p>
      </div>
    `;
  }
}

// 🎬 Карточки Netflix-style
function renderAnime(list) {
  const container = document.getElementById("grid");
  container.innerHTML = "";

  list.forEach(anime => {
    const title = anime.russian || anime.name;
    const image = "https://shikimori.one" + anime.image.original;
    const rating = anime.score || "?";
    const genres = anime.genres?.slice(0, 2).map(g => g.russian).join(", ") || "";

    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <div class="card-img">
        <img src="${image}">
      </div>

      <div class="card-overlay">
        <h3>${title}</h3>
        <div class="card-info">
          <span>⭐ ${rating}</span>
          <span>${genres}</span>
        </div>
      </div>
    `;

    card.onclick = () => {
      window.location.href = `pages/anime.html?id=${anime.id}`;
    };

    container.appendChild(card);
  });
}

// 🔍 Поиск
document.getElementById("search").addEventListener("input", (e) => {
  const value = e.target.value.toLowerCase();

  const filtered = allAnime.filter(a =>
    (a.russian || a.name).toLowerCase().includes(value)
  );

  renderAnime(filtered);
});

// 🎭 Жанры
function renderGenres() {
  const genres = ["Экшен", "Драма", "Комедия", "Фэнтези", "Романтика"];
  const container = document.getElementById("genres");

  if (!container) return;

  genres.forEach(g => {
    const btn = document.createElement("button");
    btn.textContent = g;

    btn.onclick = () => {
      const filtered = allAnime.filter(a =>
        a.genres?.some(gen => gen.russian === g)
      );

      renderAnime(filtered);
    };

    container.appendChild(btn);
  });
}

// 🚀 запуск
loadAnime();
renderGenres();