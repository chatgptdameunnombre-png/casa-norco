import { WHATSAPP_NUMERO, NEGOCIO } from "./config.js";

const CART_KEY = "bici_cart";
const $ = s => document.querySelector(s);
const money = n => "$" + Number(n).toLocaleString("es-MX");

let cart = cargar();
let productos = [];

function cargar() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || {}; }
  catch { return {}; }
}
function guardar() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  renderCart();
}

export function setProductos(list) { productos = list; renderCart(); }
export function enCarrito(id) { return cart[id]?.qty || 0; }

export function addCart(id) {
  const p = productos.find(x => x.id === id);
  if (!p || p.stock <= 0) return;
  const q = cart[id]?.qty || 0;
  if (q >= p.stock) return;
  cart[id] = { id, qty: q + 1 };
  guardar();
  toast(`<b>${p.nombre}</b> agregado`);
  openDrawer();
  document.dispatchEvent(new CustomEvent("cart:add", { detail: { id } }));
}

export function renderCart() {
  const items = Object.values(cart).map(c => {
    const p = productos.find(x => x.id === c.id);
    return p ? { ...p, qty: Math.min(c.qty, p.stock) } : null;
  }).filter(Boolean).filter(i => i.qty > 0);

  const count = items.reduce((a, i) => a + i.qty, 0);
  const total = items.reduce((a, i) => a + i.qty * i.precio, 0);
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
        <div class="line__name">${i.nombre}</div>
        <div class="line__price">${money(i.precio)}</div>
        <div class="qty">
          <button data-dec="${i.id}">−</button>
          <span>${i.qty}</span>
          <button data-inc="${i.id}" ${i.qty >= i.stock ? "disabled" : ""}>+</button>
        </div>
      </div>
      <button class="line__rm" data-rm="${i.id}">Quitar</button>
    </div>`).join("");
  $("#cartTotal").textContent = money(total);
  $("#cartFoot").hidden = false;
}

function checkout() {
  const items = Object.values(cart).map(c => {
    const p = productos.find(x => x.id === c.id);
    return p ? { ...p, qty: Math.min(c.qty, p.stock) } : null;
  }).filter(Boolean).filter(i => i.qty > 0);
  if (!items.length) return;
  const total = items.reduce((a, i) => a + i.qty * i.precio, 0);
  let msg = `¡Hola ${NEGOCIO.nombre}! Quiero comprar:\n\n`;
  items.forEach(i => { msg += `• ${i.qty}× ${i.nombre} — ${money(i.precio * i.qty)}\n`; });
  msg += `\nTotal: ${money(total)}\n\n¿Cómo continúo con el pago?`;
  window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(msg)}`, "_blank");
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
    const t = e.target.closest("[data-add],[data-inc],[data-dec],[data-rm]");
    if (!t) return;
    e.preventDefault();
    if (t.dataset.add) addCart(t.dataset.add);
    else if (t.dataset.inc) { cart[t.dataset.inc].qty++; guardar(); }
    else if (t.dataset.dec) { const id = t.dataset.dec; cart[id].qty--; if (cart[id].qty <= 0) delete cart[id]; guardar(); }
    else if (t.dataset.rm) { delete cart[t.dataset.rm]; guardar(); }
  });
  $("#openCart")?.addEventListener("click", openDrawer);
  $("#closeCart")?.addEventListener("click", closeDrawer);
  $("#overlay")?.addEventListener("click", closeDrawer);
  $("#checkout")?.addEventListener("click", checkout);
  renderCart();
}
