/* views.js — connexion, Aujourd'hui, Contacts, fiches Personne et Structure. */
'use strict';

function pastille(statut) { return '<span class="pas s-' + esc(statut || 'cible') + '">' + esc(lab(STATUTS, statut || 'cible')) + '</span>'; }
function initials(p) { return esc(((p.prenom || '')[0] || '') + ((p.nom || '')[0] || '') || '?').toUpperCase(); }
function empty(msg) { return '<div class="empty">' + msg + '</div>'; }
function sec(title, inner, extra) { return '<section class="sec"><div class="sec-h"><h2>' + title + '</h2>' + (extra || '') + '</div>' + inner + '</section>'; }

/* ---------- Connexion ---------- */
function renderLogin() {
  document.body.classList.add('login');
  $('#banner').innerHTML = '';
  $('#view').innerHTML = '<div class="login-box">' +
    '<div class="login-logo">ls</div><h1>La suite logique</h1><p class="muted">Le carnet de contacts et de projets de l\'équipe.</p>' +
    '<form id="loginForm" class="card">' +
    '<label>Adresse e-mail<input name="email" type="email" autocomplete="username" required></label>' +
    '<label>Mot de passe<input name="pw" type="password" autocomplete="current-password" minlength="6" required></label>' +
    '<div class="err" id="loginErr"></div>' +
    '<button class="btn primary wide" name="mode" value="in">Se connecter</button>' +
    '<button class="btn ghost wide" name="mode" value="up" type="submit">Créer mon compte</button>' +
    '<button class="btn link" type="button" data-act="pw-reset">Mot de passe oublié ?</button>' +
    '</form><p class="muted small">Pour rejoindre la base partagée, Julien doit d\'abord ajouter ton adresse dans ses membres.</p></div>';
}

