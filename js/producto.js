import { db, MODO } from "./db.js";
import { setProductos, initCart, enCarrito } from "./cart.js";
import { WHATSAPP_NUMERO, NEGOCIO, ENVIO_DOMICILIO } from "./config.js";

const $ = s => document.querySelector(s);
const money = n => "$" + Number(n).toLocaleString("es-MX");
const id = new URLSearchParams(location.search).get("id");

const badge = document.createElement("div");
badge.className = "mode-badge mode-badge--" + (MODO === "nube" ? "nube" : "demo");
badge.textContent = MODO === "nube" ? "● En la nube (Firebase)" : "● Modo demo (local)";
document.body.appendChild(badge);

let productos = [];
let fotosCache = null;
db.onProducts(async list => {
  productos = list;
  setProductos(list);
  if (fotosCache === null && list.some(x => x.id === id)) {
    try { fotosCache = await db.getFotos(id); } catch { fotosCache = null; }
  }
  render();
});

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
  const fotos = fotosCache?.length ? fotosCache : (p.imagenes?.length ? p.imagenes : (p.imagen ? [p.imagen] : []));
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
        <button class="add-btn add-btn--big" id="buyNow" ${sinStock ? "disabled" : ""} style="margin-top:10px;background:#25D366;color:#0a0a0a">
          ${sinStock ? "Agotado" : "Comprar por WhatsApp"}
        </button>
        <label style="display:flex;align-items:center;gap:8px;margin-top:12px;cursor:pointer;font-size:14px">
          <input type="checkbox" id="envioProd" style="width:18px;height:18px;accent-color:#c6f032"> Envío a domicilio (+${money(ENVIO_DOMICILIO)})
        </label>
        <div id="prodTotal" style="margin-top:8px;font-weight:600;color:#c6f032"></div>
        ${p.descripcion ? `<p class="prod__desc">${p.descripcion}</p>` : ""}
        ${specs}
      </div>
    </div>`;
  document.title = `${p.nombre} — Casa Norco`;
}

function actualizarTotal() {
  const p = productos.find(x => x.id === id);
  const el = $("#prodTotal");
  if (!p || !el) return;
  el.textContent = $("#envioProd")?.checked ? `Total con envío: ${money(p.precio + ENVIO_DOMICILIO)}` : "";
}

function comprarDirecto() {
  const p = productos.find(x => x.id === id);
  if (!p || p.stock <= 0) return;
  const envio = $("#envioProd")?.checked;
  const total = p.precio + (envio ? ENVIO_DOMICILIO : 0);
  let msg = `¡Hola ${NEGOCIO.nombre}! Quiero comprar:\n\n• ${p.nombre} — ${money(p.precio)}\n`;
  msg += envio ? `Envío a domicilio: ${money(ENVIO_DOMICILIO)}` : `Recoger en tienda`;
  msg += `\n\nTotal: ${money(total)}\n\n¿Cómo continúo con el pago?`;
  window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(msg)}`, "_blank");
}

document.addEventListener("click", e => {
  const th = e.target.closest("[data-thumb]");
  if (th) {
    $("#prodMainImg").src = th.dataset.thumb;
    document.querySelectorAll(".prod__thumb").forEach(t => t.classList.toggle("on", t === th));
  }
  if (e.target.closest("#buyNow")) comprarDirecto();
});
document.addEventListener("change", e => { if (e.target.id === "envioProd") actualizarTotal(); });
document.addEventListener("cart:add", render);

initCart();
