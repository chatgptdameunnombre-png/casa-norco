export const firebaseConfig = {
  apiKey: "AIzaSyDeKk6Hr-3-nDDIVwh3fi5OIPUZJo5XKPY",
  authDomain: "bici-shop-demo.firebaseapp.com",
  projectId: "bici-shop-demo",
  storageBucket: "bici-shop-demo.firebasestorage.app",
  messagingSenderId: "1033432478399",
  appId: "1:1033432478399:web:6d6223f92caac268874c0a"
};

export const WHATSAPP_NUMERO = "523343288620";

export const ENVIO_DOMICILIO = 380;

export const COBRO_WEBHOOK = "https://n8n.srv1473142.hstgr.cloud/webhook/casanorco-crear-pago";

export const ASESOR_WEBHOOK = "https://n8n.srv1473142.hstgr.cloud/webhook/casanorco-asesor";

export const NEGOCIO = {
  nombre: "Casa Norco",
  claim: "Bicicletas premium, taller y café",
  ciudad: "Zapopan, Jal.",
  direccion: "Av. Adolfo López Mateos Sur 3188, Agua Blanca Habitacional, 45235 Zapopan, Jal.",
  telefono: "33 4328 8620",
  horario: "Lun–Vie 9:00–19:00 · Sáb 9:00–14:00 · Dom cerrado",
  instagram: "https://www.instagram.com/casanorco"
};

export const usaFirebase = Object.values(firebaseConfig).every(v => v && v !== "PEGA_AQUI");
