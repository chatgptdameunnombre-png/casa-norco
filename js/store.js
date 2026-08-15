import { db, MODO } from "./db.js";
import { setProductos, initCart, enCarrito } from "./cart.js";
import { tieneTallas, stockTotal, precioDesde, preciosVarian, etiquetaStock } from "./tallas.js";

const $ = s => document.querySelector(s);
const money = n => "$" + Number(n).toLocaleString("es-MX");
const CAT = document.querySelector("#catalogo")?.dataset.categoria || null;
const MODO_SEMI = document.querySelector("#catalogo")?.dataset.modo === "seminuevo";
const base = () => MODO_SEMI ? productos.filter(p => p.seminuevo) : productos.filter(p => p.categoria === CAT && !p.seminuevo);

let productos = [];
let io;
let panelListo = false;
let f = { sub: "Todas", marca: "Todas", genero: "Todos", orden: "rel" };

/* ---------- badge de modo ---------- */
const badge = document.createElement("div");
badge.className = "mode-badge mode-badge--" + (MODO === "nube" ? "nube" : "demo");
badge.textContent = MODO === "nube" ? "● En la nube (Firebase)" : "● Modo demo (local)";
document.body.appendChild(badge);

/* ---------- productos ---------- */
if (MODO === "demo") await db.seedIfEmpty();
db.onProducts(list => { productos = list; setProductos(list); render(); });

function cardHTML(p) {
  const total = stockTotal(p);
  const st = etiquetaStock(total);
  const sinStock = total <= 0;
  const sized = tieneTallas(p);
  const precioTxt = preciosVarian(p) ? `desde ${money(precioDesde(p))}` : money(precioDesde(p));
  const boton = sinStock
    ? `<button class="add-btn" disabled>Agotado</button>`
    : sized
      ? `<a class="add-btn" href="producto.html?id=${encodeURIComponent(p.id)}" style="display:block;text-align:center;text-decoration:none">Elegir talla</a>`
      : (enCarrito(p.id) >= total
          ? `<button class="add-btn" disabled>Máximo en carrito</button>`
          : `<button class="add-btn" data-add="${p.id}">Agregar al carrito</button>`);
  const media = p.imagen
    ? `<img src="${p.imagen}" alt="${p.nombre}" loading="lazy" onerror="this.style.display='none';this.parentElement.querySelector('.card__ph').style.display='block'">
       <span class="card__ph" style="display:none">📷 Sin foto aún</span>`
    : `<span class="card__ph">📷 Foto pendiente<br><small>(el dueño la sube en el panel)</small></span>`;
  const flags = [
    p.preventa ? `<span class="card__flag card__flag--pre">Preventa</span>` : "",
    p.seminuevo ? `<span class="card__flag card__flag--semi">Usado</span>` : ""
  ].join("");
  return `
    <article class="card reveal" data-id="${p.id}">
      <div class="card__media">
        <span class="card__cat">${p.subcategoria || p.categoria}</span>
        ${flags}
        ${media}
      </div>
      <div class="card__body">
        <span class="card__brand">${p.marca}</span>
        <h3 class="card__name">${p.nombre}</h3>
        <p class="card__desc">${p.descripcion || ""}</p>
        <div class="card__foot">
          <div class="price">${precioTxt} <span>MXN</span></div>
          <span class="stock stock--${st.cls}">${st.txt}</span>
        </div>
        ${boton}
      </div>
    </article>`;
}

/* ---------- panel de filtros flotante (se construye 1 vez) ---------- */
function grupo(lbl, key, valores, abierto) {
  if (valores.length <= 2) return "";
  const opts = valores.map(v =>
    `<span class="opt" data-f="${key}" data-v="${v}">${v}</span>`).join("");
  return `<div class="acc${abierto ? " open" : ""}" data-grp="${key}">
      <button class="acc__h" type="button"><span>${lbl}</span><span class="arr">▾</span></button>
      <div class="acc__b">${opts}</div></div>`;
}

