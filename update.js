/* update.js — vérifie s'il existe une nouvelle version en ligne et propose de mettre à jour. */
(function () {
  'use strict';
  let shown = false;
  async function check() {
    if (shown || !navigator.onLine) return;
    try {
      const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      if (j.version && j.version !== VERSION) show(j.version, j.notes);
    } catch (e) { /* hors ligne : on réessaiera */ }
  }
  function show(v, notes) {
    shown = true;
    const b = document.createElement('div');
    b.id = 'updateBar';
    b.innerHTML = '<span class="grow"><b>Nouvelle version ' + esc(v) + '</b>' + (notes ? '<small>' + esc(notes) + '</small>' : '<small>Touche pour l\'installer.</small>') + '</span><button type="button">Mettre à jour</button>';
    b.querySelector('button').addEventListener('click', () => apply(v));
    document.body.appendChild(b);
  }
  async function apply(v) {
    const btn = document.querySelector('#updateBar button'); if (btn) { btn.disabled = true; btn.textContent = '…'; }
    try { if (window.caches) { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); } } catch (e) { /* rien */ }
    try { if (navigator.serviceWorker) { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r => r.unregister())); } } catch (e) { /* rien */ }
    location.replace(location.pathname + '?v=' + encodeURIComponent(v) + location.hash);
  }
  window.addEventListener('load', () => setTimeout(check, 1500));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  setInterval(check, 30 * 60 * 1000);
})();
