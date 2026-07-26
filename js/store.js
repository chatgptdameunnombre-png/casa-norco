import { db, MODO } from "./db.js";
import { setProductos, initCart, enCarrito } from "./cart.js";

const $ = s => document.querySelector(s);
const money = n => "$" + Number(n).toLocaleString("es-MX");
const CAT = document.querySelector("#catalogo")?.dataset.categoria || null;

let productos = [];
let io;
let subActiva = "Todas";

/* ---------- badge de modo ---------- */
const badge = document.createElement("div");
badge.className = "mode-badge mode-badge--" + (MODO === "nube" ? "nube" : "demo");
badge.textContent = MODO === "nube" ? "● En la nube (Firebase)" : "● Modo demo (local)";
document.body.appendChild(badge);

/* ---------- productos ---------- */
if (MODO === "demo") await db.seedIfEmpty();
db.onProducts(list => { productos = list; setProductos(list); renderCatalogo(); });

function stockInfo(s) {
  if (s <= 0) return { cls: "out", txt: "Agotado" };
  if (s <= 3) return { cls: "low", txt: `Últimas ${s}` };
  return { cls: "ok", txt: "Disponible" };
}

function cardHTML(p) {
  const st = stockInfo(p.stock);
  const sinStock = p.stock <= 0;
  const tope = enCarrito(p.id) >= p.stock;
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
          <div class="price">${money(p.precio)} <span>MXN</span></div>
          <span class="stock stock--${st.cls}">${st.txt}</span>
        </div>
        <button class="add-btn" data-add="${p.id}" ${sinStock || tope ? "disabled" : ""}>
          ${sinStock ? "Agotado" : tope ? "Máximo en carrito" : "Agregar al carrito"}
        </button>
      </div>
    </article>`;
}

function renderCatalogo() {
  const gridEl = $("#grid");
  if (!CAT || !gridEl) return;
  const delaCat = productos.filter(p => p.categoria === CAT);

  const subs = ["Todas", ...new Set(delaCat.map(p => p.subcategoria).filter(Boolean))];
  if (!subs.includes(subActiva)) subActiva = "Todas";
  const filtrosEl = $("#filtros");
  if (filtrosEl) filtrosEl.innerHTML = subs.length > 1 ? subs.map(sub =>
    `<button class="chip ${sub === subActiva ? "chip--on" : ""}" data-sub="${sub}">${sub}</button>`
  ).join("") : "";

  if (!productos.length) { gridEl.innerHTML = `<p style="color:var(--muted)">Cargando…</p>`; return; }
  const lista = subActiva === "Todas" ? delaCat : delaCat.filter(p => p.subcategoria === subActiva);
  gridEl.innerHTML = lista.length ? lista.map(cardHTML).join("")
    : `<p style="color:var(--muted)">Nada en "${subActiva}" por ahora.</p>`;
  observarReveal();
}

/* ---------- reveal ---------- */
function observarReveal() {
  io?.disconnect();
  io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .12 });
  document.querySelectorAll(".reveal:not(.in)").forEach(el => io.observe(el));
}

/* ---------- navegación a producto + sub-filtros ---------- */
document.addEventListener("click", e => {
  const chip = e.target.closest("[data-sub]");
  if (chip) { subActiva = chip.dataset.sub; renderCatalogo(); return; }
  if (e.target.closest("[data-add],[data-inc],[data-dec],[data-rm]")) return;
  const card = e.target.closest("[data-id]");
  if (card) window.location.href = `producto.html?id=${encodeURIComponent(card.dataset.id)}`;
});

initCart();
observarReveal();
document.addEventListener("cart:add", renderCatalogo);
