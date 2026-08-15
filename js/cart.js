import { ENVIO_DOMICILIO } from "./config.js?v=20";
import { iniciarPago, iniciarTransferencia } from "./checkout.js?v=20";
import { tieneTallas, stockDeTalla, stockTotal, precioTalla } from "./tallas.js?v=20";

const CART_KEY = "bici_cart";
const $ = s => document.querySelector(s);
const money = n => "$" + Number(n).toLocaleString("es-MX");

let cart = cargar();
let productos = [];
let entrega = null;
let metodoPago = "tarjeta";

const keyOf = (id, talla) => (talla ? `${id}__${talla}` : id);

function cargar() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || {}; }
  catch { return {}; }
}
function guardar() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  renderCart();
}

export function setProductos(list) { productos = list; renderCart(); }

export function enCarrito(id, talla = null) {
  const p = productos.find(x => x.id === id);
  const t = (p && tieneTallas(p)) ? talla : null;
  return cart[keyOf(id, t)]?.qty || 0;
}

function dispDe(p, talla) {
  return (tieneTallas(p) && talla) ? stockDeTalla(p, talla) : stockTotal(p);
}
function precioDe(p, talla) {
  return (tieneTallas(p) && talla) ? precioTalla(p, talla) : Number(p.precio || 0);
}

export function addCart(id, talla = null) {
  const p = productos.find(x => x.id === id);
  if (!p) return;
  const sized = tieneTallas(p);
  const t = sized ? talla : null;
  if (sized && !t) return;
  const disp = dispDe(p, t);
  if (disp <= 0) return;
  const k = keyOf(id, t);
  const q = cart[k]?.qty || 0;
  if (q >= disp) return;
  cart[k] = { id, talla: t, qty: q + 1 };
  guardar();
  toast(`<b>${p.nombre}${t ? " — Talla " + t : ""}</b> agregado`);
  openDrawer();
  document.dispatchEvent(new CustomEvent("cart:add", { detail: { id } }));
}

function itemsCarrito() {
  return Object.entries(cart).map(([k, c]) => {
    const p = productos.find(x => x.id === c.id);
    if (!p) return null;
    const t = tieneTallas(p) ? (c.talla || null) : null;
    const disp = dispDe(p, t);
    const qty = Math.min(c.qty, disp);
    if (qty <= 0) return null;
    return { key: k, id: c.id, talla: t, nombre: p.nombre, imagen: p.imagen, precio: precioDe(p, t), qty, disp };
  }).filter(Boolean);
}

export function renderCart() {
  const items = itemsCarrito();
  const count = items.reduce((a, i) => a + i.qty, 0);
  const subtotal = items.reduce((a, i) => a + i.qty * i.precio, 0);
  const total = subtotal + (entrega === "domicilio" ? ENVIO_DOMICILIO : 0);
  const countEl = $("#cartCount");
  if (countEl) countEl.textContent = count;

  const body = $("#cartBody");
  if (!body) return;
  if (!items.length) {
    body.innerHTML = `<div class="drawer__empty">🚲<br>Tu carrito está vacío.<br><small>Agrega productos del catálogo.</small></div>`;
    $("#cartFoot").hidden = true;
    return;
  }
  body.innerHTML = items.map(i => `
    <div class="line">
      <img class="line__img" src="${i.imagen || ''}" alt="" onerror="this.style.visibility='hidden'">
      <div class="line__info">
        <div class="line__name">${i.nombre}${i.talla ? ` <small style="color:#9a9aa2">· Talla ${i.talla}</small>` : ""}</div>
        <div class="line__price">${money(i.precio)}</div>
        <div class="qty">
          <button data-dec="${i.key}">−</button>
          <span>${i.qty}</span>
          <button data-inc="${i.key}" ${i.qty >= i.disp ? "disabled" : ""}>+</button>
        </div>
      </div>
      <button class="line__rm" data-rm="${i.key}">Quitar</button>
    </div>`).join("");
  $("#cartTotal").textContent = money(total);
  document.querySelectorAll(".entrega-cart").forEach(b => {
    const on = b.dataset.ec === entrega;
    b.style.borderColor = on ? "#c6f032" : "#2a2a30";
    b.style.background = on ? "rgba(198,240,50,.12)" : "#17171b";
    b.style.color = on ? "#c6f032" : "#f4f4f5";
  });
  document.querySelectorAll(".pago-cart").forEach(b => {
    const on = b.dataset.pm === metodoPago;
    b.style.borderColor = on ? "#c6f032" : "#2a2a30";
    b.style.background = on ? "rgba(198,240,50,.12)" : "#17171b";
    b.style.color = on ? "#c6f032" : "#f4f4f5";
  });
  $("#cartFoot").hidden = false;
}