function buildPanel() {
  const cont = $("#filtros");
  if (!cont) return;
  const delaCat = base();
  const subs = ["Todas", ...new Set(delaCat.map(p => p.subcategoria).filter(Boolean))];
  const marcas = ["Todas", ...[...new Set(delaCat.map(p => p.marca).filter(Boolean))].sort((a, b) => a.localeCompare(b))];
  const generos = ["Todos", ...new Set(delaCat.map(p => p.genero).filter(Boolean))];
  cont.innerHTML = `
    <button class="filtros-btn" type="button" id="filtrosBtn">
      <span class="fico">≡</span> Filtros <span class="fcount" id="fcount"></span>
    </button>
    <div class="filtros-panel" id="filtrosPanel" hidden>
      ${grupo("Tipo", "sub", subs, true)}
      ${grupo("Marca", "marca", marcas, false)}
      ${grupo("Género", "genero", generos, false)}
      <div class="acc" data-grp="orden">
        <button class="acc__h" type="button"><span>Orden</span><span class="arr">▾</span></button>
        <div class="acc__b">
          <span class="opt" data-f="orden" data-v="rel">Relevancia</span>
          <span class="opt" data-f="orden" data-v="precio-asc">Precio: menor a mayor</span>
          <span class="opt" data-f="orden" data-v="precio-desc">Precio: mayor a menor</span>
          <span class="opt" data-f="orden" data-v="nombre">Nombre A–Z</span>
        </div>
      </div>
    </div>`;
  panelListo = true;
  marcarSel();
}

function marcarSel() {
  document.querySelectorAll("#filtrosPanel .opt").forEach(o => {
    o.classList.toggle("sel", f[o.dataset.f] === o.dataset.v);
  });
  const activos = (f.sub !== "Todas") + (f.marca !== "Todas") + (f.genero !== "Todos") + (f.orden !== "rel");
  const c = $("#fcount"); if (c) { c.textContent = activos ? activos : ""; c.style.display = activos ? "" : "none"; }
}

function render() {
  const gridEl = $("#grid");
  if ((!CAT && !MODO_SEMI) || !gridEl) return;
  if (!panelListo && productos.length) buildPanel();

  const lista = base()
    .filter(p =>
      (f.sub === "Todas" || p.subcategoria === f.sub) &&
      (f.marca === "Todas" || p.marca === f.marca) &&
      (f.genero === "Todos" || p.genero === f.genero));
  if (f.orden === "precio-asc") lista.sort((a, b) => precioDesde(a) - precioDesde(b));
  else if (f.orden === "precio-desc") lista.sort((a, b) => precioDesde(b) - precioDesde(a));
  else if (f.orden === "nombre") lista.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));

  if (!productos.length) { gridEl.innerHTML = `<p style="color:var(--muted)">Cargando…</p>`; return; }
  gridEl.innerHTML = lista.length ? lista.map(cardHTML).join("")
    : `<p style="color:var(--muted)">Nada con esos filtros. Prueba quitar alguno.</p>`;
  marcarSel();
  observarReveal();
}

/* ---------- reveal ---------- */
function observarReveal() {
  io?.disconnect();
  io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .12 });
  document.querySelectorAll(".reveal:not(.in)").forEach(el => io.observe(el));
}

/* ---------- interacción ---------- */
document.addEventListener("click", e => {
  // abrir/cerrar panel
  if (e.target.closest("#filtrosBtn")) { $("#filtrosPanel")?.toggleAttribute("hidden"); return; }
  // abrir/cerrar sección del acordeón
  const h = e.target.closest(".acc__h");
  if (h) { h.parentElement.classList.toggle("open"); return; }
  // elegir opción de filtro
  const opt = e.target.closest("#filtrosPanel .opt");
  if (opt) { f[opt.dataset.f] = opt.dataset.v; render(); return; }
  // cerrar panel al hacer click fuera
  if (!e.target.closest("#filtros")) $("#filtrosPanel")?.setAttribute("hidden", "");
  // navegación / carrito
  if (e.target.closest("[data-add],[data-inc],[data-dec],[data-rm]")) return;
  const card = e.target.closest("[data-id]");
  if (card) window.location.href = `producto.html?id=${encodeURIComponent(card.dataset.id)}`;
});

initCart();
observarReveal();
document.addEventListener("cart:add", render);
