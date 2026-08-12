import { db, MODO } from "./db.js";
import { setProductos, initCart, enCarrito, addCart } from "./cart.js";
import { ENVIO_DOMICILIO } from "./config.js";
import { iniciarPago } from "./checkout.js";
import { tieneTallas, tallasDe, stockDeTalla, stockTotal, precioTalla, precioDesde, preciosVarian, etiquetaStock } from "./tallas.js";

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
let tallaSel = null;

db.onProducts(async list => {
  productos = list;
  setProductos(list);
  if (fotosCache === null && list.some(x => x.id === id)) {
    try { fotosCache = await db.getFotos(id); } catch { fotosCache = null; }
  }
  render();
});

function tallaBtn(t, on) {
  const ag = Number(t.stock) <= 0;
  const color = ag ? "#7a7a82" : (on ? "#c6f032" : "#f4f4f5");
  const borde = on ? "#c6f032" : "#2a2a30";
  const fondo = on ? "rgba(198,240,50,.12)" : "#17171b";
  return `<button type="button" class="talla-btn" data-talla="${t.talla}" style="min-width:48px;padding:9px 13px;border-radius:11px;border:1px solid ${borde};background:${fondo};color:${color};cursor:pointer;font-weight:800;${ag ? "text-decoration:line-through" : ""}">${t.talla}</button>`;
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
  const sized = tieneTallas(p);
  const stockActual = sized ? (tallaSel ? stockDeTalla(p, tallaSel) : stockTotal(p)) : stockTotal(p);
  const precioActual = sized ? (tallaSel ? precioTalla(p, tallaSel) : precioDesde(p)) : Number(p.precio || 0);
  const st = etiquetaStock(stockActual);
  const puede = sized ? (!!tallaSel && stockDeTalla(p, tallaSel) > 0) : stockActual > 0;
  const precioLinea = (sized && !tallaSel && preciosVarian(p)) ? `desde ${money(precioDesde(p))}` : money(precioActual);
  const labelAdd = (sized && !tallaSel) ? "Elige tu talla" : (puede ? (enCarrito(p.id, sized ? tallaSel : null) >= stockActual ? "Máximo" : "Agregar al carrito") : "Agotado");
  const labelBuy = (sized && !tallaSel) ? "Elige tu talla" : (puede ? "Comprar" : "Agotado");
  const topeAdd = puede && enCarrito(p.id, sized ? tallaSel : null) >= stockActual;

  const fotos = fotosCache?.length ? fotosCache : (p.imagenes?.length ? p.imagenes : (p.imagen ? [p.imagen] : []));
  const volver = p.categoria === "Bicicletas" ? "bicicletas.html" : "accesorios.html";

  const galeria = fotos.length
    ? `<div class="prod__main"><img id="prodMainImg" src="${fotos[0]}" alt="${p.nombre}"></div>
       ${fotos.length > 1 ? `<div class="prod__thumbs">${fotos.map((f, i) =>
         `<button class="prod__thumb ${i === 0 ? "on" : ""}" data-thumb="${f}"><img src="${f}" alt=""></button>`).join("")}</div>` : ""}`
    : `<div class="prod__main prod__main--ph">📷 Sin foto todavía</div>`;

  const specs = (p.specs || []).length
    ? `<h4 class="prod__spectitle">Especificaciones</h4><ul class="prod__specs">${p.specs.map(s => `<li>${s}</li>`).join("")}</ul>`
    : "";

  const tallasBloque = sized
    ? `<div style="margin:12px 0 4px;font-size:13px;color:#c9c9cf;font-weight:600">Talla${tallaSel ? ": " + tallaSel : ""}</div>
       <div style="display:flex;gap:8px;flex-wrap:wrap">${tallasDe(p).map(t => tallaBtn(t, t.talla === tallaSel)).join("")}</div>`
    : `<div style="margin:8px 0 2px;font-size:12.5px;color:#9a9aa2">Talla universal</div>`;

  cont.innerHTML = `
    <a href="${volver}" class="volver">← ${p.categoria}</a>
    <div class="prod">
      <div class="prod__galeria">${galeria}</div>
      <div class="prod__info">
        <span class="prod__brand">${p.marca}${p.subcategoria ? " · " + p.subcategoria : ""}</span>
        <h1 class="prod__name">${p.nombre}</h1>
        <div class="prod__price">${precioLinea} <span>MXN</span></div>
        <span class="stock stock--${st.cls}">${st.txt}</span>
        ${tallasBloque}
        <div style="display:flex;gap:10px;margin-top:12px">
          <button class="add-btn add-btn--big" id="addBtn2" ${puede && !topeAdd ? "" : "disabled"} style="flex:1;margin:0">${labelAdd}</button>
          <button class="add-btn add-btn--big" id="buyNow" ${puede ? "" : "disabled"} style="flex:1;margin:0;background:#c6f032;color:#0a0a0a">${labelBuy}</button>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button type="button" class="entrega-op" data-entrega="tienda" style="flex:1;padding:11px;border-radius:12px;border:1px solid #2a2a30;background:#17171b;color:#f4f4f5;font-size:13px;cursor:pointer">Recoger en tienda</button>
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

function precioSel(p) {
  const sized = tieneTallas(p);
  return sized ? (tallaSel ? precioTalla(p, tallaSel) : precioDesde(p)) : Number(p.precio || 0);
}

function actualizarTotal() {
  const p = productos.find(x => x.id === id);
  const el = $("#prodTotal");
  if (!p || !el) return;
  el.style.color = "#c6f032";
  const base = precioSel(p);
  if (entregaProd === "domicilio") el.textContent = `Total: ${money(base + ENVIO_DOMICILIO)} (con envío)`;
  else if (entregaProd === "tienda") el.textContent = `Total: ${money(base)} (recoges en tienda)`;
  else el.textContent = "";
}

function err(txt) {
  const el = $("#prodTotal");
  if (el) { el.style.color = "#ff6b6b"; el.textContent = txt; }
}

function agregar() {
  const p = productos.find(x => x.id === id);
  if (!p) return;
  const sized = tieneTallas(p);
  if (sized && !tallaSel) { err("Elige tu talla"); return; }
  addCart(p.id, sized ? tallaSel : null);
}

function comprarDirecto() {
  const p = productos.find(x => x.id === id);
  if (!p) return;
  const sized = tieneTallas(p);
  if (sized && !tallaSel) { err("Elige tu talla"); return; }
  const stock = sized ? stockDeTalla(p, tallaSel) : stockTotal(p);
  if (stock <= 0) return;
  if (!entregaProd) { err("Elige cómo lo quieres recibir: recoger o a domicilio"); return; }
  const precio = precioSel(p);
  const title = sized ? `${p.nombre} — Talla ${tallaSel}` : p.nombre;
  const items = [{ title, quantity: 1, unit_price: precio, currency_id: "MXN" }];
  if (entregaProd === "domicilio") items.push({ title: "Envío a domicilio", quantity: 1, unit_price: ENVIO_DOMICILIO, currency_id: "MXN" });
  iniciarPago({
    items,
    productos: [{ id: p.id, qty: 1, title: p.nombre, talla: sized ? tallaSel : "" }],
    entrega: entregaProd,
    onError: () => err("No se pudo generar el pago, intenta de nuevo")
  });
}

document.addEventListener("click", e => {
  const th = e.target.closest("[data-thumb]");
  if (th) {
    $("#prodMainImg").src = th.dataset.thumb;
    document.querySelectorAll(".prod__thumb").forEach(t => t.classList.toggle("on", t === th));
    return;
  }
  const tb = e.target.closest(".talla-btn");
  if (tb) { tallaSel = tb.dataset.talla; render(); return; }
  const eb = e.target.closest("[data-entrega]");
  if (eb) { entregaProd = eb.dataset.entrega; pintarEntrega(); return; }
  if (e.target.closest("#addBtn2")) { agregar(); return; }
  if (e.target.closest("#buyNow")) comprarDirecto();
});
document.addEventListener("cart:add", render);

initCart();
