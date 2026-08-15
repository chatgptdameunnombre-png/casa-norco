import { CITAS_TALLER_HORARIOS, CITAS_TALLER_AGENDAR, CITAS_MALETA_AGENDAR } from "./config.js?v=21";

const $ = s => document.querySelector(s);
const HORARIOS = { 0: null, 1: [9, 19], 2: [9, 19], 3: [9, 19], 4: [9, 19], 5: [9, 19], 6: [9, 14] };
const dosDig = n => String(n).padStart(2, "0");
const DIASEM = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fechaBonita = f => new Date(f + "T00:00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
// hora "14:00" -> "2:00 pm"
const to12 = hhmm => {
  let [h, m] = hhmm.split(":").map(Number);
  const ap = h < 12 ? "am" : "pm";
  let h12 = h % 12; if (h12 === 0) h12 = 12;
  return `${h12}:${dosDig(m || 0)} ${ap}`;
};

async function postJSON(url, body) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}
function proximosDias(n) {
  const out = [], hoy = new Date();
  for (let i = 0; i < 60 && out.length < n; i++) {
    const x = new Date(hoy); x.setDate(hoy.getDate() + i);
    if (HORARIOS[x.getDay()]) out.push(x);
  }
  return out;
}
function chipDia(x) {
  const f = `${x.getFullYear()}-${dosDig(x.getMonth() + 1)}-${dosDig(x.getDate())}`;
  return `<button type="button" class="dia-chip" data-fecha="${f}">${x.getDate()}<small>${DIASEM[x.getDay()]} ${MES[x.getMonth()]}</small></button>`;
}
const btnMas = `<button type="button" class="dia-chip mas-dias" style="border-style:dashed;color:#c6f032">+ más<small>días</small></button>`;
function horasChips() { const hs = []; for (let h = 9; h <= 18; h++) hs.push(dosDig(h) + ":00"); return hs; }

/* ---------- tabs ---------- */
document.querySelectorAll(".citas-tab").forEach(b => b.addEventListener("click", () => {
  document.querySelectorAll(".citas-tab").forEach(x => x.classList.toggle("on", x === b));
  $("#ctTaller").hidden = b.dataset.ct !== "taller";
  $("#ctMaleta").hidden = b.dataset.ct !== "maleta";
}));

/* ---------- TALLER ---------- */
let tDia = null, tHora = null, tNdias = 8;
function pintarDiasTaller() {
  if ($("#ctDias")) $("#ctDias").innerHTML = proximosDias(tNdias).map(chipDia).join("") + btnMas;
}
pintarDiasTaller();

$("#ctDias")?.addEventListener("click", async e => {
  if (e.target.closest(".mas-dias")) { tNdias += 8; pintarDiasTaller(); return; }
  const c = e.target.closest(".dia-chip"); if (!c) return;
  tDia = c.dataset.fecha; tHora = null;
  document.querySelectorAll("#ctDias .dia-chip").forEach(x => x.classList.toggle("on", x === c));
  $("#ctBloqueDatos").hidden = true; $("#ctMsg").textContent = "";
  const slots = $("#ctSlots"); $("#ctBloqueHora").hidden = false;
  slots.innerHTML = `<span style="color:#9a9aa2;font-size:13px">Buscando horarios libres…</span>`;
  try {
    const r = await postJSON(CITAS_TALLER_HORARIOS, { fecha: tDia });
    const libres = r && Array.isArray(r.horarios) ? r.horarios : [];
    if (!libres.length) { slots.innerHTML = `<span style="color:#9a9aa2;font-size:13px">No hay horarios libres ese día. Elige otro.</span>`; return; }
    slots.innerHTML = libres.map(h => `<button type="button" class="slot-chip" data-hora="${h}">${to12(h)} – ${to12(dosDig(Number(h.slice(0, 2)) + 2) + ":00")}</button>`).join("");
  } catch { slots.innerHTML = `<span style="color:#ff6b6b;font-size:13px">No se pudo cargar. Intenta de nuevo.</span>`; }
});
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

