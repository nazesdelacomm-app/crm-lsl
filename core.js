/* core.js — constantes, outils, navigation, fenêtres. */
'use strict';
const VERSION = '1.0.0';

const STATUTS = [
  ['cible', 'Cible'], ['contacte', 'Contacté'], ['rdv', 'RDV'], ['proposition', 'Proposition'],
  ['client', 'Client'], ['recurrent', 'Récurrent'], ['pause', 'En pause']
];
const OFFRES = [['diag', 'Diagnostic & plan d\'action'], ['socle', 'Socle de marque'], ['pilotage', 'Pilotage com externalisé'], ['autre', 'Autre']];
const PROJ_STATUTS = [['piste', 'Piste'], ['discussion', 'En discussion'], ['proposition', 'Proposition envoyée'], ['signe', 'Signé'], ['encours', 'En cours'], ['termine', 'Terminé'], ['perdu', 'Perdu']];
const PROJ_OUVERTS = ['piste', 'discussion', 'proposition'];
const PROJ_GAGNES = ['signe', 'encours', 'termine'];
const TYPES_ECH = [['appel', '📞', 'Appel'], ['rdv', '🤝', 'RDV'], ['mail', '✉️', 'Mail'], ['linkedin', '💼', 'LinkedIn'], ['evenement', '🎤', 'Événement'], ['sms', '💬', 'SMS'], ['autre', '📝', 'Autre']];
const FOURCHETTES = [['', 'Pas encore'], ['lt2', 'Moins de 2 k€', 1500], ['2-5', '2 à 5 k€', 3500], ['5-10', '5 à 10 k€', 7500], ['10-20', '10 à 20 k€', 15000], ['gt20', 'Plus de 20 k€', 25000]];
const CHANCES = [['faible', 'Faible', 0.2], ['moyenne', 'Moyenne', 0.5], ['forte', 'Forte', 0.8]];
const ORIGINES = [['', '—'], ['evenement', 'Un événement'], ['personne', 'Une personne (recommandation)'], ['linkedin', 'LinkedIn'], ['site', 'Le site'], ['veille', 'La veille (BODACC, registre)'], ['autre', 'Autre']];
const LIENS = {
  presente: ['m\'a présenté·e à', 'rencontré·e grâce à'],
  travaille: ['travaille avec', 'travaille avec'],
  connait: ['connaît bien', 'connaît bien'],
  recommande: ['a recommandé La suite logique à', 'a eu la recommandation de']
};
const STRUCT_TYPES = [['pme', 'PME / TPE'], ['asso', 'Association'], ['collectivite', 'Collectivité'], ['autre', 'Autre']];
const EV_STATUTS = [['propose', 'Proposé'], ['interesse', 'Intéressé'], ['inscrit', 'Inscrit'], ['ignore', 'Ignoré']];
const MAX_TAGS = 10;

const DEF_REG = {
  relance: { cible: 30, contacte: 14, rdv: 10, proposition: 7, client: 30, recurrent: 45, pause: 120 },
  catalogue: {
    diag: ['Entretiens dirigeant et équipe', 'Analyse de l\'existant (supports, site, réseaux)', 'Restitution du diagnostic', 'Plan d\'action priorisé'],
    socle: ['Atelier de positionnement', 'Plateforme de marque', 'Ton et messages clés', 'Identité visuelle', 'Charte et kit de supports'],
    pilotage: ['Calendrier éditorial', 'Création des contenus', 'Animation des réseaux sociaux', 'Relations presse et partenaires', 'Point mensuel et bilan'],
    autre: []
  },
  secteursGeo: ['Dombes', 'Plaine de l\'Ain', 'Bourg-en-Bresse', 'Mâcon', 'Autre'],
  tags: ['Industrie', 'Artisanat', 'Commerce', 'Services', 'Agricole', 'Prescripteur'],
  zone: {
    depts: '01, 71', rayon: 40,
    communes: 'Bourg-en-Bresse, Mâcon, Villars-les-Dombes, Châtillon-sur-Chalaronne, Ambérieu-en-Bugey, Meximieux',
    themes: 'réseaux d\'entreprises, petits-déjeuners et afterworks de dirigeants, salons professionnels, conférences marketing et communication, rencontres de la CCI'
  },
  sources: ['CCI de l\'Ain', 'CCI Saône-et-Loire', 'CMA Ain', 'Réseau Entreprendre Ain', 'Initiative Ain', 'BNI', 'CJD', 'Ain Business Club'],
  derniereVeille: 0
};

