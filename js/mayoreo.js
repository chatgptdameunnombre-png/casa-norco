import { db } from "./db.js?v=21";

(function () {
  if (document.getElementById("mayCss")) return;
  const s = document.createElement("style");
  s.id = "mayCss";
  s.textContent = ".precio-antes{color:#7a7a82;text-decoration:line-through;font-size:.82em;margin-right:6px}.precio-may{color:#c6f032}";
  document.head.appendChild(s);
})();

let mayorista = false;
let resuelto = false;
const subs = new Set();

db.onAuth(async u => {
  mayorista = false;
  if (u) {
    const m = await db.getMiMayoreo(u.uid).catch(() => null);
    mayorista = m?.estado === "aprobado";
  }
  resuelto = true;
  subs.forEach(fn => { try { fn(); } catch (_) {} });
});

const money = n => "$" + Number(n || 0).toLocaleString("es-MX");

export const soyMayorista = () => mayorista;
export const factorMay = () => (mayorista ? 0.9 : 1);
export const precioMay = base => Math.round(Number(base || 0) * factorMay());

// Suscribirse a cuando se resuelve/cambia el estado de mayorista (para re-render)
export function onMayoreo(fn) {
  subs.add(fn);
  if (resuelto) { try { fn(); } catch (_) {} }
  return () => subs.delete(fn);
}

// HTML de un precio: si es mayorista, muestra el anterior tachado + el descontado
export function precioHTML(base, prefijo = "") {
  const b = Number(base || 0);
  if (!mayorista) return prefijo + money(b);
  return `<s class="precio-antes">${money(b)}</s> <span class="precio-may">${prefijo}${money(Math.round(b * 0.9))}</span>`;
}
