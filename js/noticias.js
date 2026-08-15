/* Noticias / Anuncios con CARRUSEL de imágenes (flechitas ‹ ›).
   1) Posts de Instagram: arreglo ANUNCIOS (imgs = varias fotos locales + link al post).
   2) Preventas: se traen solas de Firebase (productos con preventa=true) con TODAS sus fotos. */
import { firebaseConfig } from "./config.js?v=21";

const ANUNCIOS = [
  {
    imgs: [
      "fotos/instagram/Db6aJUvJjhs.jpg",
      "fotos/instagram/casanorco-ig-01.jpg",
      "fotos/instagram/casanorco-ig-02.jpg"
    ],
    titulo: "Taller de mecánica básica para mujeres",
    texto: "Aprende a darle mantenimiento a tu bici en un taller pensado para ti. Cupo limitado.",
    tipo: "Taller",
    link: "https://www.instagram.com/p/Db6aJUvJjhs/",
    externo: true
  }
];

function carruselHTML(imgs, titulo) {
  const slides = imgs.map((src, i) =>
    `<img src="${src}" alt="${titulo}" loading="lazy" draggable="false">`).join("");
  const dots = imgs.length > 1
    ? `<div class="carru__dots">${imgs.map((_, i) => `<span class="${i === 0 ? "on" : ""}"></span>`).join("")}</div>` : "";
  const flechas = imgs.length > 1
    ? `<button class="carru__nav carru__prev" aria-label="Anterior">‹</button>
       <button class="carru__nav carru__next" aria-label="Siguiente">›</button>` : "";
  return `<div class="carru" data-i="0" data-n="${imgs.length}">
      <div class="carru__track">${slides}</div>${flechas}${dots}</div>`;
}

function cardHTML(a) {
  const attrs = a.externo ? `target="_blank" rel="noopener"` : "";
  const cta = a.externo ? "Ver publicación en Instagram ↗" : "Ver la bici →";
  return `
    <article class="anuncio reveal">
      <div class="anuncio__media">
        ${carruselHTML(a.imgs, a.titulo)}
        ${a.tipo ? `<span class="anuncio__tag">${a.tipo}</span>` : ""}
      </div>
      <div class="anuncio__body">
        <h3 class="anuncio__title">${a.titulo}</h3>
        <p class="anuncio__text">${a.texto || ""}</p>
        <a class="anuncio__btn" href="${a.link}" ${attrs}>${cta}</a>
      </div>
    </article>`;
}

const grid = document.querySelector("#noticiasGrid");
const FS = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;

async function preventas() {
  try {
    const q = { structuredQuery: { from: [{ collectionId: "productos" }],
      where: { fieldFilter: { field: { fieldPath: "preventa" }, op: "EQUAL", value: { booleanValue: true } } } } };
    const r = await fetch(`${FS}:runQuery?key=${firebaseConfig.apiKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(q) });
    const data = await r.json();
    const prods = (data || []).filter(x => x.document);
    return Promise.all(prods.map(async x => {
      const f = x.document.fields, id = x.document.name.split("/").pop();
      const imgs = [];
      if (f.imagen?.stringValue) imgs.push(f.imagen.stringValue);
      try {
        const rf = await fetch(`${FS}/productos_fotos/${id}?key=${firebaseConfig.apiKey}`);
        const df = await rf.json();
        (df.fields?.imagenes?.arrayValue?.values || []).forEach(v => v.stringValue && imgs.push(v.stringValue));
      } catch (e) {}
      return {
        imgs: imgs.length ? imgs : ["fotos/logo/iso-blanco.png"],
        titulo: f.nombre?.stringValue || "Producto",
        texto: "En preventa. Aparta la tuya — llega pronto.",
        tipo: "Preventa",
        link: `producto.html?id=${encodeURIComponent(id)}`,
        externo: false
      };
    }));
  } catch (e) { return []; }
}

function pinta(lista) {
  grid.innerHTML = lista.length ? lista.map(cardHTML).join("")
    : `<p style="color:var(--muted)">Pronto habrá novedades.</p>`;
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .12 });
  document.querySelectorAll(".reveal:not(.in)").forEach(el => io.observe(el));
}

/* navegación del carrusel */
function mover(carru, dir) {
  const n = +carru.dataset.n, track = carru.querySelector(".carru__track");
  let i = (+carru.dataset.i + dir + n) % n;
  carru.dataset.i = i;
  track.style.transform = `translateX(-${i * 100}%)`;
  carru.querySelectorAll(".carru__dots span").forEach((d, k) => d.classList.toggle("on", k === i));
}
document.addEventListener("click", e => {
  const nx = e.target.closest(".carru__next"); if (nx) { e.preventDefault(); mover(nx.closest(".carru"), 1); return; }
  const pv = e.target.closest(".carru__prev"); if (pv) { e.preventDefault(); mover(pv.closest(".carru"), -1); return; }
});

if (grid) {
  pinta(ANUNCIOS);
  preventas().then(pre => { if (pre.length) pinta([...pre, ...ANUNCIOS]); });
}
