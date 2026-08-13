/* Noticias / Anuncios:
   1) Posts de Instagram (arreglo ANUNCIOS abajo — imagen local + link al post).
   2) Preventas: se traen solas de Firebase (productos con preventa=true) y salen como anuncio. */
import { firebaseConfig } from "./config.js";

const ANUNCIOS = [
  {
    img: "fotos/instagram/Db6aJUvJjhs.jpg",
    titulo: "Taller de mecánica básica para mujeres",
    texto: "Aprende a darle mantenimiento a tu bici en un taller pensado para ti. Cupo limitado.",
    tipo: "Taller",
    link: "https://www.instagram.com/p/Db6aJUvJjhs/",
    externo: true
  }
];

function cardHTML(a) {
  const attrs = a.externo ? `target="_blank" rel="noopener"` : "";
  const cta = a.externo ? "Ver publicación en Instagram ↗" : "Ver la bici →";
  return `
    <article class="anuncio reveal">
      <a class="anuncio__media" href="${a.link}" ${attrs}>
        <img src="${a.img}" alt="${a.titulo}" loading="lazy">
        ${a.tipo ? `<span class="anuncio__tag">${a.tipo}</span>` : ""}
      </a>
      <div class="anuncio__body">
        <h3 class="anuncio__title">${a.titulo}</h3>
        <p class="anuncio__text">${a.texto || ""}</p>
        <a class="anuncio__btn" href="${a.link}" ${attrs}>${cta}</a>
      </div>
    </article>`;
}

const grid = document.querySelector("#noticiasGrid");

async function preventas() {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents:runQuery?key=${firebaseConfig.apiKey}`;
    const q = { structuredQuery: { from: [{ collectionId: "productos" }],
      where: { fieldFilter: { field: { fieldPath: "preventa" }, op: "EQUAL", value: { booleanValue: true } } } } };
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(q) });
    const data = await r.json();
    return (data || []).filter(x => x.document).map(x => {
      const f = x.document.fields, id = x.document.name.split("/").pop();
      const g = k => f[k] && (f[k].stringValue ?? f[k].integerValue ?? "");
      return {
        img: g("imagen"),
        titulo: g("nombre"),
        texto: "En preventa. Aparta la tuya — llega pronto.",
        tipo: "Preventa",
        link: `producto.html?id=${encodeURIComponent(id)}`,
        externo: false
      };
    }).filter(a => a.img);
  } catch (e) { return []; }
}

function pinta(lista) {
  grid.innerHTML = lista.length ? lista.map(cardHTML).join("")
    : `<p style="color:var(--muted)">Pronto habrá novedades.</p>`;
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .12 });
  document.querySelectorAll(".reveal:not(.in)").forEach(el => io.observe(el));
}

if (grid) {
  pinta(ANUNCIOS);
  preventas().then(pre => { if (pre.length) pinta([...pre, ...ANUNCIOS]); });
}
