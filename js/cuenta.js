import { db } from "./db.js?v=21";

const OWNER_EMAILS = ["admincasanorco@gmail.com"];
const esDueno = u => !!u && OWNER_EMAILS.includes((u.email || "").toLowerCase());

const $ = s => document.querySelector(s);
let user = null;

function set(id, v) { const e = $("#" + id); if (e && v != null) e.value = v; }
function val(id) { return ($("#" + id).value || "").trim(); }

function render() {
  $("#cuentaOut").style.display = user ? "none" : "";
  $("#cuentaIn").style.display = user ? "" : "none";
  if (user) $("#cuentaEmail").textContent = user.email;
  const panelBtn = $("#cuentaPanel");
  if (panelBtn) panelBtn.style.display = esDueno(user) ? "" : "none";
}

async function loadPerfil(uid) {
  try {
    const p = await db.getPerfil(uid);
    if (!p) return;
    set("fNombre", p.nombre); set("fTel", p.telefono); set("fCalle", p.calle);
    set("fCol", p.colonia); set("fCP", p.cp); set("fCiudad", p.ciudad);
    set("fEstado", p.estado); set("fRef", p.referencias);
  } catch (_) {}
}

db.onAuth(u => {
  user = u;
  render();
  if (u) { loadPerfil(u.uid); loadMayoreo(u.uid); }
});

async function loadMayoreo(uid) {
  const txt = $("#mayoreoTxt"), btn = $("#mayoreoBtn");
  if (!txt || !btn) return;
  let m = null;
  try { m = await db.getMiMayoreo(uid); } catch (_) {}
  const estado = m?.estado;
  if (estado === "aprobado") {
    txt.innerHTML = "✓ <b style='color:#c6f032'>Eres mayorista.</b> Tienes <b>−10%</b> en tus compras pagando por transferencia.";
    btn.style.display = "none";
  } else if (estado === "pendiente") {
    txt.textContent = "Tu solicitud de mayoreo está en revisión. Te avisaremos.";
    btn.style.display = "none";
  } else if (estado === "rechazado") {
    txt.textContent = "Tu solicitud anterior no fue aprobada. Si crees que es un error, contáctanos.";
    btn.style.display = "none";
  } else {
    txt.textContent = "¿Compras al por mayor? Solicita tu cuenta de mayorista y recibe −10% pagando por transferencia.";
    btn.style.display = "";
    btn.disabled = false; btn.textContent = "Solicitar ser mayorista";
  }
}

$("#mayoreoBtn")?.addEventListener("click", async () => {
  if (!user) return;
  const btn = $("#mayoreoBtn"); btn.disabled = true; btn.textContent = "Enviando…";
  try {
    const p = await db.getPerfil(user.uid).catch(() => null);
    await db.solicitarMayoreo(user.uid, { email: user.email, nombre: p?.nombre || "" });
    await loadMayoreo(user.uid);
  } catch (err) {
    btn.disabled = false; btn.textContent = "Solicitar ser mayorista";
    $("#mayoreoTxt").textContent = "No se pudo enviar la solicitud. Intenta más tarde.";
  }
});

$("#cuentaEntrar")?.addEventListener("click", () => document.getElementById("authBtn")?.click());

$("#cuentaGuardar")?.addEventListener("click", async () => {
  if (!user) return;
  const data = {
    nombre: val("fNombre"), telefono: val("fTel"), calle: val("fCalle"),
    colonia: val("fCol"), cp: val("fCP"), ciudad: val("fCiudad"), estado: val("fEstado"),
    referencias: val("fRef"), email: user.email, actualizado: new Date().toISOString()
  };
  const btn = $("#cuentaGuardar"); btn.disabled = true; const o = btn.textContent; btn.textContent = "Guardando…";
  const msg = $("#cuentaMsg"); msg.textContent = ""; msg.style.color = "#c6f032";
  try {
    await db.guardarPerfil(user.uid, data);
    msg.textContent = "✓ Datos guardados.";
  } catch (err) {
    msg.style.color = "#ff6b6b";
    msg.textContent = (err?.code || "").includes("permission")
      ? "No se pudo guardar (permisos de Firestore). Avísale a soporte."
      : "No se pudo guardar. Intenta de nuevo.";
  }
  btn.disabled = false; btn.textContent = o;
});

$("#cuentaSalir")?.addEventListener("click", async () => { await db.logout(); });
