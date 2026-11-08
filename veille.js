/* veille.js — sources publiques (registre des entreprises, BODACC) + IA Gemini.
   Tout est appelé depuis le téléphone : pas de serveur à payer. */
(function () {
  'use strict';
  const LS = window.localStorage;

  /* ---------- Réglages IA, gardés sur ce téléphone uniquement ---------- */
  const IA = {
    key: () => LS.getItem('lsl.gemini.key') || '',
    setKey: k => LS.setItem('lsl.gemini.key', (k || '').trim()),
    modelSearch: () => LS.getItem('lsl.gemini.mSearch') || 'gemini-2.5-flash-lite',
    modelText: () => LS.getItem('lsl.gemini.mText') || 'gemini-3.1-flash-lite',
    setModels(s, t) { if (s) LS.setItem('lsl.gemini.mSearch', s.trim()); if (t) LS.setItem('lsl.gemini.mText', t.trim()); },
    count() { const d = new Date().toISOString().slice(0, 10); const o = JSON.parse(LS.getItem('lsl.gemini.count') || '{}'); return o.d === d ? o : { d, n: 0, s: 0 }; },
    bump(search) { const o = IA.count(); o.n++; if (search) o.s++; LS.setItem('lsl.gemini.count', JSON.stringify(o)); }
  };

  /* Liste des modèles accessibles avec la clé (mise en cache 1 jour) */
  async function listModels(key) {
    const c = JSON.parse(LS.getItem('lsl.gemini.models') || 'null');
    if (c && c.k === key.slice(-6) && Date.now() - c.t < 864e5) return c.m;
    let m = [];
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=' + encodeURIComponent(key));
      const j = await r.json();
      m = (j.models || []).filter(x => (x.supportedGenerationMethods || []).includes('generateContent')).map(x => x.name.replace(/^models\//, ''));
    } catch (e) { /* on garde la liste vide */ }
    LS.setItem('lsl.gemini.models', JSON.stringify({ k: key.slice(-6), t: Date.now(), m }));
    return m;
  }
  function candidates(pref, avail, search) {
    const ok = n => /flash/.test(n) && !/(image|tts|audio|live|embedding|thinking|exp)/.test(n);
    const order = search
      ? [/^gemini-2\.5-flash-lite$/, /^gemini-2\.5-flash$/, /2\.5-flash-lite/, /2\.5-flash/, /flash-lite$/, /flash$/, /flash/]
      : [/^gemini-3\.1-flash-lite$/, /flash-lite$/, /flash$/, /flash/];
    const out = [pref];
    order.forEach(re => avail.filter(n => ok(n) && re.test(n)).forEach(n => out.push(n)));
    return out.filter((n, i) => n && out.indexOf(n) === i).slice(0, 8);
  }
  async function callModel(model, key, body) {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const j = await r.json().catch(() => ({}));
    return { r, j };
  }

  async function gemini(prompt, opts) {
    opts = opts || {};
    const key = IA.key();
    if (!key) throw new Error('Pas de clé Gemini : ajoute-la dans Plus → IA.');
    const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: opts.temperature == null ? 0.3 : opts.temperature } };
    if (opts.search) body.tools = [{ google_search: {} }];
    else if (opts.json) body.generationConfig.responseMimeType = 'application/json';
    const pref = opts.search ? IA.modelSearch() : IA.modelText();
    let list = [pref], lastMsg = '', triedAll = false, searchRefused = false, quotaZero = false;
    for (let i = 0; i < list.length; i++) {
      const model = list[i];
      const { r, j } = await callModel(model, key, body);
      IA.bump(!!opts.search);
      if (r.ok) {
        if (model !== pref) { if (opts.search) IA.setModels(model, null); else IA.setModels(null, model); }
        const cand = (j.candidates || [])[0] || {};
        const text = ((cand.content || {}).parts || []).map(p => p.text || '').join('').trim();
        const sources = (((cand.groundingMetadata || {}).groundingChunks) || []).map(c => c.web).filter(Boolean).map(w => ({ uri: w.uri, title: w.title }));
        return { text, sources, model };
      }
      const msg = (j.error && j.error.message) || ('HTTP ' + r.status);
      lastMsg = msg;
      if (r.status === 429) {
        // Google renvoie 429 pour 3 raisons différentes : modèle hors offre gratuite (limit: 0), limite par minute, limite par jour
        if (/limit:\s*0\b/i.test(msg)) { quotaZero = true; }
        else if (/per ?minute|PerMinute|retry in/i.test(msg)) throw new Error('Trop de demandes en une minute (limite Google). Réessaie dans 1 minute. Détail : ' + msg.slice(0, 160));
        else throw new Error('Limite Google atteinte pour ce modèle. Détail : ' + msg.slice(0, 200));
      }
      if ((r.status === 400 || r.status === 403) && /API key|API_KEY|permission/i.test(msg) && !/model|search|tool|ground/i.test(msg)) throw new Error('Clé Gemini refusée : vérifie-la dans Plus → IA.');
      // modèle absent, retiré, ou recherche web non autorisée pour ce modèle : on essaie le suivant
      if (opts.search && /search|ground|tool/i.test(msg)) searchRefused = true;
      if (!triedAll) { triedAll = true; list = candidates(pref, await listModels(key), !!opts.search); i = Math.max(0, list.indexOf(model)); }
    }
    if (quotaZero) throw new Error('Avec ta clé gratuite, Google n\'autorise ' + (opts.search ? 'la recherche web' : 'ce service') + ' sur aucun modèle disponible (quota à 0). Il faut activer la facturation sur le projet Google AI Studio. Détail : ' + lastMsg.slice(0, 160));
    if (opts.search && searchRefused) throw new Error('La recherche web de Gemini n\'est pas accessible avec cette clé gratuite. Détail : ' + lastMsg);
    throw new Error('Aucun modèle Gemini disponible avec cette clé. Détail : ' + lastMsg);
  }
  function parseJSON(text) {
    let t = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    try { return JSON.parse(t); } catch (e) { /* on cherche le premier bloc JSON */ }
    const a = t.indexOf('['), o = t.indexOf('{');
    const start = a >= 0 && (o < 0 || a < o) ? a : o;
    if (start < 0) throw new Error('Réponse IA illisible');
    const end = Math.max(t.lastIndexOf(']'), t.lastIndexOf('}'));
    return JSON.parse(t.slice(start, end + 1));
  }

  /* ---------- Registre des entreprises (API Recherche d'entreprises, gratuite, sans clé) ---------- */
  async function rechercheEntreprises(q, perPage) {
    const r = await fetch('https://recherche-entreprises.api.gouv.fr/search?q=' + encodeURIComponent(q) + '&page=1&per_page=' + (perPage || 5));
    if (!r.ok) throw new Error('Registre des entreprises indisponible (' + r.status + ')');
    const j = await r.json();
    return (j.results || []).map(e => {
      const s = e.siege || {};
      return {
        siren: e.siren, nom: e.nom_complet || e.nom_raison_sociale || '',
        commune: s.libelle_commune || '', cp: s.code_postal || '', adresse: s.adresse || '',
        activite: e.activite_principale || s.activite_principale || '',
        activiteLib: e.libelle_activite_principale || s.libelle_activite_principale || '',
        etat: e.etat_administratif || '', effectif: e.tranche_effectif_salarie || '',
        creation: e.date_creation || '',
        dirigeants: (e.dirigeants || []).map(d => d.type_dirigeant === 'personne morale' ? { nom: d.denomination || '', qualite: d.qualite || '' } : { nom: [d.prenoms, d.nom].filter(Boolean).join(' '), prenom: (d.prenoms || '').split(' ')[0], nomFamille: d.nom || '', qualite: d.qualite || '' })
      };
    });
  }

  /* ---------- BODACC (annonces légales, API ouverte de la DILA) ---------- */
  const BODACC = 'https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records';
  async function bodacc(where, limit) {
    const u = BODACC + '?limit=' + (limit || 50) + '&order_by=dateparution%20desc&where=' + encodeURIComponent(where);
    const r = await fetch(u);
    if (!r.ok) throw new Error('BODACC indisponible (' + r.status + ')');
    const j = await r.json();
    return (j.results || []).map(normBodacc);
  }
  function deepFind(obj, key) {
    if (!obj || typeof obj !== 'object') return '';
    if (obj[key] && typeof obj[key] === 'string') return obj[key];
    for (const k in obj) { const v = deepFind(obj[k], key); if (v) return v; }
    return '';
  }
  function tryJSON(s) { if (!s) return null; if (typeof s === 'object') return s; try { return JSON.parse(s); } catch (e) { return null; } }
  function normBodacc(x) {
    const etab = tryJSON(x.listeetablissements), pers = tryJSON(x.listepersonnes), acte = tryJSON(x.acte);
    const reg = Array.isArray(x.registre) ? x.registre : (x.registre ? [x.registre] : []);
    const siren = (reg.find(r => /^\d{9}$/.test(String(r).replace(/\s/g, ''))) || '').toString().replace(/\s/g, '');
    return {
      id: x.id, date: x.dateparution, famille: x.familleavis_lib || x.familleavis || '', type: x.typeavis_lib || '',
      nom: x.commercant || deepFind(pers, 'denomination') || deepFind(pers, 'nom'), siren,
      ville: x.ville || '', cp: x.cp || '', dept: x.numerodepartement || '',
      activite: deepFind(etab, 'activite') || deepFind(acte, 'descriptif') || '',
      url: x.url_complete || ('https://www.bodacc.fr/pages/annonces-commerciales-detail/?q.id=id:' + x.id)
    };
  }
  async function bodaccSiren(siren, since) {
    return bodacc('"' + siren + '" and dateparution >= date\'' + since + '\'', 20);
  }
  async function creations(depts, since) {
    const d = depts.map(x => 'numerodepartement="' + x + '"').join(' or ');
    return bodacc('familleavis_lib="Créations" and (' + d + ') and dateparution >= date\'' + since + '\'', 100);
  }

  /* ---------- Prompts IA ---------- */
  async function evenements(cfg, connus) {
    const debut = new Date().toISOString().slice(0, 10);
    const fin = new Date(Date.now() + 56 * 864e5).toISOString().slice(0, 10);
    const prompt = [
      'Tu fais de la veille d\'événements professionnels pour Julien, consultant en stratégie de communication (La suite logique) qui cherche à rencontrer des dirigeants de PME, d\'associations et de collectivités.',
      'Zone : ' + (cfg.communes || 'Ain et Mâcon') + ', dans un rayon d\'environ ' + (cfg.rayon || 40) + ' km. Départements : ' + (cfg.depts || '01, 71') + '.',
      'Période : du ' + debut + ' au ' + fin + '.',
      'Types recherchés : ' + (cfg.themes || 'réseaux d\'entreprises, petits-déjeuners, afterworks, salons, conférences') + '.',
      'Sources à regarder en priorité : ' + (cfg.sources || []).join(', ') + '.',
      connus.length ? 'Ignore ces événements déjà connus : ' + connus.slice(0, 40).join(' | ') + '.' : '',
      'Cherche sur le web des événements réels et vérifiables. N\'invente rien : si tu n\'as pas la date exacte, ne mets pas l\'événement.',
      'Pour chacun, note la pertinence avec cette grille :',
      '- public (0 à 4) : 4 = surtout des dirigeants de PME ou décideurs locaux, 0 = grand public ;',
      '- distance (0 à 2) : 2 = moins de 20 km de Bourg-en-Bresse ou Mâcon, 1 = moins de 50 km, 0 = plus loin ;',
      '- format (0 à 2) : 2 = format propice aux échanges (networking, atelier, petit-déj), 0 = conférence sans échange ;',
      '- cout (0 à 1) : 1 = gratuit ou peu cher et moins d\'une demi-journée.',
      'Réponds UNIQUEMENT avec un tableau JSON (maximum 12 éléments), sans texte autour, au format :',
      '[{"titre":"","date":"AAAA-MM-JJ","heure":"HH:MM","lieu":"","commune":"","organisateur":"","url":"","resume":"une phrase","public":0,"distance":0,"format":0,"cout":0,"pourquoi":"une phrase"}]'
    ].filter(Boolean).join('\n');
    const r = await gemini(prompt, { search: true, temperature: 0.2 });
    let list = [];
    try { list = parseJSON(r.text); } catch (e) { throw new Error('L\'IA n\'a pas renvoyé de liste exploitable. Réessaie plus tard.'); }
    if (!Array.isArray(list)) list = [];
    const clamp = (v, m) => Math.max(0, Math.min(m, Math.round(Number(v) || 0)));
    return list.filter(e => e && e.titre && /^\d{4}-\d{2}-\d{2}$/.test(e.date || '') && e.date >= debut).map(e => ({
      titre: String(e.titre).slice(0, 160), date: e.date, heure: /^\d{1,2}:\d{2}$/.test(e.heure || '') ? e.heure : '',
      lieu: e.lieu || '', commune: e.commune || '', organisateur: e.organisateur || '', url: /^https?:\/\//.test(e.url || '') ? e.url : '',
      description: e.resume || '', pourquoi: e.pourquoi || '',
      criteres: { public: clamp(e.public, 4), distance: clamp(e.distance, 2), format: clamp(e.format, 2), cout: clamp(e.cout, 1) },
      sourcesIA: r.sources.slice(0, 5)
    }));
  }

  async function actus(nom, commune) {
    const r = await gemini('Cherche sur le web les actualités des 3 derniers mois concernant l\'organisation « ' + nom + ' »' + (commune ? ' (' + commune + ')' : '') + '. Donne au maximum 3 faits datés et vérifiables, une ligne chacun, en français, sans introduction. S\'il n\'y a rien de récent, réponds exactement : RIEN.', { search: true });
    return { texte: /^\s*RIEN\.?\s*$/i.test(r.text) ? '' : r.text, sources: r.sources };
  }

  async function miseEnForme(note, contexte) {
    const r = await gemini([
      'Voici des notes brutes (souvent dictées) prises après un échange professionnel. ' + (contexte || ''),
      'Réécris-les en compte-rendu court et clair, en français, en gardant les mots du client entre guillemets quand ils sont importants. Structure : « Contexte », « Ce qui a été dit », « Points d\'attention ». N\'invente rien.',
      'Propose aussi la prochaine action concrète et un délai en jours.',
      'Réponds en JSON : {"compte_rendu":"...","prochaine_action":"...","delai_jours":7}',
      'NOTES :', note
    ].join('\n'), { json: true });
    return parseJSON(r.text);
  }

  async function remplirRecap(notes, projet) {
    const r = await gemini([
      'À partir des notes d\'échanges ci-dessous avec un prospect, remplis la trame de récap de projet « ' + (projet || '') + ' ».',
      'Champs : besoin (ce que le client dit, avec ses mots), enjeux, decideur (qui décide), echeance (date AAAA-MM-JJ si connue, sinon vide). N\'invente rien : laisse vide ce qui n\'est pas dit.',
      'Réponds en JSON : {"besoin":"","enjeux":"","decideur":"","echeance":""}',
      'NOTES :', notes
    ].join('\n'), { json: true });
    return parseJSON(r.text);
  }

  window.Veille = { IA, gemini, listModels, parseJSON, rechercheEntreprises, bodacc, bodaccSiren, creations, evenements, actus, miseEnForme, remplirRecap };
})();