function checkout() {
  const items = itemsCarrito();
  if (!items.length) return;
  if (!entrega) { toast("Elige cómo lo recibes: <b>recoger</b> o <b>a domicilio</b>"); return; }
  const productos = items.map(i => ({ id: i.id, qty: i.qty, title: i.nombre, talla: i.talla || "" }));
  if (metodoPago === "transferencia") {
    const subtotal = items.reduce((a, i) => a + i.qty * i.precio, 0);
    const total = subtotal + (entrega === "domicilio" ? ENVIO_DOMICILIO : 0);
    iniciarTransferencia({ productos, entrega, total, onError: () => toast("No se pudo, intenta de nuevo") });
    return;
  }
  const mpItems = items.map(i => ({ title: i.talla ? `${i.nombre} — Talla ${i.talla}` : i.nombre, quantity: i.qty, unit_price: i.precio, currency_id: "MXN" }));
  if (entrega === "domicilio") mpItems.push({ title: "Envío a domicilio", quantity: 1, unit_price: ENVIO_DOMICILIO, currency_id: "MXN" });
  iniciarPago({
    items: mpItems,
    productos,
    entrega,
    onError: () => toast("No se pudo generar el pago, intenta de nuevo")
  });
}

const openDrawer = () => { $("#drawer")?.classList.add("open"); $("#overlay")?.classList.add("open"); };
const closeDrawer = () => { $("#drawer")?.classList.remove("open"); $("#overlay")?.classList.remove("open"); };

function toast(html) {
  const wrap = $("#toasts");
  if (!wrap) return;
  const t = document.createElement("div");
  t.className = "toast"; t.innerHTML = html;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

export function initCart() {
  document.addEventListener("click", e => {
    const ec = e.target.closest("[data-ec]");
    if (ec) { entrega = ec.dataset.ec; renderCart(); return; }
    const pm = e.target.closest("[data-pm]");
    if (pm) { metodoPago = pm.dataset.pm; renderCart(); return; }
    const t = e.target.closest("[data-add],[data-inc],[data-dec],[data-rm]");
    if (!t) return;
    e.preventDefault();
    if (t.dataset.add) addCart(t.dataset.add);
    else if (t.dataset.inc) {
      const c = cart[t.dataset.inc];
      if (!c) return;
      const p = productos.find(x => x.id === c.id);
      const disp = p ? dispDe(p, tieneTallas(p) ? c.talla : null) : 0;
      if (c.qty < disp) { c.qty++; guardar(); }
    }
    else if (t.dataset.dec) { const k = t.dataset.dec; if (!cart[k]) return; cart[k].qty--; if (cart[k].qty <= 0) delete cart[k]; guardar(); }
    else if (t.dataset.rm) { delete cart[t.dataset.rm]; guardar(); }
  });
  $("#openCart")?.addEventListener("click", openDrawer);
  $("#closeCart")?.addEventListener("click", closeDrawer);
  $("#overlay")?.addEventListener("click", closeDrawer);
  $("#checkout")?.addEventListener("click", checkout);
  const foot = $("#cartFoot");
  if (foot && !$("#entregaCart")) {
    const wrap = document.createElement("div");
    wrap.id = "entregaCart";
    wrap.style.cssText = "display:flex;gap:8px;margin-bottom:12px";
    wrap.innerHTML = `<button type="button" class="entrega-cart" data-ec="tienda" style="flex:1;padding:10px;border-radius:10px;border:1px solid #2a2a30;background:#17171b;color:#f4f4f5;font-size:12.5px;cursor:pointer">Recoger en tienda</button><button type="button" class="entrega-cart" data-ec="domicilio" style="flex:1;padding:10px;border-radius:10px;border:1px solid #2a2a30;background:#17171b;color:#f4f4f5;font-size:12.5px;cursor:pointer">🏠 A domicilio +${money(ENVIO_DOMICILIO)}</button>`;
    foot.prepend(wrap);
  }
  if (foot && !$("#pagoCart")) {
    const w2 = document.createElement("div");
    w2.id = "pagoCart";
    w2.style.cssText = "display:flex;gap:8px;margin-bottom:12px";
    w2.innerHTML = `<button type="button" class="pago-cart" data-pm="tarjeta" style="flex:1;padding:10px;border-radius:10px;border:1px solid #2a2a30;background:#17171b;color:#f4f4f5;font-size:12.5px;cursor:pointer">💳 Tarjeta</button><button type="button" class="pago-cart" data-pm="transferencia" style="flex:1;padding:10px;border-radius:10px;border:1px solid #2a2a30;background:#17171b;color:#f4f4f5;font-size:12.5px;cursor:pointer">🏦 Transferencia</button>`;
    $("#entregaCart")?.after(w2);
  }
  renderCart();
}
