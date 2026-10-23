/* Firebase Authentication + Firestore + Server + Per-Account Vault sync for JAFN AI.
   Requires Google Login before chatting and restores conversation history on re-login to the same Google account. */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, doc, setDoc, collection, getDocs, writeBatch, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDPxANYoZFLMd_gr4oP9PEsQsaMLaHGr4o',
  authDomain: 'jafn-ai.firebaseapp.com',
  projectId: 'jafn-ai',
  storageBucket: 'jafn-ai.firebasestorage.app',
  messagingSenderId: '868530308242',
  appId: '1:868530308242:web:889da8a1f744c7ba3b524b',
  measurementId: 'G-23N9M1PYZ8'
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });
const KEYS = [
  'ruangai_history','ruangai_image_history','ruangai_theme','ruangai_style',
  'ruangai_personalization','jafn_companion_settings_v1','jafn_privacy_save_history',
  'jafn_privacy_save_preferences','jafn_privacy_memory','jafn_onboarding_done_v1',
  'ruangai_arcade_v1','jafn_usage_total_v1','jafn_usage_daily_v1','jafn_response_feedback_v1'
];
const CHAT_KEY = 'ruangai_chats';
const VAULT_PREFIX = 'jafn_account_vault_';
let currentUser = null;
let cloudReady = false;
let syncTimer = null;

const originalSetItem = Storage.prototype.setItem;
const originalRemoveItem = Storage.prototype.removeItem;

function vaultKey(uid) {
  return VAULT_PREFIX + String(uid || '');
}

function readLocalVault(uid) {
  if (!uid) return { chats: [], settings: {}, deletedChatIds: [] };
  try {
    const raw = localStorage.getItem(vaultKey(uid));
    if (!raw) return { chats: [], settings: {}, deletedChatIds: [] };
    const parsed = JSON.parse(raw);
    return {
      chats: Array.isArray(parsed?.chats) ? parsed.chats.map(safeChat).filter(c => c.id) : [],
      settings: (parsed?.settings && typeof parsed.settings === 'object') ? parsed.settings : {},
      deletedChatIds: Array.isArray(parsed?.deletedChatIds) ? parsed.deletedChatIds : []
    };
  } catch {
    return { chats: [], settings: {}, deletedChatIds: [] };
  }
}

function writeLocalVault(uid, chats, settings, deletedChatIds = []) {
  if (!uid) return;
  try {
    const existing = readLocalVault(uid);
    const nextChats = Array.isArray(chats) ? chats.map(safeChat).filter(c => c.id) : existing.chats;
    const nextSettings = (settings && typeof settings === 'object') ? { ...existing.settings, ...settings } : existing.settings;
    const nextDeleted = Array.isArray(deletedChatIds) ? deletedChatIds.slice(-200) : existing.deletedChatIds;
    originalSetItem.call(localStorage, vaultKey(uid), JSON.stringify({
      chats: nextChats.slice(0, 150),
      settings: nextSettings,
      deletedChatIds: nextDeleted,
      updatedAt: Date.now()
    }));
  } catch (e) {
    console.warn('Local vault write failed', e);
  }
}

function snapshotActiveStateToVault(uid) {
  if (!uid) return;
  try {
    const existing = readLocalVault(uid);
    let activeChats = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(CHAT_KEY) || '[]');
      if (Array.isArray(parsed)) activeChats = parsed.map(safeChat).filter(c => c.id);
    } catch {}
    const activeIds = new Set(activeChats.map(c => c.id));
    const prevIds = existing.chats.map(c => c.id);
    const newlyDeleted = prevIds.filter(id => !activeIds.has(id));
    const deletedSet = new Set([...(existing.deletedChatIds || []), ...newlyDeleted].filter(id => !activeIds.has(id)));
    const settings = { ...existing.settings };
    for (const k of KEYS) {
      const val = localStorage.getItem(k);
      if (val !== null) settings[k] = val;
    }
    writeLocalVault(uid, activeChats, settings, [...deletedSet]);
  } catch (e) {
    console.warn('Snapshot to vault failed', e);
  }
}

function safeChat(chat) {
  if (!chat || typeof chat !== 'object') return { id: '', mode: 'text', title: 'Percakapan', updated: 0, messages: [] };
  const copy = {
    id: String(chat.id || '').slice(0, 150),
    mode: chat.mode === 'image' ? 'image' : 'text',
    title: String(chat.title || 'Percakapan').slice(0, 100),
    updated: Number(chat.updated) || Date.now(),
    messages: []
  };
  for (const m of (Array.isArray(chat.messages) ? chat.messages : []).slice(-80)) {
    if (!m || !['user', 'assistant'].includes(m.role)) continue;
    const content = typeof m.content === 'string' ? m.content.slice(-15000) : '';
    copy.messages.push({ role: m.role, content });
  }
  return copy;
}

