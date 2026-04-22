const allAnime = [];

const state = {
  search: "",
  genre: "",
  year: "",
  status: "",
  kind: ""
};

function getTitle(anime) {
  return anime.russian || anime.name || "Без названия";
}

function getImage(anime) {
  const original = anime.image?.original || anime.image?.preview || anime.image?.x96;
  return original ? `https://shikimori.one${original}` : "";
}

function isAdultRating(anime) {
  const rating = (anime.rating || "").toLowerCase();
  return rating.includes("rx") || rating.includes("r+");
}

function formatEpisodes(anime) {
  if (anime.kind === "movie") return "Фильм";
  if (anime.episodes_aired && anime.episodes) return `${anime.episodes_aired}/${anime.episodes} эп.`;
  if (anime.episodes) return `${anime.episodes} эп.`;
  return "? эп.";
}

function renderAnime(list) {
  const container = document.getElementById("grid");
  container.innerHTML = "";

  if (!list.length) {
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
        <img src="${image}" alt="${title}" loading="lazy" decoding="async">
        ${adultBadge}
      </div>
      <div class="card-overlay">
        <h3>${title}</h3>
        <div class="card-info">
          <span>${formatEpisodes(anime)}</span>
          <span>${year}</span>
        </div>
        <div class="card-info">
          <span>⭐ ${rating}</span>
          <span>${(anime.kind || "tv").toUpperCase()}</span>
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

  ["Все", ...genres].forEach((genre) => {
    const btn = document.createElement("button");
    const active = (genre === "Все" && !state.genre) || genre === state.genre;
    btn.className = `genre-btn${active ? " active" : ""}`;
    btn.textContent = genre;
    btn.onclick = () => {
      state.genre = genre === "Все" ? "" : genre;
      document.getElementById("filterGenre").value = state.genre;
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

function renderSection(title, list) {
  if (!list.length) return "";
  return `
    <section class="home-row">
      <h2>${title}</h2>
      <div class="scroll-row">
        ${list.slice(0, 20).map((anime) => `
          <a class="home-mini" href="pages/anime.html?id=${anime.id}">
            <img src="${getImage(anime)}" alt="${getTitle(anime)}" loading="lazy" decoding="async">
            <div class="home-mini-info">
              <strong>${getTitle(anime)}</strong>
              <span>${formatEpisodes(anime)} · ⭐ ${anime.score || "?"}</span>
            </div>
          </a>
        `).join("")}
      </div>
    </section>
  `;
}

function renderHomeSections() {
  const byScore = [...allAnime].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  const byRecent = [...allAnime].sort((a, b) => new Date(b.aired_on || 0) - new Date(a.aired_on || 0));
  const byUpcoming = allAnime.filter((a) => a.status === "anons");

  const genres = {
    "Романтика": allAnime.filter((a) => (a.genres || []).some((g) => g.russian === "Романтика")),
    "Комедия": allAnime.filter((a) => (a.genres || []).some((g) => g.russian === "Комедия")),
    "Боевик": allAnime.filter((a) => (a.genres || []).some((g) => g.russian === "Экшен" || g.russian === "Боевик"))
  };

  const home = document.getElementById("homeSections");
  home.innerHTML = [
    renderSection("Популярное", byScore),
    renderSection("Недавно опубликованные", byRecent),
    renderSection("Скоро выйдут", byUpcoming),
    ...Object.entries(genres).map(([name, list]) => renderSection(name, list))
  ].join("");

  const recent = byRecent[0];
  const banner = document.getElementById("recentBanner");
  if (!recent) return;
  banner.innerHTML = `
    <div class="hero-banner-content">
      <div>
        <h1>AniLuna</h1>
        <p>Новый релиз: ${getTitle(recent)}</p>
        <a class="primary-btn banner-btn" href="pages/anime.html?id=${recent.id}">▶ Смотреть</a>
      </div>
      <img src="${getImage(recent)}" alt="${getTitle(recent)}">
    </div>
  `;
}

async function loadAllAnime() {
  const pagesToFetch = [1, 2, 3, 4, 5, 6, 7, 8];
  const requests = pagesToFetch.map((page) => fetch(`/api/list?page=${page}&limit=50&order=ranked`).then((r) => r.json()).catch(() => null));
  const result = await Promise.all(requests);

  result.forEach((payload) => {
    if (payload?.data?.length) allAnime.push(...payload.data);
  });

  const unique = new Map();
  allAnime.forEach((a) => unique.set(a.id, a));
  allAnime.length = 0;
  allAnime.push(...unique.values());

  renderDynamicFilters();
  applyFilters();
  renderHomeSections();
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

function setupHeaderScroll() {
  const header = document.getElementById("siteHeader");
  let lastY = window.scrollY;
  window.addEventListener("scroll", () => {
    const current = window.scrollY;
    if (current > lastY && current > 120) {
      header.classList.add("header-hidden");
    } else {
      header.classList.remove("header-hidden");
    }
    lastY = current;
  }, { passive: true });
}

document.getElementById("search").addEventListener("input", applyFilters);
document.getElementById("filterGenre").addEventListener("change", applyFilters);
document.getElementById("filterYear").addEventListener("change", applyFilters);
document.getElementById("filterStatus").addEventListener("change", applyFilters);
document.getElementById("filterKind").addEventListener("change", applyFilters);

const querySearch = new URLSearchParams(window.location.search).get("search");
if (querySearch) {
  document.getElementById("search").value = querySearch;
  state.search = querySearch.toLowerCase();
}

setupHeaderScroll();
loadAllAnime();
