/* views2.js — Projets, Veille, Événements, Plus (réglages, IA, membres, statistiques, RGPD). */
'use strict';

/* ---------- Projets ---------- */
let showClosedProj = false;
ROUTES.projets = () => {
  const all = Store.all('projets');
  const ouverts = all.filter(p => PROJ_OUVERTS.includes(p.statut || 'piste'));
  const probable = ouverts.reduce((s, p) => s + projetMontant(p) * chanceVal(p.chance), 0);
  const an = String(new Date().getFullYear());
  const signe = all.filter(p => PROJ_GAGNES.includes(p.statut) && iso(p.dateSigne || p.updatedAt).startsWith(an)).reduce((s, p) => s + projetMontant(p), 0);
  let h = '<div class="kpis"><div class="kpi"><small>CA probable</small><b>' + euros(probable) + '</b><span>' + plural(ouverts.length, 'projet ouvert', 'projets ouverts') + '</span></div>' +
    '<div class="kpi"><small>Signé en ' + an + '</small><b>' + euros(signe) + '</b><span>montants signés</span></div></div>';
  if (!all.length) return h + empty('Pas encore de projet. Un projet naît d\'un échange : touche <b>+</b> puis « Projet ».');
  PROJ_STATUTS.forEach(([k, l]) => {
    if (!showClosedProj && (k === 'termine' || k === 'perdu')) return;
    const list = all.filter(p => (p.statut || 'piste') === k).sort((a, b) => (a.echeance || '9').localeCompare(b.echeance || '9'));
    if (list.length) h += sec(l + ' <span class="cnt">' + list.length + '</span>', list.map(p => {
      const s = p.structureId ? Store.get('structures', p.structureId) : null, pe = p.personneId ? Store.get('personnes', p.personneId) : null;
      return '<a class="item" href="#/projet/' + p.id + '"><span class="grow"><b>' + esc(p.titre) + '</b><small>' + esc([s && s.nom, pe && pName(pe), lab(OFFRES, p.offre)].filter(Boolean).join(' · ')) + '</small></span><span class="amt">' + (projetMontant(p) ? euros(projetMontant(p)) : '') + (PROJ_OUVERTS.includes(k) && p.chance ? '<small>' + esc(lab(CHANCES, p.chance)) + '</small>' : '') + '</span></a>';
    }).join(''));
  });
  const closed = all.filter(p => p.statut === 'termine' || p.statut === 'perdu').length;
  if (closed) h += '<button class="btn link" data-act="toggle-closed">' + (showClosedProj ? 'Masquer' : 'Voir') + ' les projets terminés ou perdus (' + closed + ')</button>';
  return h;
};