/* ---------- Aujourd'hui ---------- */
let showAllDormants = false;
ROUTES.aujourdhui = () => {
  const t = today(), R = reg();
  const taches = Store.all('taches').filter(x => !x.faite);
  const dues = taches.filter(x => x.date && x.date <= t).sort((a, b) => a.date.localeCompare(b.date));
  const bientot = taches.filter(x => x.date && x.date > t && x.date <= addDays(7)).sort((a, b) => a.date.localeCompare(b.date));
  const sansDate = taches.filter(x => !x.date);
  const brouillons = echangesAll().filter(e => e.brouillon && (!e.auteur || e.auteur === me() || Store.DEMO));
  const personnes = Store.all('personnes');
  const dormants = personnes.map(p => ({ p, d: daysSince(lastContact(p)) }))
    .filter(x => x.d >= (R.relance[x.p.statut || 'cible'] || 30) && !openTasksOf('personneId', x.p.id).length)
    .sort((a, b) => b.d - a.d);
  const veilleP = personnes.filter(p => Number(p.veilleFreq) > 0 && daysSince(p.derniereVeille || p.createdAt) >= Number(p.veilleFreq));
  const evs = Store.all('evenements');
  const semaine = evs.filter(e => ['interesse', 'inscrit'].includes(e.statut) && e.date >= t && e.date <= addDays(7)).sort((a, b) => a.date.localeCompare(b.date));
  const suggestions = evs.filter(e => (e.statut || 'propose') === 'propose' && e.date >= t && evNote(e) >= 7).length;
  const bilans = evs.filter(e => ['interesse', 'inscrit'].includes(e.statut) && e.date < t && !e.bilan);
  const rgpd = personnes.filter(p => !['client', 'recurrent'].includes(p.statut) && daysSince(lastContact(p)) >= 1035).length;
  const lastExport = Number(localStorage.getItem('lsl.lastExport') || 0);

  const nom = nomMembre(me());
  const d = new Date();
  let h = '<div class="hello"><h1>' + (d.getHours() < 18 ? 'Bonjour' : 'Bonsoir') + (nom && nom !== 'Moi' ? ' ' + esc(nom) : '') + '</h1>' +
    '<div class="muted">' + JOURS[d.getDay()] + ' ' + d.getDate() + ' ' + MOIS[d.getMonth()] + ' · ' + plural(dues.length + dormants.length, 'relance') + ' · ' + plural(semaine.length, 'événement') + ' cette semaine</div></div>';

  const rappels = [];
  if (brouillons.length) rappels.push(...brouillons.map(e => '<button class="rappel" data-act="echange-edit" data-id="' + e.id + '" data-prive="' + (e.prive ? 1 : '') + '">📞 Appel à ' + esc(pName(Store.get('personnes', e.personneId))) + ' : <b>à compléter</b></button>'));
  if (bilans.length) rappels.push(...bilans.map(e => '<a class="rappel" href="#/evenement/' + e.id + '">🎤 ' + esc(e.titre) + ' : <b>ça valait le coup ?</b></a>'));
  if (Store.all('personnes').length && daysSince(lastExport) >= 7) rappels.push('<button class="rappel" data-act="export">💾 Faire l\'export de la semaine</button>');
  if (daysSince(R.derniereVeille) >= 7 && (Veille.IA.key() || Store.all('structures').some(s => s.suivie))) rappels.push('<a class="rappel" href="#/veille">📡 Lancer la veille de la semaine</a>');
  if (rgpd) rappels.push('<a class="rappel" href="#/rgpd">🧹 ' + plural(rgpd, 'fiche') + ' sans contact depuis près de 3 ans</a>');
  if (rappels.length) h += '<div class="rappels">' + rappels.join('') + '</div>';

  h += sec('À faire', dues.length ? dues.map(tacheRow).join('') : empty('Aucune relance en retard. 👌'));

  const dShown = showAllDormants ? dormants : dormants.slice(0, 6);
  if (dormants.length) h += sec('Sans nouvelles depuis un moment', dShown.map(x => '<div class="item">' +
    '<a class="grow" href="#/personne/' + x.p.id + '"><b>' + esc(pName(x.p)) + '</b> ' + pastille(x.p.statut) + '<small>' + (x.d >= 9999 ? 'jamais contacté·e' : 'dernier contact il y a ' + x.d + ' j') + (structOf(x.p) ? ' · ' + esc(structOf(x.p).nom) : '') + '</small></a>' +
    '<button class="mini" data-act="echange-new" data-p="' + x.p.id + '">+ Échange</button><button class="mini ghost" data-act="plus-tard" data-p="' + x.p.id + '">Plus tard</button></div>').join('') +
    (dormants.length > 6 ? '<button class="btn link" data-act="toggle-dormants">' + (showAllDormants ? 'Réduire' : 'Voir les ' + dormants.length) + '</button>' : ''));

  if (veilleP.length) h += sec('Regarder leur actu', veilleP.map(p => '<div class="item"><a class="grow" href="#/personne/' + p.id + '"><b>' + esc(pName(p)) + '</b><small>tous les ' + p.veilleFreq + ' jours</small></a>' +
    '<a class="mini" target="_blank" rel="noopener" href="' + esc(linkedinHref(p)) + '">LinkedIn</a><button class="mini ghost" data-act="veille-vu" data-p="' + p.id + '">Vu</button></div>').join(''));

  h += sec('Cette semaine', (semaine.length ? semaine.map(evRow).join('') : empty('Pas d\'événement prévu.')) + (suggestions ? '<a class="rappel" href="#/veille">✨ ' + plural(suggestions, 'événement') + ' noté' + (suggestions > 1 ? 's' : '') + ' 7/10 ou plus à regarder</a>' : ''));

  if (bientot.length || sansDate.length) h += sec('Dans les 7 jours', bientot.concat(sansDate).map(tacheRow).join(''));
  return h;
};
function tacheRow(t) {
  const p = t.personneId ? Store.get('personnes', t.personneId) : null;
  const pr = t.projetId ? Store.get('projets', t.projetId) : null;
  const late = t.date && t.date < today();
  return '<div class="item task' + (t.faite ? ' done' : '') + '"><button class="check" data-act="tache-done" data-id="' + t.id + '" aria-label="Fait">' + (t.faite ? '✓' : '') + '</button>' +
    '<button class="grow txt" data-act="tache-edit" data-id="' + t.id + '"><b>' + esc(t.titre) + '</b><small>' +
    [p ? esc(pName(p)) : '', pr ? '📁 ' + esc(pr.titre) : '', t.type === 'livrable' ? 'livrable' : '', t.assigne && t.assigne !== me() ? '→ ' + esc(nomMembre(t.assigne)) : ''].filter(Boolean).join(' · ') + '</small></button>' +
    (t.date ? '<span class="date' + (late ? ' late' : '') + '">' + fdate(t.date) + '</span>' : '') + '</div>';
}
function evRow(e) {
  const n = evNote(e);
  return '<a class="item" href="#/evenement/' + e.id + '"><span class="note n' + (n >= 7 ? 'hi' : n >= 4 ? 'mid' : 'lo') + '">' + n + '</span><span class="grow"><b>' + esc(e.titre) + '</b><small>' +
    esc([fdate(e.date, true) + (e.heure ? ' ' + e.heure : ''), e.commune || e.lieu].filter(Boolean).join(' · ')) + '</small></span>' +
    (e.statut && e.statut !== 'propose' ? '<span class="tag">' + esc(lab(EV_STATUTS, e.statut)) + '</span>' : '') + '</a>';
}

