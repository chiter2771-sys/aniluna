const homeState = {
  all: [],
  filteredGenre: ""
};

const normalize = (text = "") => text
  .toLowerCase()
  .replace(/ё/g, "е")
  .replace(/[^\p{L}\p{N}\s]/gu, "")
  .trim();

function getTitle(anime) {
  return anime.russian || anime.name || "Без названия";
}

function getImage(anime) {
  const original = anime.image?.original || anime.image?.preview || anime.image?.x96;
  return original ? `https://shikimori.one${original}` : "";
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
      <img src="${getImage(anime)}" alt="${getTitle(anime)}" loading="lazy" decoding="async">
      <div class="home-mini-info">
        <strong>${getTitle(anime)}</strong>
        <span>${formatEpisodes(anime)} · ⭐ ${anime.score || "?"}</span>
      </div>
    </a>
  `;
}

function renderRow(title, list) {
  if (!list.length) return "";
  return `
    <section class="home-row">
      <h2>${title}</h2>
      <div class="scroll-row">${list.map(renderMiniCard).join("")}</div>
    </section>
  `;
}

function withGenreFilter(list) {
  if (!homeState.filteredGenre) return list;
  return list.filter((anime) => (anime.genres || []).some((g) => normalize(g.russian || g.name) === normalize(homeState.filteredGenre)));
}

function renderGenrePanel() {
  const root = document.getElementById("homeSections");
  const genres = [...new Set(homeState.all.flatMap((a) => (a.genres || []).map((g) => g.russian || g.name).filter(Boolean)))].sort((a, b) => a.localeCompare(b, "ru"));

  const panel = document.createElement("section");
  panel.className = "genre-panel";
  panel.innerHTML = `
    <h2>Жанры</h2>
    <div class="genre-inline" id="genreInline"></div>
  `;

  root.appendChild(panel);
  const container = panel.querySelector("#genreInline");

  ["Все", ...genres].forEach((name) => {
    const btn = document.createElement("button");
    btn.className = `genre-btn${(!homeState.filteredGenre && name === "Все") || homeState.filteredGenre === name ? " active" : ""}`;
    btn.textContent = name;
    btn.onclick = () => {
      homeState.filteredGenre = name === "Все" ? "" : name;
      renderHome();
    };
    container.appendChild(btn);
  });
}

function appendRow(root, title, list) {
  const rowMarkup = renderRow(title, list);
  if (!rowMarkup) return;

  const fragment = document.createRange().createContextualFragment(rowMarkup);
  root.appendChild(fragment);
}

function renderHome() {
  const root = document.getElementById("homeSections");
  root.innerHTML = "";

  renderGenrePanel();

  const base = withGenreFilter(homeState.all);
  const popular = [...base].sort((a, b) => Number(b.score || 0) - Number(a.score || 0)).slice(0, 12);
  const recent = [...base].sort((a, b) => new Date(b.aired_on || 0) - new Date(a.aired_on || 0)).slice(0, 12);
  const upcoming = base.filter((a) => a.status === "anons").slice(0, 12);

  appendRow(root, "Популярное", popular);
  appendRow(root, "Недавно опубликованные", recent);
  appendRow(root, "Скоро выйдут", upcoming);

  const romance = base.filter((a) => (a.genres || []).some((g) => normalize(g.russian || g.name).includes("роман"))).slice(0, 12);
  const comedy = base.filter((a) => (a.genres || []).some((g) => normalize(g.russian || g.name).includes("комед"))).slice(0, 12);
  const action = base.filter((a) => (a.genres || []).some((g) => {
    const n = normalize(g.russian || g.name);
    return n.includes("экшен") || n.includes("боев");
  })).slice(0, 12);

  appendRow(root, "Романтика", romance);
  appendRow(root, "Комедия", comedy);
  appendRow(root, "Боевик", action);
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
      <img src="${getImage(recent)}" alt="${getTitle(recent)}">
    </div>
  `;
}

async function loadHomeTitles() {
  // Только 40 тайтлов на главной для скорости.
  const pages = [1, 2];
  const result = await Promise.all(pages.map((page) => fetch(`/api/list?page=${page}&limit=20&order=ranked`).then((r) => r.json()).catch(() => ({ data: [] }))));

  const map = new Map();
  result.forEach((payload) => (payload.data || []).forEach((item) => map.set(item.id, item)));
  homeState.all = [...map.values()].slice(0, 40);

  renderBanner();
  renderHome();
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
      <img src="${getImage(item)}" alt="${getTitle(item)}">
      <div>
        <strong>${getTitle(item)}</strong>
        <span>${item.aired_on ? item.aired_on.slice(0, 4) : "—"} • ${(item.kind || "tv").toUpperCase()}</span>
      </div>
    </a>
  `;
}

async function runSearch(query) {
  const results = document.getElementById("searchOverlayResults");
  if (!query) {
    results.innerHTML = "<div class='empty-inline'>Начните вводить название.</div>";
    return;
  }

  results.innerHTML = "<div class='empty-inline'>Поиск...</div>";
  const res = await fetch(`/api/search?query=${encodeURIComponent(query)}&limit=160`);
  const payload = await res.json();
  const list = payload.data || [];

  if (!list.length) {
    results.innerHTML = "<div class='empty-inline'>Ничего не найдено.</div>";
    return;
  }

  results.innerHTML = list.map(createSearchItem).join("");
}

function setupSearchOverlay() {
  const input = document.getElementById("search");
  const overlay = document.getElementById("searchOverlay");
  const overlayInput = document.getElementById("searchOverlayInput");
  const close = document.getElementById("searchClose");

  const open = () => {
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
    overlayInput.value = input.value;
    overlayInput.focus();
    runSearch(overlayInput.value.trim());
  };

  const hide = () => {
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll");
  };

  input.addEventListener("focus", open);
  input.addEventListener("input", () => {
    if (input.value.trim().length > 0) open();
  });

  overlayInput.addEventListener("input", () => runSearch(overlayInput.value.trim()));
  close.addEventListener("click", hide);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) hide();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hide();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      open();
    }
  });
}

setupHeaderScroll();
setupSearchOverlay();
loadHomeTitles();