ROUTES.projet = id => {
  const p = Store.get('projets', id);
  if (!p) return empty('Projet introuvable. <a href="#/projets">Retour</a>');
  const s = p.structureId ? Store.get('structures', p.structureId) : null, pe = p.personneId ? Store.get('personnes', p.personneId) : null;
  const taches = Store.all('taches').filter(t => t.projetId === id && t.type !== 'livrable').sort((a, b) => (a.faite - b.faite) || (a.date || '9').localeCompare(b.date || '9'));
  const exs = echangesAll().filter(e => e.projetId === id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const liv = p.livrables || [];
  const four = FOURCHETTES.find(x => x[0] === p.fourchette);
  const budget = [four && four[0] ? 'fourchette ' + four[1] : '', p.propose ? 'proposé ' + euros(p.propose) : '', p.signe ? '<b>signé ' + euros(p.signe) + '</b>' : '', PROJ_OUVERTS.includes(p.statut || 'piste') && p.chance ? 'chance ' + lab(CHANCES, p.chance).toLowerCase() : ''].filter(Boolean).join(' · ');
  const recap = [
    ['Besoin (ses mots)', p.besoin ? '<q>' + esc(p.besoin) + '</q>' : ''], ['Enjeux', esc(p.enjeux || '')], ['Décideur', esc(p.decideur || '')],
    ['Budget', budget], ['Échéance', p.echeance ? fdate(p.echeance) : ''], ['Offre proposée', esc(lab(OFFRES, p.offre))], ['Statut', esc(lab(PROJ_STATUTS, p.statut || 'piste'))]
  ];
  let h = '<div class="back"><a href="#/projets">‹ Projets</a></div><div class="head"><span class="av big sq">📁</span><div class="grow"><h1>' + esc(p.titre) + '</h1><div class="muted">' +
    [s ? '<a href="#/structure/' + s.id + '">' + esc(s.nom) + '</a>' : '', pe ? '<a href="#/personne/' + pe.id + '">' + esc(pName(pe)) + '</a>' : ''].filter(Boolean).join(' · ') + '</div></div></div>' +
    '<div class="stepper">' + PROJ_STATUTS.map(x => '<button data-act="proj-statut" data-id="' + id + '" data-v="' + x[0] + '" class="p-' + x[0] + ((p.statut || 'piste') === x[0] ? ' on' : '') + '">' + x[1] + '</button>').join('') + '</div>';
  h += sec('Récap', '<dl class="infos recap">' + recap.map(x => '<dt>' + x[0] + '</dt><dd>' + (x[1] || '<span class="muted">—</span>') + '</dd>').join('') + '</dl>',
    '<span>' + (Veille.IA.key() && (exs.some(e => e.note) || (pe && echangesOf(pe.id).some(e => e.note))) ? '<button class="mini ghost" data-act="recap-ia" data-id="' + id + '">✨ IA</button> ' : '') + '<button class="mini ghost" data-act="projet-edit" data-id="' + id + '">Modifier</button></span>');
  h += sec('Périmètre proposé <span class="cnt">' + liv.filter(l => l.ok).length + '/' + liv.length + '</span>', (liv.length ? liv.map((l, i) => '<label class="item chkrow' + (l.ok ? '' : ' off') + '"><input type="checkbox" data-act="livrable-toggle" data-id="' + id + '" data-i="' + i + '"' + (l.ok ? ' checked' : '') + '><span class="grow">' + esc(l.l) + '</span><button class="mini ghost" data-act="livrable-del" data-id="' + id + '" data-i="' + i + '" aria-label="Retirer">✕</button></label>').join('') : empty('Aucun livrable.')),
    '<button class="mini ghost" data-act="livrable-new" data-id="' + id + '">+ Livrable</button>');
  h += sec('Tâches internes', taches.length ? taches.map(tacheRow).join('') : empty('Rien à faire pour l\'instant.'), '<button class="mini ghost" data-act="tache-new" data-pr="' + id + '">+ Tâche</button>');
  h += sec('Échanges liés', exs.length ? '<div class="timeline">' + exs.map(echRow).join('') + '</div>' : empty('Aucun échange relié à ce projet.'), pe ? '<button class="mini" data-act="echange-new" data-p="' + pe.id + '" data-pr="' + id + '">+ Échange</button>' : '');
  h += '<div class="foot"><button class="btn danger-ghost" data-act="projet-del" data-id="' + id + '">Supprimer le projet</button></div>';
  return h;
};

/* ---------- Veille ---------- */
let veilleTab = 'evenements', evFilter = false;
ROUTES.veille = () => {
  const R = reg(), t = today();
  const evs = Store.all('evenements');
  const sig = Store.all('signaux');
  const nonLus = k => sig.filter(x => (k === 'creation' ? x.type === 'creation' : x.type !== 'creation') && !x.lu).length;
  const cnt = IA => IA.count();
  let h = '<div class="card veille-run"><div class="grow"><b>Veille de la semaine</b><small>' + (R.derniereVeille ? 'Dernière : ' + fdate(R.derniereVeille) + ' (' + esc(nomMembre(R.derniereVeillePar)) + ')' : 'Jamais lancée') +
    (Veille.IA.key() ? ' · IA : ' + cnt(Veille.IA).n + ' appel(s) aujourd\'hui' : ' · <a href="#/ia">Ajouter la clé IA gratuite</a> pour les événements') + '</small></div>' +
    '<button class="btn primary" data-act="veille-run">Lancer</button></div>';
  h += '<div class="seg"><button data-act="vtab" data-v="evenements" class="' + (veilleTab === 'evenements' ? 'on' : '') + '">Événements</button>' +
    '<button data-act="vtab" data-v="signaux" class="' + (veilleTab === 'signaux' ? 'on' : '') + '">Signaux' + (nonLus('s') ? ' <i class="dot">' + nonLus('s') + '</i>' : '') + '</button>' +
    '<button data-act="vtab" data-v="creations" class="' + (veilleTab === 'creations' ? 'on' : '') + '">Nouvelles entreprises' + (nonLus('creation') ? ' <i class="dot">' + nonLus('creation') + '</i>' : '') + '</button></div>';
  if (veilleTab === 'evenements') {
    const up = evs.filter(e => e.date >= t && e.statut !== 'ignore' && (!evFilter || evNote(e) >= 7)).sort((a, b) => a.date.localeCompare(b.date));
    const past = evs.filter(e => e.date < t && ['interesse', 'inscrit'].includes(e.statut)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
    h += '<div class="row between"><label class="chk"><input type="checkbox" data-act="ev-filter"' + (evFilter ? ' checked' : '') + '> 7/10 et plus</label><button class="mini" data-act="evenement-new">+ Événement</button></div>';
    h += up.length ? up.map(evRow).join('') : empty('Aucun événement à venir. Lance la veille ou ajoute ceux que tu connais.');
    if (past.length) h += sec('Passés', past.map(e => evRow(e).replace('</a>', (e.bilan ? '<span class="tag">' + ({ oui: '👍', moyen: '😐', non: '👎' }[e.bilan] || '') + '</span>' : '<span class="tag warn">bilan ?</span>') + '</a>')).join(''));
  } else {
    const list = sig.filter(x => veilleTab === 'creations' ? x.type === 'creation' : x.type !== 'creation').sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt);
    if (list.some(x => !x.lu)) h += '<div class="row end"><button class="mini ghost" data-act="sig-all-read" data-v="' + veilleTab + '">Tout marquer lu</button></div>';
    h += list.length ? list.map(sigRow).join('') : empty(veilleTab === 'creations' ? 'Les créations et reprises d\'entreprises de ton territoire (BODACC) arriveront ici à la prochaine veille.' : 'Aucun signal. Active « Suivre en veille » sur les structures qui comptent (avec leur SIREN).');
  }
  return h;
};
function sigRow(x) {
  const ico = { dirigeant: '👤', bodacc: '📰', etat: '⚠️', adresse: '🏠', actu: '🗞️', creation: '🌱' }[x.type] || '📌';
  const s = x.structureId ? Store.get('structures', x.structureId) : null;
  return '<div class="item sig' + (x.lu ? '' : ' unread') + '"><span class="ico">' + ico + '</span><span class="grow"><b>' + esc(x.titre) + '</b><small>' + esc([fdate(x.date), s && s.nom].filter(Boolean).join(' · ')) + '</small>' + (x.detail ? '<span class="tl-n">' + esc(x.detail) + '</span>' : '') +
    '<span class="row">' + (x.url ? '<a class="mini ghost" target="_blank" rel="noopener" href="' + esc(x.url) + '">Voir</a>' : '') +
    (x.type === 'creation' ? (x.cibleId && Store.get('structures', x.cibleId) ? '<a class="mini ghost" href="#/structure/' + x.cibleId + '">Dans le CRM ✓</a>' : '<button class="mini" data-act="sig-cible" data-id="' + x.id + '">+ Ajouter en cible</button>') : '') +
    (x.lu ? '' : '<button class="mini ghost" data-act="sig-lu" data-id="' + x.id + '">Lu</button>') + '<button class="mini ghost" data-act="sig-del" data-id="' + x.id + '" aria-label="Supprimer">✕</button></span></span></div>';
}

ROUTES.evenement = id => {
  const e = Store.get('evenements', id);
  if (!e) return empty('Événement introuvable. <a href="#/veille">Retour</a>');
  const c = e.criteres || {}, n = evNote(e), past = e.date < today();
  const crit = [['public', 'Public de dirigeants', 4], ['distance', 'Proche', 2], ['format', 'Format pour échanger', 2], ['cout', 'Coût et temps raisonnables', 1]];
  const met = Store.all('personnes').filter(p => p.origineType === 'evenement' && p.origineId === id);
  const auto = evContact(Object.assign({}, e, { contactManuel: false }));
  const gcal = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(e.titre) + '&dates=' + gDates(e) + '&location=' + encodeURIComponent([e.lieu, e.commune].filter(Boolean).join(', ')) + '&details=' + encodeURIComponent((e.description || '') + (e.url ? '\n' + e.url : ''));
  let h = '<div class="back"><a href="#/veille">‹ Veille</a></div><div class="head"><span class="note big n' + (n >= 7 ? 'hi' : n >= 4 ? 'mid' : 'lo') + '">' + n + '<small>/10</small></span><div class="grow"><h1>' + esc(e.titre) + '</h1><div class="muted">' + esc([fdate(e.date, true) + (e.heure ? ' à ' + e.heure : ''), e.lieu, e.commune].filter(Boolean).join(' · ')) + '</div></div></div>';
  h += '<div class="stepper">' + EV_STATUTS.map(x => '<button data-act="ev-statut" data-id="' + id + '" data-v="' + x[0] + '" class="' + ((e.statut || 'propose') === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div>';
  h += '<div class="acts">' + (e.url ? '<a class="act" target="_blank" rel="noopener" href="' + esc(e.url) + '"><span>🔗</span>Page</a>' : '<span class="act off"><span>🔗</span>Page</span>') +
    '<a class="act" target="_blank" rel="noopener" href="' + esc(gcal) + '"><span>📅</span>Agenda</a>' +
    '<a class="act" target="_blank" rel="noopener" href="' + esc(mapsHref([e.lieu, e.commune].filter(Boolean).join(' '))) + '"><span>📍</span>Lieu</a>' +
    '<button class="act" data-act="evenement-edit" data-id="' + id + '"><span>✏️</span>Modifier</button></div>';
  if (past && ['interesse', 'inscrit'].includes(e.statut)) h += '<div class="card"><b>Ça valait le coup ?</b><div class="row">' + [['oui', '👍 Oui'], ['moyen', '😐 Moyen'], ['non', '👎 Non']].map(x => '<button class="btn ' + (e.bilan === x[0] ? 'primary' : 'ghost') + '" data-act="ev-bilan" data-id="' + id + '" data-v="' + x[0] + '">' + x[1] + '</button>').join('') + '</div></div>';
  h += sec('Pertinence : ' + n + '/10', crit.map(([k, l, m]) => '<div class="crit"><span class="grow">' + l + '</span><button class="mini ghost" data-act="crit" data-id="' + id + '" data-k="' + k + '" data-d="-1">−</button><b>' + (c[k] || 0) + '/' + m + '</b><button class="mini ghost" data-act="crit" data-id="' + id + '" data-k="' + k + '" data-d="1">+</button></div>').join('') +
    '<label class="crit chk"><input type="checkbox" data-act="ev-contact" data-id="' + id + '"' + (evContact(e) ? ' checked' : '') + (auto ? ' disabled' : '') + '><span class="grow">Un contact du CRM y va ou l\'organise' + (auto ? ' (organisateur reconnu)' : '') + '</span><b>' + (evContact(e) ? 1 : 0) + '/1</b></label>' +
    (e.pourquoi ? '<p class="muted small">IA : ' + esc(e.pourquoi) + '</p>' : ''));
  const infos = [['Organisateur', esc(e.organisateur || '')], ['Description', esc(e.description || '')], ['Trouvé par', e.trouveParIA ? 'la veille IA (à vérifier sur la page)' : 'ajout manuel']].filter(x => x[1]);
  h += sec('Infos', '<dl class="infos">' + infos.map(x => '<dt>' + x[0] + '</dt><dd>' + x[1] + '</dd>').join('') + '</dl>' + ((e.sourcesIA || []).length ? '<p class="small">Sources : ' + e.sourcesIA.map((s, i) => '<a target="_blank" rel="noopener" href="' + esc(s.uri) + '">' + esc(s.title || 'source ' + (i + 1)) + '</a>').join(' · ') + '</p>' : ''));
  h += sec('Personnes rencontrées', met.length ? met.map(p => '<a class="item" href="#/personne/' + p.id + '"><span class="av">' + initials(p) + '</span><span class="grow"><b>' + esc(pName(p)) + '</b></span>' + pastille(p.statut) + '</a>').join('') : empty(past ? 'Qui as-tu rencontré ? Ajoute-les : leur origine sera notée.' : 'Après l\'événement, ajoute ici les personnes rencontrées.'), '<button class="mini" data-act="personne-new" data-ev="' + id + '">+ Personne</button>');
  h += '<div class="foot"><button class="btn danger-ghost" data-act="evenement-del" data-id="' + id + '">Supprimer</button></div>';
  return h;
};
function gDates(e) {
  const d = (e.date || today()).replace(/-/g, '');
  if (!e.heure) { const n = addDays(1, e.date).replace(/-/g, ''); return d + '/' + n; }
  const [hh, mm] = e.heure.split(':').map(Number);
  const pad = x => String(x).padStart(2, '0');
  return d + 'T' + pad(hh) + pad(mm) + '00/' + d + 'T' + pad(Math.min(23, hh + 2)) + pad(mm) + '00';
}

/* ---------- Plus ---------- */
ROUTES.plus = () => {
  const u = Store.user(), st = Store.status();
  const link = (href, ico, t, s) => '<a class="item" href="' + href + '"><span class="ico">' + ico + '</span><span class="grow"><b>' + t + '</b><small>' + s + '</small></span><span class="chev">›</span></a>';
  let h = '<h1 class="pt">Plus</h1>';
  h += sec('Équipe et réglages', link('#/reglages', '⚙️', 'Réglages communs', 'Relances, offres et livrables, secteurs, étiquettes, zone de veille') +
    link('#/ia', '✨', 'IA (Gemini)', Veille.IA.key() ? 'Clé enregistrée sur ce téléphone' : 'Gratuit : ajoute ta clé pour la veille événements') +
    link('#/membres', '👥', 'Membres', Store.DEMO ? 'Disponible avec la base partagée' : plural(membres().length, 'membre')) +
    link('#/stats', '📈', 'Ce qui rapporte', 'D\'où viennent les contacts et les clients') +
    link('#/rgpd', '🧹', 'RGPD', 'Fiches à supprimer, durée de conservation'));
  h += sec('Données', '<button class="item" data-act="export"><span class="ico">💾</span><span class="grow"><b>Exporter tout</b><small>Sauvegarde complète + tableau des contacts (CSV). Dernier export : ' + (localStorage.getItem('lsl.lastExport') ? fdate(Number(localStorage.getItem('lsl.lastExport'))) : 'jamais') + '</small></span></button>' +
    '<label class="item"><span class="ico">📥</span><span class="grow"><b>Importer une sauvegarde</b><small>Fichier .json exporté par l\'appli</small></span><input type="file" accept=".json,application/json" data-act="import" hidden></label>' +
    (Store.DEMO ? '' : '<button class="item" data-act="resync"><span class="ico">🔄</span><span class="grow"><b>Tout resynchroniser</b><small>' + (st.lastSync ? 'Dernière synchro : ' + fdate(st.lastSync) + ' ' + new Date(st.lastSync).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'jamais') + (st.pending ? ' · ' + st.pending + ' en attente' : '') + '</small></span></button>'));
  h += sec('Compte', Store.DEMO ? '<div class="card"><b>Mode démo</b><p class="small">Firebase n\'est pas encore branché : tes données restent sur ce téléphone. Une fois le fichier config.js rempli, la connexion et le partage s\'activent.</p></div>' :
    '<div class="item"><span class="ico">🙂</span><span class="grow"><b>' + esc(nomMembre(u.email)) + '</b><small>' + esc(u.email) + (Store.isAdmin() ? ' · administrateur' : '') + '</small></span><button class="mini ghost" data-act="logout">Déconnexion</button></div>');
  h += '<p class="muted small center">La suite logique · CRM v' + VERSION + '</p>';
  return h;
};

ROUTES.reglages = () => {
  const R = reg(), z = R.zone;
  return '<div class="back"><a href="#/plus">‹ Plus</a></div><h1 class="pt">Réglages communs</h1><p class="muted small">Partagés avec toute l\'équipe.</p>' +
    '<form id="regForm" class="card form">' +
    '<h3>Relancer au bout de… (jours sans échange)</h3><div class="grid2">' + STATUTS.map(x => '<label>' + x[1] + '<input type="number" min="1" max="999" name="rel_' + x[0] + '" value="' + (R.relance[x[0]] || 30) + '"></label>').join('') + '</div>' +
    '<h3>Livrables types par offre <small>(un par ligne)</small></h3>' + OFFRES.map(x => '<label>' + x[1] + '<textarea name="cat_' + x[0] + '" rows="4">' + esc((R.catalogue[x[0]] || []).join('\n')) + '</textarea></label>').join('') +
    '<h3>Secteurs géographiques <small>(un par ligne)</small></h3><textarea name="secteursGeo" rows="4">' + esc(R.secteursGeo.join('\n')) + '</textarea>' +
    '<h3>Étiquettes <small>(' + MAX_TAGS + ' maximum, une par ligne)</small></h3><textarea name="tags" rows="4">' + esc(R.tags.join('\n')) + '</textarea>' +
    '<h3>Veille événements</h3><label>Communes de référence<textarea name="communes" rows="2">' + esc(z.communes) + '</textarea></label>' +
    '<div class="grid2"><label>Rayon (km)<input type="number" name="rayon" value="' + esc(z.rayon) + '"></label><label>Départements<input name="depts" value="' + esc(z.depts) + '"></label></div>' +
    '<label>Types d\'événements recherchés<textarea name="themes" rows="3">' + esc(z.themes) + '</textarea></label>' +
    '<label>Sources à surveiller <small>(une par ligne : réseau, agenda, site…)</small><textarea name="sources" rows="5">' + esc(R.sources.join('\n')) + '</textarea></label>' +
    '<button class="btn primary wide">Enregistrer</button></form>';
};

ROUTES.ia = () => {
  const c = Veille.IA.count();
  return '<div class="back"><a href="#/plus">‹ Plus</a></div><h1 class="pt">IA (Gemini)</h1>' +
    '<div class="card"><p><b>Gratuit, sans carte bancaire.</b> L\'appli utilise l\'offre gratuite de Google Gemini. Si le quota du jour est atteint, l\'IA s\'arrête jusqu\'au lendemain : aucune facture possible tant que tu n\'ajoutes pas de moyen de paiement chez Google.</p>' +
    '<p class="small muted">À savoir : en gratuit, Google peut utiliser les textes envoyés pour améliorer ses produits. Évite de mettre des infos sensibles dans les notes que tu fais remettre en forme.</p></div>' +
    '<form id="iaForm" class="card form"><label>Clé API Gemini <small>(gardée sur ce téléphone uniquement)</small><input name="key" type="password" autocomplete="off" value="' + esc(Veille.IA.key()) + '" placeholder="AIza…"></label>' +
    '<details><summary>Modèles (avancé)</summary><label>Modèle avec recherche web (veille)<input name="mSearch" value="' + esc(Veille.IA.modelSearch()) + '"></label><label>Modèle texte (mise en forme)<input name="mText" value="' + esc(Veille.IA.modelText()) + '"></label></details>' +
    '<div class="row"><button class="btn primary">Enregistrer</button><button type="button" class="btn ghost" data-act="ia-test">Tester</button></div></form>' +
    '<p class="muted small">Aujourd\'hui : ' + c.n + ' appel(s), dont ' + c.s + ' avec recherche web. Une veille complète en utilise 1 à 3, plus 1 par structure suivie avec « actus web ».</p>' +
    '<div class="card small"><b>Obtenir la clé</b><ol><li>Va sur <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> avec ton compte Google.</li><li>« Créer une clé API », puis copie-la.</li><li>Colle-la ici et touche Tester.</li></ol></div>';
};

ROUTES.membres = () => {
  const list = membres();
  let h = '<div class="back"><a href="#/plus">‹ Plus</a></div><h1 class="pt">Membres</h1>';
  if (Store.DEMO) return h + empty('Les membres apparaissent une fois la base partagée branchée.');
  h += list.length ? list.map(m => '<div class="item"><span class="av">' + esc((m.nom || m.id)[0].toUpperCase()) + '</span><span class="grow"><b>' + esc(m.nom || m.id) + '</b><small>' + esc(m.id) + '</small></span>' + (Store.isAdmin() && m.id !== me() ? '<button class="mini ghost" data-act="membre-del" data-id="' + esc(m.id) + '">Retirer</button>' : '') + '</div>').join('') : empty('Aucun membre enregistré.');
  if (Store.isAdmin()) h += '<form id="membreForm" class="card form"><h3>Ajouter un membre</h3><label>Adresse e-mail<input name="email" type="email" required></label><label>Prénom affiché<input name="nom" required></label><button class="btn primary">Ajouter</button><p class="small muted">Ensuite, la personne installe l\'appli et touche « Créer mon compte » avec cette adresse.</p></form>';
  else h += '<p class="muted small">Seul l\'administrateur peut ajouter ou retirer des membres.</p>';
  return h;
};

ROUTES.stats = () => {
  const P = Store.all('personnes');
  const gagne = p => ['client', 'recurrent'].includes(p.statut);
  const by = {};
  P.forEach(p => { const k = p.origineType || ''; by[k] = by[k] || { n: 0, c: 0 }; by[k].n++; if (gagne(p)) by[k].c++; });
  let h = '<div class="back"><a href="#/plus">‹ Plus</a></div><h1 class="pt">Ce qui rapporte</h1>';
  h += sec('Origine des contacts', '<table class="tbl"><tr><th>Origine</th><th>Contacts</th><th>Clients</th></tr>' + ORIGINES.map(o => by[o[0]] ? '<tr><td>' + esc(o[0] ? o[1] : 'Non renseignée') + '</td><td>' + by[o[0]].n + '</td><td>' + by[o[0]].c + '</td></tr>' : '').join('') + '</table>');
  const evs = Store.all('evenements').map(e => ({ e, m: P.filter(p => p.origineType === 'evenement' && p.origineId === e.id) })).filter(x => x.m.length || x.e.bilan).sort((a, b) => b.m.length - a.m.length);
  h += sec('Événements', evs.length ? '<table class="tbl"><tr><th>Événement</th><th>Rencontrés</th><th>Clients</th><th>Bilan</th></tr>' + evs.map(x => '<tr><td><a href="#/evenement/' + x.e.id + '">' + esc(x.e.titre) + '</a></td><td>' + x.m.length + '</td><td>' + x.m.filter(gagne).length + '</td><td>' + ({ oui: '👍', moyen: '😐', non: '👎' }[x.e.bilan] || '') + '</td></tr>').join('') + '</table>' : empty('Rien encore : note les personnes rencontrées sur chaque événement.'));
  const reco = {};
  P.filter(p => p.origineType === 'personne' && p.origineId).forEach(p => { reco[p.origineId] = reco[p.origineId] || { n: 0, c: 0 }; reco[p.origineId].n++; if (gagne(p)) reco[p.origineId].c++; });
  Store.all('liens').filter(l => l.type === 'presente' || l.type === 'recommande').forEach(l => { reco[l.de] = reco[l.de] || { n: 0, c: 0 }; reco[l.de].n++; const v = Store.get('personnes', l.vers); if (v && gagne(v)) reco[l.de].c++; });
  const rk = Object.keys(reco).filter(k => Store.get('personnes', k)).sort((a, b) => reco[b].n - reco[a].n);
  h += sec('Tes apporteurs', rk.length ? '<table class="tbl"><tr><th>Personne</th><th>Mises en relation</th><th>Clients</th></tr>' + rk.map(k => '<tr><td>' + linkTo('personne', k) + '</td><td>' + reco[k].n + '</td><td>' + reco[k].c + '</td></tr>').join('') + '</table>' : empty('Note « Rencontré via : une personne » ou des liens « m\'a présenté·e à » pour voir qui t\'ouvre des portes.'));
  return h;
};

ROUTES.rgpd = () => {
  const list = Store.all('personnes').map(p => ({ p, d: daysSince(lastContact(p)) })).filter(x => !['client', 'recurrent'].includes(x.p.statut) && x.d >= 1035).sort((a, b) => b.d - a.d);
  return '<div class="back"><a href="#/plus">‹ Plus</a></div><h1 class="pt">RGPD</h1>' +
    '<div class="card small"><p>Pour la prospection, la CNIL recommande de ne pas garder les données d\'un prospect plus de <b>3 ans après le dernier contact</b>. L\'appli te prévient 2 mois avant.</p><p>Bonnes pratiques intégrées : pas de champ sensible (santé, opinions…), suppression qui efface vraiment le contenu, export d\'une fiche si la personne le demande (bouton en bas de chaque fiche).</p></div>' +
    sec('À supprimer ou recontacter <span class="cnt">' + list.length + '</span>', list.length ? list.map(x => '<div class="item"><a class="grow" href="#/personne/' + x.p.id + '"><b>' + esc(pName(x.p)) + '</b><small>dernier contact il y a ' + Math.floor(x.d / 30) + ' mois</small></a><button class="mini" data-act="echange-new" data-p="' + x.p.id + '">Recontacter</button><button class="mini ghost" data-act="personne-del" data-id="' + x.p.id + '">Supprimer</button></div>').join('') : empty('Rien à purger. 👍'));
};
