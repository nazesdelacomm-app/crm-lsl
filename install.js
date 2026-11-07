/* install.js — bouton « Installer l'appli » affiché en haut de l'écran tant que l'appli n'est pas installée. */
(function () {
  'use strict';
  var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (standalone || localStorage.getItem('lsl.installHidden') === '1') return;
  var deferred = null;
  var ua = navigator.userAgent;
  var ios = /iPhone|iPad|iPod/i.test(ua);

  var bar = document.createElement('div');
  bar.id = 'installBar';
  bar.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 14px;background:#e0673a;color:#fff;font:600 15px/1.3 system-ui,sans-serif';
  bar.innerHTML = '<span style="font-size:22px">📲</span><span id="installTxt" style="flex:1"></span>' +
    '<button id="installBtn" style="border:0;border-radius:10px;padding:9px 14px;background:#fff;color:#1f2a44;font:700 15px system-ui,sans-serif">Installer</button>' +
    '<button id="installClose" aria-label="Masquer" style="border:0;background:none;color:#fff;font-size:20px;padding:4px 6px">✕</button>';

  function help() {
    var t = document.getElementById('installTxt');
    var b = document.getElementById('installBtn');
    if (!t || !b) return;
    if (deferred) { t.textContent = 'Installe l\'appli sur ton téléphone'; b.style.display = ''; b.textContent = 'Installer'; return; }
    b.style.display = '';
    b.textContent = 'Comment ?';
    t.textContent = 'Ajoute l\'appli à ton écran d\'accueil';
  }
  function steps() {
    var msg = ios
      ? 'Sur iPhone : ouvre ce lien dans Safari, touche le bouton Partager (carré avec une flèche), puis « Sur l\'écran d\'accueil ».'
      : 'Touche le menu ⋮ de Chrome (en haut à droite), puis « Ajouter à l\'écran d\'accueil » ou « Installer l\'application ».';
    alertBox(msg);
  }
  function alertBox(msg) {
    var o = document.createElement('div');
    o.style.cssText = 'position:fixed;inset:0;z-index:70;background:rgba(20,24,36,.5);display:flex;align-items:flex-end';
    o.innerHTML = '<div style="background:#fff;color:#1f2a44;width:100%;border-radius:18px 18px 0 0;padding:20px 18px 28px;font:16px/1.5 system-ui,sans-serif">' +
      '<b style="font-size:18px">Installer l\'appli</b><p>' + msg + '</p><button style="width:100%;border:0;border-radius:12px;padding:12px;background:#1f2a44;color:#fff;font:700 16px system-ui,sans-serif">OK</button></div>';
    o.addEventListener('click', function () { o.remove(); });
    document.body.appendChild(o);
  }

  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; if (document.getElementById('installTxt')) help(); });
  window.addEventListener('appinstalled', function () { bar.remove(); });

  function mount() {
    document.body.insertBefore(bar, document.body.firstChild);
    help();
    document.getElementById('installBtn').addEventListener('click', function () {
      if (!deferred) { steps(); return; }
      deferred.prompt();
      deferred.userChoice.then(function (c) { if (c.outcome === 'accepted') bar.remove(); deferred = null; help(); });
    });
    document.getElementById('installClose').addEventListener('click', function () { localStorage.setItem('lsl.installHidden', '1'); bar.remove(); });
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
