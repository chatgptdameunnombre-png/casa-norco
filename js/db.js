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

async function crearImplFirebase() {
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js");
  const {
    getFirestore, collection, onSnapshot, addDoc, doc, updateDoc,
    deleteDoc, getDocs, setDoc, query, orderBy
  } = await import("https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js");
  const {
    getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
  } = await import("https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js");

  const app = initializeApp(firebaseConfig);
  const fdb = getFirestore(app);
  const auth = getAuth(app);
  const col = collection(fdb, "productos");

  return {
    modo: "nube",
    onProducts(cb) {
      return onSnapshot(query(col, orderBy("nombre")), snap => {
        cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    },
    async addProduct(data) {
      const { id, ...resto } = data;
      if (id) await setDoc(doc(fdb, "productos", id), resto);
      else await addDoc(col, resto);
    },
    updateProduct(id, patch) { return updateDoc(doc(fdb, "productos", id), patch); },
    deleteProduct(id) { return deleteDoc(doc(fdb, "productos", id)); },
    login(email, pass) { return signInWithEmailAndPassword(auth, email, pass); },
    logout() { return signOut(auth); },
    onAuth(cb) { return onAuthStateChanged(auth, u => cb(u ? { email: u.email } : null)); },
    async seedIfEmpty() {
      const snap = await getDocs(col);
      if (snap.empty) {
        for (const p of PRODUCTOS_SEED) {
          const { id, ...resto } = p;
          await setDoc(doc(fdb, "productos", id), resto);
        }
      }
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
  const notificar = () => {
    const arr = [...leer()].sort((a, b) => a.nombre.localeCompare(b.nombre));
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
      cb([...leer()].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      return () => listeners.delete(cb);
    },
    async addProduct(data) {
      const arr = leer();
      const id = data.id || `p_${Date.now()}`;
      const i = arr.findIndex(p => p.id === id);
      const item = { ...data, id };
      if (i >= 0) arr[i] = item; else arr.push(item);
      guardar(arr);
    },
    async updateProduct(id, patch) {
      const arr = leer();
      const i = arr.findIndex(p => p.id === id);
      if (i >= 0) { arr[i] = { ...arr[i], ...patch }; guardar(arr); }
    },
    async deleteProduct(id) {
      guardar(leer().filter(p => p.id !== id));
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
    }
  };
}

export const db = impl;
export const MODO = impl.modo;
export const CREDS_DEMO = DEMO_USER;
