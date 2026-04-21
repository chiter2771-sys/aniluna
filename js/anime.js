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

  list.forEach((anime) => {
    const card = document.createElement("article");
    card.className = "card";

    const title = getTitle(anime);
    const image = getImage(anime);
    const year = anime.aired_on ? anime.aired_on.slice(0, 4) : "—";
    const rating = anime.score || "?";
    const adultBadge = isAdultRating(anime) ? '<span class="age-badge">18+</span>' : "";
function getTitle(anime) {
  return anime.russian || anime.name || "Без названия";
}

function getImage(anime) {
  return anime.image?.original ? `https://shikimori.one${anime.image.original}` : "";
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
      const safeGo = () => (window.location.href = `pages/anime.html?id=${anime.id}`);

      if (isAdultRating(anime) && localStorage.getItem("adult_confirmed") !== "yes") {
        openAgeModal(safeGo);
        return;
      }

      safeGo();
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

function applyFilters() {
  state.search = document.getElementById("search").value.trim().toLowerCase();
  state.genre = document.getElementById("filterGenre").value;
  state.year = document.getElementById("filterYear").value;
  state.status = document.getElementById("filterStatus").value;
  state.kind = document.getElementById("filterKind").value;

  const filtered = allAnime.filter((anime) => {
    const title = getTitle(anime).toLowerCase();

    const matchesSearch = title.includes(state.search);
    const matchesGenre = !state.genre || (anime.genres || []).some((g) => g.russian === state.genre);
    const matchesYear = !state.year || anime.aired_on?.startsWith(state.year);
    const matchesStatus = !state.status || anime.status === state.status;
    const matchesKind = !state.kind || anime.kind === state.kind;

    return matchesSearch && matchesGenre && matchesYear && matchesStatus && matchesKind;
  });

  renderAnime(filtered);
  renderGenreChips([...new Set(allAnime.flatMap((anime) => (anime.genres || []).map((g) => g.russian).filter(Boolean)))].sort((a, b) => a.localeCompare(b, "ru")));
}

async function loadPage(page = 1) {
  if (loading || !hasMore) return;
  loading = true;
  setLoadMoreVisibility();

  try {
    const res = await fetch(`/api/list?page=${page}&limit=50&order=ranked`);
    if (!res.ok) throw new Error("Ошибка API");

    const payload = await res.json();
    const chunk = payload.data || [];

    allAnime = [...allAnime, ...chunk];
    hasMore = !!payload.hasMore;
    currentPage = payload.page || page;

    renderDynamicFilters();
    applyFilters();
  } catch (err) {
    console.error(err);
    if (!allAnime.length) {
      document.getElementById("grid").innerHTML = `<div class="empty-state"><h2>Ошибка загрузки</h2><p>Проверь подключение и попробуй позже.</p></div>`;
    }
  } finally {
    loading = false;
    setLoadMoreVisibility();
  }
}

function openAgeModal(onConfirm) {
  const overlay = document.createElement("div");
  overlay.className = "age-modal-overlay";
  overlay.innerHTML = `
    <div class="age-modal">
      <h3>⚠ Подтверждение возраста</h3>
      <p>Этот тайтл имеет возрастное ограничение 18+.</p>
      <div class="age-actions">
        <button id="confirmAdult" class="primary-btn">Мне есть 18</button>
        <button id="cancelAdult" class="ghost-btn">Вернуться</button>
      </div>
    </div>
  `;

  overlay.querySelector("#confirmAdult").onclick = () => {
    localStorage.setItem("adult_confirmed", "yes");
    overlay.remove();
    onConfirm();
  };

  overlay.querySelector("#cancelAdult").onclick = () => overlay.remove();

  document.body.appendChild(overlay);
}

document.getElementById("search").addEventListener("input", applyFilters);
document.getElementById("filterGenre").addEventListener("change", applyFilters);
document.getElementById("filterYear").addEventListener("change", applyFilters);
document.getElementById("filterStatus").addEventListener("change", applyFilters);
document.getElementById("filterKind").addEventListener("change", applyFilters);

document.getElementById("loadMore").addEventListener("click", () => loadPage(currentPage + 1));


const querySearch = new URLSearchParams(window.location.search).get("search");
if (querySearch) {
  document.getElementById("search").value = querySearch;
  state.search = querySearch.toLowerCase();
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
