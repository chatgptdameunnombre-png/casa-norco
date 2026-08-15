import { WHATSAPP_NUMERO, CITAS_TALLER_HORARIOS, CITAS_TALLER_AGENDAR, CITAS_MALETA_AGENDAR } from "./config.js";

const $ = s => document.querySelector(s);

// Horarios del taller por día (respaldo local si el webhook falla)
const HORARIOS = { 0: null, 1: [9, 19], 2: [9, 19], 3: [9, 19], 4: [9, 19], 5: [9, 19], 6: [9, 14] };

const dosDig = n => String(n).padStart(2, "0");
const hoyStr = () => { const d = new Date(); return `${d.getFullYear()}-${dosDig(d.getMonth() + 1)}-${dosDig(d.getDate())}`; };
const fmtFecha = s => new Date(s + "T00:00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
const waLink = msg => `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(msg)}`;

let tallaSlot = null;

async function postJSON(url, body) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}

/* ---------- tabs ---------- */
document.querySelectorAll(".cita-tab").forEach(b => b.addEventListener("click", () => {
  document.querySelectorAll(".cita-tab").forEach(x => x.classList.toggle("on", x === b));
  $("#cardTaller").hidden = b.dataset.t !== "taller";
  $("#cardMaleta").hidden = b.dataset.t !== "maleta";
}));

$("#tDia").min = hoyStr();
$("#mDiaR").min = hoyStr();
$("#mDiaD").min = hoyStr();

function slotsLocal(fechaStr) {
  const d = new Date(fechaStr + "T00:00:00");
  const rango = HORARIOS[d.getDay()];
  if (!rango) return null;
  const [ini, fin] = rango;
  const out = [];
  for (let h = ini; h + 2 <= fin; h += 2) out.push(dosDig(h) + ":00");
  return out;
}

function pintarSlots(lista) {
  const cont = $("#tSlots");
  tallaSlot = null;
  if (!lista || !lista.length) { cont.innerHTML = `<p style="color:#9a9aa2;font-size:13px">No hay horarios libres ese día. Elige otro.</p>`; return; }
  cont.innerHTML = lista.map(h => `<button type="button" class="slot" data-slot="${h}">${h} – ${dosDig(Number(h.slice(0, 2)) + 2)}:00</button>`).join("");
}

$("#tDia").addEventListener("change", async () => {
  const fecha = $("#tDia").value;
  const cont = $("#tSlots");
  tallaSlot = null; $("#tMsg").textContent = "";
  $("#tCerrado").hidden = true; $("#tHoraLbl").hidden = true;
  if (!fecha) { cont.innerHTML = ""; return; }
  if (!slotsLocal(fecha)) { $("#tCerrado").hidden = false; cont.innerHTML = ""; return; }
  $("#tHoraLbl").hidden = false;
  cont.innerHTML = `<p style="color:#9a9aa2;font-size:13px">Buscando horarios libres…</p>`;
  try {
    const r = await postJSON(CITAS_TALLER_HORARIOS, { fecha });
    if (r && r.cerrado) { $("#tCerrado").hidden = false; $("#tHoraLbl").hidden = true; cont.innerHTML = ""; return; }
    pintarSlots(r && Array.isArray(r.horarios) ? r.horarios : slotsLocal(fecha));
  } catch {
    pintarSlots(slotsLocal(fecha)); // respaldo local si el webhook falla
  }
});

$("#tSlots").addEventListener("click", e => {
  const b = e.target.closest(".slot");
  if (!b) return;
  tallaSlot = b.dataset.slot;
  document.querySelectorAll("#tSlots .slot").forEach(s => s.classList.toggle("on", s === b));
});