function mergeChatLists(chatArrays, deletedIds = []) {
  const deleted = new Set(Array.isArray(deletedIds) ? deletedIds : []);
  const byId = new Map();
  for (const list of chatArrays) {
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      const c = safeChat(raw);
      if (!c.id || c.id.includes('/') || deleted.has(c.id)) continue;
      const prev = byId.get(c.id);
      if (!prev) {
        byId.set(c.id, c);
      } else {
        const prevLen = (prev.messages || []).length;
        const curLen = (c.messages || []).length;
        if (curLen > prevLen || (curLen === prevLen && (c.updated || 0) > (prev.updated || 0))) {
          byId.set(c.id, c);
        }
      }
    }
  }
  return [...byId.values()].sort((a, b) => (b.updated || 0) - (a.updated || 0)).slice(0, 150);
}

async function fetchServerUserData(user) {
  try {
    const token = await user.getIdToken();
    const res = await fetch('/api/user-data', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) return { chats: [], settings: {} };
    const data = await res.json();
    return {
      chats: Array.isArray(data?.chats) ? data.chats.map(safeChat).filter(c => c.id) : [],
      settings: (data?.settings && typeof data.settings === 'object') ? data.settings : {}
    };
  } catch {
    return { chats: [], settings: {} };
  }
}

async function pushServerUserData(user, chats, settings) {
  if (!user) return;
  try {
    const token = await user.getIdToken();
    await fetch('/api/user-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ chats, settings })
    });
  } catch (e) {
    console.warn('Server user-data sync skipped:', e);
  }
}

function addAuthControl() {
  if (document.getElementById('jafnAuthControl')) return;
  const header = document.querySelector('header');
  if (!header) return;
  const wrap = document.createElement('div');
  wrap.id = 'jafnAuthControl';
  wrap.style.cssText = 'display:flex;align-items:center;gap:8px;max-width:220px;margin-left:4px;';
  const btn = document.createElement('button');
  btn.type = 'button'; btn.id = 'jafnAuthButton';
  btn.style.cssText = 'border:1px solid var(--line,#64748b);border-radius:12px;padding:9px 12px;background:var(--panel2,#202638);color:var(--text,#fff);font-weight:650;cursor:pointer;white-space:nowrap;max-width:190px;overflow:hidden;text-overflow:ellipsis;';
  btn.textContent = '🔐 Login Google';
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      if (auth.currentUser) {
        if (!confirm('Logout dari JAFN AI? Percakapanmu sudah tersimpan di akun Google ini dan akan kembali saat login ulang.')) return;
        await flushCloudSync();
        await signOut(auth);
      } else {
        await signInWithPopup(auth, provider);
      }
    } catch (e) {
      console.error('Firebase auth error', e);
      const code = e?.code || 'unknown';
      if (code === 'auth/unauthorized-domain') {
        const host = window.location.hostname || '(hostname tidak tersedia)';
        const origin = window.location.origin || window.location.href;
        alert(
          'Domain aplikasi belum diizinkan oleh Firebase Authentication.\n\n' +
          'Domain yang sedang dipakai: ' + host + '\n' +
          'Alamat aplikasi: ' + origin + '\n\n' +
          'Perbaikan: buka Firebase Console > Authentication > Settings > Authorized domains > Add domain, lalu tambahkan hostname di atas (tanpa https://, path, atau port). ' +
          'Jika berjalan lokal, buka http://localhost:3000 dan pastikan localhost tercantum.'
        );
      } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        alert('Login/logout gagal. Detail: ' + code + (e?.message ? '\n' + e.message : ''));
      }
    } finally { btn.disabled = false; }
  });
  const status = document.createElement('span');
  status.id = 'jafnAuthStatus'; status.style.cssText = 'font-size:11px;color:var(--muted,#94a3b8);display:none;';
  wrap.append(btn, status);
  const arcade = document.getElementById('arcadeBtn');
  if (arcade?.parentElement === header) header.insertBefore(wrap, arcade); else header.append(wrap);
  const style = document.createElement('style');
  style.textContent = '@media(max-width:700px){#jafnAuthControl{max-width:145px}#jafnAuthButton{font-size:11px;padding:7px 8px;max-width:145px}}';
  document.head.append(style);
}

