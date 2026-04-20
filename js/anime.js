let allAnime = [];
let activeGenre = null;

async function loadAnime() {
  try {
    const res = await fetch("/api/list");
    if (!res.ok) throw new Error("Ошибка API");

    const data = await res.json();
    allAnime = Array.isArray(data) ? data : [];

    renderGenres(allAnime);
    renderAnime(allAnime);
  } catch (err) {
    console.error("Ошибка загрузки:", err.message);

    document.getElementById("grid").innerHTML = `
      <div class="empty-state">
        <h2>😢 Не удалось загрузить каталог</h2>
        <p>Проверь подключение к серверу и доступность API.</p>
      </div>
    `;
  }
}

function getTitle(anime) {
  return anime.russian || anime.name || "Без названия";
}

function getImage(anime) {
  return anime.image?.original ? `https://shikimori.one${anime.image.original}` : "";
}

function renderAnime(list) {
  const container = document.getElementById("grid");
  container.innerHTML = "";

  if (!list.length) {
    container.innerHTML = `
      <div class="empty-state">
        <h2>Ничего не найдено</h2>
        <p>Попробуй изменить поисковый запрос или жанр.</p>
      </div>
    `;
    return;
  }

  list.forEach((anime) => {
    const title = getTitle(anime);
    const image = getImage(anime);
    const rating = anime.score || "?";
    const year = anime.aired_on ? anime.aired_on.slice(0, 4) : "—";

    const card = document.createElement("article");
    card.className = "card";

    card.innerHTML = `
      <div class="card-img">
        <img src="${image}" alt="${title}">
      </div>
      <div class="card-overlay">
        <h3>${title}</h3>
        <div class="card-info">
          <span>⭐ ${rating}</span>
          <span>${year}</span>
        </div>
      </div>
    `;

    card.onclick = () => {
      window.location.href = `pages/anime.html?id=${anime.id}`;
    };

    container.appendChild(card);
  });
}

function renderGenres(animeList) {
  const container = document.getElementById("genres");
  if (!container) return;

  const genres = new Set();
  animeList.forEach((anime) => {
    (anime.genres || []).forEach((genre) => {
      if (genre?.russian) genres.add(genre.russian);
    });
  });

  container.innerHTML = "";

  const allBtn = document.createElement("button");
  allBtn.className = "genre-btn active";
  allBtn.textContent = "Все";
  allBtn.onclick = () => {
    activeGenre = null;
    document.querySelectorAll(".genre-btn").forEach((b) => b.classList.remove("active"));
    allBtn.classList.add("active");
    applyFilters();
  };
  container.appendChild(allBtn);

  Array.from(genres)
    .sort((a, b) => a.localeCompare(b, "ru"))
    .slice(0, 20)
    .forEach((genre) => {
      const btn = document.createElement("button");
      btn.className = "genre-btn";
      btn.textContent = genre;

      btn.onclick = () => {
        activeGenre = genre;
        document.querySelectorAll(".genre-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        applyFilters();
      };

      container.appendChild(btn);
    });
}

function applyFilters() {
  const value = document.getElementById("search").value.trim().toLowerCase();

  const filtered = allAnime.filter((anime) => {
    const matchesSearch = getTitle(anime).toLowerCase().includes(value);
    const matchesGenre = !activeGenre || (anime.genres || []).some((g) => g.russian === activeGenre);
    return matchesSearch && matchesGenre;
  });

  renderAnime(filtered);
}

document.getElementById("search").addEventListener("input", applyFilters);

loadAnime();