/* ---------- MALETA ---------- */
let mR = null, mRh = null, mD = null, mDh = null, mNr = 8, mNd = 8;
function pintarMaleta() {
  $("#cmDiasR").innerHTML = proximosDias(mNr).map(chipDia).join("") + btnMas;
  $("#cmDiasD").innerHTML = proximosDias(mNd).map(chipDia).join("") + btnMas;
  const chips = q => q.map(h => `<button type="button" class="slot-chip" data-h="${h}">${to12(h)}</button>`).join("");
  if (!$("#cmHorasR").dataset.filled) { $("#cmHorasR").innerHTML = chips(horasChips()); $("#cmHorasR").dataset.filled = "1"; }
  if (!$("#cmHorasD").dataset.filled) { $("#cmHorasD").innerHTML = chips(horasChips()); $("#cmHorasD").dataset.filled = "1"; }
}
if ($("#cmDiasR")) pintarMaleta();

// buscar hora específica (filtra los chips por lo que escribas: "2 pm", "14", etc.)
["#cmBuscarR|#cmHorasR", "#cmBuscarD|#cmHorasD"].forEach(par => {
  const [inp, cont] = par.split("|");
  $(inp)?.addEventListener("input", e => {
    const q = e.target.value.toLowerCase().trim();
    document.querySelectorAll(`${cont} .slot-chip`).forEach(c => {
      c.style.display = (!q || c.textContent.toLowerCase().includes(q) || c.dataset.h.includes(q)) ? "" : "none";
    });
  });
});

function bindDias(sel, cb) {
  $(sel)?.addEventListener("click", e => {
    if (e.target.closest(".mas-dias")) { cb(null, true); return; }
    const c = e.target.closest(".dia-chip"); if (!c) return;
    $(sel).querySelectorAll(".dia-chip").forEach(x => x.classList.toggle("on", x === c));
    cb(c.dataset.fecha);
  });
}
function bindHoras(sel, cb) {
  $(sel)?.addEventListener("click", e => {
    const c = e.target.closest(".slot-chip"); if (!c) return;
    $(sel).querySelectorAll(".slot-chip").forEach(x => x.classList.toggle("on", x === c));
    cb(c.dataset.h);
  });
}
bindDias("#cmDiasR", (v, mas) => { if (mas) { mNr += 8; pintarMaleta(); } else mR = v; });
bindDias("#cmDiasD", (v, mas) => { if (mas) { mNd += 8; pintarMaleta(); } else mD = v; });
bindHoras("#cmHorasR", v => mRh = v);
bindHoras("#cmHorasD", v => mDh = v);

$("#cmGo")?.addEventListener("click", async () => {
  const nombre = $("#cmNombre").value.trim(), tel = $("#cmTel").value.trim();
  const msg = $("#cmMsg"); msg.style.color = "#ff6b6b"; msg.textContent = "";
  if (!mR || !mRh || !mD || !mDh) { msg.textContent = "Elige día y hora de recoger y de regreso."; return; }
  if (!nombre || !tel) { msg.textContent = "Pon tu nombre y teléfono."; return; }
  if (new Date(`${mD}T${mDh}`) <= new Date(`${mR}T${mRh}`)) { msg.textContent = "El regreso debe ser después de recoger."; return; }
  const btn = $("#cmGo"); btn.disabled = true; btn.textContent = "Apartando…";
  try {
    const r = await postJSON(CITAS_MALETA_AGENDAR, { fechaR: mR, horaR: mRh, fechaD: mD, horaD: mDh, nombre, telefono: tel });
    if (r && r.ok) {
      $("#ctMaleta").innerHTML = `<div class="citas-ok">✓ ¡Maleta apartada!<br><span style="color:#9a9aa2;font-weight:500;font-size:13px">Recoges el ${fechaBonita(mR)} a las ${to12(mRh)}, regresas el ${fechaBonita(mD)} a las ${to12(mDh)}.</span></div>`;
    } else { msg.style.color = "#ff6b6b"; msg.textContent = (r && r.mensaje) || "Esas fechas ya están apartadas. Elige otras."; btn.disabled = false; btn.textContent = "Apartar maleta"; }
  } catch { msg.textContent = "No se pudo. Intenta de nuevo."; btn.disabled = false; btn.textContent = "Apartar maleta"; }
});
