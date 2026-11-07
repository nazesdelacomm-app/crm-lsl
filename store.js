/* store.js — données sur le téléphone + synchronisation avec la base partagée (Firebase, via REST).
   Principe : tout est d'abord écrit sur le téléphone (ça marche hors ligne),
   puis envoyé à la base en ligne dès que le réseau est là. Les autres membres
   récupèrent les changements à la synchro suivante. */
(function () {
  'use strict';
  const CFG = window.LSL_CONFIG || {};
  const DEMO = !CFG.apiKey || !CFG.projectId;
  // Collections partagées. « prive » = échanges privés, rangés à part et visibles par leur seul auteur.
  const COLLS = ['personnes', 'structures', 'liens', 'projets', 'echanges', 'taches', 'evenements', 'signaux', 'reglages', 'membres', 'prive'];

  /* ---------- petit stockage IndexedDB ---------- */
  let dbp;
  function idb() {
    return dbp || (dbp = new Promise((res, rej) => {
      const r = indexedDB.open('lsl-crm', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
  }
  async function kget(k) {
    const d = await idb();
    return new Promise((res, rej) => { const q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  }
  async function kset(k, v) {
    const d = await idb();
    return new Promise((res, rej) => { const tx = d.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  }

  /* ---------- état ---------- */
  const data = {}; COLLS.forEach(c => data[c] = {});
  let queue = [];            // clés « coll/id » à envoyer
  let meta = { lastPull: {}, lastSync: 0 };
  let session = null;        // { idToken, refreshToken, exp, email, uid }
  const listeners = new Set();
  const status = { online: navigator.onLine, syncing: false, error: '', lastSync: 0 };

  function emit(what) { listeners.forEach(fn => { try { fn(what); } catch (e) { console.error(e); } }); }
  const saveTimers = {};
  function persist(coll) {
    clearTimeout(saveTimers[coll]);
    saveTimers[coll] = setTimeout(() => kset('c:' + coll, data[coll]).catch(console.error), 250);
  }
  const persistQueue = () => kset('queue', queue).catch(console.error);
  const persistMeta = () => kset('meta', meta).catch(console.error);

  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  /* ---------- API données ---------- */
  function all(coll) { return Object.values(data[coll] || {}).filter(d => d && !d.deleted); }
  function get(coll, id) { const d = (data[coll] || {})[id]; return d && !d.deleted ? d : null; }
  function put(coll, doc) {
    const now = Date.now();
    const d = Object.assign({}, doc);
    if (!d.id) d.id = newId();
    if (!d.createdAt) d.createdAt = now;
    if (!d.auteur && session) d.auteur = session.email;
    d.updatedAt = Math.max(now, (data[coll][d.id] && data[coll][d.id].updatedAt || 0) + 1);
    data[coll][d.id] = d;
    persist(coll);
    enqueue(coll, d.id);
    emit(coll);
    return d;
  }
  // Suppression : on efface le contenu (RGPD) et on garde une trace vide pour que la suppression se propage.
  function remove(coll, id) {
    if (!data[coll][id]) return;
    data[coll][id] = { id, deleted: true, updatedAt: Date.now(), createdAt: data[coll][id].createdAt || Date.now() };
    persist(coll); enqueue(coll, id); emit(coll);
  }
  function enqueue(coll, id) {
    if (DEMO) return;
    const k = coll + '/' + id;
    if (!queue.includes(k)) queue.push(k);
    persistQueue();
    clearTimeout(enqueue.t); enqueue.t = setTimeout(() => sync(), 1500);
  }

  /* ---------- conversions Firestore ---------- */
  function toV(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (typeof v === 'string') return { stringValue: v };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(toV) } };
    if (typeof v === 'object') return { mapValue: { fields: toF(v) } };
    return { stringValue: String(v) };
  }
  function toF(o) { const f = {}; for (const k in o) if (o[k] !== undefined && k !== 'id') f[k] = toV(o[k]); return f; }
  function fromV(v) {
    if (!v) return null;
    if ('stringValue' in v) return v.stringValue;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return v.doubleValue;
    if ('booleanValue' in v) return v.booleanValue;
    if ('nullValue' in v) return null;
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromV);
    if ('mapValue' in v) return fromF(v.mapValue.fields || {});
    if ('timestampValue' in v) return v.timestampValue;
    return null;
  }
  function fromF(f) { const o = {}; for (const k in f) o[k] = fromV(f[k]); return o; }

  /* ---------- connexion (Firebase Auth en REST) ---------- */
  async function authPost(url, body, form) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' },
      body: form ? body : JSON.stringify(body)
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(authMsg((j.error && j.error.message) || ('HTTP ' + r.status)));
    return j;
  }
  function authMsg(code) {
    const m = {
      EMAIL_NOT_FOUND: 'Aucun compte avec cette adresse.', INVALID_PASSWORD: 'Mot de passe incorrect.',
      INVALID_LOGIN_CREDENTIALS: 'Adresse ou mot de passe incorrect.', EMAIL_EXISTS: 'Un compte existe déjà avec cette adresse : utilise « Se connecter ».',
      USER_DISABLED: 'Ce compte est désactivé.', TOO_MANY_ATTEMPTS_TRY_LATER: 'Trop d\'essais, réessaie dans quelques minutes.',
      INVALID_EMAIL: 'Adresse e-mail invalide.', OPERATION_NOT_ALLOWED: 'La connexion par e-mail n\'est pas activée dans Firebase (Authentication → Méthode de connexion).'
    };
    const key = String(code).split(' ')[0].split(':')[0];
    if (key === 'WEAK_PASSWORD') return 'Mot de passe trop court (6 caractères minimum).';
    return m[key] || ('Connexion impossible : ' + code);
  }
  async function setSession(j, email) {
    session = { idToken: j.idToken || j.id_token, refreshToken: j.refreshToken || j.refresh_token, exp: Date.now() + (Number(j.expiresIn || j.expires_in || 3600) - 120) * 1000, email: (email || j.email || '').toLowerCase(), uid: j.localId || j.user_id };
    await kset('session', session);
  }
  async function signIn(email, password) {
    const j = await authPost('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + CFG.apiKey, { email, password, returnSecureToken: true });
    await setSession(j, email); emit('auth'); sync(true);
  }
  async function signUp(email, password) {
    const j = await authPost('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + CFG.apiKey, { email, password, returnSecureToken: true });
    await setSession(j, email); emit('auth'); sync(true);
  }
  async function resetPassword(email) {
    await authPost('https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=' + CFG.apiKey, { requestType: 'PASSWORD_RESET', email });
  }
  async function signOut() {
    session = null; await kset('session', null);
    // on vide les données locales pour qu'un autre compte ne voie rien
    COLLS.forEach(c => { data[c] = {}; kset('c:' + c, {}); });
    queue = []; persistQueue(); meta = { lastPull: {}, lastSync: 0 }; persistMeta();
    emit('auth');
  }
  async function token() {
    if (!session) throw new Error('non connecté');
    if (Date.now() < session.exp) return session.idToken;
    const j = await authPost('https://securetoken.googleapis.com/v1/token?key=' + CFG.apiKey, 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(session.refreshToken), true);
    session.idToken = j.id_token; session.refreshToken = j.refresh_token; session.exp = Date.now() + (Number(j.expires_in || 3600) - 120) * 1000;
    await kset('session', session);
    return session.idToken;
  }

  /* ---------- Firestore REST ---------- */
  const BASE = () => 'https://firestore.googleapis.com/v1/projects/' + CFG.projectId + '/databases/(default)/documents';
  function remote(coll) { return coll === 'prive' ? { parent: '/prive/' + session.uid, cid: 'echanges' } : { parent: '', cid: coll }; }
  async function fsReq(method, path, body) {
    const h = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await token() };
    const r = await fetch(BASE() + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 403) { const e = new Error('ACCES'); e.code = 403; throw e; }
    if (!r.ok) { const t = await r.text(); throw new Error('Firestore ' + r.status + ' ' + t.slice(0, 200)); }
    return r.json();
  }
  async function pushOne(k) {
    const [coll, id] = k.split('/');
    const doc = data[coll] && data[coll][id];
    if (!doc) return;
    const rm = remote(coll);
    await fsReq('PATCH', rm.parent + '/' + rm.cid + '/' + encodeURIComponent(id), { fields: toF(doc) });
  }
  async function pullColl(coll, since) {
    const rm = remote(coll);
    const q = { structuredQuery: { from: [{ collectionId: rm.cid }], where: { fieldFilter: { field: { fieldPath: 'updatedAt' }, op: 'GREATER_THAN', value: { integerValue: String(Math.max(0, since)) } } } } };
    const res = await fsReq('POST', rm.parent + ':runQuery', q);
    let max = meta.lastPull[coll] || 0, changed = false;
    (res || []).forEach(row => {
      if (!row.document) return;
      const id = decodeURIComponent(row.document.name.split('/').pop());
      const doc = fromF(row.document.fields || {}); doc.id = id;
      max = Math.max(max, doc.updatedAt || 0);
      if (queue.includes(coll + '/' + id)) return; // un changement local attend d'être envoyé : il gagne
      const loc = data[coll][id];
      if (!loc || (doc.updatedAt || 0) >= (loc.updatedAt || 0)) { data[coll][id] = doc; changed = true; }
    });
    meta.lastPull[coll] = max;
    if (changed) persist(coll);
    return changed;
  }

  let syncing = null;
  function sync(full) {
    if (DEMO || !session) return Promise.resolve();
    if (syncing) return syncing;
    status.syncing = true; emit('status');
    syncing = (async () => {
      try {
        if (!navigator.onLine) throw new Error('hors ligne');
        while (queue.length) { await pushOne(queue[0]); queue.shift(); await persistQueue(); }
        let changed = false;
        for (const c of COLLS) {
          const since = full ? 0 : Math.max(0, (meta.lastPull[c] || 0) - 10 * 60 * 1000); // marge de 10 min (horloges des téléphones)
          if (await pullColl(c, since)) changed = true;
        }
        meta.lastSync = Date.now(); persistMeta();
        status.error = ''; status.lastSync = meta.lastSync;
        if (changed) emit('data');
      } catch (e) {
        status.error = e.code === 403 ? 'acces' : (e.message === 'hors ligne' ? 'offline' : e.message);
        if (e.code !== 403 && e.message !== 'hors ligne') console.warn(e);
      } finally {
        status.syncing = false; syncing = null; emit('status');
      }
    })();
    return syncing;
  }

  async function init() {
    // Passage du mode démo à la vraie base : on efface les données de test du téléphone.
    const mode = await kget('mode').catch(() => null);
    if (mode === 'demo' && !DEMO) { for (const c of COLLS) await kset('c:' + c, {}); await kset('queue', []); await kset('meta', null); }
    await kset('mode', DEMO ? 'demo' : 'live');
    for (const c of COLLS) { const v = await kget('c:' + c).catch(() => null); if (v) data[c] = v; }
    queue = (await kget('queue').catch(() => null)) || [];
    meta = (await kget('meta').catch(() => null)) || meta;
    meta.lastPull = meta.lastPull || {};
    status.lastSync = meta.lastSync || 0;
    session = DEMO ? { email: 'demo', uid: 'demo' } : (await kget('session').catch(() => null));
    window.addEventListener('online', () => { status.online = true; sync(); });
    window.addEventListener('offline', () => { status.online = false; emit('status'); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync(); });
    setInterval(() => { if (document.visibilityState === 'visible') sync(); }, 3 * 60 * 1000);
    if (session && !DEMO) sync();
  }

  window.Store = {
    DEMO, init, all, get, put, remove, newId, sync,
    on: fn => listeners.add(fn),
    user: () => session ? { email: session.email, uid: session.uid } : null,
    isAdmin: () => DEMO || (!!session && session.email === String(CFG.adminEmail || '').toLowerCase()),
    signIn, signUp, signOut, resetPassword,
    status: () => Object.assign({ pending: queue.length }, status),
    rawAll: coll => Object.values(data[coll] || {}),
    importDocs(coll, docs) { docs.forEach(d => { if (d && d.id) { data[coll][d.id] = Object.assign({}, d, { updatedAt: Date.now() }); enqueue(coll, d.id); } }); persist(coll); emit(coll); }
  };
})();
