import { db } from "./db.js";
import { ASESOR_WEBHOOK, NEGOCIO } from "./config.js";
import { tieneTallas, stockTotal, precioDesde, preciosVarian } from "./tallas.js";

const money = n => "$" + Number(n).toLocaleString("es-MX");
const SID_KEY = "casanorco_asesor_sid";
const SALUDO = "¡Hola! 👋 Soy la IA de Casa Norco. Dime qué buscas —una bici, un casco, algo para proteger— y te muestro lo que tenemos.";

let productos = [];
db.onProducts(list => { productos = list; });

function sessionId() {
  let s = localStorage.getItem(SID_KEY);
  if (!s) { s = "web-" + Math.random().toString(36).slice(2) + "-" + (performance.now() | 0); localStorage.setItem(SID_KEY, s); }
  return s;
}

let abierto = false;

function montar() {
  if (document.getElementById("asesorBtn")) return;

  const btn = document.createElement("button");
  btn.id = "asesorBtn";
  btn.type = "button";
  btn.setAttribute("aria-label", "Abrir IA de Casa Norco");
  btn.innerHTML = `<img class="asesor-logo" src="fotos/logo/iso-negro.png" alt=""><span class="asesor-lbl">IA Casa Norco</span>`;

  const panel = document.createElement("div");
  panel.id = "asesorPanel";
  panel.innerHTML = `
    <div class="asesor-head">
      <div>
        <div class="asesor-title">IA Casa Norco</div>
        <div class="asesor-sub">Te ayudo a encontrar tu bici o accesorio</div>
      </div>
      <div class="asesor-head-btns">
        <button class="asesor-reset" type="button" aria-label="Empezar de nuevo" title="Empezar de nuevo">↻</button>
        <button class="asesor-x" type="button" aria-label="Cerrar">✕</button>
      </div>
    </div>
    <div class="asesor-body" id="asesorBody"></div>
    <form class="asesor-input" id="asesorForm">
      <input id="asesorText" type="text" placeholder="Ej: un casco para montaña…" autocomplete="off" maxlength="240">
      <button type="submit" id="asesorSend" aria-label="Enviar">➤</button>
    </form>`;

  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);
  document.body.appendChild(btn);
  document.body.appendChild(panel);

  const body = panel.querySelector("#asesorBody");
  const form = panel.querySelector("#asesorForm");
  const input = panel.querySelector("#asesorText");

  const toggle = () => {
    abierto = !abierto;
    panel.classList.toggle("open", abierto);
    btn.classList.toggle("hide", abierto);
    if (abierto) {
      if (!body.dataset.saludo) {
        body.dataset.saludo = "1";
        pintarBot(SALUDO);
      }
      setTimeout(() => input.focus(), 120);
    }
  };
  btn.addEventListener("click", toggle);
  panel.querySelector(".asesor-x").addEventListener("click", toggle);
  panel.querySelector(".asesor-reset").addEventListener("click", () => {
    localStorage.removeItem(SID_KEY);
    body.innerHTML = "";
    body.dataset.saludo = "1";
    pintarBot(SALUDO);
    setTimeout(() => input.focus(), 60);
  });

  const drawer = document.getElementById("drawer");
  if (drawer) {
    const sync = () => {
      const abierto = drawer.classList.contains("open");
      btn.classList.toggle("cart-abierto", abierto);
      panel.classList.toggle("cart-abierto", abierto);
    };
    new MutationObserver(sync).observe(drawer, { attributes: true, attributeFilter: ["class"] });
  }

  form.addEventListener("submit", e => {
    e.preventDefault();
    const txt = input.value.trim();
    if (!txt) return;
    input.value = "";
    pintarUser(txt);
    enviar(txt);
  });

  function pintarUser(txt) {
    const el = document.createElement("div");
    el.className = "msg msg--user";
    el.textContent = txt;
    body.appendChild(el);
    scroll();
  }
  function pintarBot(txt) {
    const el = document.createElement("div");
    el.className = "msg msg--bot";
    el.textContent = txt;
    body.appendChild(el);
    scroll();
    return el;
  }
  function typing() {
    const el = document.createElement("div");
    el.className = "msg msg--bot asesor-typing";
    el.innerHTML = "<span></span><span></span><span></span>";
    body.appendChild(el);
    scroll();
    return el;
  }
  function scroll() { body.scrollTop = body.scrollHeight; }

  function tarjetas(ids) {
    const encontrados = ids.map(id => productos.find(p => p.id === id)).filter(Boolean);
    if (!encontrados.length) return;
    const wrap = document.createElement("div");
    wrap.className = "asesor-cards";
    wrap.innerHTML = encontrados.map(p => {
      const total = stockTotal(p);
      const sinStock = total <= 0;
      const sized = tieneTallas(p);
      const precioTxt = preciosVarian(p) ? `desde ${money(precioDesde(p))}` : money(precioDesde(p));
      const foto = p.imagen
        ? `<img src="${p.imagen}" alt="${p.nombre}" onerror="this.style.display='none'">`
        : `<div class="ac-ph">📷</div>`;
      const accion = sinStock
        ? `<button class="ac-add" type="button" disabled>Agotado</button>`
        : sized
          ? `<a class="ac-add" href="producto.html?id=${encodeURIComponent(p.id)}" style="text-align:center;text-decoration:none;line-height:1.9">Elegir talla</a>`
          : `<button class="ac-add" type="button" data-add="${p.id}">🛒 Agregar al carrito</button>`;
      return `
        <div class="ac-card">
          <div class="ac-media">${foto}${sinStock ? '<span class="ac-out">Agotado</span>' : ''}</div>
          <div class="ac-info">
            <div class="ac-name">${p.nombre}</div>
            <div class="ac-price">${precioTxt} <span>MXN</span></div>
            <div class="ac-actions">
              <a class="ac-ver" href="producto.html?id=${encodeURIComponent(p.id)}">Ver</a>
              ${accion}
            </div>
          </div>
        </div>`;
    }).join("");
    body.appendChild(wrap);
    scroll();
  }

  async function enviar(txt) {
    const t = typing();
    try {
      const r = await fetch(ASESOR_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: txt, sessionId: sessionId() })
      });
      const d = await r.json();
      t.remove();
      const reply = d.reply || "Perdón, no te entendí bien. ¿Me lo dices de otra forma?";
      pintarBot(reply);
      const idsMostrar = Array.isArray(d.ids) ? d.ids.slice() : [];
      const low = reply.toLowerCase();
      for (const p of productos) {
        if (p.nombre && p.nombre.length >= 4 && low.includes(p.nombre.toLowerCase()) && !idsMostrar.includes(p.id)) idsMostrar.push(p.id);
      }
      if (idsMostrar.length) tarjetas(idsMostrar);
    } catch {
      t.remove();
      pintarBot("Uy, se me fue la señal 📶. Inténtalo de nuevo en un momento.");
    }
  }
}

