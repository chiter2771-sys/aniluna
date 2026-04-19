document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("grid");

  container.innerHTML = ""; // очистка

  const grouped = {};

  animeList.forEach(a => {
    if (!a.genre) a.genre = "Без жанра"; // 🔥 защита от undefined

    if (!grouped[a.genre]) grouped[a.genre] = [];
    grouped[a.genre].push(a);
  });

  Object.keys(grouped).forEach(genre => {
    const section = document.createElement("div");
    section.className = "section";

    const title = document.createElement("h2");
    title.textContent = genre;
    title.style.margin;

    const grid = document.createElement("div");
    grid.className = "grid";

    grouped[genre].forEach(anime => {
      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `
        <img src="${anime.image}">
        <h3>${anime.title}</h3>
      `;

      card.onclick = () => {
        window.location.href = `/title?id=${anime.id}`;
      };

      grid.appendChild(card);
    });

    section.appendChild(title);
    section.appendChild(grid);

    container.appendChild(section);
  });
});