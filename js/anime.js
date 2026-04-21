const state = {
  allAnime: [],
  page: 1,
  loading: false,
  hasMore: true,
  activeGenre: null
};

const searchInput = document.getElementById("search");
const loadMoreBtn = document.getElementById("loadMore");

async function fetchAnimePage(page = 1) {
  const res = await fetch(`/api/list?page=${page}&limit=50&order=ranked`);
  if (!res.ok) throw new Error("Ошибка API");
  return res.json();
}

async function loadAnimePage() {
  if (state.loading || !state.hasMore) return;

  state.loading = true;
  loadMoreBtn.disabled = true;
  loadMoreBtn.textContent = "Загрузка...";

  try {
    const list = await fetchAnimePage(state.page);

    if (!Array.isArray(list) || list.length === 0) {
      state.hasMore = false;
      loadMoreBtn.style.display = "none";
      return;
    }

    state.allAnime.push(...list);
    state.page += 1;

    hydrateFilters(state.allAnime);
    applyFilters();
  } catch (err) {
    console.error("Ошибка загрузки:", err.message);
    document.getElementById("grid").innerHTML = `
      <div class="empty-state">
        <h2>😢 Не удалось загрузить каталог</h2>
        <p>Проверь доступность сервера и внешнего API.</p>
      </div>
    `;
  } finally {
    state.loading = false;
    if (state.hasMore) {
      loadMoreBtn.disabled = false;
      loadMoreBtn.textContent = "Загрузить ещё";
    }
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
        <p>Измени параметры поиска или фильтров.</p>
      </div>
    `;
    return;
  }

  list.forEach((anime) => {
    const title = getTitle(anime);
    const image = getImage(anime);
    const rating = anime.score || "?";
    const year = anime.aired_on ? anime.aired_on.slice(0, 4) : "—";
    const age = anime.rating || "";

    const card = document.createElement("article");
    card.className = "card";

    card.innerHTML = `
      <div class="card-img">
        <img src="${image}" alt="${title}">
        ${age.startsWith("rx") || age.startsWith("r+") ? '<span class="age-badge">18+</span>' : ""}
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

function uniqueValues(source, getter) {
  return Array.from(new Set(source.map(getter).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), "ru"));
}

function hydrateFilters(animeList) {
  const genreFilter = document.getElementById("genreFilter");
  const yearFilter = document.getElementById("yearFilter");
  const kindFilter = document.getElementById("kindFilter");

  const genres = uniqueValues(animeList.flatMap((a) => a.genres || []), (g) => g.russian);
  const years = uniqueValues(animeList, (a) => (a.aired_on ? a.aired_on.slice(0, 4) : ""));
  const kinds = uniqueValues(animeList, (a) => a.kind);

  fillSelect(genreFilter, genres, "Жанр: любой");
  fillSelect(yearFilter, years.reverse(), "Год: любой");
  fillSelect(kindFilter, kinds, "Тип: любой");

  renderGenreChips(genres.slice(0, 16));
}

function fillSelect(select, values, defaultLabel) {
  const current = select.value;
  select.innerHTML = `<option value="">${defaultLabel}</option>`;

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });

  if (values.includes(current)) select.value = current;
}

function renderGenreChips(genres) {
  const container = document.getElementById("genres");
  container.innerHTML = "";

  const allBtn = document.createElement("button");
  allBtn.className = `genre-btn ${state.activeGenre ? "" : "active"}`;
  allBtn.textContent = "Все";
  allBtn.onclick = () => {
    state.activeGenre = null;
    applyFilters();
  };
  container.appendChild(allBtn);

  genres.forEach((genre) => {
    const btn = document.createElement("button");
    btn.className = `genre-btn ${state.activeGenre === genre ? "active" : ""}`;
    btn.textContent = genre;
    btn.onclick = () => {
      state.activeGenre = genre;
      document.getElementById("genreFilter").value = genre;
      applyFilters();
    };
    container.appendChild(btn);
  });
}

function applyFilters() {
  const searchValue = searchInput.value.trim().toLowerCase();
  const genreValue = document.getElementById("genreFilter").value || state.activeGenre;
  const yearValue = document.getElementById("yearFilter").value;
  const statusValue = document.getElementById("statusFilter").value;
  const kindValue = document.getElementById("kindFilter").value;

  state.activeGenre = genreValue || null;

  const filtered = state.allAnime.filter((anime) => {
    const matchesSearch = getTitle(anime).toLowerCase().includes(searchValue);
    const matchesGenre = !genreValue || (anime.genres || []).some((g) => g.russian === genreValue);
    const matchesYear = !yearValue || (anime.aired_on || "").startsWith(yearValue);
    const matchesStatus = !statusValue || anime.status === statusValue;
    const matchesKind = !kindValue || anime.kind === kindValue;
    return matchesSearch && matchesGenre && matchesYear && matchesStatus && matchesKind;
  });

  renderGenreChips(uniqueValues(state.allAnime.flatMap((a) => a.genres || []), (g) => g.russian).slice(0, 16));
  renderAnime(filtered);
}

searchInput.addEventListener("input", applyFilters);
document.getElementById("genreFilter").addEventListener("change", applyFilters);
document.getElementById("yearFilter").addEventListener("change", applyFilters);
document.getElementById("statusFilter").addEventListener("change", applyFilters);
document.getElementById("kindFilter").addEventListener("change", applyFilters);
loadMoreBtn.addEventListener("click", loadAnimePage);

loadAnimePage();
