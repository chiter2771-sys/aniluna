let allAnime = [];
let currentPage = 1;
let hasMore = true;
let loading = false;

const state = {
  search: "",
  genre: "",
  year: "",
  status: "",
  kind: "",
  chipGenre: ""
};

function getTitle(anime) {
  return anime.russian || anime.name || "Без названия";
}

function getImage(anime) {
  return anime.image?.original ? `https://shikimori.one${anime.image.original}` : "";
}

function isAdultRating(anime) {
  const rating = (anime.rating || "").toLowerCase();
  return rating.includes("rx") || rating.includes("r+");
}

function renderAnime(list, append = false) {
  const container = document.getElementById("grid");
  if (!append) container.innerHTML = "";

  if (!list.length && !append) {
    container.innerHTML = `
      <div class="empty-state">
        <h2>Ничего не найдено</h2>
        <p>Попробуй изменить фильтры или поисковый запрос.</p>
      </div>
    `;
    return;
  }

  list.forEach((anime) => {
    const card = document.createElement("article");
    card.className = "card";

    const title = getTitle(anime);
    const image = getImage(anime);
    const year = anime.aired_on ? anime.aired_on.slice(0, 4) : "—";
    const rating = anime.score || "?";
    const adultBadge = isAdultRating(anime) ? '<span class="age-badge">18+</span>' : "";

    card.innerHTML = `
      <div class="card-img">
        <img src="${image}" alt="${title}">
        ${adultBadge}
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

function setLoadMoreVisibility() {
  const btn = document.getElementById("loadMore");
  btn.style.display = hasMore ? "block" : "none";
  btn.disabled = loading;
  btn.textContent = loading ? "Загрузка..." : "Загрузить ещё";
}

function createOptions(selectId, values, allLabel) {
  const select = document.getElementById(selectId);
  const current = select.value;

  select.innerHTML = `<option value="">${allLabel}</option>`;

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });

  if (values.includes(current)) select.value = current;
}

function renderDynamicFilters() {
  const genres = [...new Set(allAnime.flatMap((anime) => (anime.genres || []).map((g) => g.russian).filter(Boolean)))].sort((a, b) => a.localeCompare(b, "ru"));
  const years = [...new Set(allAnime.map((anime) => anime.aired_on?.slice(0, 4)).filter(Boolean))].sort((a, b) => Number(b) - Number(a));

  createOptions("filterGenre", genres, "Все жанры");
  createOptions("filterYear", years, "Все годы");

  renderGenreChips(genres);
}

function renderGenreChips(genres) {
  const container = document.getElementById("genres");
  container.innerHTML = "";

  const chips = ["Все", ...genres.slice(0, 16)];

  chips.forEach((genre) => {
    const btn = document.createElement("button");
    btn.className = "genre-btn" + ((genre === "Все" && !state.chipGenre) || genre === state.chipGenre ? " active" : "");
    btn.textContent = genre;

    btn.onclick = () => {
      state.chipGenre = genre === "Все" ? "" : genre;
      document.getElementById("filterGenre").value = state.chipGenre;
      applyFilters();
    };

    container.appendChild(btn);
  });
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

loadPage(1);
