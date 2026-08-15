import { CITAS_TALLER_HORARIOS, CITAS_TALLER_AGENDAR, CITAS_MALETA_AGENDAR } from "./config.js?v=21";

const $ = s => document.querySelector(s);
const HORARIOS = { 0: null, 1: [9, 19], 2: [9, 19], 3: [9, 19], 4: [9, 19], 5: [9, 19], 6: [9, 14] };
const MAX = "2026-12-31"; // no agendar más allá de diciembre
const dosDig = n => String(n).padStart(2, "0");
const DIASEM = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fechaBonita = f => new Date(f + "T00:00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
const to12 = hhmm => { let [h, m] = hhmm.split(":").map(Number); const ap = h < 12 ? "am" : "pm"; let h12 = h % 12; if (h12 === 0) h12 = 12; return `${h12}:${dosDig(m || 0)} ${ap}`; };
const hoyStr = () => { const d = new Date(); return `${d.getFullYear()}-${dosDig(d.getMonth() + 1)}-${dosDig(d.getDate())}`; };
const abierto = f => !!HORARIOS[new Date(f + "T00:00:00").getDay()];

async function postJSON(url, body) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}
function proximosDias(n) {
  const out = [], hoy = new Date();
  for (let i = 0; i < 30 && out.length < n; i++) {
    const x = new Date(hoy); x.setDate(hoy.getDate() + i);
    const f = `${x.getFullYear()}-${dosDig(x.getMonth() + 1)}-${dosDig(x.getDate())}`;
    if (f > MAX) break;
    if (HORARIOS[x.getDay()]) out.push(x);
  }
  return out;
}
function chipDia(x) {
  const f = `${x.getFullYear()}-${dosDig(x.getMonth() + 1)}-${dosDig(x.getDate())}`;
  return `<button type="button" class="dia-chip" data-fecha="${f}">${x.getDate()}<small>${DIASEM[x.getDay()]} ${MES[x.getMonth()]}</small></button>`;
}

// límites de fecha (hoy → diciembre) en todos los inputs de fecha
["#ctOtroDia", "#cmDiaR", "#cmDiaD"].forEach(s => { if ($(s)) { $(s).min = hoyStr(); $(s).max = MAX; } });

/* ---------- tabs ---------- */
document.querySelectorAll(".citas-tab").forEach(b => b.addEventListener("click", () => {
  document.querySelectorAll(".citas-tab").forEach(x => x.classList.toggle("on", x === b));
  $("#ctTaller").hidden = b.dataset.ct !== "taller";
  $("#ctMaleta").hidden = b.dataset.ct !== "maleta";
}));

/* ---------- TALLER ---------- */
let tDia = null, tHora = null;
if ($("#ctDias")) $("#ctDias").innerHTML = proximosDias(6).map(chipDia).join("");

async function seleccionarDiaTaller(fecha, chipEl) {
  if (fecha > MAX) { $("#ctMsg").style.color = "#ff6b6b"; $("#ctMsg").textContent = "Por ahora solo agendamos hasta diciembre."; return; }
  tDia = fecha; tHora = null;
  document.querySelectorAll("#ctDias .dia-chip").forEach(x => x.classList.toggle("on", x === chipEl));
  $("#ctBloqueDatos").hidden = true; $("#ctMsg").textContent = "";
  const slots = $("#ctSlots"); $("#ctBloqueHora").hidden = false;
  if (!abierto(fecha)) { slots.innerHTML = `<span style="color:#ff6b6b;font-size:13px">Ese día estamos cerrados (domingo). Elige otro.</span>`; return; }
  slots.innerHTML = `<span style="color:#9a9aa2;font-size:13px">Buscando horarios libres…</span>`;
  try {
    const r = await postJSON(CITAS_TALLER_HORARIOS, { fecha });
    const libres = r && Array.isArray(r.horarios) ? r.horarios : [];
    if (!libres.length) { slots.innerHTML = `<span style="color:#9a9aa2;font-size:13px">No hay horarios libres ese día. Elige otro.</span>`; return; }
    slots.innerHTML = libres.map(h => `<button type="button" class="slot-chip" data-hora="${h}">${to12(h)}</button>`).join("");
  } catch { slots.innerHTML = `<span style="color:#ff6b6b;font-size:13px">No se pudo cargar. Intenta de nuevo.</span>`; }
}
$("#ctDias")?.addEventListener("click", e => {
  const c = e.target.closest(".dia-chip"); if (!c) return;
  if ($("#ctOtroDia")) $("#ctOtroDia").value = "";
  seleccionarDiaTaller(c.dataset.fecha, c);
});
$("#ctOtroDia")?.addEventListener("change", e => { if (e.target.value) seleccionarDiaTaller(e.target.value, null); });

