import { WHATSAPP_NUMERO } from "./config.js";

const $ = s => document.querySelector(s);

// Horarios del taller por día (getDay: 0=Dom … 6=Sáb)
const HORARIOS = { 0: null, 1: [9, 19], 2: [9, 19], 3: [9, 19], 4: [9, 19], 5: [9, 19], 6: [9, 14] };

const dosDigitos = n => String(n).padStart(2, "0");
const hoyStr = () => { const d = new Date(); return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`; };
const fmtHora = h => `${h}:00`;
const fmtFecha = s => { const d = new Date(s + "T00:00:00"); return d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" }); };
const waLink = msg => `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(msg)}`;

let tallaSlot = null;

/* ---------- tabs ---------- */
document.querySelectorAll(".cita-tab").forEach(b => b.addEventListener("click", () => {
  document.querySelectorAll(".cita-tab").forEach(x => x.classList.toggle("on", x === b));
  $("#cardTaller").hidden = b.dataset.t !== "taller";
  $("#cardMaleta").hidden = b.dataset.t !== "maleta";
}));

/* ---------- taller ---------- */
$("#tDia").min = hoyStr();
$("#mDiaR").min = hoyStr();
$("#mDiaD").min = hoyStr();

function slotsDelDia(fechaStr) {
  const d = new Date(fechaStr + "T00:00:00");
  const rango = HORARIOS[d.getDay()];
  if (!rango) return null;
  const [ini, fin] = rango;
  const slots = [];
  for (let h = ini; h + 2 <= fin; h += 2) slots.push([h, h + 2]);
  return slots;
}

$("#tDia").addEventListener("change", () => {
  tallaSlot = null;
  const cont = $("#tSlots");
  const fecha = $("#tDia").value;
  $("#tMsg").textContent = "";
  if (!fecha) { cont.innerHTML = ""; $("#tCerrado").hidden = true; $("#tHoraLbl").hidden = true; return; }
  const slots = slotsDelDia(fecha);
  if (!slots) { cont.innerHTML = ""; $("#tCerrado").hidden = false; $("#tHoraLbl").hidden = true; return; }
  $("#tCerrado").hidden = true;
  $("#tHoraLbl").hidden = false;
  cont.innerHTML = slots.map(s => `<button type="button" class="slot" data-slot="${s[0]}-${s[1]}">${fmtHora(s[0])} – ${fmtHora(s[1])}</button>`).join("");
});

$("#tSlots").addEventListener("click", e => {
  const b = e.target.closest(".slot");
  if (!b) return;
  tallaSlot = b.dataset.slot;
  document.querySelectorAll("#tSlots .slot").forEach(s => s.classList.toggle("on", s === b));
});

$("#tGo").addEventListener("click", () => {
  const fecha = $("#tDia").value, nombre = $("#tNombre").value.trim(), tel = $("#tTel").value.trim();
  const servicio = $("#tServicio").value.trim();
  $("#tMsg").textContent = "";
  if (!fecha) { $("#tMsg").textContent = "Elige el día."; return; }
  if (!slotsDelDia(fecha)) { $("#tMsg").textContent = "Ese día estamos cerrados."; return; }
  if (!tallaSlot) { $("#tMsg").textContent = "Elige un horario."; return; }
  if (!nombre || !tel) { $("#tMsg").textContent = "Completa nombre y teléfono."; return; }
  const [h1, h2] = tallaSlot.split("-");
  const msg = `Hola, quiero apartar una CITA EN EL TALLER.\nDía: ${fmtFecha(fecha)}\nHora: ${fmtHora(h1)} a ${fmtHora(h2)}\nNombre: ${nombre}\nTeléfono: ${tel}${servicio ? "\nServicio: " + servicio : ""}`;
  window.open(waLink(msg), "_blank", "noopener");
});

/* ---------- maleta ---------- */
$("#mGo").addEventListener("click", () => {
  const dr = $("#mDiaR").value, hr = $("#mHoraR").value, dd = $("#mDiaD").value, hd = $("#mHoraD").value;
  const nombre = $("#mNombre").value.trim(), tel = $("#mTel").value.trim();
  $("#mMsg").textContent = "";
  if (!dr || !hr || !dd || !hd) { $("#mMsg").textContent = "Completa las fechas y horas de recoger y regresar."; return; }
  if (!nombre || !tel) { $("#mMsg").textContent = "Completa nombre y teléfono."; return; }
  const iniD = new Date(`${dr}T${hr}`), finD = new Date(`${dd}T${hd}`);
  if (finD <= iniD) { $("#mMsg").textContent = "La fecha de regreso debe ser después de la de recoger."; return; }
  const dias = Math.max(1, Math.ceil((finD - iniD) / 86400000));
  const msg = `Hola, quiero APARTAR UNA MALETA.\nRecojo: ${fmtFecha(dr)} a las ${hr}\nRegreso: ${fmtFecha(dd)} a las ${hd}\nDías: ${dias}\nNombre: ${nombre}\nTeléfono: ${tel}`;
  window.open(waLink(msg), "_blank", "noopener");
});
