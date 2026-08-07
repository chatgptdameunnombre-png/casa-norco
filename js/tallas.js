export const TALLAS_ORDEN = ["CH", "M", "G", "XG"];

export function tieneTallas(p) {
  return !!(p && p.tallaTipo === "tallas" && Array.isArray(p.tallas) && p.tallas.length > 0);
}

export function tallasDe(p) {
  if (!tieneTallas(p)) return [];
  return p.tallas.slice().sort((a, b) => TALLAS_ORDEN.indexOf(a.talla) - TALLAS_ORDEN.indexOf(b.talla));
}

export function stockDeTalla(p, talla) {
  const x = (p.tallas || []).find(z => z.talla === talla);
  return x ? Number(x.stock || 0) : 0;
}

export function stockTotal(p) {
  if (tieneTallas(p)) return p.tallas.reduce((a, t) => a + Number(t.stock || 0), 0);
  return Number(p.stock || 0);
}

export function precioTalla(p, talla) {
  const x = (p.tallas || []).find(z => z.talla === talla);
  return x && Number(x.precio) > 0 ? Number(x.precio) : Number(p.precio || 0);
}

export function precioDesde(p) {
  if (!tieneTallas(p)) return Number(p.precio || 0);
  const ps = tallasDe(p).map(t => (Number(t.precio) > 0 ? Number(t.precio) : Number(p.precio || 0)));
  return ps.length ? Math.min(...ps) : Number(p.precio || 0);
}

export function preciosVarian(p) {
  if (!tieneTallas(p)) return false;
  const set = new Set(tallasDe(p).map(t => (Number(t.precio) > 0 ? Number(t.precio) : Number(p.precio || 0))));
  return set.size > 1;
}

export function etiquetaStock(n) {
  n = Number(n) || 0;
  if (n <= 0) return { cls: "out", txt: "Agotado" };
  if (n < 5) return { cls: "low", txt: "Quedan " + n };
  return { cls: "ok", txt: "Disponible" };
}