const CSS = `
#asesorBtn{position:fixed;right:20px;bottom:20px;z-index:9998;display:flex;align-items:center;gap:9px;
  background:#c6f032;color:#0a0a0a;border:none;border-radius:999px;padding:13px 20px 13px 16px;
  font-family:inherit;font-weight:800;font-size:14.5px;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.35);
  transition:transform .18s ease,box-shadow .18s ease,right .34s cubic-bezier(.2,.7,.2,1)}
#asesorBtn.cart-abierto{right:460px}
#asesorPanel.cart-abierto{right:460px}
@media(max-width:900px){
  #asesorBtn.cart-abierto,#asesorPanel.cart-abierto{opacity:0;pointer-events:none;transform:translateY(16px)}
}
#asesorBtn:hover{transform:translateY(-3px);box-shadow:0 16px 40px rgba(198,240,50,.35)}
#asesorBtn.hide{transform:scale(.4);opacity:0;pointer-events:none}
#asesorBtn .asesor-logo{height:20px;width:auto;display:block}
@media(max-width:520px){
  #asesorBtn{padding:0;width:58px;height:58px;border-radius:50%;justify-content:center;bottom:calc(env(safe-area-inset-bottom, 0px) + 26px);z-index:2147483000}
  #asesorBtn .asesor-lbl{display:none}
  #asesorBtn .asesor-logo{height:28px}
  #asesorPanel{bottom:calc(env(safe-area-inset-bottom, 0px) + 20px)}
}
#asesorPanel{position:fixed;right:20px;bottom:20px;z-index:9999;width:380px;max-width:calc(100vw - 32px);
  height:560px;max-height:calc(100vh - 40px);background:#141416;border:1px solid #26262c;border-radius:20px;
  display:flex;flex-direction:column;overflow:hidden;font-family:inherit;color:#f4f4f5;
  box-shadow:0 24px 70px rgba(0,0,0,.55);opacity:0;transform:translateY(16px) scale(.98);pointer-events:none;
  transition:opacity .2s ease,transform .2s ease,right .34s cubic-bezier(.2,.7,.2,1)}
#asesorPanel.open{opacity:1;transform:none;pointer-events:auto}
.asesor-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:16px 18px;
  border-bottom:1px solid #26262c;background:linear-gradient(180deg,#1a1a1d,#141416)}
.asesor-title{font-weight:800;font-size:15.5px}
.asesor-sub{font-size:11.5px;color:#9a9aa2;margin-top:2px}
.asesor-head-btns{display:flex;align-items:center;gap:4px}
.asesor-reset{background:none;border:none;color:#9a9aa2;font-size:17px;cursor:pointer;line-height:1;padding:4px 6px;border-radius:8px}
.asesor-reset:hover{color:#c6f032;background:#1e1e22}
.asesor-x{background:none;border:none;color:#9a9aa2;font-size:18px;cursor:pointer;line-height:1;padding:4px}
.asesor-x:hover{color:#f4f4f5}
.asesor-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}
.asesor-body::-webkit-scrollbar{width:6px}.asesor-body::-webkit-scrollbar-thumb{background:#2a2a30;border-radius:3px}
.msg{max-width:85%;padding:10px 13px;border-radius:14px;font-size:13.5px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}
.msg--user{align-self:flex-end;background:#c6f032;color:#0a0a0a;border-bottom-right-radius:4px;font-weight:600}
.msg--bot{align-self:flex-start;background:#1e1e22;color:#eaeaec;border:1px solid #26262c;border-bottom-left-radius:4px}
.asesor-typing{display:flex;gap:4px;align-items:center}
.asesor-typing span{width:7px;height:7px;border-radius:50%;background:#6a6a72;animation:asdot 1s infinite}
.asesor-typing span:nth-child(2){animation-delay:.15s}.asesor-typing span:nth-child(3){animation-delay:.3s}
@keyframes asdot{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}
.asesor-cards{display:flex;flex-direction:column;gap:9px;align-self:stretch}
.ac-card{display:flex;gap:11px;background:#0f0f12;border:1px solid #26262c;border-radius:13px;padding:9px}
.ac-media{width:70px;height:70px;flex:0 0 70px;border-radius:9px;overflow:hidden;background:#17171b;display:flex;align-items:center;justify-content:center;position:relative}
.ac-out{position:absolute;top:4px;left:4px;background:#e5484d;color:#fff;font-size:8.5px;font-weight:800;padding:2px 5px;border-radius:5px;letter-spacing:.02em}
.ac-media img{width:100%;height:100%;object-fit:cover}
.ac-ph{font-size:22px;opacity:.5}
.ac-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.ac-name{font-weight:700;font-size:13px;line-height:1.25}
.ac-price{font-size:13px;font-weight:800;color:#c6f032}.ac-price span{font-size:10px;color:#9a9aa2;font-weight:600}
.ac-actions{display:flex;gap:7px;margin-top:auto}
.ac-ver{flex:0 0 auto;text-align:center;text-decoration:none;padding:8px 14px;border-radius:9px;border:1px solid #2a2a30;color:#f4f4f5;font-size:12px;font-weight:700}
.ac-ver:hover{border-color:#c6f032;color:#c6f032}
.ac-add{flex:1;padding:8px 6px;border-radius:9px;border:none;background:#c6f032;color:#0a0a0a;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap}
.ac-add:disabled{background:#2a2a30;color:#7a7a82;cursor:not-allowed}
.asesor-input{display:flex;gap:8px;padding:12px;border-top:1px solid #26262c;background:#141416}
.asesor-input input{flex:1;background:#0e0e11;border:1px solid #2a2a30;border-radius:11px;padding:11px 13px;color:#f4f4f5;font-size:13.5px;outline:none}
.asesor-input input:focus{border-color:#c6f032}
.asesor-input button{flex:0 0 44px;border:none;border-radius:11px;background:#c6f032;color:#0a0a0a;font-size:16px;font-weight:800;cursor:pointer}
`;

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montar);
else montar();
