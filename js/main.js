async function loadAnime() {
  const res = await fetch("https://shikimori.one/api/animes?limit=12&order=popularity");
  const data = await res.json();

  const container = document.getElementById("grid");
  container.innerHTML = "";

  data.forEach(anime => {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <img src="https://shikimori.one${anime.image.original}">
      <h3>${anime.russian || anime.name}</h3>
    `;

    // 🔥 КЛИК → переход на страницу
    card.onclick = () => {
      window.location.href = `pages/anime.html?id=${anime.id}`;
    };

    container.appendChild(card);
  });
}

loadAnime();