/* ---------- outils ---------- */
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
const lab = (list, k) => (list.find(x => x[0] === k) || [k, k])[1];
const DAY = 864e5;
function iso(d) { d = d ? new Date(d) : new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
const today = () => iso();
const addDays = (n, from) => iso(new Date((from ? new Date(from + 'T12:00') : new Date()).getTime() + n * DAY));
function daysSince(t) { if (!t) return 9999; const ms = typeof t === 'number' ? t : new Date(String(t).length === 10 ? t + 'T12:00' : t).getTime(); return Math.floor((Date.now() - ms) / DAY); }
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
function fdate(s, withDay) {
  if (!s) return '';
  const d = new Date(String(s).length === 10 ? s + 'T12:00' : s);
  if (isNaN(d)) return '';
  const t = today();
  const k = iso(d);
  if (k === t) return 'aujourd\'hui';
  if (k === addDays(-1)) return 'hier';
  if (k === addDays(1)) return 'demain';
  return (withDay ? JOURS[d.getDay()] + ' ' : '') + d.getDate() + ' ' + MOIS[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '');
}
function euros(n) { return (Math.round(n || 0)).toLocaleString('fr-FR') + ' €'; }
function plural(n, s, p) { return n + ' ' + (n > 1 ? (p || s + 's') : s); }
function telHref(t) { return 'tel:' + String(t || '').replace(/[^\d+]/g, ''); }
function linkedinHref(p) {
  if (p.linkedin) return /^https?:/.test(p.linkedin) ? p.linkedin : 'https://www.linkedin.com/in/' + p.linkedin.replace(/^\/+/, '');
  return 'https://www.linkedin.com/search/results/people/?keywords=' + encodeURIComponent([p.prenom, p.nom, structOf(p) && structOf(p).nom].filter(Boolean).join(' '));
}
function mapsHref(q) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q); }

/* ---------- accès aux données ---------- */
function reg() {
  const r = Store.get('reglages', 'commun') || {};
  const o = JSON.parse(JSON.stringify(DEF_REG));
  for (const k in r) if (k !== 'id' && r[k] != null) o[k] = (typeof DEF_REG[k] === 'object' && !Array.isArray(DEF_REG[k])) ? Object.assign(o[k] || {}, r[k]) : r[k];
  return o;
}
function saveReg(patch) { const cur = Store.get('reglages', 'commun') || { id: 'commun' }; Store.put('reglages', Object.assign({}, cur, patch, { id: 'commun' })); }
const pName = p => p ? ([p.prenom, p.nom].filter(Boolean).join(' ') || '(sans nom)') : '?';
const structOf = p => p && p.structureId ? Store.get('structures', p.structureId) : null;
function echangesAll() { return Store.all('echanges').concat(Store.all('prive').map(e => Object.assign({}, e, { prive: true }))); }
function echangesOf(pid) { return echangesAll().filter(e => e.personneId === pid).sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt); }
function lastContact(p) {
  const ex = echangesOf(p.id).filter(e => !e.brouillon);
  return ex.length ? ex[0].date : iso(p.createdAt);
}
function openTasksOf(field, id) { return Store.all('taches').filter(t => !t.faite && t[field] === id).sort((a, b) => (a.date || '9').localeCompare(b.date || '9')); }
function membres() { return Store.all('membres').sort((a, b) => (a.nom || a.id).localeCompare(b.nom || b.id)); }
function nomMembre(email) {
  if (!email) return '';
  if (email === 'demo') return 'Moi';
  const m = Store.get('membres', email);
  return (m && m.nom) || email.split('@')[0];
}
const me = () => (Store.user() || {}).email || '';
function projetMontant(p) {
  if (p.signe) return Number(p.signe);
  if (p.propose) return Number(p.propose);
  const f = FOURCHETTES.find(x => x[0] === p.fourchette);
  return f && f[2] ? f[2] : 0;
}
const chanceVal = c => (CHANCES.find(x => x[0] === c) || [0, 0, 0.5])[2];
function evNote(e) {
  const c = e.criteres || {};
  return (c.public || 0) + (c.distance || 0) + (c.format || 0) + (c.cout || 0) + (evContact(e) ? 1 : 0);
}
function evContact(e) {
  if (e.contactManuel) return true;
  const org = (e.organisateur || '').toLowerCase();
  if (!org) return false;
  return Store.all('structures').some(s => s.nom && s.nom.length > 2 && (org.includes(s.nom.toLowerCase()) || s.nom.toLowerCase().includes(org)));
}

