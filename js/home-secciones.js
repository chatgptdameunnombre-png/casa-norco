/* Secciones de la HOME: Seminuevos (fila de bicis) + Noticias (slider de banners, 1 a la vez). */
import { firebaseConfig } from "./config.js";
import { precioDesde, preciosVarian } from "./tallas.js";

const FS = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;
const KEY = firebaseConfig.apiKey;
const money = n => "$" + Number(n).toLocaleString("es-MX");

/* -------- parser Firestore -> objeto plano -------- */
function fsVal(v) {
  if (!v) return undefined;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return parseInt(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fsVal);
  if ("mapValue" in v) return fsFields(v.mapValue.fields || {});
  return undefined;
}
function fsFields(f) { const o = {}; for (const k in f) o[k] = fsVal(f[k]); return o; }

async function runQuery(field) {
  const q = { structuredQuery: { from: [{ collectionId: "productos" }],
    where: { fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: { booleanValue: true } } } } };
  const r = await fetch(`${FS}:runQuery?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(q) });
  const data = await r.json();
  return (data || []).filter(x => x.document).map(x => ({ id: x.document.name.split("/").pop(), ...fsFields(x.document.fields) }));
}

/* ================= SEMINUEVOS ================= */
function cardSemiHTML(p) {
  const precioTxt = preciosVarian(p) ? `desde ${money(precioDesde(p))}` : money(precioDesde(p));
  const media = p.imagen
    ? `<img src="${p.imagen}" alt="${p.nombre}" loading="lazy">`
    : `<span class="card__ph">📷</span>`;
  return `
    <a class="card reveal" href="producto.html?id=${encodeURIComponent(p.id)}" style="text-decoration:none">
      <div class="card__media">
        <span class="card__cat">${p.subcategoria || p.categoria || ""}</span>
        <span class="card__flag card__flag--semi">Seminuevo</span>
        ${media}
      </div>
      <div class="card__body">
        <span class="card__brand">${p.marca || ""}</span>
        <h3 class="card__name">${p.nombre}</h3>
        <div class="card__foot"><div class="price">${precioTxt} <span>MXN</span></div></div>
        <span class="add-btn" style="text-align:center">Ver bici</span>
      </div>
    </a>`;
}

async function cargarSeminuevos() {
  const cont = document.querySelector("#homeSeminuevos");
  if (!cont) return;
  try {
    const semis = await runQuery("seminuevo");
    cont.innerHTML = semis.length ? semis.map(cardSemiHTML).join("")
      : `<p style="color:var(--muted)">Pronto habrá seminuevos.</p>`;
  } catch (e) { cont.innerHTML = ""; }
  revelar();
}

/* ================= NOTICIAS (slider de banners) ================= */
const ANUNCIOS = [
  { img: "fotos/instagram/Db6aJUvJjhs.jpg", tipo: "Taller",
    titulo: "Taller de mecánica básica para mujeres",
    texto: "Aprende a darle mantenimiento a tu bici en un taller pensado para ti. Cupo limitado.",
    link: "https://www.instagram.com/p/Db6aJUvJjhs/", externo: true }
];

function bannerHTML(a, i) {
  const attrs = a.externo ? `target="_blank" rel="noopener"` : "";
  const cta = a.externo ? "Ver en Instagram ↗" : "Ver la bici →";
  return `
    <div class="bslide${i === 0 ? " on" : ""}" style="background-image:url('${a.img}')">
      <div class="bslide__shade"></div>
      <div class="bslide__c">
        ${a.tipo ? `<span class="bslide__tag">${a.tipo}</span>` : ""}
        <h3>${a.titulo}</h3>
        <p>${a.texto || ""}</p>
        <a class="bslide__btn" href="${a.link}" ${attrs}>${cta}</a>
      </div>
    </div>`;
}

async function cargarNoticias() {
  const cont = document.querySelector("#homeNoticias");
  if (!cont) return;
  let pre = [];
  try {
    pre = (await runQuery("preventa")).map(p => ({
      img: p.imagen, tipo: "Preventa", titulo: p.nombre,
      texto: "En preventa. Aparta la tuya — llega pronto.",
      link: `producto.html?id=${encodeURIComponent(p.id)}`, externo: false
    })).filter(a => a.img);
  } catch (e) {}
  const lista = [...ANUNCIOS, ...pre];
  const dots = lista.map((_, i) => `<span class="${i === 0 ? "on" : ""}" data-go="${i}"></span>`).join("");
  const flechas = lista.length > 1
    ? `<button class="bslider__nav bslider__prev" aria-label="Anterior">‹</button>
       <button class="bslider__nav bslider__next" aria-label="Siguiente">›</button>` : "";
  cont.innerHTML = `<div class="bslider" data-i="0" data-n="${lista.length}">
      ${lista.map(bannerHTML).join("")}${flechas}
      <div class="bslider__dots">${dots}</div></div>`;
  initSlider(cont.querySelector(".bslider"));
  revelar();
}

function initSlider(sl) {
  if (!sl) return;
  const n = +sl.dataset.n;
  const slides = sl.querySelectorAll(".bslide");
  const dots = sl.querySelectorAll(".bslider__dots span");
  let timer;
  const ir = k => {
    const i = (k + n) % n;
    sl.dataset.i = i;
    slides.forEach((s, j) => s.classList.toggle("on", j === i));
    dots.forEach((d, j) => d.classList.toggle("on", j === i));
  };
  const auto = () => { clearInterval(timer); if (n > 1) timer = setInterval(() => ir(+sl.dataset.i + 1), 6000); };
  sl.querySelector(".bslider__next")?.addEventListener("click", () => { ir(+sl.dataset.i + 1); auto(); });
  sl.querySelector(".bslider__prev")?.addEventListener("click", () => { ir(+sl.dataset.i - 1); auto(); });
  dots.forEach(d => d.addEventListener("click", () => { ir(+d.dataset.go); auto(); }));
  auto();
}

/* -------- reveal -------- */
let io;
function revelar() {
  io?.disconnect();
  io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .12 });
  document.querySelectorAll(".reveal:not(.in)").forEach(el => io.observe(el));
}

cargarSeminuevos();
cargarNoticias();