/* ---------- Contacts ---------- */
const CF = { tab: 'personnes', q: '', statut: '', geo: '', tag: '', mine: false };
ROUTES.contacts = () => {
  const R = reg();
  const opt = (list, cur, all) => '<option value="">' + all + '</option>' + list.map(x => { const k = Array.isArray(x) ? x[0] : x, l = Array.isArray(x) ? x[1] : x; return '<option value="' + esc(k) + '"' + (cur === k ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('');
  return '<div class="seg"><button data-act="ctab" data-v="personnes" class="' + (CF.tab === 'personnes' ? 'on' : '') + '">Personnes (' + Store.all('personnes').length + ')</button><button data-act="ctab" data-v="structures" class="' + (CF.tab === 'structures' ? 'on' : '') + '">Structures (' + Store.all('structures').length + ')</button></div>' +
    '<div class="search"><input id="q" type="search" placeholder="Rechercher partout…" value="' + esc(CF.q) + '" autocomplete="off"></div>' +
    '<div class="filters">' +
    (CF.tab === 'personnes' ? '<select data-f="statut">' + opt(STATUTS, CF.statut, 'Tous statuts') + '</select>' : '') +
    '<select data-f="geo">' + opt(R.secteursGeo, CF.geo, 'Tout le territoire') + '</select>' +
    '<select data-f="tag">' + opt(R.tags, CF.tag, 'Toutes étiquettes') + '</select>' +
    (!Store.DEMO && CF.tab === 'personnes' ? '<label class="chk"><input type="checkbox" data-f="mine"' + (CF.mine ? ' checked' : '') + '> Suivis par moi</label>' : '') +
    '</div><div id="clist">' + contactsList() + '</div>';
};
function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function contactsList() {
  const q = norm(CF.q.trim());
  const hit = (...xs) => !q || xs.some(x => norm(x).includes(q));
  let h = '';
  if (CF.tab === 'personnes') {
    const list = Store.all('personnes').filter(p => {
      const s = structOf(p);
      if (CF.statut && (p.statut || 'cible') !== CF.statut) return false;
      if (CF.geo && p.secteurGeo !== CF.geo && !(s && s.secteurGeo === CF.geo)) return false;
      if (CF.tag && !(p.tags || []).includes(CF.tag) && !(s && (s.tags || []).includes(CF.tag))) return false;
      if (CF.mine && p.suiviPar !== me()) return false;
      return hit(p.prenom, p.nom, p.fonction, p.email, p.commune, p.notes, s && s.nom, (p.tags || []).join(' '));
    }).sort((a, b) => (a.nom || a.prenom || '').localeCompare(b.nom || b.prenom || ''));
    h = list.length ? list.map(p => { const s = structOf(p); return '<a class="item" href="#/personne/' + p.id + '"><span class="av">' + initials(p) + '</span><span class="grow"><b>' + esc(pName(p)) + '</b><small>' + esc([p.fonction, s && s.nom, p.commune || (s && s.commune)].filter(Boolean).join(' · ')) + '</small></span>' + pastille(p.statut) + '</a>'; }).join('')
      : empty(Store.all('personnes').length ? 'Personne ne correspond.' : 'Pas encore de contact. Touche <b>+</b> pour ajouter ta première cible.');
  } else {
    const list = Store.all('structures').filter(s => {
      if (CF.geo && s.secteurGeo !== CF.geo) return false;
      if (CF.tag && !(s.tags || []).includes(CF.tag)) return false;
      return hit(s.nom, s.commune, s.activite, s.notes, s.siren, (s.tags || []).join(' '));
    }).sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
    h = list.length ? list.map(s => { const n = Store.all('personnes').filter(p => p.structureId === s.id).length; return '<a class="item" href="#/structure/' + s.id + '"><span class="av sq">' + esc((s.nom || '?')[0].toUpperCase()) + '</span><span class="grow"><b>' + esc(s.nom) + (s.suivie ? ' <span title="Suivie en veille">📡</span>' : '') + '</b><small>' + esc([lab(STRUCT_TYPES, s.type || 'pme'), s.commune, plural(n, 'contact')].filter(Boolean).join(' · ')) + '</small></span></a>'; }).join('')
      : empty('Aucune structure.');
  }
  if (q) {
    const pj = Store.all('projets').filter(p => hit(p.titre, p.besoin, p.enjeux, p.decideur));
    const ex = echangesAll().filter(e => hit(e.note)).slice(0, 10);
    if (pj.length || ex.length) h += '<h3 class="also">Aussi trouvé</h3>' + pj.map(p => '<a class="item" href="#/projet/' + p.id + '">📁 <span class="grow"><b>' + esc(p.titre) + '</b><small>' + esc(lab(PROJ_STATUTS, p.statut)) + '</small></span></a>').join('') +
      ex.map(e => '<a class="item" href="#/personne/' + e.personneId + '">' + (TYPES_ECH.find(x => x[0] === e.type) || TYPES_ECH[6])[1] + ' <span class="grow"><b>' + esc(pName(Store.get('personnes', e.personneId))) + '</b><small>' + esc(snippet(e.note, q)) + '</small></span></a>').join('');
  }
  return h;
}
function snippet(t, q) { const n = norm(t), i = n.indexOf(q); t = String(t || ''); return i < 0 ? t.slice(0, 80) : (i > 30 ? '…' : '') + t.slice(Math.max(0, i - 30), i + 60) + '…'; }

/* ---------- Fiche personne ---------- */
ROUTES.personne = id => {
  const p = Store.get('personnes', id);
  if (!p) return empty('Fiche introuvable (supprimée ?). <a href="#/contacts">Retour</a>');
  const s = structOf(p), R = reg();
  const next = openTasksOf('personneId', id)[0];
  const exs = echangesOf(id);
  const projets = Store.all('projets').filter(x => x.personneId === id || (s && x.structureId === s.id && !x.personneId));
  const liens = Store.all('liens').filter(l => l.de === id || l.vers === id);
  const rencontres = Store.all('personnes').filter(x => x.origineType === 'personne' && x.origineId === id);
  const lc = lastContact(p);
  const act = (href, ico, label, attrs) => href ? '<a class="act" href="' + esc(href) + '"' + (attrs || '') + '><span>' + ico + '</span>' + label + '</a>' : '<span class="act off"><span>' + ico + '</span>' + label + '</span>';
  let h = '<div class="back"><a href="#/contacts">‹ Contacts</a></div>' +
    '<div class="head"><span class="av big">' + initials(p) + '</span><div class="grow"><h1>' + esc(pName(p)) + '</h1><div class="muted">' + esc(p.fonction || '') + (s ? (p.fonction ? ' · ' : '') + '<a href="#/structure/' + s.id + '">' + esc(s.nom) + '</a>' : '') + '</div></div></div>' +
    '<div class="stepper">' + STATUTS.map(x => '<button data-act="set-statut" data-id="' + id + '" data-v="' + x[0] + '" class="s-' + x[0] + ((p.statut || 'cible') === x[0] ? ' on' : '') + '">' + x[1] + '</button>').join('') + '</div>' +
    '<div class="acts">' +
    (p.tel ? '<button class="act" data-act="call" data-p="' + id + '"><span>📞</span>Appeler</button>' : act('', '📞', 'Appeler')) +
    act(p.tel ? 'sms:' + String(p.tel).replace(/[^\d+]/g, '') : '', '💬', 'SMS') +
    act(p.email ? 'mailto:' + p.email : '', '✉️', 'Mail') +
    act(linkedinHref(p), '💼', 'LinkedIn', ' target="_blank" rel="noopener"') +
    act((p.adresse || p.commune || (s && (s.adresse || s.commune))) ? mapsHref([p.adresse || (s && s.adresse), p.commune || (s && s.commune)].filter(Boolean).join(' ')) : '', '📍', 'Itinéraire', ' target="_blank" rel="noopener"') +
    '</div>';

  h += '<div class="card next">' + (next ? '<div class="lbl">Prochaine action</div>' + tacheRow(next) : '<div class="lbl">Prochaine action</div><div class="muted">Rien de prévu. <button class="btn link" data-act="tache-new" data-p="' + id + '">Planifier</button></div>') + '</div>';

  const orig = p.origineType ? lab(ORIGINES, p.origineType) + (p.origineId ? ' : ' + (p.origineType === 'evenement' ? linkTo('evenement', p.origineId) : linkTo('personne', p.origineId)) : '') + (p.origineTexte ? ' (' + esc(p.origineTexte) + ')' : '') : '';
  const infos = [
    ['Dernier contact', fdate(lc) + ' (' + daysSince(lc) + ' j)'],
    ['Rencontré via', orig],
    ['Suivi par', esc(nomMembre(p.suiviPar))],
    ['Secteur', esc(p.secteurGeo || '')],
    ['Commune', esc(p.commune || '')],
    ['Téléphone', p.tel ? '<a href="' + telHref(p.tel) + '">' + esc(p.tel) + '</a>' : ''],
    ['E-mail', p.email ? '<a href="mailto:' + esc(p.email) + '">' + esc(p.email) + '</a>' : ''],
    ['Étiquettes', (p.tags || []).map(t => '<span class="tag">' + esc(t) + '</span>').join(' ')],
    ['Veille', Number(p.veilleFreq) ? 'regarder son actu tous les ' + p.veilleFreq + ' j' : '']
  ].filter(x => x[1]);
  h += sec('Infos', '<dl class="infos">' + infos.map(x => '<dt>' + x[0] + '</dt><dd>' + x[1] + '</dd>').join('') + '</dl>' + (p.notes ? '<p class="notes">' + esc(p.notes) + '</p>' : ''), '<button class="mini ghost" data-act="personne-edit" data-id="' + id + '">Modifier</button>');

  h += sec('Échanges', exs.length ? '<div class="timeline">' + exs.map(echRow).join('') + '</div>' : empty('Aucun échange noté.'), '<button class="mini" data-act="echange-new" data-p="' + id + '">+ Échange</button>');

  h += sec('Projets', projets.length ? projets.map(projRow).join('') : empty('Pas de projet.'), '<button class="mini ghost" data-act="projet-new" data-p="' + id + '">+ Projet</button>');

  const lienRows = liens.map(l => {
    const other = l.de === id ? l.vers : l.de, labels = LIENS[l.type] || ['lié·e à', 'lié·e à'];
    return '<div class="item"><span class="grow">' + (l.de === id ? labels[0] : labels[1]) + ' ' + linkTo('personne', other) + (l.note ? '<small>' + esc(l.note) + '</small>' : '') + '</span><button class="mini ghost" data-act="lien-del" data-id="' + l.id + '" aria-label="Supprimer le lien">✕</button></div>';
  }).concat(rencontres.map(x => '<div class="item"><span class="grow">m\'a fait rencontrer ' + linkTo('personne', x.id) + '</span></div>'));
  h += sec('Réseau', lienRows.length ? lienRows.join('') : empty('Aucun lien. Qui t\'a présenté cette personne ? Qui connaît-elle ?'), '<button class="mini ghost" data-act="lien-new" data-p="' + id + '">+ Lien</button>');

  h += '<div class="foot"><button class="btn ghost" data-act="fiche-export" data-id="' + id + '">Exporter la fiche</button><button class="btn danger-ghost" data-act="personne-del" data-id="' + id + '">Supprimer</button></div>';
  return h;
};
function linkTo(kind, id) {
  if (kind === 'evenement') { const e = Store.get('evenements', id); return e ? '<a href="#/evenement/' + id + '">' + esc(e.titre) + '</a>' : '(événement supprimé)'; }
  const p = Store.get('personnes', id); return p ? '<a href="#/personne/' + id + '">' + esc(pName(p)) + '</a>' : '(fiche supprimée)';
}
function echRow(e) {
  const ty = TYPES_ECH.find(x => x[0] === e.type) || TYPES_ECH[6];
  const pr = e.projetId ? Store.get('projets', e.projetId) : null;
  return '<button class="tl" data-act="echange-edit" data-id="' + e.id + '" data-prive="' + (e.prive ? 1 : '') + '"><span class="ico">' + ty[1] + '</span><span class="grow"><span class="tl-h"><b>' + esc(ty[2]) + '</b> · ' + fdate(e.date) + (e.prive ? ' · 🔒 privé' : '') + (e.brouillon ? ' · <i>à compléter</i>' : '') + (e.auteur && e.auteur !== me() && !Store.DEMO ? ' · ' + esc(nomMembre(e.auteur)) : '') + '</span>' +
    (pr ? '<small>📁 ' + esc(pr.titre) + '</small>' : '') + '<span class="tl-n">' + esc(e.note || '') + '</span></span></button>';
}
function projRow(p) {
  return '<a class="item" href="#/projet/' + p.id + '"><span class="grow"><b>' + esc(p.titre) + '</b><small>' + esc(lab(OFFRES, p.offre)) + (projetMontant(p) ? ' · ' + euros(projetMontant(p)) : '') + '</small></span><span class="tag p-' + esc(p.statut) + '">' + esc(lab(PROJ_STATUTS, p.statut)) + '</span></a>';
}

/* ---------- Fiche structure ---------- */
ROUTES.structure = id => {
  const s = Store.get('structures', id);
  if (!s) return empty('Structure introuvable. <a href="#/contacts">Retour</a>');
  const pers = Store.all('personnes').filter(p => p.structureId === id);
  const projets = Store.all('projets').filter(p => p.structureId === id);
  const sig = Store.all('signaux').filter(x => x.structureId === id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const infos = [
    ['Type', esc(lab(STRUCT_TYPES, s.type || 'pme'))], ['Activité', esc(s.activite || '')], ['Commune', esc(s.commune || '')],
    ['Secteur', esc(s.secteurGeo || '')], ['SIREN', esc(s.siren || '')],
    ['Site', s.site ? '<a target="_blank" rel="noopener" href="' + esc(/^https?:/.test(s.site) ? s.site : 'https://' + s.site) + '">' + esc(s.site) + '</a>' : ''],
    ['Étiquettes', (s.tags || []).map(t => '<span class="tag">' + esc(t) + '</span>').join(' ')],
    ['Dirigeants (registre)', esc(((s.snapshot || {}).dirigeants || []).join(', '))]
  ].filter(x => x[1]);
  let h = '<div class="back"><a href="#/contacts">‹ Contacts</a></div>' +
    '<div class="head"><span class="av big sq">' + esc((s.nom || '?')[0].toUpperCase()) + '</span><div class="grow"><h1>' + esc(s.nom) + '</h1><div class="muted">' + esc([lab(STRUCT_TYPES, s.type || 'pme'), s.commune].filter(Boolean).join(' · ')) + '</div></div></div>' +
    '<div class="acts">' +
    (s.site ? '<a class="act" target="_blank" rel="noopener" href="' + esc(/^https?:/.test(s.site) ? s.site : 'https://' + s.site) + '"><span>🌐</span>Site</a>' : '<span class="act off"><span>🌐</span>Site</span>') +
    '<a class="act" target="_blank" rel="noopener" href="' + esc(mapsHref([s.nom, s.adresse, s.commune].filter(Boolean).join(' '))) + '"><span>📍</span>Itinéraire</a>' +
    '<a class="act" target="_blank" rel="noopener" href="https://www.linkedin.com/search/results/companies/?keywords=' + encodeURIComponent(s.nom || '') + '"><span>💼</span>LinkedIn</a>' +
    '<button class="act" data-act="registre" data-id="' + id + '"><span>🏛️</span>Registre</button>' +
    '</div>' +
    '<label class="switch card"><input type="checkbox" data-act="suivre" data-id="' + id + '"' + (s.suivie ? ' checked' : '') + '><span><b>Suivre en veille</b><small>' + (s.siren ? 'Changement de dirigeant, annonces légales' + (s.actusWeb ? ' et actus web' : '') + ' remontent dans Veille.' : 'Ajoute le SIREN (bouton Registre) pour activer la veille.') + '</small></span></label>';
  if (s.suivie) h += '<label class="chk pad"><input type="checkbox" data-act="actus-web" data-id="' + id + '"' + (s.actusWeb ? ' checked' : '') + '> Chercher aussi ses actus sur le web (IA)</label>';
  h += sec('Infos', '<dl class="infos">' + infos.map(x => '<dt>' + x[0] + '</dt><dd>' + x[1] + '</dd>').join('') + '</dl>' + (s.notes ? '<p class="notes">' + esc(s.notes) + '</p>' : ''), '<button class="mini ghost" data-act="structure-edit" data-id="' + id + '">Modifier</button>');
  h += sec('Contacts', pers.length ? pers.map(p => '<a class="item" href="#/personne/' + p.id + '"><span class="av">' + initials(p) + '</span><span class="grow"><b>' + esc(pName(p)) + '</b><small>' + esc(p.fonction || '') + '</small></span>' + pastille(p.statut) + '</a>').join('') : empty('Personne pour l\'instant.'), '<button class="mini" data-act="personne-new" data-s="' + id + '">+ Contact</button>');
  h += sec('Projets', projets.length ? projets.map(projRow).join('') : empty('Pas de projet.'), '<button class="mini ghost" data-act="projet-new" data-s="' + id + '">+ Projet</button>');
  if (sig.length) h += sec('Signaux de veille', sig.map(sigRow).join(''));
  h += '<div class="foot"><button class="btn danger-ghost" data-act="structure-del" data-id="' + id + '">Supprimer la structure</button></div>';
  return h;
};
