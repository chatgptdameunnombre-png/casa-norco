import { db, MODO } from "./db.js";
import { setProductos, initCart, enCarrito } from "./cart.js";
import { tieneTallas, stockTotal, precioDesde, preciosVarian, etiquetaStock } from "./tallas.js";

const $ = s => document.querySelector(s);
const money = n => "$" + Number(n).toLocaleString("es-MX");
const CAT = document.querySelector("#catalogo")?.dataset.categoria || null;

let productos = [];
let io;
let f = { sub: "Todas", marca: "Todas", genero: "Todos", orden: "rel" };

/* ---------- badge de modo ---------- */
const badge = document.createElement("div");
badge.className = "mode-badge mode-badge--" + (MODO === "nube" ? "nube" : "demo");
badge.textContent = MODO === "nube" ? "● En la nube (Firebase)" : "● Modo demo (local)";
document.body.appendChild(badge);

/* ---------- productos ---------- */
if (MODO === "demo") await db.seedIfEmpty();
db.onProducts(list => { productos = list; setProductos(list); renderCatalogo(); });

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
  return `
    <article class="card reveal" data-id="${p.id}">
      <div class="card__media">
        <span class="card__cat">${p.subcategoria || p.categoria}</span>
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

/* ---------- panel de filtros ---------- */
function grupoChips(label, key, valores, activo) {
  if (valores.length <= 2) return "";
  return `<div class="fgroup"><span class="fgroup__lbl">${label}</span>
    <div class="fgroup__chips">${valores.map(v =>
      `<button class="chip ${v === activo ? "chip--on" : ""}" data-f="${key}" data-v="${v}">${v}</button>`
    ).join("")}</div></div>`;
}

function renderCatalogo() {
  const gridEl = $("#grid");
  if (!CAT || !gridEl) return;
  const delaCat = productos.filter(p => p.categoria === CAT);

  const subs = ["Todas", ...new Set(delaCat.map(p => p.subcategoria).filter(Boolean))];
  const marcas = ["Todas", ...[...new Set(delaCat.map(p => p.marca).filter(Boolean))].sort((a, b) => a.localeCompare(b))];
  const generos = ["Todos", ...new Set(delaCat.map(p => p.genero).filter(Boolean))];
  if (!subs.includes(f.sub)) f.sub = "Todas";
  if (!marcas.includes(f.marca)) f.marca = "Todas";
  if (!generos.includes(f.genero)) f.genero = "Todos";

  const filtrosEl = $("#filtros");
  if (filtrosEl) {
    filtrosEl.innerHTML =
      grupoChips("Tipo", "sub", subs, f.sub) +
      grupoChips("Marca", "marca", marcas, f.marca) +
      grupoChips("Género", "genero", generos, f.genero) +
      `<div class="fgroup fgroup--orden"><span class="fgroup__lbl">Orden</span>
        <select id="ordenSel" class="fsel">
          <option value="rel">Relevancia</option>
          <option value="precio-asc">Precio: menor a mayor</option>
          <option value="precio-desc">Precio: mayor a menor</option>
          <option value="nombre">Nombre A–Z</option>
        </select></div>`;
    const sel = $("#ordenSel"); if (sel) sel.value = f.orden;
  }

  if (!productos.length) { gridEl.innerHTML = `<p style="color:var(--muted)">Cargando…</p>`; return; }

  let lista = delaCat.filter(p =>
    (f.sub === "Todas" || p.subcategoria === f.sub) &&
    (f.marca === "Todas" || p.marca === f.marca) &&
    (f.genero === "Todos" || p.genero === f.genero));

  if (f.orden === "precio-asc") lista.sort((a, b) => precioDesde(a) - precioDesde(b));
  else if (f.orden === "precio-desc") lista.sort((a, b) => precioDesde(b) - precioDesde(a));
  else if (f.orden === "nombre") lista.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));

  gridEl.innerHTML = lista.length ? lista.map(cardHTML).join("")
    : `<p style="color:var(--muted)">Nada con esos filtros. Prueba quitar alguno.</p>`;
  observarReveal();
}

/* ---------- reveal ---------- */
function observarReveal() {
  io?.disconnect();
  io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .12 });
  document.querySelectorAll(".reveal:not(.in)").forEach(el => io.observe(el));
}

/* ---------- interacción: filtros, orden, navegación ---------- */
document.addEventListener("click", e => {
  const chip = e.target.closest("[data-f]");
  if (chip) { f[chip.dataset.f] = chip.dataset.v; renderCatalogo(); return; }
  if (e.target.closest("[data-add],[data-inc],[data-dec],[data-rm]")) return;
  const card = e.target.closest("[data-id]");
  if (card) window.location.href = `producto.html?id=${encodeURIComponent(card.dataset.id)}`;
});
document.addEventListener("change", e => {
  if (e.target.id === "ordenSel") { f.orden = e.target.value; renderCatalogo(); }
});

initCart();
observarReveal();
document.addEventListener("cart:add", renderCatalogo);
