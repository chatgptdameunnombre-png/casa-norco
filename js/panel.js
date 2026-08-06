import { db } from "./db.js";

const $ = s => document.querySelector(s);
const money = n => "$" + Number(n).toLocaleString("es-MX");

const TAXONOMIA = {
  "Bicicletas": ["Montaña", "Gravel", "Ruta", "Urbana", "Eléctrica", "Niños"],
  "Accesorios": ["Cascos", "Lentes", "Ropa", "Componentes", "Refacciones", "Nutrición"]
};
const MAX_BYTES = 950000;

let productos = [];
let inicializado = false;
let fotosActuales = [];

db.onAuth(user => {
  if (!user) { window.location.replace("admin.html"); return; }
  $("#loader").hidden = true;
  $("#dash").hidden = false;
  window.scrollTo(0, 0);
  arrancarDash();
});

$("#logout").onclick = async () => { await db.logout(); window.location.replace("admin.html"); };

async function arrancarDash() {
  if (inicializado) return;
  inicializado = true;
  await db.seedIfEmpty();
  db.onProducts(list => { productos = list; render(); });
}

function stockPill(s) {
  if (s <= 0) return `<span class="stock-pill" style="color:var(--danger)">Agotado</span>`;
  if (s <= 3) return `<span class="stock-pill" style="color:var(--warn)">${s} · bajo</span>`;
  return `<span class="stock-pill" style="color:var(--ink)">${s}</span>`;
}

function render() {
  $("#stTotal").textContent = productos.length;
  $("#stStock").textContent = productos.reduce((a, p) => a + Number(p.stock || 0), 0);
  $("#stOut").textContent = productos.filter(p => p.stock <= 0).length;

  $("#pList").innerHTML = productos.map(p => `
    <div class="p-row">
      <img class="p-thumb" src="${p.imagen || ''}" alt="" onerror="this.style.visibility='hidden'">
      <div class="p-name"><b>${p.nombre}</b><span>${p.marca} · ${p.subcategoria || p.categoria}</span></div>
      <span class="hide-sm">${p.categoria}</span>
      <span class="hide-sm">${money(p.precio)}</span>
      <span>${stockPill(p.stock)}</span>
      <div class="p-actions">
        <button class="edit-a" data-edit="${p.id}">Editar</button>
        <button class="del-a" data-del="${p.id}">Borrar</button>
      </div>
    </div>`).join("") || `<div style="padding:40px;text-align:center;color:var(--muted)">Sin productos. Agrega el primero.</div>`;
}

/* ---------- subcategorías dependientes ---------- */
function poblarSub(categoria, seleccion = "") {
  const sub = $("#pSub");
  const opts = TAXONOMIA[categoria] || [];
  sub.innerHTML = `<option value="">—</option>` + opts.map(o => `<option ${o === seleccion ? "selected" : ""}>${o}</option>`).join("");
}
$("#pCategoria").addEventListener("change", e => poblarSub(e.target.value));

