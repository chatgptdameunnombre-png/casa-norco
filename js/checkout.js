import { COBRO_WEBHOOK, ENVIO_DOMICILIO, WHATSAPP_NUMERO } from "./config.js?v=21";
import { db } from "./db.js?v=21";
import { soyMayorista } from "./mayoreo.js?v=21";

const money = n => "$" + Number(n).toLocaleString("es-MX");

const CLABE_TRANSFERENCIA = "646180157099887766";
const BANCO_TRANSFERENCIA = "STP";
const BENEFICIARIO_TRANSFERENCIA = "Casa Norco (Cueva Bicycles)";

let user = null, perfil = null;
db.onAuth(async u => {
  user = u;
  perfil = u ? await db.getPerfil(u.uid).catch(() => null) : null;
});

export function iniciarPago({ items, productos, entrega, onError }) {
  if (entrega === "domicilio") {
    abrirModal(datos => enviarPago({ items, productos, entrega, ...datos }, onError), onError);
  } else {
    enviarPago({ items, productos, entrega }, onError);
  }
}

function enviarPago(payload, onError) {
  fetch(COBRO_WEBHOOK, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, uid: user?.uid || "" })
  }).then(r => r.json()).then(d => {
    if (d.link) { window.location.href = d.link; return; }
    throw new Error("sin link");
  }).catch(() => { if (onError) onError(); });
}

export function iniciarTransferencia({ productos, entrega, total, onError }) {
  if (entrega === "domicilio") {
    abrirModal(datos => mostrarClabe({ productos, entrega, total, ...datos }), onError);
  } else {
    mostrarClabe({ productos, entrega, total });
  }
}

