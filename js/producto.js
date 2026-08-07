import { db, MODO } from "./db.js";
import { setProductos, initCart, enCarrito } from "./cart.js";
import { WHATSAPP_NUMERO, NEGOCIO, ENVIO_DOMICILIO, COBRO_WEBHOOK } from "./config.js";
import { iniciarPago } from "./checkout.js";

const $ = s => document.querySelector(s);
const money = n => "$" + Number(n).toLocaleString("es-MX");
const id = new URLSearchParams(location.search).get("id");

const badge = document.createElement("div");
badge.className = "mode-badge mode-badge--" + (MODO === "nube" ? "nube" : "demo");
badge.textContent = MODO === "nube" ? "● En la nube (Firebase)" : "● Modo demo (local)";
document.body.appendChild(badge);

let productos = [];
let fotosCache = null;
let entregaProd = null;
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
        <div style="display:flex;gap:10px;margin-top:6px">
          <button class="add-btn add-btn--big" data-add="${p.id}" ${sinStock || tope ? "disabled" : ""} style="flex:1;margin:0">
            ${sinStock ? "Agotado" : tope ? "Máximo" : "Agregar al carrito"}
          </button>
          <button class="add-btn add-btn--big" id="buyNow" ${sinStock ? "disabled" : ""} style="flex:1;margin:0;background:#c6f032;color:#0a0a0a">
            ${sinStock ? "Agotado" : "Comprar"}
          </button>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button type="button" class="entrega-op" data-entrega="tienda" style="flex:1;padding:11px;border-radius:12px;border:1px solid #2a2a30;background:#17171b;color:#f4f4f5;font-size:13px;cursor:pointer">🏪 Recoger en tienda</button>
          <button type="button" class="entrega-op" data-entrega="domicilio" style="flex:1;padding:11px;border-radius:12px;border:1px solid #2a2a30;background:#17171b;color:#f4f4f5;font-size:13px;cursor:pointer">🏠 A domicilio +${money(ENVIO_DOMICILIO)}</button>
        </div>
        <div id="prodTotal" style="margin-top:10px;font-weight:600;color:#c6f032"></div>
        ${p.descripcion ? `<p class="prod__desc">${p.descripcion}</p>` : ""}
        ${specs}
      </div>
    </div>`;
  document.title = `${p.nombre} — Casa Norco`;
  pintarEntrega();
}

function pintarEntrega() {
  document.querySelectorAll(".entrega-op").forEach(b => {
    const on = b.dataset.entrega === entregaProd;
    b.style.borderColor = on ? "#c6f032" : "#2a2a30";
    b.style.background = on ? "rgba(198,240,50,.12)" : "#17171b";
    b.style.color = on ? "#c6f032" : "#f4f4f5";
  });
  actualizarTotal();
}

function actualizarTotal() {
  const p = productos.find(x => x.id === id);
  const el = $("#prodTotal");
  if (!p || !el) return;
  el.style.color = "#c6f032";
  if (entregaProd === "domicilio") el.textContent = `Total: ${money(p.precio + ENVIO_DOMICILIO)} (con envío)`;
  else if (entregaProd === "tienda") el.textContent = `Total: ${money(p.precio)} (recoges en tienda)`;
  else el.textContent = "";
}

async function comprarDirecto() {
  const p = productos.find(x => x.id === id);
  if (!p || p.stock <= 0) return;
  if (!entregaProd) {
    const el = $("#prodTotal");
    if (el) { el.style.color = "#ff6b6b"; el.textContent = "Elige cómo lo quieres recibir: recoger o a domicilio"; }
    return;
  }
  const items = [{ title: p.nombre, quantity: 1, unit_price: p.precio, currency_id: "MXN" }];
  if (entregaProd === "domicilio") items.push({ title: "Envío a domicilio", quantity: 1, unit_price: ENVIO_DOMICILIO, currency_id: "MXN" });
  iniciarPago({
    items, productos: [{ id: p.id, qty: 1, title: p.nombre }], entrega: entregaProd,
    onError: () => {
      const el = $("#prodTotal");
      if (el) { el.style.color = "#ff6b6b"; el.textContent = "No se pudo generar el pago, intenta de nuevo"; }
    }
  });
}

document.addEventListener("click", e => {
  const th = e.target.closest("[data-thumb]");
  if (th) {
    $("#prodMainImg").src = th.dataset.thumb;
    document.querySelectorAll(".prod__thumb").forEach(t => t.classList.toggle("on", t === th));
  }
  const eb = e.target.closest("[data-entrega]");
  if (eb) { entregaProd = eb.dataset.entrega; pintarEntrega(); return; }
  if (e.target.closest("#buyNow")) comprarDirecto();
});
document.addEventListener("cart:add", render);

initCart();