window.jafnTriggerGoogleLogin = () => {
  const btn = document.getElementById('jafnAuthButton');
  if (btn && !auth.currentUser) btn.click();
};

function updateAuthUI(user) {
  const btn = document.getElementById('jafnAuthButton');
  const status = document.getElementById('jafnAuthStatus');
  if (!btn) return;
  if (user) {
    btn.textContent = '👤 ' + (user.displayName || user.email || 'Akun Google');
    btn.title = `${user.displayName || ''} ${user.email || ''}\nKlik untuk logout`;
    if (status) { status.style.display = 'block'; status.textContent = cloudReady ? '☁️ Tersinkron' : '☁️ Memuat riwayat…'; }
  } else {
    btn.textContent = '🔐 Login Google';
    btn.title = 'Login dengan Google diperlukan untuk mulai chat dan menyimpan riwayat';
    if (status) { status.style.display = 'block'; status.textContent = '🔒 Belum login'; }
  }
}

async function syncChatsToFirestore(chats) {
  if (!currentUser || !cloudReady) return;
  if (!Array.isArray(chats)) return;
  const ref = collection(db, 'users', currentUser.uid, 'chats');
  const existing = await getDocs(ref);
  const wanted = new Set(chats.slice(0, 100).map(c => String(c.id || '')).filter(id => id && !id.includes('/')));
  let batch = writeBatch(db), count = 0;
  for (const c of chats.slice(0, 100)) {
    const item = safeChat(c);
    if (!item.id || item.id.includes('/')) continue;
    batch.set(doc(ref, item.id), { ...item, updatedAt: serverTimestamp() });
    count++;
    if (count >= 400) { await batch.commit(); batch = writeBatch(db); count = 0; }
  }
  for (const old of existing.docs) {
    if (!wanted.has(old.id)) {
      batch.delete(old.ref);
      count++;
      if (count >= 400) { await batch.commit(); batch = writeBatch(db); count = 0; }
    }
  }
  if (count) await batch.commit();
}

async function syncSettingToFirestore(key, value) {
  if (!currentUser || !cloudReady || !KEYS.includes(key)) return;
  if (typeof value !== 'string' || value.length > 45000) return;
  await setDoc(doc(db, 'users', currentUser.uid, 'settings', key), { value, updatedAt: serverTimestamp() });
}

function collectCurrentSettings() {
  const out = {};
  for (const k of KEYS) {
    const val = localStorage.getItem(k);
    if (val !== null) out[k] = val;
  }
  return out;
}

function collectCurrentChats() {
  if (localStorage.getItem('jafn_privacy_save_history') === 'false') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(CHAT_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(safeChat).filter(c => c.id) : [];
  } catch {
    return [];
  }
}

function queueSync(key, value) {
  if (!currentUser || !cloudReady) return;
  // Save immediately to per-UID local vault so zero data is ever lost on quick logout/refresh
  snapshotActiveStateToVault(currentUser.uid);

  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    if (!currentUser || !cloudReady) return;
    const chats = collectCurrentChats();
    const settings = collectCurrentSettings();
    await pushServerUserData(currentUser, chats, settings);
    try {
      if (key === CHAT_KEY) await syncChatsToFirestore(chats);
      else await syncSettingToFirestore(key, value);
      const status = document.getElementById('jafnAuthStatus');
      if (status) status.textContent = '☁️ Tersinkron';
    } catch (e) {
      console.warn('Firestore sync warning (saved to local vault & server):', e);
      const status = document.getElementById('jafnAuthStatus');
      if (status) status.textContent = '☁️ Tersimpan';
    }
  }, 400);
}

Storage.prototype.setItem = function(key, value) {
  originalSetItem.call(this, key, value);
  if (this === window.localStorage && (key === CHAT_KEY || KEYS.includes(key))) {
    queueSync(key, String(value));
  }
};

Storage.prototype.removeItem = function(key) {
  originalRemoveItem.call(this, key);
  if (this === window.localStorage && (key === CHAT_KEY || KEYS.includes(key)) && currentUser && cloudReady) {
    if (key === CHAT_KEY) queueSync(key, '[]');
    else queueSync(key, '');
  }
};

async function flushCloudSync() {
  if (!currentUser || !cloudReady) return;
  clearTimeout(syncTimer);
  snapshotActiveStateToVault(currentUser.uid);
  const chats = collectCurrentChats();
  const settings = collectCurrentSettings();
  await pushServerUserData(currentUser, chats, settings);
  try {
    await syncChatsToFirestore(chats);
    for (const [k, v] of Object.entries(settings)) {
      await syncSettingToFirestore(k, v);
    }
  } catch (e) {
    console.warn('Firestore flush warning (saved to vault & server):', e);
  }
}