function mostrarClabe({ productos, entrega, total, cliente, telefono, direccion }) {
  if (document.getElementById("trOverlay")) return;
  const ref = "CN-" + Date.now().toString().slice(-6);
  const desc = soyMayorista() ? Math.round(total * 0.1) : 0;
  const totalFinal = total - desc;
  const resumen = (productos || []).map(p => `${p.qty}x ${p.title}${p.talla ? " (T " + p.talla + ")" : ""}`).join(", ");
  const entregaTxt = entrega === "domicilio" ? `Entrega a domicilio: ${direccion || ""}` : "Recoge en tienda";
  const descTxt = desc ? `\nDescuento mayoreo -10%: -${money(desc)}` : "";
  const waMsg = encodeURIComponent(`Hola, hice mi pedido en la web (ref ${ref}).\nProductos: ${resumen}${descTxt}\nTotal: ${money(totalFinal)}\n${entregaTxt}\nAdjunto mi comprobante de transferencia.`);
  const waLink = `https://wa.me/${WHATSAPP_NUMERO}?text=${waMsg}`;
  const ov = document.createElement("div");
  ov.id = "trOverlay";
  ov.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.72);backdrop-filter:blur(3px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px";
  ov.innerHTML = `
    <div style="background:#141416;border:1px solid #26262c;border-radius:18px;max-width:440px;width:100%;padding:24px;font-family:inherit;color:#f4f4f5;max-height:92vh;overflow:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <h3 style="margin:0;font-size:19px;font-weight:800">Paga por transferencia</h3>
        <button id="trClose" style="background:none;border:none;color:#9a9aa2;font-size:22px;cursor:pointer;line-height:1">✕</button>
      </div>
      <p style="margin:0 0 16px;font-size:13px;color:#9a9aa2">Transfiere el total a esta cuenta y mándanos tu comprobante por WhatsApp. Confirmamos tu pedido en cuanto lo recibamos.</p>
      <div style="background:#0e0e11;border:1px solid #2a2a30;border-radius:12px;padding:14px;margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="color:#9a9aa2;font-size:13px">Banco</span><b>${BANCO_TRANSFERENCIA}</b></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="color:#9a9aa2;font-size:13px">Beneficiario</span><b style="text-align:right">${BENEFICIARIO_TRANSFERENCIA}</b></div>
        <div style="margin-bottom:8px"><span style="color:#9a9aa2;font-size:13px">CLABE</span><div style="display:flex;align-items:center;gap:8px;margin-top:4px"><b id="trClabe" style="font-size:18px;letter-spacing:1px">${CLABE_TRANSFERENCIA}</b><button id="trCopy" style="background:#26262c;border:none;color:#c6f032;border-radius:8px;padding:4px 10px;font-size:12px;cursor:pointer">Copiar</button></div></div>
        ${desc
          ? `<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px"><span style="color:#c6f032;font-size:13px;font-weight:700">Precio mayorista −10%</span><span><s style="color:#7a7a82;font-size:14px;margin-right:8px">${money(total)}</s><b style="color:#c6f032;font-size:20px">${money(totalFinal)}</b></span></div>`
          : `<div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="color:#9a9aa2;font-size:13px">Monto</span><b style="color:#c6f032;font-size:18px">${money(totalFinal)}</b></div>`}
        <div style="display:flex;justify-content:space-between"><span style="color:#9a9aa2;font-size:13px">Referencia</span><b>${ref}</b></div>
      </div>
      <a href="${waLink}" target="_blank" rel="noopener" style="display:block;text-align:center;background:#25D366;color:#fff;border-radius:12px;padding:14px;font-weight:800;font-size:15px;text-decoration:none">Enviar comprobante por WhatsApp</a>
    </div>`;
  document.body.appendChild(ov);
  const q = s => ov.querySelector(s);
  const cerrar = () => ov.remove();
  q("#trClose").onclick = cerrar;
  ov.addEventListener("click", e => { if (e.target === ov) cerrar(); });
  q("#trCopy").onclick = () => {
    navigator.clipboard?.writeText(CLABE_TRANSFERENCIA);
    q("#trCopy").textContent = "Copiado ✓";
  };
}

function abrirModal(onConfirm, onCancel) {
  if (document.getElementById("dirOverlay")) return;
  const ov = document.createElement("div");
  ov.id = "dirOverlay";
  ov.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.72);backdrop-filter:blur(3px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px";
  ov.innerHTML = `
    <div style="background:#141416;border:1px solid #26262c;border-radius:18px;max-width:440px;width:100%;padding:24px;font-family:inherit;color:#f4f4f5;max-height:92vh;overflow:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <h3 style="margin:0;font-size:19px;font-weight:800">¿A dónde lo enviamos?</h3>
        <button id="dirClose" style="background:none;border:none;color:#9a9aa2;font-size:22px;cursor:pointer;line-height:1">✕</button>
      </div>
      <p style="margin:0 0 16px;font-size:13px;color:#9a9aa2">${perfil ? "Envío a domicilio (+" + money(ENVIO_DOMICILIO) + "). Revisa que tus datos estén bien y confirma." : "Envío a domicilio (+" + money(ENVIO_DOMICILIO) + "). Llena tus datos para la entrega."}</p>
      <div style="display:flex;flex-direction:column;gap:10px">
        <input id="dNombre" placeholder="Nombre completo" ${inp()}>
        <input id="dTel" placeholder="Teléfono" inputmode="tel" ${inp()}>
        <input id="dCalle" placeholder="Calle y número" ${inp()}>
        <div style="display:flex;gap:10px">
          <input id="dCol" placeholder="Colonia" ${inp()} style="flex:2;${inpS()}">
          <input id="dCP" placeholder="C.P." inputmode="numeric" ${inp()} style="flex:1;${inpS()}">
        </div>
        <div style="display:flex;gap:10px">
          <input id="dCiudad" placeholder="Ciudad" ${inp()} style="flex:1;${inpS()}">
          <input id="dEstado" placeholder="Estado" ${inp()} style="flex:1;${inpS()}">
        </div>
        <input id="dRef" placeholder="Referencias (opcional)" ${inp()}>
        <div id="dErr" style="color:#ff6b6b;font-size:12.5px;min-height:16px"></div>
        <button id="dGo" style="background:#c6f032;color:#0a0a0a;border:none;border-radius:12px;padding:14px;font-weight:800;font-size:15px;cursor:pointer;letter-spacing:.3px">Continuar al pago</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const $ = s => ov.querySelector(s);
  if (perfil) {
    const pre = { dNombre: perfil.nombre, dTel: perfil.telefono, dCalle: perfil.calle, dCol: perfil.colonia, dCP: perfil.cp, dCiudad: perfil.ciudad, dEstado: perfil.estado, dRef: perfil.referencias };
    for (const [id, v] of Object.entries(pre)) { if (v) $("#" + id).value = v; }
  }
  const cerrar = () => { ov.remove(); if (onCancel) onCancel(); };
  $("#dirClose").onclick = cerrar;
  ov.addEventListener("click", e => { if (e.target === ov) cerrar(); });
  $("#dGo").onclick = () => {
    const nombre = $("#dNombre").value.trim(), tel = $("#dTel").value.trim();
    const calle = $("#dCalle").value.trim(), col = $("#dCol").value.trim(), cp = $("#dCP").value.trim();
    const ciudad = $("#dCiudad").value.trim(), estado = $("#dEstado").value.trim(), ref = $("#dRef").value.trim();
    if (!nombre || !tel || !calle || !col || !cp || !ciudad || !estado) { $("#dErr").textContent = "Completa nombre, teléfono, calle, colonia, C.P., ciudad y estado."; return; }
    const direccion = `${calle}, Col. ${col}, ${ciudad}, ${estado}, C.P. ${cp}${ref ? " (" + ref + ")" : ""}`;
    if (user) {
      db.guardarPerfil(user.uid, {
        nombre, telefono: tel, calle, colonia: col, cp, ciudad, estado, referencias: ref,
        email: user.email, actualizado: new Date().toISOString()
      }).catch(() => {});
    }
    $("#dGo").disabled = true; $("#dGo").textContent = "Generando pago…";
    ov.remove();
    onConfirm({ cliente: nombre, telefono: tel, direccion });
  };
}

function inp() { return `style="${inpBase()}"`; }
function inpBase() { return "width:100%;padding:12px 14px;border-radius:11px;border:1px solid #2a2a30;background:#0e0e11;color:#f4f4f5;font-size:14px;outline:none;box-sizing:border-box"; }
function inpS() { return inpBase(); }