/* ---------- fotos: subir + comprimir ---------- */
function comprimirImagen(file, size = 1000, calidad = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const c = document.createElement("canvas");
      c.width = size; c.height = size;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#101013";
      ctx.fillRect(0, 0, size, size);
      const escala = Math.min(size / img.width, size / img.height);
      const w = img.width * escala, h = img.height * escala;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      resolve(c.toDataURL("image/jpeg", calidad));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function renderFotos() {
  $("#pFotos").innerHTML = fotosActuales.map((src, i) => `
    <div class="foto-mini">
      <img src="${src}" alt="">
      ${i === 0 ? '<span class="foto-badge">Principal</span>' : ''}
      <button type="button" class="foto-rm" data-rmfoto="${i}">✕</button>
    </div>`).join("");
}

$("#pFileBtn").onclick = () => $("#pFile").click();
$("#pFile").addEventListener("change", async e => {
  const files = [...e.target.files];
  e.target.value = "";
  for (const f of files) {
    try { fotosActuales.push(await comprimirImagen(f)); }
    catch { toast("No se pudo procesar una imagen"); }
  }
  renderFotos();
});

/* ---------- modal ---------- */
const ov = $("#modalOv");
const abrir = () => ov.classList.add("open");
const cerrar = () => ov.classList.remove("open");

function nuevo() {
  $("#modalTitle").textContent = "Nuevo producto";
  $("#prodForm").reset();
  $("#pId").value = "";
  fotosActuales = [];
  poblarSub("");
  renderFotos();
  abrir();
}
function editar(id) {
  const p = productos.find(x => x.id === id);
  if (!p) return;
  $("#modalTitle").textContent = "Editar producto";
  $("#pId").value = p.id;
  $("#pNombre").value = p.nombre;
  $("#pMarca").value = p.marca;
  $("#pCategoria").value = TAXONOMIA[p.categoria] ? p.categoria : "";
  poblarSub($("#pCategoria").value, p.subcategoria || "");
  $("#pPrecio").value = p.precio;
  $("#pStock").value = p.stock;
  $("#pDesc").value = p.descripcion || "";
  $("#pSpecs").value = (p.specs || []).join("\n");
  fotosActuales = p.imagenes?.length ? [...p.imagenes] : (p.imagen ? [p.imagen] : []);
  renderFotos();
  abrir();
  db.getFotos(id).then(fotos => {
    if ($("#pId").value !== id) return;
    fotosActuales = fotos;
    renderFotos();
  }).catch(() => {});
}

$("#prodForm").addEventListener("submit", async e => {
  e.preventDefault();
  const imagenes = fotosActuales;
  if (JSON.stringify(imagenes).length > MAX_BYTES) {
    toast("Demasiadas fotos o muy pesadas. Quita alguna.");
    return;
  }
  const id = $("#pId").value;
  const data = {
    nombre: $("#pNombre").value.trim(),
    marca: $("#pMarca").value.trim(),
    categoria: $("#pCategoria").value,
    subcategoria: $("#pSub").value,
    precio: Number($("#pPrecio").value),
    stock: Number($("#pStock").value),
    descripcion: $("#pDesc").value.trim(),
    specs: $("#pSpecs").value.split("\n").map(s => s.trim()).filter(Boolean),
    imagenes,
    imagen: imagenes[0] || ""
  };
  try {
    if (id) await db.updateProduct(id, data);
    else await db.addProduct(data);
    cerrar();
    toast(id ? "Producto actualizado" : "Producto agregado");
  } catch (err) { toast("Error: " + (err.message || "no se pudo guardar")); }
});

async function borrar(id) {
  const p = productos.find(x => x.id === id);
  if (!confirm(`¿Borrar "${p?.nombre}"? Esta acción no se puede deshacer.`)) return;
  try { await db.deleteProduct(id); toast("Producto borrado"); }
  catch (err) { toast("Error al borrar"); }
}

/* ---------- eventos ---------- */
$("#addBtn").onclick = nuevo;
$("#optBtn").onclick = async () => {
  if (!confirm("Optimiza las fotos de todos los productos para que la tienda cargue más rápido y gaste menos. Se corre una sola vez. ¿Continuar?")) return;
  const btn = $("#optBtn");
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = "Optimizando…";
  try {
    const n = await db.optimizarCatalogo(hechos => { btn.textContent = `Optimizando… ${hechos}`; });
    toast(n ? `Listo: ${n} producto${n === 1 ? "" : "s"} optimizado${n === 1 ? "" : "s"}` : "Ya estaba todo optimizado");
  } catch (err) {
    toast("Error al optimizar: " + (err.message || "reintenta"));
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
};
$("#modalClose").onclick = cerrar;
$("#modalCancel").onclick = cerrar;
ov.addEventListener("click", e => { if (e.target === ov) cerrar(); });
document.addEventListener("click", e => {
  const rm = e.target.closest("[data-rmfoto]");
  if (rm) { fotosActuales.splice(Number(rm.dataset.rmfoto), 1); renderFotos(); return; }
  const t = e.target.closest("[data-edit],[data-del]");
  if (!t) return;
  if (t.dataset.edit) editar(t.dataset.edit);
  else if (t.dataset.del) borrar(t.dataset.del);
});

function toast(html) {
  const t = document.createElement("div");
  t.className = "toast"; t.innerHTML = html;
  $("#toasts").appendChild(t);
  setTimeout(() => t.remove(), 2600);
}
