/* forms.js — formulaires, actions et démarrage. */
'use strict';

/* ---------- briques de formulaire ---------- */
function sel(name, opts, cur, attrs) {
  return '<select name="' + name + '"' + (attrs || '') + '>' + opts.map(o => {
    if (o.group) return '<optgroup label="' + esc(o.group) + '">' + o.items.map(i => '<option value="' + esc(i[0]) + '"' + (String(cur) === String(i[0]) ? ' selected' : '') + '>' + esc(i[1]) + '</option>').join('') + '</optgroup>';
    return '<option value="' + esc(o[0]) + '"' + (String(cur == null ? '' : cur) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
  }).join('') + '</select>';
}
const inp = (label, name, val, attrs) => '<label>' + label + '<input name="' + name + '" value="' + esc(val == null ? '' : val) + '"' + (attrs || '') + '></label>';
const area = (label, name, val, rows, attrs) => '<label>' + label + '<textarea name="' + name + '" rows="' + (rows || 3) + '"' + (attrs || '') + '>' + esc(val || '') + '</textarea></label>';
const field = (label, html) => '<label>' + label + html + '</label>';
const personnesOpts = () => Store.all('personnes').sort((a, b) => pName(a).localeCompare(pName(b))).map(p => [p.id, pName(p) + (structOf(p) ? ' (' + structOf(p).nom + ')' : '')]);
const structOpts = () => Store.all('structures').sort((a, b) => (a.nom || '').localeCompare(b.nom || '')).map(s => [s.id, s.nom]);
const projOpts = pid => Store.all('projets').filter(p => !pid || p.personneId === pid || (Store.get('personnes', pid) && p.structureId === Store.get('personnes', pid).structureId)).map(p => [p.id, p.titre]);
function membresOpts() { const m = membres().map(x => [x.id, x.nom || x.id]); if (!m.some(x => x[0] === me())) m.unshift([me(), Store.DEMO ? 'Moi' : nomMembre(me())]); return m; }
function chips(name, list, cur) { return '<div class="chips">' + list.map(t => '<label class="chip"><input type="checkbox" name="' + name + '" value="' + esc(t) + '"' + ((cur || []).includes(t) ? ' checked' : '') + '><span>' + esc(t) + '</span></label>').join('') + '</div>'; }
function formWrap(title, inner, submitLabel, extra) {
  return '<form id="sheetForm" class="form" novalidate><h2>' + title + '</h2>' + inner + '<div class="err" id="formErr"></div><div class="row end">' + (extra || '') + '<button type="button" class="btn ghost" data-act="close">Annuler</button><button class="btn primary">' + (submitLabel || 'Enregistrer') + '</button></div></form>';
}
function formErr(msg) { const e = $('#formErr'); if (e) { e.textContent = msg; e.scrollIntoView({ block: 'nearest' }); } return false; }
const fv = (fd, k) => String(fd.get(k) || '').trim();

/* ---------- Personne ---------- */
function personneForm(p, preset) {
  p = p || Object.assign({ statut: 'cible', suiviPar: me() }, preset || {});
  const R = reg();
  const orig = p.origineType === 'evenement' && p.origineId ? 'ev:' + p.origineId : p.origineType === 'personne' && p.origineId ? 'p:' + p.origineId : (p.origineType || '');
  const origOpts = [['', '—'], ['linkedin', 'LinkedIn'], ['site', 'Le site'], ['veille', 'La veille (BODACC, registre)'], ['autre', 'Autre']];
  const evs = Store.all('evenements').sort((a, b) => b.date.localeCompare(a.date)).map(e => ['ev:' + e.id, fdate(e.date) + ' · ' + e.titre]);
  const ps = personnesOpts().filter(x => x[0] !== p.id).map(x => ['p:' + x[0], x[1]]);
  if (evs.length) origOpts.push({ group: 'Un événement', items: evs });
  if (ps.length) origOpts.push({ group: 'Une personne (recommandation)', items: ps });
  const inner = '<div class="grid2">' + inp('Prénom', 'prenom', p.prenom, ' autocomplete="off"') + inp('Nom', 'nom', p.nom, ' autocomplete="off"') + '</div>' +
    inp('Fonction', 'fonction', p.fonction) +
    field('Structure', sel('structureId', [['', '—'], ['__new', '+ Nouvelle structure…']].concat(structOpts()), p.structureId, ' data-act="struct-sel"')) +
    '<div id="newStruct" class="' + (p.structureId === '__new' ? '' : 'hidden') + '">' + inp('Nom de la nouvelle structure', 'structNew', '') + '</div>' +
    field('Statut', sel('statut', STATUTS, p.statut || 'cible')) +
    '<div class="grid2">' + inp('Téléphone', 'tel', p.tel, ' type="tel" inputmode="tel"') + inp('E-mail', 'email', p.email, ' type="email" inputmode="email"') + '</div>' +
    inp('LinkedIn <small>(lien du profil)</small>', 'linkedin', p.linkedin, ' inputmode="url"') +
    '<div class="grid2">' + inp('Commune', 'commune', p.commune) + field('Secteur', sel('secteurGeo', [['', '—']].concat(R.secteursGeo.map(x => [x, x])), p.secteurGeo)) + '</div>' +
    field('Rencontré via', sel('origine', origOpts, orig)) + inp('Précision <small>(facultatif)</small>', 'origineTexte', p.origineTexte) +
    (Store.DEMO ? '' : field('Suivi par', sel('suiviPar', membresOpts(), p.suiviPar || me()))) +
    '<div class="lbl">Étiquettes</div>' + chips('tags', R.tags, p.tags) +
    field('Regarder son actu', sel('veilleFreq', [['0', 'Non'], ['30', 'Tous les mois'], ['60', 'Tous les 2 mois'], ['90', 'Tous les 3 mois']], String(p.veilleFreq || 0))) +
    area('Notes', 'notes', p.notes, 3) +
    '<p class="small muted">Pas d\'info sensible (santé, opinions, vie privée) : RGPD.</p>';
  openSheet(formWrap(p.id ? 'Modifier le contact' : 'Nouveau contact', inner), fd => {
    if (!fv(fd, 'prenom') && !fv(fd, 'nom')) return formErr('Indique au moins un prénom ou un nom.');
    let structureId = fv(fd, 'structureId');
    if (structureId === '__new') {
      if (!fv(fd, 'structNew')) return formErr('Donne un nom à la nouvelle structure.');
      structureId = Store.put('structures', { nom: fv(fd, 'structNew'), type: 'pme', commune: fv(fd, 'commune'), secteurGeo: fv(fd, 'secteurGeo') }).id;
    }
    const o = fv(fd, 'origine');
    const d = Object.assign({}, p, {
      prenom: fv(fd, 'prenom'), nom: fv(fd, 'nom'), fonction: fv(fd, 'fonction'), structureId, statut: fv(fd, 'statut') || 'cible',
      tel: fv(fd, 'tel'), email: fv(fd, 'email'), linkedin: fv(fd, 'linkedin'), commune: fv(fd, 'commune'), secteurGeo: fv(fd, 'secteurGeo'),
      origineType: o.startsWith('ev:') ? 'evenement' : o.startsWith('p:') ? 'personne' : o, origineId: o.includes(':') ? o.split(':')[1] : '', origineTexte: fv(fd, 'origineTexte'),
      suiviPar: Store.DEMO ? me() : fv(fd, 'suiviPar'), tags: fd.getAll('tags'), veilleFreq: Number(fd.get('veilleFreq') || 0), notes: fv(fd, 'notes')
    });
    const saved = Store.put('personnes', d);
    closeSheet(); toast(p.id ? 'Contact mis à jour' : 'Contact ajouté');
    if (!p.id) go('personne/' + saved.id);
  }, { tall: true });
}

/* ---------- Structure ---------- */
function structureForm(s) {
  s = s || { type: 'pme' };
  const R = reg();
  const inner = inp('Nom', 'nom', s.nom) + field('Type', sel('type', STRUCT_TYPES, s.type || 'pme')) + inp('Activité', 'activite', s.activite) +
    '<div class="grid2">' + inp('Commune', 'commune', s.commune) + field('Secteur', sel('secteurGeo', [['', '—']].concat(R.secteursGeo.map(x => [x, x])), s.secteurGeo)) + '</div>' +
    inp('Adresse', 'adresse', s.adresse) + '<div class="grid2">' + inp('SIREN', 'siren', s.siren, ' inputmode="numeric" maxlength="11"') + inp('Site web', 'site', s.site, ' inputmode="url"') + '</div>' +
    '<div class="lbl">Étiquettes</div>' + chips('tags', R.tags, s.tags) + area('Notes', 'notes', s.notes, 3);
  openSheet(formWrap(s.id ? 'Modifier la structure' : 'Nouvelle structure', inner), fd => {
    if (!fv(fd, 'nom')) return formErr('Le nom est obligatoire.');
    const siren = fv(fd, 'siren').replace(/\s/g, '');
    if (siren && !/^\d{9}$/.test(siren)) return formErr('Le SIREN fait 9 chiffres.');
    const saved = Store.put('structures', Object.assign({}, s, { nom: fv(fd, 'nom'), type: fv(fd, 'type'), activite: fv(fd, 'activite'), commune: fv(fd, 'commune'), secteurGeo: fv(fd, 'secteurGeo'), adresse: fv(fd, 'adresse'), siren, site: fv(fd, 'site'), tags: fd.getAll('tags'), notes: fv(fd, 'notes') }));
    closeSheet(); toast('Structure enregistrée');
    if (!s.id) go('structure/' + saved.id);
  }, { tall: true });
}

/* ---------- Échange ---------- */
function echangeForm(e, preset) {
  const isNew = !e;
  e = e || Object.assign({ type: 'rdv', date: today() }, preset || {});
  if (!Store.all('personnes').length) { toast('Ajoute d\'abord un contact'); personneForm(); return; }
  const p = e.personneId ? Store.get('personnes', e.personneId) : null;
  const t = e.tacheId ? Store.get('taches', e.tacheId) : null;
  const nextTitre = t && !t.faite ? t.titre : (p ? 'Relancer ' + (p.prenom || pName(p)) : 'Relancer');
  const nextDate = t && !t.faite ? t.date : '';
  const inner = '<div class="types">' + TYPES_ECH.map(x => '<label class="tchip"><input type="radio" name="type" value="' + x[0] + '"' + ((e.type || 'rdv') === x[0] ? ' checked' : '') + '><span>' + x[1] + '<small>' + x[2] + '</small></span></label>').join('') + '</div>' +
    field('Avec', sel('personneId', [['', 'Choisir…']].concat(personnesOpts()), e.personneId, ' data-act="ech-person"')) +
    '<div class="grid2">' + inp('Date', 'date', e.date || today(), ' type="date"') + field('Projet', sel('projetId', [['', 'Aucun']].concat(projOpts(e.personneId)), e.projetId)) + '</div>' +
    '<label>Notes <span class="row inline"><button type="button" class="mini ghost" data-act="dictee">🎤 Dicter</button>' + (Veille.IA.key() ? '<button type="button" class="mini ghost" data-act="ech-ia">✨ Mettre en forme</button>' : '') + '</span><textarea name="note" rows="6" placeholder="Ce qui s\'est dit, avec ses mots…">' + esc(e.note || '') + '</textarea></label>' +
    '<input type="hidden" name="noteBrute" value="' + esc(e.noteBrute || '') + '">' +
    '<div class="card next-step"><div class="lbl">Prochaine étape (obligatoire)</div>' +
    '<input name="nextTitre" value="' + esc(nextTitre) + '" placeholder="Ex. : envoyer la proposition">' +
    '<div class="row wrap">' + [['2', '+2 j'], ['7', '+1 sem.'], ['14', '+2 sem.'], ['30', '+1 mois'], ['90', '+3 mois']].map(x => '<button type="button" class="mini ghost" data-act="date-chip" data-n="' + x[0] + '">' + x[1] + '</button>').join('') + '</div>' +
    '<input name="nextDate" type="date" value="' + esc(nextDate) + '">' +
    '<label class="chk"><input type="checkbox" name="rien" data-act="rien"' + (!isNew && !e.tacheId && !e.brouillon ? ' checked' : '') + '> Rien pour l\'instant</label></div>' +
    (Store.DEMO ? '' : '<label class="chk"><input type="checkbox" name="prive"' + (e.prive ? ' checked' : '') + '> 🔒 Note privée (visible par moi seul)</label>');
  const extra = !isNew ? '<button type="button" class="btn danger-ghost" data-act="echange-del" data-id="' + e.id + '" data-prive="' + (e.prive ? 1 : '') + '">Supprimer</button>' : '';
  openSheet(formWrap(isNew ? 'Noter un échange' : (e.brouillon ? 'Compléter l\'échange' : 'Modifier l\'échange'), inner, 'Enregistrer', extra), fd => {
    const pid = fv(fd, 'personneId');
    if (!pid) return formErr('Avec qui ?');
    const rien = !!fd.get('rien');
    const nt = fv(fd, 'nextTitre'), nd = fv(fd, 'nextDate');
    if (!rien && (!nt || !nd)) return formErr('Choisis une prochaine étape et sa date, ou coche « Rien pour l\'instant ».');
    const prive = !!fd.get('prive');
    const doc = Object.assign({}, e, { type: fd.get('type') || 'autre', personneId: pid, date: fv(fd, 'date') || today(), projetId: fv(fd, 'projetId'), note: fv(fd, 'note'), noteBrute: fv(fd, 'noteBrute'), brouillon: false });
    delete doc.prive;
    // tâche « prochaine étape »
    const old = doc.tacheId ? Store.get('taches', doc.tacheId) : null;
    if (rien) { if (old && !old.faite) Store.remove('taches', old.id); doc.tacheId = ''; }
    else if (old && !old.faite) Store.put('taches', Object.assign({}, old, { titre: nt, date: nd, personneId: pid, projetId: doc.projetId }));
    else doc.tacheId = Store.put('taches', { titre: nt, date: nd, personneId: pid, projetId: doc.projetId, type: 'relance', assigne: me() }).id;
    // privé ou partagé : on range dans la bonne collection
    const coll = prive ? 'prive' : 'echanges', other = prive ? 'echanges' : 'prive';
    if (doc.id && Store.get(other, doc.id)) Store.remove(other, doc.id);
    Store.put(coll, doc);
    // les tâches de relance liées à ce contact et déjà dues sont considérées comme faites
    Store.all('taches').filter(x => !x.faite && x.personneId === pid && x.type === 'relance' && x.id !== doc.tacheId && x.date && x.date <= doc.date).forEach(x => Store.put('taches', Object.assign({}, x, { faite: true, faiteLe: today() })));
    // le statut avance tout seul
    const pe = Store.get('personnes', pid); let msg = 'Échange noté';
    if (pe) {
      const st = pe.statut || 'cible';
      let ns = st;
      if (st === 'cible' && doc.type !== 'evenement') ns = 'contacte';
      if (doc.type === 'rdv' && ['cible', 'contacte'].includes(st)) ns = 'rdv';
      if (ns !== st) { Store.put('personnes', Object.assign({}, pe, { statut: ns })); msg += ' · statut : ' + lab(STATUTS, ns); }
    }
    closeSheet(); toast(msg);
  }, { tall: true });
}

/* ---------- Tâche ---------- */
function tacheForm(t, preset) {
  const isNew = !t;
  t = t || Object.assign({ date: addDays(7), assigne: me(), type: 'interne' }, preset || {});
  const inner = inp('Quoi ?', 'titre', t.titre) + inp('Pour quand ?', 'date', t.date, ' type="date"') +
    field('Contact', sel('personneId', [['', 'Aucun']].concat(personnesOpts()), t.personneId)) +
    field('Projet', sel('projetId', [['', 'Aucun']].concat(projOpts()), t.projetId)) +
    (Store.DEMO ? '' : field('Qui s\'en charge ?', sel('assigne', membresOpts(), t.assigne || me()))) +
    (isNew ? '' : '<label class="chk"><input type="checkbox" name="faite"' + (t.faite ? ' checked' : '') + '> Fait</label>');
  const extra = isNew ? '' : '<button type="button" class="btn danger-ghost" data-act="tache-del" data-id="' + t.id + '">Supprimer</button>';
  openSheet(formWrap(isNew ? 'Nouvelle tâche' : 'Tâche', inner, 'Enregistrer', extra), fd => {
    if (!fv(fd, 'titre')) return formErr('Dis ce qu\'il y a à faire.');
    const faite = isNew ? false : !!fd.get('faite');
    Store.put('taches', Object.assign({}, t, { titre: fv(fd, 'titre'), date: fv(fd, 'date'), personneId: fv(fd, 'personneId'), projetId: fv(fd, 'projetId'), assigne: Store.DEMO ? me() : fv(fd, 'assigne'), faite, faiteLe: faite ? (t.faiteLe || today()) : '' }));
    closeSheet(); toast('Tâche enregistrée');
  });
}

/* ---------- Projet ---------- */
function projetForm(p, preset) {
  const isNew = !p;
  p = p || Object.assign({ statut: 'piste', offre: 'diag', chance: 'moyenne' }, preset || {});
  if (isNew && p.personneId && !p.structureId) { const pe = Store.get('personnes', p.personneId); if (pe && pe.structureId) p.structureId = pe.structureId; }
  const inner = inp('Nom du projet', 'titre', p.titre, ' placeholder="Ex. : Diagnostic com Dupont SA"') +
    '<div class="grid2">' + field('Structure', sel('structureId', [['', '—']].concat(structOpts()), p.structureId)) + field('Contact principal', sel('personneId', [['', '—']].concat(personnesOpts()), p.personneId)) + '</div>' +
    '<div class="grid2">' + field('Offre', sel('offre', OFFRES, p.offre)) + field('Statut', sel('statut', PROJ_STATUTS, p.statut || 'piste')) + '</div>' +
    '<h3>Récap</h3>' + area('Besoin, avec les mots du client', 'besoin', p.besoin, 3) + area('Enjeux', 'enjeux', p.enjeux, 2) +
    '<div class="grid2">' + inp('Décideur', 'decideur', p.decideur) + inp('Échéance', 'echeance', p.echeance, ' type="date"') + '</div>' +
    '<h3>Budget</h3>' + field('Fourchette', sel('fourchette', FOURCHETTES.map(x => [x[0], x[1]]), p.fourchette)) +
    '<div class="grid2">' + inp('Montant proposé (€)', 'propose', p.propose, ' type="number" inputmode="numeric" min="0"') + inp('Montant signé (€)', 'signe', p.signe, ' type="number" inputmode="numeric" min="0"') + '</div>' +
    field('Chance de signature', sel('chance', CHANCES.map(x => [x[0], x[1]]), p.chance || 'moyenne')) +
    (isNew ? '<p class="small muted">Les livrables types de l\'offre seront ajoutés : tu pourras les cocher ou décocher.</p>' : '');
  openSheet(formWrap(isNew ? 'Nouveau projet' : 'Modifier le projet', inner), fd => {
    if (!fv(fd, 'titre')) return formErr('Donne un nom au projet.');
    const offre = fv(fd, 'offre'), statut = fv(fd, 'statut');
    const d = Object.assign({}, p, {
      titre: fv(fd, 'titre'), structureId: fv(fd, 'structureId'), personneId: fv(fd, 'personneId'), offre, statut,
      besoin: fv(fd, 'besoin'), enjeux: fv(fd, 'enjeux'), decideur: fv(fd, 'decideur'), echeance: fv(fd, 'echeance'),
      fourchette: fv(fd, 'fourchette'), propose: Number(fd.get('propose') || 0) || 0, signe: Number(fd.get('signe') || 0) || 0, chance: fv(fd, 'chance')
    });
    if ((!d.livrables || !d.livrables.length) && (isNew || offre !== p.offre)) d.livrables = (reg().catalogue[offre] || []).map(l => ({ l, ok: true }));
    if (PROJ_GAGNES.includes(statut) && !d.dateSigne) d.dateSigne = today();
    const saved = Store.put('projets', d);
    closeSheet(); toast('Projet enregistré');
    if (isNew) go('projet/' + saved.id);
  }, { tall: true });
}

/* ---------- Événement ---------- */
function evenementForm(e) {
  const isNew = !e;
  e = e || { date: addDays(7), statut: 'interesse', criteres: { public: 2, distance: 1, format: 1, cout: 1 } };
  const c = e.criteres || {};
  const range = (k, m) => sel('c_' + k, Array.from({ length: m + 1 }, (_, i) => [String(i), String(i)]), String(c[k] || 0));
  const inner = inp('Titre', 'titre', e.titre) + '<div class="grid2">' + inp('Date', 'date', e.date, ' type="date"') + inp('Heure', 'heure', e.heure, ' type="time"') + '</div>' +
    '<div class="grid2">' + inp('Lieu', 'lieu', e.lieu) + inp('Commune', 'commune', e.commune) + '</div>' +
    inp('Organisateur', 'organisateur', e.organisateur) + inp('Lien', 'url', e.url, ' inputmode="url"') + area('Description', 'description', e.description, 2) +
    '<h3>Pertinence</h3><div class="grid2">' + field('Public de dirigeants (0-4)', range('public', 4)) + field('Proche (0-2)', range('distance', 2)) + field('Format pour échanger (0-2)', range('format', 2)) + field('Coût et temps (0-1)', range('cout', 1)) + '</div>' +
    '<label class="chk"><input type="checkbox" name="contactManuel"' + (e.contactManuel ? ' checked' : '') + '> Un contact du CRM y va ou l\'organise (+1)</label>' +
    field('Statut', sel('statut', EV_STATUTS, e.statut || 'interesse'));
  openSheet(formWrap(isNew ? 'Nouvel événement' : 'Modifier l\'événement', inner), fd => {
    if (!fv(fd, 'titre') || !fv(fd, 'date')) return formErr('Titre et date obligatoires.');
    const saved = Store.put('evenements', Object.assign({}, e, {
      titre: fv(fd, 'titre'), date: fv(fd, 'date'), heure: fv(fd, 'heure'), lieu: fv(fd, 'lieu'), commune: fv(fd, 'commune'), organisateur: fv(fd, 'organisateur'), url: fv(fd, 'url'), description: fv(fd, 'description'),
      criteres: { public: Number(fd.get('c_public')), distance: Number(fd.get('c_distance')), format: Number(fd.get('c_format')), cout: Number(fd.get('c_cout')) },
      contactManuel: !!fd.get('contactManuel'), statut: fv(fd, 'statut')
    }));
    closeSheet(); toast('Événement enregistré');
    if (isNew) go('evenement/' + saved.id);
  }, { tall: true });
}

/* ---------- Lien entre personnes ---------- */
function lienForm(pid) {
  const p = Store.get('personnes', pid);
  const others = personnesOpts().filter(x => x[0] !== pid);
  if (!others.length) { toast('Ajoute d\'abord une autre personne'); return; }
  const types = Object.keys(LIENS).map(k => [k, pName(p) + ' ' + LIENS[k][0] + '…']);
  openSheet(formWrap('Nouveau lien', field('Type de lien', sel('type', types, 'presente')) + field('Avec', sel('vers', [['', 'Choisir…']].concat(others), '')) + inp('Précision', 'note', '')), fd => {
    if (!fv(fd, 'vers')) return formErr('Choisis la personne.');
    Store.put('liens', { de: pid, vers: fv(fd, 'vers'), type: fv(fd, 'type'), note: fv(fd, 'note') });
    closeSheet(); toast('Lien ajouté');
  });
}

/* ---------- Registre des entreprises ---------- */
function registreSheet(sid) {
  const s = Store.get('structures', sid);
  openSheet('<h2>Registre des entreprises</h2><p class="small muted">Recherche officielle et gratuite (annuaire des entreprises de l\'État).</p><form id="regSearch" class="row"><input name="q" value="' + esc(s.siren || s.nom || '') + '" placeholder="Nom ou SIREN" class="grow"><button class="btn primary">Chercher</button></form><div id="regRes"></div>', null, { tall: true, noFocus: true });
  registreSheet.sid = sid;
  registreSearch(s.siren || s.nom || '');
}
async function registreSearch(q) {
  const box = $('#regRes'); if (!box || !q) return;
  box.innerHTML = '<div class="empty">Recherche…</div>';
  try {
    const res = await Veille.rechercheEntreprises(q, 6);
    registreSearch.res = res;
    box.innerHTML = res.length ? res.map((r, i) => '<div class="card"><b>' + esc(r.nom) + '</b><div class="small muted">' + esc([r.siren, r.commune, r.activiteLib || r.activite, r.etat === 'C' ? 'cessée' : ''].filter(Boolean).join(' · ')) + '</div>' +
      (r.dirigeants.length ? '<div class="small">Dirigeants : ' + esc(r.dirigeants.map(d => d.nom + (d.qualite ? ' (' + d.qualite + ')' : '')).join(', ')) + '</div>' : '') +
      '<button class="btn primary" data-act="registre-pick" data-i="' + i + '">C\'est elle</button></div>').join('') : '<div class="empty">Rien trouvé. Essaie le SIREN ou un autre nom.</div>';
  } catch (e) { box.innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; }
}
function registrePick(i) {
  const r = registreSearch.res[i], s = Store.get('structures', registreSheet.sid);
  const d = Object.assign({}, s, { siren: r.siren, nom: s.nom || r.nom, commune: s.commune || r.commune, adresse: s.adresse || r.adresse, activite: s.activite || r.activiteLib || r.activite, snapshot: snap(r) });
  Store.put('structures', d);
  const known = Store.all('personnes').filter(p => p.structureId === s.id).map(p => norm(pName(p)));
  const dirs = r.dirigeants.filter(x => x.prenom && !known.includes(norm(x.nom)));
  $('#regRes').innerHTML = '<div class="card"><b>✓ Fiche complétée</b> (SIREN ' + esc(r.siren) + ').' + (dirs.length ? '<p>Ajouter un dirigeant comme contact ?</p>' + dirs.map((x, j) => '<button class="btn ghost" data-act="dirigeant-add" data-i="' + i + '" data-j="' + r.dirigeants.indexOf(x) + '">+ ' + esc(x.nom) + (x.qualite ? ' · ' + esc(x.qualite) : '') + '</button>').join('') : '') + '</div><div class="row end"><button class="btn primary" data-act="close">Terminé</button></div>';
}
function snap(r) { return { dirigeants: r.dirigeants.map(d => d.nom + (d.qualite ? ' (' + d.qualite + ')' : '')).sort(), etat: r.etat || '', adresse: r.adresse || '', effectif: r.effectif || '' }; }

/* ---------- Veille : lancement ---------- */
async function veilleRun() {
  openSheet('<h2>Veille en cours…</h2><div id="vlog" class="vlog"></div><div class="row end"><button class="btn primary" data-act="close" id="vdone" disabled>Fermer</button></div>', null, { noFocus: true });
  const log = (m, cls) => { const el = $('#vlog'); if (el) { el.insertAdjacentHTML('beforeend', '<div class="' + (cls || '') + '">' + m + '</div>'); el.scrollTop = el.scrollHeight; } };
  const R = reg(), t = today();
  const sigs = Store.all('signaux');
  const knownBodacc = new Set(Store.rawAll('signaux').map(x => x.bodaccId).filter(Boolean));
  let nSig = 0, nCrea = 0, nEv = 0;
  const addSig = d => { Store.put('signaux', Object.assign({ date: t, lu: false }, d)); if (d.type === 'creation') nCrea++; else nSig++; if (d.bodaccId) knownBodacc.add(d.bodaccId); };

  // 1. structures suivies : registre + BODACC
  const suivies = Store.all('structures').filter(s => s.suivie && s.siren);
  if (suivies.length) log('🏛️ ' + plural(suivies.length, 'structure suivie', 'structures suivies') + '…');
  for (const s of suivies) {
    try {
      const r = (await Veille.rechercheEntreprises(s.siren, 1))[0];
      if (r && r.siren === s.siren) {
        const n = snap(r), o = s.snapshot;
        if (o) {
          const added = n.dirigeants.filter(x => !(o.dirigeants || []).includes(x)), gone = (o.dirigeants || []).filter(x => !n.dirigeants.includes(x));
          if (added.length || gone.length) addSig({ type: 'dirigeant', structureId: s.id, titre: 'Changement de dirigeant chez ' + s.nom, detail: [added.length ? 'Arrivée : ' + added.join(', ') : '', gone.length ? 'Départ : ' + gone.join(', ') : ''].filter(Boolean).join(' · ') });
          if (o.etat !== n.etat && n.etat === 'C') addSig({ type: 'etat', structureId: s.id, titre: s.nom + ' est indiquée comme cessée', detail: '' });
          if (o.adresse && n.adresse && o.adresse !== n.adresse) addSig({ type: 'adresse', structureId: s.id, titre: s.nom + ' a changé d\'adresse', detail: n.adresse });
        }
        s.snapshot = n;
      }
      const since = s.derniereVeille ? iso(s.derniereVeille - 3 * DAY) : addDays(-90);
      const ann = await Veille.bodaccSiren(s.siren, since);
      ann.filter(a => !knownBodacc.has(a.id)).forEach(a => addSig({ type: 'bodacc', structureId: s.id, bodaccId: a.id, date: a.date, titre: s.nom + ' : ' + (a.famille || 'annonce légale') + (a.type && a.type !== 'Avis initial' ? ' (' + a.type + ')' : ''), detail: a.activite, url: a.url }));
      if (s.actusWeb && Veille.IA.key()) {
        try { const a = await Veille.actus(s.nom, s.commune); if (a.texte) addSig({ type: 'actu', structureId: s.id, titre: 'Actus de ' + s.nom, detail: a.texte, url: (a.sources[0] || {}).uri || '' }); } catch (e) { log('Actus ' + esc(s.nom) + ' : ' + esc(e.message), 'warn'); }
      }
      Store.put('structures', Object.assign({}, s, { derniereVeille: Date.now() }));
    } catch (e) { log(esc(s.nom) + ' : ' + esc(e.message), 'warn'); }
  }

  // 2. nouvelles entreprises du territoire (BODACC, créations)
  const depts = String(R.zone.depts || '').split(/[,\s;]+/).map(x => x.trim()).filter(x => /^\d{2,3}$|^2[AB]$/i.test(x));
  if (depts.length) {
    log('🌱 Nouvelles entreprises (' + depts.join(', ') + ')…');
    try {
      const since = R.derniereVeille ? iso(Math.max(R.derniereVeille - 3 * DAY, Date.now() - 21 * DAY)) : addDays(-14);
      const list = await Veille.creations(depts, since);
      list.filter(a => !knownBodacc.has(a.id) && a.nom).forEach(a => addSig({ type: 'creation', bodaccId: a.id, date: a.date, titre: a.nom, detail: [a.activite, [a.cp, a.ville].filter(Boolean).join(' ')].filter(Boolean).join(' — '), url: a.url, siren: a.siren, ville: a.ville, activite: a.activite }));
    } catch (e) { log('BODACC : ' + esc(e.message), 'warn'); }
  }

  // 3. événements (IA + recherche web)
  if (Veille.IA.key()) {
    log('🎤 Recherche d\'événements avec l\'IA (30 à 60 s)…');
    try {
      const evs = Store.rawAll('evenements').filter(e => !e.deleted);
      const key = e => norm(e.titre).replace(/[^a-z0-9]/g, '').slice(0, 40) + '|' + e.date;
      const known = new Set(evs.map(key));
      const found = await Veille.evenements({ communes: R.zone.communes, rayon: R.zone.rayon, depts: R.zone.depts, themes: R.zone.themes, sources: R.sources }, evs.filter(e => e.date >= t).map(e => e.titre));
      found.filter(e => !known.has(key(e))).forEach(e => { Store.put('evenements', Object.assign(e, { statut: 'propose', trouveParIA: true })); nEv++; });
    } catch (e) { log('Événements : ' + esc(e.message), 'warn'); }
  } else log('🎤 Événements : ajoute une clé IA (Plus → IA) pour les chercher automatiquement.', 'muted');

  saveReg({ derniereVeille: Date.now(), derniereVeillePar: me() });
  log('<b>Terminé :</b> ' + plural(nSig, 'signal', 'signaux') + ', ' + plural(nCrea, 'nouvelle entreprise', 'nouvelles entreprises') + ', ' + plural(nEv, 'événement') + '.', 'ok');
  const b = $('#vdone'); if (b) b.disabled = false;
  if (nEv) veilleTab = 'evenements'; else if (nSig) veilleTab = 'signaux'; else if (nCrea) veilleTab = 'creations';
  if (route().name === 'veille') render(true);
}

/* ---------- Export / import ---------- */
function csvCell(v) { v = String(v == null ? '' : v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
async function exportAll() {
  const out = { app: 'lsl-crm', version: VERSION, date: new Date().toISOString(), data: {} };
  ['personnes', 'structures', 'liens', 'projets', 'echanges', 'taches', 'evenements', 'signaux', 'reglages', 'membres', 'prive'].forEach(c => out.data[c] = Store.all(c));
  const rows = [['Prénom', 'Nom', 'Fonction', 'Structure', 'Statut', 'Téléphone', 'E-mail', 'Commune', 'Secteur', 'Étiquettes', 'Rencontré via', 'Dernier contact', 'Prochaine action', 'Suivi par']]
    .concat(Store.all('personnes').map(p => { const n = openTasksOf('personneId', p.id)[0]; return [p.prenom, p.nom, p.fonction, (structOf(p) || {}).nom, lab(STATUTS, p.statut || 'cible'), p.tel, p.email, p.commune, p.secteurGeo, (p.tags || []).join(', '), lab(ORIGINES, p.origineType || ''), lastContact(p), n ? n.titre + ' (' + n.date + ')' : '', nomMembre(p.suiviPar)]; }));
  const d = today();
  const files = [
    new File([JSON.stringify(out, null, 1)], 'lsl-crm-sauvegarde-' + d + '.json', { type: 'application/json' }),
    new File(['﻿' + rows.map(r => r.map(csvCell).join(';')).join('\r\n')], 'lsl-crm-contacts-' + d + '.csv', { type: 'text/csv' })
  ];
  await shareOrDownload(files, 'Sauvegarde CRM La suite logique du ' + fdate(d));
  localStorage.setItem('lsl.lastExport', String(Date.now()));
  render(true);
}
async function shareOrDownload(files, title) {
  try {
    if (navigator.canShare && navigator.canShare({ files })) { await navigator.share({ files, title, text: title }); toast('Export envoyé'); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  files.forEach(f => { const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); });
  toast('Fichiers téléchargés');
}
async function importFile(file) {
  let j;
  try { j = JSON.parse(await file.text()); } catch (e) { toast('Fichier illisible'); return; }
  if (!j || j.app !== 'lsl-crm' || !j.data) { toast('Ce n\'est pas une sauvegarde de l\'appli'); return; }
  const n = Object.values(j.data).reduce((s, l) => s + (l || []).length, 0);
  confirmSheet('Importer ' + n + ' éléments du ' + fdate(j.date) + ' ? Les fiches existantes portant le même identifiant seront remplacées.', 'Importer', () => {
    Object.keys(j.data).forEach(c => { if (Array.isArray(j.data[c]) && c !== 'membres') Store.importDocs(c, j.data[c]); });
    toast('Import terminé');
  });
}
function exportFiche(id) {
  const p = Store.get('personnes', id), s = structOf(p);
  const lines = ['Fiche contact — La suite logique', 'Exportée le ' + fdate(today()), '', 'Nom : ' + pName(p), 'Fonction : ' + (p.fonction || ''), 'Structure : ' + (s ? s.nom : ''), 'Téléphone : ' + (p.tel || ''), 'E-mail : ' + (p.email || ''), 'LinkedIn : ' + (p.linkedin || ''), 'Commune : ' + (p.commune || ''), 'Statut : ' + lab(STATUTS, p.statut || 'cible'), 'Origine : ' + lab(ORIGINES, p.origineType || ''), 'Notes : ' + (p.notes || ''), '', 'Échanges :']
    .concat(echangesOf(id).filter(e => !e.prive).map(e => '- ' + e.date + ' · ' + lab(TYPES_ECH.map(x => [x[0], x[2]]), e.type) + ' : ' + (e.note || '').replace(/\n/g, ' ')));
  shareOrDownload([new File([lines.join('\n')], 'fiche-' + norm(pName(p)).replace(/[^a-z0-9]+/g, '-') + '.txt', { type: 'text/plain' })], 'Fiche ' + pName(p));
}

/* ---------- menu + ---------- */
function fabMenu() {
  const r = route();
  const ctx = r.name === 'personne' ? ' data-p="' + r.id + '"' : r.name === 'structure' ? ' data-s="' + r.id + '"' : r.name === 'projet' ? ' data-pr="' + r.id + '"' : '';
  const b = (act, ico, t, s) => '<button class="item" data-act="' + act + '"' + ctx + '><span class="ico">' + ico + '</span><span class="grow"><b>' + t + '</b><small>' + s + '</small></span></button>';
  openSheet('<h2>Ajouter</h2>' + b('echange-new', '💬', 'Un échange', 'Appel, RDV, mail… et la prochaine étape') + b('personne-new', '👤', 'Un contact', 'Cible, prospect, client, prescripteur') + b('structure-new', '🏢', 'Une structure', 'PME, association, collectivité') +
    b('projet-new', '📁', 'Un projet', 'Besoin, budget, périmètre') + b('tache-new', '✅', 'Une tâche', 'Relance, livrable, interne') + b('evenement-new', '🎤', 'Un événement', 'Salon, petit-déj, afterwork…'), null, { noFocus: true });
}

/* ---------- actions ---------- */
const A = {
  close: () => closeSheet(),
  fab: fabMenu,
  'confirm-ok': () => { const f = confirmSheet.ok; closeSheet(); if (f) f(); },
  sync: () => { if (Store.DEMO) { toast('Mode démo : pas de synchro'); return; } Store.sync().then(() => toast(Store.status().error ? 'Synchro impossible pour l\'instant' : 'Synchronisé ✓')); },
  resync: () => Store.sync(true).then(() => toast(Store.status().error ? 'Synchro impossible : ' + Store.status().error : 'Tout est à jour ✓')),
  'personne-new': d => { personneForm(null, { structureId: d.s || '', origineType: d.ev ? 'evenement' : '', origineId: d.ev || '' }); },
  'personne-edit': d => personneForm(Store.get('personnes', d.id)),
  'personne-del': d => confirmSheet('Supprimer définitivement ' + pName(Store.get('personnes', d.id)) + ' et ses échanges ?', 'Supprimer', () => {
    echangesAll().filter(e => e.personneId === d.id).forEach(e => Store.remove(e.prive ? 'prive' : 'echanges', e.id));
    Store.all('taches').filter(t => t.personneId === d.id).forEach(t => Store.remove('taches', t.id));
    Store.all('liens').filter(l => l.de === d.id || l.vers === d.id).forEach(l => Store.remove('liens', l.id));
    Store.remove('personnes', d.id); toast('Fiche supprimée'); if (route().name === 'personne') go('contacts');
  }, true),
  'structure-new': () => { structureForm(); },
  'structure-edit': d => structureForm(Store.get('structures', d.id)),
  'structure-del': d => confirmSheet('Supprimer cette structure ? Les contacts restent, sans structure.', 'Supprimer', () => {
    Store.all('personnes').filter(p => p.structureId === d.id).forEach(p => Store.put('personnes', Object.assign({}, p, { structureId: '' })));
    Store.remove('structures', d.id); go('contacts');
  }, true),
  'echange-new': d => { echangeForm(null, { personneId: d.p || '', projetId: d.pr || '' }); },
  'echange-edit': d => { const e = Store.get(d.prive ? 'prive' : 'echanges', d.id); if (e) echangeForm(Object.assign({}, e, { prive: !!d.prive })); },
  'echange-del': d => confirmSheet('Supprimer cet échange ?', 'Supprimer', () => { Store.remove(d.prive ? 'prive' : 'echanges', d.id); toast('Échange supprimé'); }, true),
  'tache-new': d => { tacheForm(null, { personneId: d.p || '', projetId: d.pr || '' }); },
  'tache-edit': d => tacheForm(Store.get('taches', d.id)),
  'tache-del': d => { Store.remove('taches', d.id); closeSheet(); toast('Tâche supprimée'); },
  'tache-done': d => { const t = Store.get('taches', d.id); if (!t) return; Store.put('taches', Object.assign({}, t, { faite: !t.faite, faiteLe: t.faite ? '' : today() })); if (!t.faite && t.personneId && t.type === 'relance') toast('Fait ✓ Pense à noter l\'échange'); else toast(t.faite ? 'Rouverte' : 'Fait ✓'); },
  'plus-tard': d => { const p = Store.get('personnes', d.p); Store.put('taches', { titre: 'Relancer ' + (p.prenom || pName(p)), date: addDays(7), personneId: d.p, type: 'relance', assigne: me() }); toast('Relance prévue dans 7 jours'); },
  'veille-vu': d => { const p = Store.get('personnes', d.p); Store.put('personnes', Object.assign({}, p, { derniereVeille: Date.now() })); },
  'toggle-dormants': () => { showAllDormants = !showAllDormants; render(true); },
  'toggle-closed': () => { showClosedProj = !showClosedProj; render(true); },
  'set-statut': d => { const p = Store.get('personnes', d.id); Store.put('personnes', Object.assign({}, p, { statut: d.v })); toast('Statut : ' + lab(STATUTS, d.v)); },
  call: d => {
    const p = Store.get('personnes', d.p);
    const e = Store.put('echanges', { type: 'appel', personneId: p.id, date: today(), note: '', brouillon: true });
    localStorage.setItem('lsl.lastCall', JSON.stringify({ id: e.id, t: Date.now() }));
    location.href = telHref(p.tel);
  },
  'lien-new': d => lienForm(d.p),
  'lien-del': d => { Store.remove('liens', d.id); toast('Lien retiré'); },
  'fiche-export': d => exportFiche(d.id),
  ctab: d => { CF.tab = d.v; render(); },
  vtab: d => { veilleTab = d.v; render(true); },
  'projet-new': d => { projetForm(null, { personneId: d.p || '', structureId: d.s || '' }); },
  'projet-edit': d => projetForm(Store.get('projets', d.id)),
  'projet-del': d => confirmSheet('Supprimer ce projet ?', 'Supprimer', () => { Store.all('taches').filter(t => t.projetId === d.id).forEach(t => Store.remove('taches', t.id)); Store.remove('projets', d.id); go('projets'); }, true),
  'proj-statut': d => { const p = Store.get('projets', d.id); const x = Object.assign({}, p, { statut: d.v }); if (PROJ_GAGNES.includes(d.v) && !x.dateSigne) x.dateSigne = today(); Store.put('projets', x); },
  'livrable-new': d => openSheet(formWrap('Ajouter un livrable', inp('Livrable', 'l', '') + '<label class="chk"><input type="checkbox" name="cat"> L\'ajouter aussi au catalogue de cette offre</label>'), fd => {
    if (!fv(fd, 'l')) return formErr('Écris le livrable.');
    const p = Store.get('projets', d.id);
    Store.put('projets', Object.assign({}, p, { livrables: (p.livrables || []).concat([{ l: fv(fd, 'l'), ok: true }]) }));
    if (fd.get('cat')) { const R = reg(); const cat = Object.assign({}, R.catalogue); cat[p.offre] = (cat[p.offre] || []).concat([fv(fd, 'l')]); saveReg({ catalogue: cat }); }
    closeSheet();
  }),
  'livrable-del': d => { const p = Store.get('projets', d.id); const l = (p.livrables || []).slice(); l.splice(Number(d.i), 1); Store.put('projets', Object.assign({}, p, { livrables: l })); },
  'recap-ia': async d => {
    const p = Store.get('projets', d.id);
    let ex = echangesAll().filter(e => e.projetId === d.id && e.note);
    if (!ex.length && p.personneId) ex = echangesOf(p.personneId).filter(e => e.note);
    toast('L\'IA lit les échanges…', 6000);
    try {
      const r = await Veille.remplirRecap(ex.map(e => e.date + ' : ' + e.note).join('\n\n'), p.titre);
      const k = [['besoin', 'Besoin'], ['enjeux', 'Enjeux'], ['decideur', 'Décideur'], ['echeance', 'Échéance']].filter(x => r[x[0]]);
      if (!k.length) { toast('L\'IA n\'a rien trouvé de plus dans les notes'); return; }
      openSheet(formWrap('Proposition de l\'IA', k.map(x => '<label class="chk top"><input type="checkbox" name="k" value="' + x[0] + '" checked><span><b>' + x[1] + '</b><br>' + esc(r[x[0]]) + (p[x[0]] ? '<br><small class="muted">Actuel : ' + esc(p[x[0]]) + '</small>' : '') + '</span></label>').join(''), 'Appliquer'), fd => {
        const patch = {}; fd.getAll('k').forEach(x => { patch[x] = x === 'echeance' && !/^\d{4}-\d{2}-\d{2}$/.test(r[x]) ? p[x] : r[x]; });
        Store.put('projets', Object.assign({}, p, patch)); closeSheet(); toast('Récap mis à jour');
      });
    } catch (e) { toast(e.message, 5000); }
  },
  'veille-run': veilleRun,
  'sig-lu': d => { const x = Store.get('signaux', d.id); Store.put('signaux', Object.assign({}, x, { lu: true })); },
  'sig-del': d => Store.remove('signaux', d.id),
  'sig-all-read': d => Store.all('signaux').filter(x => !x.lu && (d.v === 'creations' ? x.type === 'creation' : x.type !== 'creation')).forEach(x => Store.put('signaux', Object.assign({}, x, { lu: true }))),
  'sig-cible': d => {
    const x = Store.get('signaux', d.id);
    const s = Store.put('structures', { nom: x.titre, siren: x.siren || '', commune: x.ville || '', activite: x.activite || '', type: 'pme', notes: 'Repérée par la veille (BODACC, ' + fdate(x.date) + ').' });
    Store.put('signaux', Object.assign({}, x, { lu: true, cibleId: s.id }));
    toast('Ajoutée. Trouve maintenant la bonne personne à contacter.'); go('structure/' + s.id);
  },
  'evenement-new': () => { evenementForm(); },
  'evenement-edit': d => evenementForm(Store.get('evenements', d.id)),
  'evenement-del': d => confirmSheet('Supprimer cet événement ?', 'Supprimer', () => { Store.remove('evenements', d.id); go('veille'); }, true),
  'ev-statut': d => { const e = Store.get('evenements', d.id); Store.put('evenements', Object.assign({}, e, { statut: d.v })); },
  'ev-bilan': d => { const e = Store.get('evenements', d.id); Store.put('evenements', Object.assign({}, e, { bilan: d.v })); toast('Merci, c\'est noté'); },
  crit: d => { const e = Store.get('evenements', d.id); const max = { public: 4, distance: 2, format: 2, cout: 1 }[d.k]; const c = Object.assign({}, e.criteres); c[d.k] = Math.max(0, Math.min(max, (c[d.k] || 0) + Number(d.d))); Store.put('evenements', Object.assign({}, e, { criteres: c })); },
  registre: d => registreSheet(d.id),
  'registre-pick': d => registrePick(Number(d.i)),
  'dirigeant-add': d => {
    const r = registreSearch.res[Number(d.i)], x = r.dirigeants[Number(d.j)], s = Store.get('structures', registreSheet.sid);
    Store.put('personnes', { prenom: (x.prenom || '').replace(/^./, c => c.toUpperCase()), nom: (x.nomFamille || '').toUpperCase(), fonction: x.qualite || '', structureId: s.id, statut: 'cible', commune: s.commune || '', origineType: 'veille', suiviPar: me() });
    toast(x.nom + ' ajouté·e en cible');
    const btn = document.querySelector('[data-act="dirigeant-add"][data-j="' + d.j + '"]'); if (btn) { btn.disabled = true; btn.textContent = '✓ ' + x.nom; }
  },
  export: exportAll,
  logout: () => confirmSheet('Se déconnecter ? Les données seront retirées de ce téléphone (elles restent dans la base partagée).', 'Se déconnecter', () => Store.signOut()),
  'pw-reset': async () => { const em = ($('#loginForm [name=email]') || {}).value; if (!em) { $('#loginErr').textContent = 'Écris d\'abord ton adresse e-mail.'; return; } try { await Store.resetPassword(em); $('#loginErr').textContent = 'E-mail de réinitialisation envoyé.'; } catch (e) { $('#loginErr').textContent = e.message; } },
  'ia-test': async () => { try { toast('Test en cours…'); const r = await Veille.gemini('Réponds juste : OK'); toast('Clé valide ✓ (' + (r.text || 'OK').slice(0, 20) + ')'); } catch (e) { toast(e.message, 5000); } },
  'membre-del': d => confirmSheet('Retirer ' + d.id + ' de la base partagée ?', 'Retirer', () => Store.remove('membres', d.id), true),
  dictee: (d, el) => dictee($('#sheetForm textarea[name=note]'), el),
  'ech-ia': async (d, el) => {
    const ta = $('#sheetForm textarea[name=note]'); if (!ta.value.trim()) { toast('Écris ou dicte d\'abord tes notes'); return; }
    el.disabled = true; el.textContent = '✨ …';
    try {
      const pid = $('#sheetForm [name=personneId]').value, p = Store.get('personnes', pid);
      const r = await Veille.miseEnForme(ta.value, p ? 'Échange avec ' + pName(p) + (structOf(p) ? ' (' + structOf(p).nom + ')' : '') + '.' : '');
      const brute = $('#sheetForm [name=noteBrute]'); if (!brute.value) brute.value = ta.value;
      if (r.compte_rendu) ta.value = r.compte_rendu;
      if (r.prochaine_action) $('#sheetForm [name=nextTitre]').value = r.prochaine_action;
      if (r.delai_jours) $('#sheetForm [name=nextDate]').value = addDays(Math.max(1, Math.min(365, Number(r.delai_jours) || 7)));
      const rien = $('#sheetForm [name=rien]'); if (rien && r.prochaine_action) { rien.checked = false; syncRien(); }
      toast('Relis et ajuste si besoin');
    } catch (e) { toast(e.message, 5000); }
    el.disabled = false; el.textContent = '✨ Mettre en forme';
  },
  'date-chip': d => { $('#sheetForm [name=nextDate]').value = addDays(Number(d.n)); const r = $('#sheetForm [name=rien]'); if (r) { r.checked = false; syncRien(); } }
};
function syncRien() { const r = $('#sheetForm [name=rien]'); if (!r) return; $$('#sheetForm .next-step input:not([name=rien]), #sheetForm .next-step .mini').forEach(x => x.disabled = r.checked); }

document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  if (el.matches('input,select,label')) return; // gérés par « change »
  const fn = A[el.dataset.act];
  if (fn) { ev.preventDefault(); fn(Object.assign({}, el.dataset), el); }
});
document.addEventListener('change', ev => {
  const el = ev.target;
  if (el.dataset.f) { CF[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value; const l = $('#clist'); if (l) l.innerHTML = contactsList(); return; }
  const act = el.dataset.act;
  if (act === 'struct-sel') $('#newStruct').classList.toggle('hidden', el.value !== '__new');
  else if (act === 'ech-person') { const s = $('#sheetForm [name=projetId]'); s.innerHTML = [['', 'Aucun']].concat(projOpts(el.value)).map(o => '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>').join(''); const p = Store.get('personnes', el.value); const t = $('#sheetForm [name=nextTitre]'); if (p && t && /^Relancer/.test(t.value)) t.value = 'Relancer ' + (p.prenom || pName(p)); }
  else if (act === 'rien') syncRien();
  else if (act === 'suivre') { const s = Store.get('structures', el.dataset.id); if (el.checked && !s.siren) { el.checked = false; toast('Il faut d\'abord le SIREN : bouton Registre'); registreSheet(s.id); return; } Store.put('structures', Object.assign({}, s, { suivie: el.checked })); toast(el.checked ? 'Suivie en veille 📡' : 'Veille arrêtée'); }
  else if (act === 'actus-web') { const s = Store.get('structures', el.dataset.id); Store.put('structures', Object.assign({}, s, { actusWeb: el.checked })); }
  else if (act === 'livrable-toggle') { const p = Store.get('projets', el.dataset.id); const l = (p.livrables || []).map((x, i) => i === Number(el.dataset.i) ? Object.assign({}, x, { ok: el.checked }) : x); Store.put('projets', Object.assign({}, p, { livrables: l })); }
  else if (act === 'ev-filter') { evFilter = el.checked; render(true); }
  else if (act === 'ev-contact') { const e = Store.get('evenements', el.dataset.id); Store.put('evenements', Object.assign({}, e, { contactManuel: el.checked })); }
  else if (act === 'import' && el.files[0]) { importFile(el.files[0]); el.value = ''; }
});
document.addEventListener('input', ev => { if (ev.target.id === 'q') { CF.q = ev.target.value; const l = $('#clist'); if (l) l.innerHTML = contactsList(); } });
document.addEventListener('submit', async ev => {
  const f = ev.target; ev.preventDefault();
  const fd = new FormData(f);
  if (f.id === 'sheetForm' && sheetSubmit) { sheetSubmit(fd, f); return; }
  if (f.id === 'regSearch') { registreSearch(fv(fd, 'q')); return; }
  if (f.id === 'loginForm') {
    const mode = ev.submitter ? ev.submitter.value : 'in';
    const em = fv(fd, 'email'), pw = String(fd.get('pw') || '');
    $('#loginErr').textContent = '';
    if (!em || pw.length < 6) { $('#loginErr').textContent = 'Adresse e-mail et mot de passe (6 caractères minimum).'; return; }
    try { if (mode === 'up') await Store.signUp(em, pw); else await Store.signIn(em, pw); } catch (e) { $('#loginErr').textContent = e.message; }
    return;
  }
  if (f.id === 'regForm') {
    const lines = k => fv(fd, k).split('\n').map(x => x.trim()).filter(Boolean);
    const tags = lines('tags');
    if (tags.length > MAX_TAGS) { toast('10 étiquettes maximum : garde l\'essentiel'); return; }
    const relance = {}; STATUTS.forEach(x => relance[x[0]] = Math.max(1, Number(fd.get('rel_' + x[0])) || 30));
    const catalogue = {}; OFFRES.forEach(x => catalogue[x[0]] = lines('cat_' + x[0]));
    saveReg({ relance, catalogue, secteursGeo: lines('secteursGeo'), tags, sources: lines('sources'), zone: { communes: fv(fd, 'communes'), rayon: Number(fd.get('rayon')) || 40, depts: fv(fd, 'depts'), themes: fv(fd, 'themes') } });
    toast('Réglages enregistrés'); return;
  }
  if (f.id === 'iaForm') { Veille.IA.setKey(fv(fd, 'key')); Veille.IA.setModels(fv(fd, 'mSearch'), fv(fd, 'mText')); toast('Enregistré sur ce téléphone'); render(true); return; }
  if (f.id === 'membreForm') { const em = fv(fd, 'email').toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { toast('Adresse invalide'); return; } Store.put('membres', { id: em, nom: fv(fd, 'nom') }); toast('Membre ajouté'); f.reset(); }
});

/* ---------- démarrage ---------- */
let renderT;
Store.on(what => {
  if (what === 'status') { renderBanner(); return; }
  if (what === 'auth') { render(); return; }
  clearTimeout(renderT); renderT = setTimeout(() => { if (!document.querySelector('#view input:focus,#view textarea:focus')) render(true); }, 120);
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const c = JSON.parse(localStorage.getItem('lsl.lastCall') || 'null');
  if (c && Date.now() - c.t < 60 * 60 * 1000) {
    localStorage.removeItem('lsl.lastCall');
    const e = Store.get('echanges', c.id);
    if (e && e.brouillon) setTimeout(() => echangeForm(e), 400);
  }
});
Store.init().then(() => {
  render();
  // l'administrateur s'ajoute lui-même comme membre au premier lancement
  setTimeout(() => {
    const u = Store.user();
    if (!Store.DEMO && u && Store.isAdmin() && !Store.get('membres', u.email) && !Store.status().error) Store.put('membres', { id: u.email, nom: u.email.split('@')[0].replace(/^./, c => c.toUpperCase()) });
  }, 6000);
});
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
