let allAnime = [];

// 🔥 Загрузка аниме
async function loadAnime() {
  const res = await fetch("https://shikimori.one/api/animes?limit=50&order=popularity");
  const data = await res.json();

  allAnime = data;
  renderAnime(data);
}

// 🔥 Отрисовка карточек
function renderAnime(list) {
  const container = document.getElementById("grid");
  container.innerHTML = "";

  list.forEach(anime => {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <div class="img-wrap">
        <img src="https://shikimori.one${anime.image.original}">
      </div>
      <h3>${anime.russian || anime.name}</h3>
    `;

    card.onclick = () => {
      window.location.href = `pages/anime.html?id=${anime.id}`;
    };

    container.appendChild(card);
  });
}

// 🔍 ПОИСК
document.getElementById("search").addEventListener("input", (e) => {
  const value = e.target.value.toLowerCase();

  const filtered = allAnime.filter(a =>
    (a.russian || a.name).toLowerCase().includes(value)
  );

  renderAnime(filtered);
});

// 🎭 ЖАНРЫ (простые кнопки)
function renderGenres() {
  const genres = ["Экшен", "Драма", "Комедия", "Фэнтези", "Романтика"];

  const container = document.getElementById("genres");

  if (!container) return; // если блока нет — не падаем

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

// 🚀 Запуск
loadAnime();
renderGenres();