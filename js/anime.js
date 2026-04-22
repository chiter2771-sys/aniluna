const homeState = { all: [], filteredGenre: "", genres: [] };
const FALLBACK_POSTER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='600'%3E%3Crect width='100%25' height='100%25' fill='%230c1630'/%3E%3Ctext x='50%25' y='50%25' fill='%2394a3b8' font-size='32' text-anchor='middle' dominant-baseline='middle'%3ENo Poster%3C/text%3E%3C/svg%3E";

const normalize = (text = "") => text.toLowerCase().replace(/ё/g, "е").replace(/[^\p{L}\p{N}\s]/gu, "").trim();
const getTitle = (anime) => anime.russian || anime.name || "Без названия";

function getImage(anime) {
  const original = anime.image?.original || anime.image?.preview || anime.image?.x96 || anime.image;
  if (!original) return FALLBACK_POSTER;
  return original.startsWith("http") || original.startsWith("data:") ? original : `https://shikimori.one${original}`;
}

function formatEpisodes(anime) {
  if (anime.kind === "movie") return "Фильм";
  if (anime.episodes_aired && anime.episodes) return `${anime.episodes_aired}/${anime.episodes} эп.`;
  if (anime.episodes) return `${anime.episodes} эп.`;
  return "? эп.";
}

function renderMiniCard(anime) {
  return `
    <a class="home-mini" href="pages/anime.html?id=${anime.id}">
      <img src="${getImage(anime)}" alt="${getTitle(anime)}" loading="lazy" decoding="async" onerror="this.src='${FALLBACK_POSTER}'">
      <div class="home-mini-info">
        <strong>${getTitle(anime)}</strong>
        <span>${formatEpisodes(anime)} · ⭐ ${anime.score || "?"}</span>
      </div>
    </a>
  `;
}

function makeCarousel(id, title, list) {
  if (!list.length) return "";
  return `
    <section class="home-row">
      <h2>${title}</h2>
      <div class="carousel-wrap">
        <button class="carousel-btn prev" data-target="${id}">‹</button>
        <div class="scroll-row" id="${id}">${list.map(renderMiniCard).join("")}</div>
        <button class="carousel-btn next" data-target="${id}">›</button>
      </div>
    </section>
  `;
}

function withGenreFilter(list) {
  if (!homeState.filteredGenre) return list;
  const needle = normalize(homeState.filteredGenre);
  return list.filter((anime) => (anime.genres || []).some((g) => normalize(g.russian || g.name).includes(needle)));
}

function byGenre(list, genreName) {
  const needle = normalize(genreName);
  return list.filter((anime) => (anime.genres || []).some((g) => normalize(g.russian || g.name).includes(needle)));
}

function bindCarousels() {
  document.querySelectorAll(".carousel-btn").forEach((btn) => {
    btn.onclick = () => {
      const row = document.getElementById(btn.dataset.target);
      if (!row) return;
      row.scrollBy({ left: btn.classList.contains("next") ? 260 : -260, behavior: "smooth" });
    };
  });
}

function renderHome() {
  const root = document.getElementById("homeSections");
  root.innerHTML = "";

  const base = withGenreFilter(homeState.all);
  const popular = [...base].sort((a, b) => Number(b.score || 0) - Number(a.score || 0)).slice(0, 18);
  const romance = byGenre(base, "роман").slice(0, 18);
  const action = byGenre(base, "боев").slice(0, 18);
  const comedy = byGenre(base, "комед").slice(0, 18);
  const hentai = byGenre(base, "хентай").slice(0, 18);
  const recent = [...base]
    .sort((a, b) => new Date(b.aired_on || 0) - new Date(a.aired_on || 0))
    .slice(0, 18);

  root.innerHTML += makeCarousel("row-popular", "Популярное", popular);
  root.innerHTML += makeCarousel("row-romance", "Романтика", romance);
  root.innerHTML += makeCarousel("row-action", "Боевик", action);
  root.innerHTML += makeCarousel("row-comedy", "Комедия", comedy);
  root.innerHTML += makeCarousel("row-hentai", "Хентай", hentai);
  root.innerHTML += makeCarousel("row-recent", "Недавно вышедшие", recent);

  bindCarousels();
}

function renderBanner() {
  const banner = document.getElementById("recentBanner");
  const recent = [...homeState.all].sort((a, b) => new Date(b.aired_on || 0) - new Date(a.aired_on || 0))[0];
  if (!recent) return;

  banner.innerHTML = `
    <div class="hero-banner-content">
      <div>
        <h1>AniLuna</h1>
        <p>Новый релиз: ${getTitle(recent)}</p>
        <a class="primary-btn banner-btn" href="pages/anime.html?id=${recent.id}">▶ Смотреть</a>
      </div>
      <img src="${getImage(recent)}" alt="${getTitle(recent)}" onerror="this.src='${FALLBACK_POSTER}'">
    </div>
  `;
}

