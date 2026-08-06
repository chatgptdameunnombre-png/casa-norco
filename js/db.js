import { firebaseConfig, usaFirebase } from "./config.js";
import { PRODUCTOS_SEED } from "./seed.js";

const LS_KEY = "bici_productos";
const LS_AUTH = "bici_auth";
const DEMO_USER = { email: "dueno@demo.com", pass: "demo1234" };

let impl;

if (usaFirebase) {
  impl = await crearImplFirebase();
} else {
  impl = crearImplDemo();
}

function separarFotos(data) {
  const { id, imagenes, ...resto } = data;
  const fotos = Array.isArray(imagenes) ? imagenes : [];
  const principal = { ...resto, imagen: fotos[0] || resto.imagen || "", nFotos: fotos.length };
  const extra = fotos.slice(1);
  return { id, principal, fotos, extra };
}

async function crearImplFirebase() {
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js");
  const {
    getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, getDoc,
    deleteDoc, getDocs, setDoc, deleteField, query, orderBy
  } = await import("https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js");
  const {
    getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
  } = await import("https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js");

  const app = initializeApp(firebaseConfig);
  const fdb = getFirestore(app);
  const auth = getAuth(app);
  const col = collection(fdb, "productos");
  const refProd = id => doc(fdb, "productos", id);
  const refFotos = id => doc(fdb, "productos_fotos", id);

  async function escribirFotos(id, extra) {
    if (extra.length) await setDoc(refFotos(id), { imagenes: extra });
    else await deleteDoc(refFotos(id)).catch(() => {});
  }

  return {
    modo: "nube",
    onProducts(cb) {
      return onSnapshot(query(col, orderBy("nombre")), snap => {
        cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    },
    async addProduct(data) {
      const ref = data.id ? refProd(data.id) : doc(col);
      const { principal, extra } = separarFotos({ ...data, id: ref.id });
      await setDoc(ref, principal);
      await escribirFotos(ref.id, extra);
    },
    async updateProduct(id, patch) {
      if ("imagenes" in patch) {
        const { principal, extra } = separarFotos({ ...patch, id });
        await escribirFotos(id, extra);
        return updateDoc(refProd(id), { ...principal, imagenes: deleteField() });
      }
      return updateDoc(refProd(id), patch);
    },
    async deleteProduct(id) {
      await deleteDoc(refFotos(id)).catch(() => {});
      return deleteDoc(refProd(id));
    },
    async getFotos(id) {
      const fs = await getDoc(refFotos(id));
      const extra = fs.exists() ? (fs.data().imagenes || []) : null;
      const ms = await getDoc(refProd(id));
      const d = ms.exists() ? ms.data() : {};
      if (extra) return [d.imagen, ...extra].filter(Boolean);
      if (d.imagenes?.length) return d.imagenes;
      return d.imagen ? [d.imagen] : [];
    },
    login(email, pass) { return signInWithEmailAndPassword(auth, email, pass); },
    logout() { return signOut(auth); },
    onAuth(cb) { return onAuthStateChanged(auth, u => cb(u ? { email: u.email } : null)); },
    async seedIfEmpty() {
      const snap = await getDocs(col);
      if (snap.empty) {
        for (const p of PRODUCTOS_SEED) {
          const { principal, extra } = separarFotos(p);
          await setDoc(refProd(p.id), principal);
          await escribirFotos(p.id, extra);
        }
      }
    },
    async optimizarCatalogo(onProgress) {
      const snap = await getDocs(col);
      let hechos = 0;
      for (const d of snap.docs) {
        const data = d.data();
        if (!data.imagenes?.length) continue;
        const extra = data.imagenes.slice(1);
        await escribirFotos(d.id, extra);
        await updateDoc(refProd(d.id), {
          imagen: data.imagenes[0] || data.imagen || "",
          nFotos: data.imagenes.length,
          imagenes: deleteField()
        });
        hechos++;
        onProgress?.(hechos);
      }
      return hechos;
    }
  };
}

function crearImplDemo() {
  const bc = "BroadcastChannel" in window ? new BroadcastChannel("bici-shop") : null;
  const listeners = new Set();
  const authListeners = new Set();

  const leer = () => {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
    catch { return []; }
  };
  const guardar = (arr) => {
    localStorage.setItem(LS_KEY, JSON.stringify(arr));
    notificar();
    bc?.postMessage("cambio");
  };
  const ligero = ({ imagenes, ...p }) => ({ ...p, imagen: (imagenes?.[0]) || p.imagen || "", nFotos: imagenes?.length || (p.imagen ? 1 : 0) });
  const notificar = () => {
    const arr = [...leer()].map(ligero).sort((a, b) => a.nombre.localeCompare(b.nombre));
    listeners.forEach(cb => cb(arr));
  };

  bc?.addEventListener("message", notificar);
  window.addEventListener("storage", e => { if (e.key === LS_KEY) notificar(); });

  const usuarioActual = () => {
    try { return JSON.parse(localStorage.getItem(LS_AUTH)); } catch { return null; }
  };
  const notificarAuth = () => authListeners.forEach(cb => cb(usuarioActual()));

  return {
    modo: "demo",
    onProducts(cb) {
      listeners.add(cb);
      cb([...leer()].map(ligero).sort((a, b) => a.nombre.localeCompare(b.nombre)));
      return () => listeners.delete(cb);
    },
    async addProduct(data) {
      const arr = leer();
      const id = data.id || `p_${Date.now()}`;
      const fotos = Array.isArray(data.imagenes) ? data.imagenes : (data.imagen ? [data.imagen] : []);
      const i = arr.findIndex(p => p.id === id);
      const item = { ...data, id, imagenes: fotos, imagen: fotos[0] || "" };
      if (i >= 0) arr[i] = item; else arr.push(item);
      guardar(arr);
    },
    async updateProduct(id, patch) {
      const arr = leer();
      const i = arr.findIndex(p => p.id === id);
      if (i < 0) return;
      const merged = { ...arr[i], ...patch };
      if ("imagenes" in patch) {
        const fotos = Array.isArray(patch.imagenes) ? patch.imagenes : [];
        merged.imagenes = fotos;
        merged.imagen = fotos[0] || "";
      }
      arr[i] = merged;
      guardar(arr);
    },
    async deleteProduct(id) {
      guardar(leer().filter(p => p.id !== id));
    },
    async getFotos(id) {
      const p = leer().find(x => x.id === id);
      if (!p) return [];
      return p.imagenes?.length ? p.imagenes : (p.imagen ? [p.imagen] : []);
    },
    async login(email, pass) {
      if (email.trim().toLowerCase() === DEMO_USER.email && pass === DEMO_USER.pass) {
        localStorage.setItem(LS_AUTH, JSON.stringify({ email: DEMO_USER.email }));
        notificarAuth();
        return true;
      }
      const err = new Error("Correo o contraseña incorrectos");
      err.code = "auth/invalid-credential";
      throw err;
    },
    async logout() { localStorage.removeItem(LS_AUTH); notificarAuth(); },
    onAuth(cb) { authListeners.add(cb); cb(usuarioActual()); return () => authListeners.delete(cb); },
    async seedIfEmpty() {
      if (leer().length === 0) guardar(PRODUCTOS_SEED.map(p => ({ ...p })));
    },
    async optimizarCatalogo() { return 0; }
  };
}

export const db = impl;
export const MODO = impl.modo;
export const CREDS_DEMO = DEMO_USER;
