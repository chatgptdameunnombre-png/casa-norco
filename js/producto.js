import { db, MODO } from "./db.js";
import { setProductos, initCart, enCarrito } from "./cart.js";

const $ = s => document.querySelector(s);
const money = n => "$" + Number(n).toLocaleString("es-MX");
const id = new URLSearchParams(location.search).get("id");

const badge = document.createElement("div");
badge.className = "mode-badge mode-badge--" + (MODO === "nube" ? "nube" : "demo");
badge.textContent = MODO === "nube" ? "● En la nube (Firebase)" : "● Modo demo (local)";
document.body.appendChild(badge);

let productos = [];
db.onProducts(list => { productos = list; setProductos(list); render(); });

function stockInfo(s) {
  if (s <= 0) return { cls: "out", txt: "Agotado" };
  if (s <= 3) return { cls: "low", txt: `Últimas ${s} piezas` };
  return { cls: "ok", txt: "Disponible" };
}

function render() {
  const cont = $("#producto");
  if (!cont) return;
  const p = productos.find(x => x.id === id);
  if (!productos.length) { cont.innerHTML = `<p style="color:var(--muted)">Cargando…</p>`; return; }
  if (!p) {
    cont.innerHTML = `<div class="prod-404"><h2>Producto no encontrado</h2><a href="index.html" class="btn">← Volver a la tienda</a></div>`;
    return;
  }
  const fotos = p.imagenes?.length ? p.imagenes : (p.imagen ? [p.imagen] : []);
  const st = stockInfo(p.stock);
  const sinStock = p.stock <= 0;
  const tope = enCarrito(p.id) >= p.stock;
  const volver = p.categoria === "Bicicletas" ? "bicicletas.html" : "accesorios.html";

  const galeria = fotos.length
    ? `<div class="prod__main"><img id="prodMainImg" src="${fotos[0]}" alt="${p.nombre}"></div>
       ${fotos.length > 1 ? `<div class="prod__thumbs">${fotos.map((f, i) =>
         `<button class="prod__thumb ${i === 0 ? "on" : ""}" data-thumb="${f}"><img src="${f}" alt=""></button>`).join("")}</div>` : ""}`
    : `<div class="prod__main prod__main--ph">📷 Sin foto todavía</div>`;

  const specs = (p.specs || []).length
    ? `<h4 class="prod__spectitle">Especificaciones</h4><ul class="prod__specs">${p.specs.map(s => `<li>${s}</li>`).join("")}</ul>`
    : "";

  cont.innerHTML = `
    <a href="${volver}" class="volver">← ${p.categoria}</a>
    <div class="prod">
      <div class="prod__galeria">${galeria}</div>
      <div class="prod__info">
        <span class="prod__brand">${p.marca}${p.subcategoria ? " · " + p.subcategoria : ""}</span>
        <h1 class="prod__name">${p.nombre}</h1>
        <div class="prod__price">${money(p.precio)} <span>MXN</span></div>
        <span class="stock stock--${st.cls}">${st.txt}</span>
        <button class="add-btn add-btn--big" data-add="${p.id}" ${sinStock || tope ? "disabled" : ""}>
          ${sinStock ? "Agotado" : tope ? "Ya está en tu carrito (máximo)" : "Agregar al carrito"}
        </button>
        ${p.descripcion ? `<p class="prod__desc">${p.descripcion}</p>` : ""}
        ${specs}
      </div>
    </div>`;
  document.title = `${p.nombre} — Casa Norco`;
}

document.addEventListener("click", e => {
  const th = e.target.closest("[data-thumb]");
  if (th) {
    $("#prodMainImg").src = th.dataset.thumb;
    document.querySelectorAll(".prod__thumb").forEach(t => t.classList.toggle("on", t === th));
  }
});
document.addEventListener("cart:add", render);

initCart();