$("#ctSlots")?.addEventListener("click", e => {
  const c = e.target.closest(".slot-chip"); if (!c) return;
  tHora = c.dataset.hora;
  document.querySelectorAll("#ctSlots .slot-chip").forEach(x => x.classList.toggle("on", x === c));
  $("#ctBloqueDatos").hidden = false;
});
$("#ctGo")?.addEventListener("click", async () => {
  const nombre = $("#ctNombre").value.trim(), tel = $("#ctTel").value.trim(), servicio = $("#ctServicio").value.trim();
  const msg = $("#ctMsg"); msg.style.color = "#ff6b6b"; msg.textContent = "";
  if (!tDia || !tHora) { msg.textContent = "Elige día y hora."; return; }
  if (!nombre || !tel) { msg.textContent = "Pon tu nombre y teléfono."; return; }
  const btn = $("#ctGo"); btn.disabled = true; btn.textContent = "Agendando…";
  try {
    const r = await postJSON(CITAS_TALLER_AGENDAR, { fecha: tDia, hora: tHora, nombre, telefono: tel, servicio });
    if (r && r.ok) {
      $("#ctTaller").innerHTML = `<div class="citas-ok">✓ ¡Listo! Tu cita en el taller quedó para el <b>${fechaBonita(tDia)}</b> a las <b>${to12(tHora)}</b>.<br><span style="color:#9a9aa2;font-weight:500;font-size:13px">Te esperamos.</span></div>`;
    } else { throw new Error(); }
  } catch { msg.textContent = "No se pudo agendar. Intenta de nuevo."; btn.disabled = false; btn.textContent = "Agendar cita"; }
});

/* ---------- MALETA (simple: día + hora directos) ---------- */
$("#cmGo")?.addEventListener("click", async () => {
  const dr = $("#cmDiaR").value, hr = $("#cmHoraR").value, dd = $("#cmDiaD").value, hd = $("#cmHoraD").value;
  const nombre = $("#cmNombre").value.trim(), tel = $("#cmTel").value.trim();
  const msg = $("#cmMsg"); msg.style.color = "#ff6b6b"; msg.textContent = "";
  if (!dr || !hr || !dd || !hd) { msg.textContent = "Completa día y hora de recoger y de regreso."; return; }
  if (dr > MAX || dd > MAX) { msg.textContent = "Por ahora solo apartamos hasta diciembre."; return; }
  if (!nombre || !tel) { msg.textContent = "Pon tu nombre y teléfono."; return; }
  if (new Date(`${dd}T${hd}`) <= new Date(`${dr}T${hr}`)) { msg.textContent = "El regreso debe ser después de recoger."; return; }
  const btn = $("#cmGo"); btn.disabled = true; btn.textContent = "Apartando…";
  try {
    const r = await postJSON(CITAS_MALETA_AGENDAR, { fechaR: dr, horaR: hr, fechaD: dd, horaD: hd, nombre, telefono: tel });
    if (r && r.ok) {
      $("#ctMaleta").innerHTML = `<div class="citas-ok">✓ ¡Maleta apartada!<br><span style="color:#9a9aa2;font-weight:500;font-size:13px">Recoges el ${fechaBonita(dr)} a las ${to12(hr)}, regresas el ${fechaBonita(dd)} a las ${to12(hd)}.</span></div>`;
    } else { msg.style.color = "#ff6b6b"; msg.textContent = (r && r.mensaje) || "Esas fechas ya están apartadas. Elige otras."; btn.disabled = false; btn.textContent = "Apartar maleta"; }
  } catch { msg.textContent = "No se pudo. Intenta de nuevo."; btn.disabled = false; btn.textContent = "Apartar maleta"; }
});