async function loadCloudState(user) {
  const vault = readLocalVault(user.uid);
  const serverData = await fetchServerUserData(user);

  let firestoreChats = [];
  const firestoreSettings = {};
  try {
    const settingsRef = collection(db, 'users', user.uid, 'settings');
    const chatsRef = collection(db, 'users', user.uid, 'chats');
    const [settingsSnap, chatsSnap] = await Promise.all([getDocs(settingsRef), getDocs(chatsRef)]);
    settingsSnap.forEach(s => {
      const d = s.data();
      if (KEYS.includes(s.id) && typeof d.value === 'string') firestoreSettings[s.id] = d.value;
    });
    firestoreChats = chatsSnap.docs.map(d => safeChat(d.data())).filter(c => c.id);
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      displayName: user.displayName || '',
      email: user.email || '',
      photoURL: user.photoURL || '',
      lastLoginAt: serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.warn('Firestore read warning, falling back to server + local vault:', e);
  }

  // Merge settings from Firestore, server, and per-account vault
  const mergedSettings = {
    ...(serverData.settings || {}),
    ...(firestoreSettings || {}),
    ...(vault.settings || {})
  };

  const historyDisabled = mergedSettings['jafn_privacy_save_history'] === 'false';

  // Merge chats across Vault + Server + Firestore so conversations are never lost on re-login
  const mergedChats = historyDisabled
    ? []
    : mergeChatLists([vault.chats, serverData.chats, firestoreChats], vault.deletedChatIds);

  // Replace active localStorage keys cleanly without triggering deletion sync
  for (const k of [...KEYS, CHAT_KEY]) {
    try { originalRemoveItem.call(localStorage, k); } catch {}
  }
  for (const [k, v] of Object.entries(mergedSettings)) {
    if (KEYS.includes(k) && typeof v === 'string') {
      originalSetItem.call(localStorage, k, v);
    }
  }
  originalSetItem.call(localStorage, CHAT_KEY, JSON.stringify(mergedChats));
  if (mergedChats.length > 0) {
    originalSetItem.call(localStorage, 'ruangai_history', JSON.stringify((mergedChats[0].messages || []).slice(-40)));
  }

  // Persist merged state back to vault, server, and Firestore
  writeLocalVault(user.uid, mergedChats, mergedSettings, vault.deletedChatIds);
  await pushServerUserData(user, mergedChats, mergedSettings);
  try {
    if (mergedChats.length > 0) await syncChatsToFirestore(mergedChats);
  } catch {}
}

addAuthControl();
window.jafnGetAuthToken = async () => auth.currentUser ? await auth.currentUser.getIdToken() : null;
window.jafnFirebaseUser = () => auth.currentUser ? ({
  uid: auth.currentUser.uid,
  email: auth.currentUser.email,
  displayName: auth.currentUser.displayName,
  photoURL: auth.currentUser.photoURL
}) : null;

onAuthStateChanged(auth, async user => {
  const previousUid = sessionStorage.getItem('jafn_cloud_uid') || '';
  currentUser = user;
  cloudReady = false;
  updateAuthUI(user);

  if (!user) {
    window.jafnSetChatLocked?.(true, null);
    if (previousUid) {
      sessionStorage.removeItem('jafn_cloud_uid');
      sessionStorage.removeItem('jafn_cloud_loaded_' + previousUid);
    }
    // Clear active session keys so logged-out view does not show private chats,
    // while keeping jafn_account_vault_<uid> intact for re-login.
    [...KEYS, CHAT_KEY].forEach(k => { try { originalRemoveItem.call(localStorage, k); } catch {} });
    window.jafnClearActiveSessionUI?.();
    return;
  }

  try {
    await loadCloudState(user);
    cloudReady = true;
    sessionStorage.setItem('jafn_cloud_uid', user.uid);
    updateAuthUI(user);
    window.jafnSetChatLocked?.(false, user);
    window.jafnReloadChatsFromStorage?.();
    const status = document.getElementById('jafnAuthStatus');
    if (status) status.textContent = '☁️ Tersinkron';
  } catch (e) {
    console.error('Account state load error:', e);
    cloudReady = true;
    window.jafnSetChatLocked?.(false, user);
    window.jafnReloadChatsFromStorage?.();
  }
});

window.addEventListener('beforeunload', () => {
  if (currentUser && cloudReady) {
    try { snapshotActiveStateToVault(currentUser.uid); } catch {}
  }
});