$("#tGo").addEventListener("click", async () => {
  const fecha = $("#tDia").value, nombre = $("#tNombre").value.trim(), tel = $("#tTel").value.trim();
  const servicio = $("#tServicio").value.trim();
  const msg = $("#tMsg"); msg.style.color = "#ff6b6b"; msg.textContent = "";
  if (!fecha || !slotsLocal(fecha)) { msg.textContent = "Elige un día válido."; return; }
  if (!tallaSlot) { msg.textContent = "Elige un horario."; return; }
  if (!nombre || !tel) { msg.textContent = "Completa nombre y teléfono."; return; }
  const btn = $("#tGo"); btn.disabled = true; const o = btn.textContent; btn.textContent = "Agendando…";
  try {
    const r = await postJSON(CITAS_TALLER_AGENDAR, { fecha, hora: tallaSlot, nombre, telefono: tel, servicio });
    if (r && r.ok) {
      msg.style.color = "#c6f032";
      msg.innerHTML = `✓ ${r.mensaje || "Cita agendada."} Te confirmamos por WhatsApp.`;
      const wa = `Hola, agendé una cita en el taller el ${fmtFecha(fecha)} a las ${tallaSlot} a nombre de ${nombre}.`;
      window.open(waLink(wa), "_blank", "noopener");
      $("#tDia").dispatchEvent(new Event("change")); // refrescar slots libres
    } else { throw new Error("no ok"); }
  } catch {
    // respaldo: WhatsApp
    const wa = `Hola, quiero apartar cita en el taller.\nDía: ${fmtFecha(fecha)}\nHora: ${tallaSlot}\nNombre: ${nombre}\nTel: ${tel}${servicio ? "\nServicio: " + servicio : ""}`;
    window.open(waLink(wa), "_blank", "noopener");
    msg.style.color = "#9a9aa2"; msg.textContent = "Te mandamos a WhatsApp para confirmar.";
  }
  btn.disabled = false; btn.textContent = o;
});

/* ---------- maleta ---------- */
$("#mGo").addEventListener("click", async () => {
  const dr = $("#mDiaR").value, hr = $("#mHoraR").value, dd = $("#mDiaD").value, hd = $("#mHoraD").value;
  const nombre = $("#mNombre").value.trim(), tel = $("#mTel").value.trim();
  const msg = $("#mMsg"); msg.style.color = "#ff6b6b"; msg.textContent = "";
  if (!dr || !hr || !dd || !hd) { msg.textContent = "Completa fechas y horas."; return; }
  if (!nombre || !tel) { msg.textContent = "Completa nombre y teléfono."; return; }
  if (new Date(`${dd}T${hd}`) <= new Date(`${dr}T${hr}`)) { msg.textContent = "El regreso debe ser después de recoger."; return; }
  const btn = $("#mGo"); btn.disabled = true; const o = btn.textContent; btn.textContent = "Apartando…";
  try {
    const r = await postJSON(CITAS_MALETA_AGENDAR, { fechaR: dr, horaR: hr, fechaD: dd, horaD: hd, nombre, telefono: tel });
    if (r && r.ok) {
      msg.style.color = "#c6f032";
      msg.innerHTML = `✓ ${r.mensaje || "Maleta apartada."} Te confirmamos por WhatsApp.`;
      window.open(waLink(`Hola, aparté una maleta: recojo ${fmtFecha(dr)} ${hr}, regreso ${fmtFecha(dd)} ${hd}. Nombre: ${nombre}.`), "_blank", "noopener");
    } else {
      msg.style.color = "#ff6b6b";
      msg.textContent = (r && r.mensaje) || "Esas fechas ya están apartadas. Elige otras.";
    }
  } catch {
    const wa = `Hola, quiero apartar una maleta.\nRecojo: ${fmtFecha(dr)} ${hr}\nRegreso: ${fmtFecha(dd)} ${hd}\nNombre: ${nombre}\nTel: ${tel}`;
    window.open(waLink(wa), "_blank", "noopener");
    msg.style.color = "#9a9aa2"; msg.textContent = "Te mandamos a WhatsApp para confirmar.";
  }
  btn.disabled = false; btn.textContent = o;
});