/* ---------- interface : toast, fenêtre du bas ---------- */
function toast(msg, ms) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), ms || 2400);
}
let sheetSubmit = null;
function openSheet(html, onSubmit, opts) {
  sheetSubmit = onSubmit || null;
  const card = $('#sheetCard');
  card.innerHTML = '<div class="grab"></div>' + html;
  card.classList.toggle('tall', !!(opts && opts.tall));
  $('#sheet').classList.remove('hidden');
  document.body.classList.add('noscroll');
  card.scrollTop = 0;
  if (!(opts && opts.noFocus)) { const f = card.querySelector('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea'); if (f && !f.value && window.innerWidth > 700) f.focus(); }
  if (history.state !== 'sheet') history.pushState('sheet', '');
}
let backPending = false, afterBack = null;
function closeSheet(fromPop) {
  if ($('#sheet').classList.contains('hidden')) return;
  $('#sheet').classList.add('hidden'); document.body.classList.remove('noscroll');
  sheetSubmit = null; stopDictee();
  if (!fromPop && history.state === 'sheet') { backPending = true; history.back(); }
}
window.addEventListener('popstate', () => {
  closeSheet(true);
  if (backPending) { backPending = false; const f = afterBack; afterBack = null; if (f) f(); }
});
function confirmSheet(msg, okLabel, onOk, danger) {
  openSheet('<h2>' + esc(msg) + '</h2><div class="row end"><button type="button" class="btn ghost" data-act="close">Annuler</button><button type="button" class="btn ' + (danger ? 'danger' : 'primary') + '" data-act="confirm-ok">' + esc(okLabel) + '</button></div>', null, { noFocus: true });
  confirmSheet.ok = onOk;
}

/* ---------- dictée vocale (Chrome Android) ---------- */
let rec = null;
function dictee(target, btn) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('Dictée : utilise le micro de ton clavier 🎤'); target.focus(); return; }
  if (rec) { stopDictee(); return; }
  rec = new SR(); rec.lang = 'fr-FR'; rec.continuous = true; rec.interimResults = false;
  const base = target.value ? target.value.replace(/\s*$/, ' ') : '';
  let acc = '';
  rec.onresult = ev => { for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) acc += ev.results[i][0].transcript + ' '; target.value = base + acc; };
  rec.onend = () => { if (btn) btn.classList.remove('rec'); rec = null; };
  rec.onerror = () => { toast('Dictée interrompue'); };
  rec.start(); if (btn) btn.classList.add('rec'); toast('Je t\'écoute… touche à nouveau 🎤 pour arrêter');
}
function stopDictee() { if (rec) { try { rec.stop(); } catch (e) { /* rien */ } rec = null; } }

/* ---------- navigation ---------- */
const ROUTES = {};
function route() { const h = location.hash.replace(/^#\/?/, '') || 'aujourdhui'; const [name, id] = h.split('/'); return { name, id: id ? decodeURIComponent(id) : '' }; }
function go(h) { if (backPending) afterBack = () => { location.hash = '#/' + h; }; else location.hash = '#/' + h; }
let scrollMem = {};
function render(keepScroll) {
  if (!Store.user()) { renderLogin(); return; }
  document.body.classList.remove('login');
  const r = route();
  const fn = ROUTES[r.name] || ROUTES.aujourdhui;
  const v = $('#view');
  const y = window.scrollY;
  try { v.innerHTML = fn(r.id); } catch (e) { console.error(e); v.innerHTML = '<div class="empty">Oups, un souci d\'affichage : ' + esc(e.message) + '</div>'; }
  const tab = { aujourdhui: 'aujourdhui', contacts: 'contacts', personne: 'contacts', structure: 'contacts', projets: 'projets', projet: 'projets', veille: 'veille', evenement: 'veille', plus: 'plus', reglages: 'plus', stats: 'plus', rgpd: 'plus', membres: 'plus', ia: 'plus' }[r.name] || 'aujourdhui';
  $$('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  window.scrollTo(0, keepScroll ? y : 0);
  renderBanner();
}
window.addEventListener('hashchange', () => render(false));

function renderBanner() {
  const st = Store.status();
  const b = $('#banner');
  let html = '';
  if (Store.DEMO) html = '<div class="ban demo">Mode démo : les données restent sur ce téléphone. <a href="#/plus">En savoir plus</a></div>';
  else if (st.error === 'acces') html = '<div class="ban warn">Ton compte n\'a pas encore accès à la base partagée. Demande à Julien de t\'ajouter dans Plus → Membres.</div>';
  else if (!st.online) html = '<div class="ban off">Hors ligne : tout est enregistré sur le téléphone et partira au retour du réseau.</div>';
  b.innerHTML = html;
  const s = $('#syncBtn');
  s.className = 'sync' + (st.syncing ? ' spin' : '') + (st.pending ? ' pending' : '') + (st.error && st.error !== 'offline' ? ' err' : '');
  s.title = st.pending ? st.pending + ' changement(s) à envoyer' : (st.lastSync ? 'Synchronisé ' + fdate(st.lastSync) : '');
  s.innerHTML = Store.DEMO ? '' : (st.syncing ? '⟳' : (st.pending ? '⇡' + st.pending : '✓'));
}
