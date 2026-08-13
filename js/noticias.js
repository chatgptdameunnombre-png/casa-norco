/* Anuncios / Noticias — publicaciones de Instagram (imagen + link al post).
   Para agregar una: añade un objeto arriba del arreglo. */
const ANUNCIOS = [
  {
    img: "fotos/instagram/Db6aJUvJjhs.jpg",
    titulo: "Taller de mecánica básica para mujeres",
    texto: "Aprende a darle mantenimiento a tu bici en un taller pensado para ti. Cupo limitado.",
    tipo: "Taller",
    link: "https://www.instagram.com/p/Db6aJUvJjhs/"
  }
];

function cardHTML(a) {
  return `
    <article class="anuncio reveal">
      <a class="anuncio__media" href="${a.link}" target="_blank" rel="noopener">
        <img src="${a.img}" alt="${a.titulo}" loading="lazy">
        ${a.tipo ? `<span class="anuncio__tag">${a.tipo}</span>` : ""}
      </a>
      <div class="anuncio__body">
        <h3 class="anuncio__title">${a.titulo}</h3>
        <p class="anuncio__text">${a.texto || ""}</p>
        <a class="anuncio__btn" href="${a.link}" target="_blank" rel="noopener">Ver publicación en Instagram ↗</a>
      </div>
    </article>`;
}

const grid = document.querySelector("#noticiasGrid");
if (grid) {
  grid.innerHTML = ANUNCIOS.length
    ? ANUNCIOS.map(cardHTML).join("")
    : `<p style="color:var(--muted)">Pronto habrá novedades.</p>`;
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .12 });
  document.querySelectorAll(".reveal:not(.in)").forEach(el => io.observe(el));
}