async function loadHomeTitles() {
  const pages = [1, 2, 3, 4, 5];
  const result = await Promise.all(
    pages.map((page) => fetch(`/api/list?page=${page}&limit=50&order=ranked`).then((r) => r.json()).catch(() => ({ data: [] })))
  );

  const map = new Map();
  result.forEach((payload) => (payload.data || []).forEach((item) => map.set(item.id, item)));
  homeState.all = [...map.values()];

  const genresRes = await fetch("/api/genres").then((r) => r.json()).catch(() => ({ data: [] }));
  homeState.genres = (genresRes.data || [])
    .map((item) => item.russian || item.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "ru"));

  renderBanner();
  renderHome();
  renderGenreOverlay();
}

function setupHeaderScroll() {
  const header = document.getElementById("siteHeader");
  let lastY = window.scrollY;
  window.addEventListener("scroll", () => {
    const current = window.scrollY;
    if (current > lastY && current > 120) header.classList.add("header-hidden");
    else header.classList.remove("header-hidden");
    lastY = current;
  }, { passive: true });
}

function createSearchItem(item) {
  return `
    <a class="search-item" href="pages/anime.html?id=${item.id}">
      <img src="${getImage(item)}" alt="${getTitle(item)}" onerror="this.src='${FALLBACK_POSTER}'">
      <div>
        <strong>${getTitle(item)}</strong>
        <span>${item.aired_on ? item.aired_on.slice(0, 4) : "—"} • ${(item.kind || "tv").toUpperCase()}</span>
      </div>
    </a>
  `;
}

async function runSearch(query) {
  const results = document.getElementById("searchOverlayResults");
  if (!query) return (results.innerHTML = "<div class='empty-inline'>Начните вводить название.</div>");
  results.innerHTML = "<div class='empty-inline'>Поиск...</div>";

  const payload = await fetch(`/api/search?query=${encodeURIComponent(query)}&limit=8&page=1`).then((r) => r.json()).catch(() => ({ data: [] }));
  const list = payload.data || [];

  const moreButton = payload.hasMore
    ? `<a class='show-more-link' href='/search?q=${encodeURIComponent(query)}'>Показать ещё</a>`
    : "";

  results.innerHTML = list.length
    ? `${list.map(createSearchItem).join("")} ${moreButton}`
    : "<div class='empty-inline'>Ничего не найдено.</div>";
}

function setupSearchOverlay() {
  const input = document.getElementById("search");
  const overlay = document.getElementById("searchOverlay");
  const overlayInput = document.getElementById("searchOverlayInput");
  const close = document.getElementById("searchClose");

  const open = () => {
    overlay.classList.remove("hidden");
    document.body.classList.add("no-scroll");
    overlayInput.value = input.value;
    overlayInput.focus();
    runSearch(overlayInput.value.trim());
  };
  const hide = () => {
    overlay.classList.add("hidden");
    document.body.classList.remove("no-scroll");
  };

  input.addEventListener("focus", open);
  input.addEventListener("input", () => input.value.trim() && open());
  overlayInput.addEventListener("input", () => runSearch(overlayInput.value.trim()));
  overlayInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") window.location.href = `/search?q=${encodeURIComponent(overlayInput.value.trim())}`;
  });
  close.addEventListener("click", hide);
  overlay.addEventListener("click", (e) => e.target === overlay && hide());
  document.addEventListener("keydown", (e) => e.key === "Escape" && hide());
}

function renderGenreOverlay() {
  const host = document.getElementById("genreOverlayList");
  host.innerHTML = ["Все", ...homeState.genres].map((g) => `<button class="genre-btn">${g}</button>`).join("");

  host.querySelectorAll(".genre-btn").forEach((btn) => {
    btn.onclick = () => {
      homeState.filteredGenre = btn.textContent === "Все" ? "" : btn.textContent;
      document.getElementById("genreOverlay").classList.add("hidden");
      document.body.classList.remove("no-scroll");
      renderHome();
    };
  });
}

function setupGenreOverlay() {
  const overlay = document.getElementById("genreOverlay");
  document.getElementById("openGenres").onclick = () => {
    overlay.classList.remove("hidden");
    document.body.classList.add("no-scroll");
  };
  document.getElementById("genreClose").onclick = () => {
    overlay.classList.add("hidden");
    document.body.classList.remove("no-scroll");
  };
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlay.classList.add("hidden");
      document.body.classList.remove("no-scroll");
    }
  });
}

setupHeaderScroll();
setupSearchOverlay();
setupGenreOverlay();
loadHomeTitles();
