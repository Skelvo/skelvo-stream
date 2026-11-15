/* ==========================================================================
   Skelvo Stream — outils partagés des pages éditeur.

   1) Traduction : le français est écrit directement dans le HTML. Pour une
      autre langue, il suffit d'ajouter un dictionnaire dans SK.dict (voir
      assets/lang-en.js à créer plus tard) : chaque élément qui porte
      data-i18n="clé" voit son texte remplacé. Rien à faire pour le français.

   2) Éditeur : lit le formulaire de réglages, fabrique l'URL de l'overlay à
      coller dans OBS, mémorise les réglages dans le navigateur, et prévient
      l'aperçu (iframe) à chaque changement sans le recharger.
   ========================================================================== */
(function(){
  'use strict';

  var SK = window.SK = window.SK || {};
  SK.dict = SK.dict || {};

  /* ---------- Stockage local (protégé : navigation privée, OBS…) ---------- */
  SK.store = {
    get: function(k){ try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch(e){ return null; } },
    set: function(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} },
    del: function(k){ try { localStorage.removeItem(k); } catch(e){} }
  };

  /* ---------- Traduction ---------- */
  var qs = new URLSearchParams(location.search);
  SK.lang = (qs.get('lang') || SK.store.get('sk-lang') || (navigator.language || 'fr')).slice(0, 2).toLowerCase();
  SK.t = function(key, fallback){
    var d = SK.dict[SK.lang];
    return (d && d[key]) || fallback;
  };
  SK.applyI18n = function(root){
    var d = SK.dict[SK.lang];
    if (!d) return; // français (ou langue sans dictionnaire) : le HTML fait foi
    document.documentElement.lang = SK.lang;
    (root || document).querySelectorAll('[data-i18n]').forEach(function(el){
      var v = d[el.getAttribute('data-i18n')]; if (v) el.innerHTML = v; // dictionnaires écrits par nous : le HTML (<b>, liens) est permis
    });
    (root || document).querySelectorAll('[data-i18n-ph]').forEach(function(el){
      var v = d[el.getAttribute('data-i18n-ph')]; if (v) el.placeholder = v;
    });
  };

  /* ---------- Toast ---------- */
  var toastEl, toastTimer;
  SK.toast = function(msg){
    if (!toastEl){ toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ toastEl.classList.remove('show'); }, 1800);
  };

  SK.copy = function(text){
    var done = function(){ SK.toast(SK.t('copied', 'Lien copié ! Colle-le dans OBS')); };
    if (navigator.clipboard && window.isSecureContext){
      navigator.clipboard.writeText(text).then(done, fallback);
    } else fallback();
    function fallback(){
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch(e){}
      ta.remove();
    }
  };

  /* ---------- Éditeur ---------- */
  function readForm(form){
    var p = {};
    Array.prototype.forEach.call(form.elements, function(el){
      if (!el.name || el.disabled) return;
      if (el.type === 'radio'){ if (el.checked) p[el.name] = el.value; return; }
      if (el.type === 'checkbox'){ p[el.name] = el.checked ? '1' : '0'; return; }
      if (el.type === 'color'){ p[el.name] = el.value.replace('#', '').toLowerCase(); return; }
      p[el.name] = String(el.value).trim();
    });
    return p;
  }

  function writeForm(form, p){
    Object.keys(p).forEach(function(name){
      var els = form.querySelectorAll('[name="' + name + '"]');
      els.forEach(function(el){
        var v = p[name];
        if (el.type === 'radio') el.checked = (el.value === v);
        else if (el.type === 'checkbox') el.checked = (v === '1');
        else if (el.type === 'color') { if (/^[0-9a-f]{6}$/i.test(v)) el.value = '#' + v; }
        else el.value = v;
      });
    });
  }

  function syncOutputs(form){
    form.querySelectorAll('input[type=range]').forEach(function(r){
      var out = form.querySelector('output[for="' + r.id + '"]');
      if (out) out.textContent = r.value + (out.dataset.unit || '');
    });
  }

  /**
   * opts = {
   *   form, overlay ('overlay.html'), storageKey,
   *   urlInput, copyBtn, resetBtn, openBtn,
   *   onChange(params, url)
   * }
   */
  SK.editor = function(opts){
    var form = opts.form;
    var defaults = readForm(form);
    var base = new URL(opts.overlay, location.href);

    // Réglages de départ : ceux de l'URL (lien "modifier") > ceux mémorisés > défauts
    var fromUrl = {};
    qs.forEach(function(v, k){ if (k in defaults) fromUrl[k] = v; });
    var saved = SK.store.get(opts.storageKey) || {};
    writeForm(form, Object.assign({}, defaults, saved, fromUrl));

    function buildUrl(p){
      var u = new URL(base.href);
      Object.keys(p).forEach(function(k){ u.searchParams.set(k, p[k]); });
      return u.href;
    }

    var raf;
    function update(){
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function(){
        syncOutputs(form);
        var p = readForm(form);
        var url = buildUrl(p);
        if (opts.urlInput) opts.urlInput.value = url;
        if (opts.openBtn) opts.openBtn.href = url;
        SK.store.set(opts.storageKey, p);
        if (opts.onChange) opts.onChange(p, url);
      });
    }

    form.addEventListener('input', update);
    form.addEventListener('change', update);
    form.addEventListener('submit', function(e){ e.preventDefault(); });

    if (opts.copyBtn) opts.copyBtn.addEventListener('click', function(){ SK.copy(opts.urlInput.value); });
    if (opts.urlInput) opts.urlInput.addEventListener('focus', function(){ this.select(); });
    if (opts.resetBtn) opts.resetBtn.addEventListener('click', function(){
      writeForm(form, defaults); SK.store.del(opts.storageKey); update();
    });

    update();

    var api = {
      get: function(){ return readForm(form); },
      set: function(p){ writeForm(form, p); update(); },
      update: update
    };
    SK._themeTarget = api;
    return api;
  };

  /* Envoie les réglages à un aperçu (iframe) sans le recharger */
  SK.sendToPreview = function(iframe, params){
    if (!iframe || !iframe.contentWindow) return;
    iframe.contentWindow.postMessage({ type: 'sk-params', params: params }, location.origin);
  };

  /**
   * Aperçu à la vraie taille de la source OBS, réduit pour tenir dans la page.
   * opts = { stage, canvas, buttons (NodeList avec data-w / data-h), sizeTxt, storageKey, def: {w,h}, onSize }
   */
  SK.stage = function(opts){
    var size = SK.store.get(opts.storageKey) || opts.def;
    function fit(){ opts.canvas.style.transform = 'scale(' + (opts.stage.clientWidth / size.w) + ')'; }
    function set(w, h){
      size = { w: w, h: h };
      SK.store.set(opts.storageKey, size);
      if (opts.buttons) opts.buttons.forEach(function(b){ b.setAttribute('aria-pressed', String(+b.dataset.w === w && +b.dataset.h === h)); });
      opts.stage.style.aspectRatio = w + ' / ' + h;
      opts.stage.style.maxWidth = h > w ? '400px' : '';
      opts.canvas.style.width = w + 'px'; opts.canvas.style.height = h + 'px';
      if (opts.sizeTxt) opts.sizeTxt.textContent = w + ' × ' + h;
      fit();
      if (opts.onSize) opts.onSize(size);
    }
    if (opts.buttons) opts.buttons.forEach(function(b){ b.addEventListener('click', function(){ set(+b.dataset.w, +b.dataset.h); }); });
    new ResizeObserver(fit).observe(opts.stage);
    set(size.w, size.h);
    return { size: function(){ return size; }, set: set };
  };

  /* Affiche l'état de connexion renvoyé par un overlay en aperçu */
  SK.watchStatus = function(statusEl){
    function setStatus(cls, text){ statusEl.className = 'status ' + cls; statusEl.textContent = text; }
    window.addEventListener('message', function(e){
      if (e.origin !== location.origin || !e.data || e.data.type !== 'sk-status') return;
      var ch = e.data.channel ? '#' + e.data.channel : '';
      switch (e.data.state){
        case 'demo':       setStatus('demo', SK.t('st.demo', 'Aperçu de démonstration. Clique sur l\'autre bouton, en haut à droite, pour tester en vrai.')); break;
        case 'connecting': setStatus('', SK.t('st.connecting', 'Connexion à') + ' ' + ch + '…'); break;
        case 'connected':  setStatus('ok', SK.t('st.connected', 'Connecté à') + ' ' + ch + '.'); break;
        case 'notfound':   setStatus('warn', SK.t('st.notfound', 'Pas de réponse de') + ' ' + ch + SK.t('st.notfound2', ' : vérifie le nom de la chaîne.')); break;
        case 'retry':      setStatus('warn', SK.t('st.retry', 'Connexion perdue, nouvelle tentative…')); break;
        case 'idle':       setStatus('warn', SK.t('st.idle', 'Entre le nom de ta chaîne pour tester en vrai.')); break;
        case 'nouser':     setStatus('warn', SK.t('st.nouser', 'Entre ton pseudo Last.fm pour voir ta vraie musique.')); break;
        case 'nokey':      setStatus('warn', SK.t('st.nokey', 'Il manque la clé API Last.fm.')); break;
        case 'lferror':    setStatus('warn', 'Last.fm : ' + (e.data.message || SK.t('st.lferror', 'erreur'))); break;
      }
    });
  };

  /**
   * Bouton Démo / Ma chaîne : renvoie une fonction qui ajoute demo=1|0 aux réglages de l'aperçu
   */
  SK.demoSwitch = function(buttons, onChange){
    var mode = 'demo';
    buttons.forEach(function(b){ b.addEventListener('click', function(){
      mode = b.dataset.mode;
      buttons.forEach(function(x){ x.setAttribute('aria-pressed', String(x === b)); });
      onChange();
    }); });
    return function(p){ return Object.assign({}, p, { demo: mode === 'demo' ? '1' : '0' }); };
  };

  /**
   * Raccourci pour un éditeur d'overlay classique : formulaire + aperçu iframe + lien.
   * opts = SK.editor(opts) + { iframe, previewParams(p) }
   */
  SK.overlayEditor = function(opts){
    var iframe = opts.iframe, latest = null, ed;
    var userChange = opts.onChange;
    opts.onChange = function(p, url){
      latest = opts.previewParams ? opts.previewParams(p) : p;
      if (!iframe.src){
        var u = new URL(url); Object.keys(latest).forEach(function(k){ u.searchParams.set(k, latest[k]); });
        iframe.src = u.href;
      } else SK.sendToPreview(iframe, latest);
      if (userChange) userChange(p, url);
    };
    iframe.addEventListener('load', function(){ if (latest) SK.sendToPreview(iframe, latest); });
    ed = SK.editor(opts);
    return ed;
  };

  /* ======================================================================
     Thèmes : mêmes réglages pour tous les overlays (voir SKO.theme).
     Un élément <div data-theme-panel="minimal"></div> placé DANS le formulaire
     est remplacé par le panneau complet avant que l'éditeur lise ses défauts.
     ====================================================================== */
  SK.FONTS = [
    ['inter', 'Inter'], ['manrope', 'Manrope'], ['sora', 'Sora'], ['outfit', 'Outfit'], ['jakarta', 'Plus Jakarta Sans'], ['dmsans', 'DM Sans'],
    ['grotesk', 'Space Grotesk'], ['syne', 'Syne'], ['unbounded', 'Unbounded'], ['archivo', 'Archivo'], ['montserrat', 'Montserrat'], ['poppins', 'Poppins'],
    ['rubik', 'Rubik'], ['nunito', 'Nunito'], ['fredoka', 'Fredoka'], ['bebas', 'Bebas Neue'], ['oswald', 'Oswald'], ['anton', 'Anton'],
    ['playfair', 'Playfair Display'], ['cormorant', 'Cormorant Garamond'], ['dmserif', 'DM Serif Display'], ['jetbrains', 'JetBrains Mono'],
    ['pixel', 'VT323'], ['press', 'Press Start 2P'], ['marker', 'Permanent Marker'], ['caveat', 'Caveat'], ['system', 'Police du système']
  ];
  var T = function(name, label, v){ return { name: name, label: label, v: v }; };
  SK.THEMES = [
    T('minimal', 'Minimal',  { font: 'inter', fw: '700', tx: 'ffffff', ac: 'a78bfa', ac2: '67e8f9', sk: 'solid', sf: '0b0b10', so: '78', rad: '40', bw: '1', bc: 'ffffff', bo: '12', sh: '35', shs: 'soft', gl: '0', up: '0' }),
    T('verre',   'Verre',    { font: 'manrope', fw: '700', tx: 'ffffff', ac: 'ffffff', ac2: 'c4b5fd', sk: 'glass', sf: '1a1a24', so: '40', rad: '60', bw: '1', bc: 'ffffff', bo: '22', sh: '30', shs: 'soft', gl: '0', up: '0' }),
    T('clair',   'Clair',    { font: 'jakarta', fw: '800', tx: '16161d', ac: '6d5efc', ac2: 'ff7a59', sk: 'solid', sf: 'ffffff', so: '96', rad: '45', bw: '0', bc: '000000', bo: '8', sh: '30', shs: 'soft', gl: '0', up: '0' }),
    T('nuit',    'Nuit',     { font: 'sora', fw: '700', tx: 'eef0ff', ac: '8b9bff', ac2: 'c3a6ff', sk: 'gradient', sf: '0d1020', so: '88', rad: '35', bw: '1', bc: '8b9bff', bo: '25', sh: '40', shs: 'soft', gl: '12', up: '0' }),
    T('neon',    'Néon',     { font: 'outfit', fw: '700', tx: 'ffffff', ac: '22d3ee', ac2: 'e879f9', sk: 'outline', sf: '05060a', so: '70', rad: '30', bw: '2', bc: '22d3ee', bo: '100', sh: '0', shs: 'soft', gl: '45', up: '0' }),
    T('pastel',  'Pastel',   { font: 'fredoka', fw: '600', tx: '3f2d56', ac: 'b18cff', ac2: 'ff9fbd', sk: 'solid', sf: 'fff7fb', so: '95', rad: '90', bw: '0', bc: 'ffffff', bo: '0', sh: '22', shs: 'soft', gl: '0', up: '0' }),
    T('luxe',    'Luxe',     { font: 'cormorant', fw: '700', tx: 'f5ecd7', ac: 'd8b46a', ac2: 'a07c3a', sk: 'solid', sf: '0a0907', so: '90', rad: '6', bw: '1', bc: 'd8b46a', bo: '45', sh: '40', shs: 'soft', gl: '0', up: '1' }),
    T('retro',   'Rétro',    { font: 'press', fw: '400', tx: 'ffffff', ac: 'ffd23f', ac2: 'ff5d73', sk: 'solid', sf: '241a4a', so: '96', rad: '0', bw: '3', bc: '000000', bo: '100', sh: '100', shs: 'hard', gl: '0', up: '0' }),
    T('mono',    'Mono',     { font: 'jetbrains', fw: '600', tx: 'ffffff', ac: 'ffffff', ac2: '8a8a8a', sk: 'solid', sf: '000000', so: '88', rad: '0', bw: '1', bc: 'ffffff', bo: '22', sh: '0', shs: 'soft', gl: '0', up: '1' }),
    T('gaming',  'Gaming',   { font: 'unbounded', fw: '700', tx: 'ffffff', ac: 'b6ff3b', ac2: '3bffd0', sk: 'solid', sf: '0c0d0c', so: '90', rad: '18', bw: '0', bc: 'ffffff', bo: '0', sh: '40', shs: 'soft', gl: '10', up: '1' }),
    T('couleur', 'Couleur',  { font: 'poppins', fw: '700', tx: 'ffffff', ac: 'ff6b6b', ac2: 'ff9f5a', sk: 'accent', sf: '000000', so: '0', rad: '50', bw: '0', bc: 'ffffff', bo: '0', sh: '35', shs: 'soft', gl: '0', up: '0' }),
    T('brut',    'Sans fond',{ font: 'inter', fw: '800', tx: 'ffffff', ac: 'a78bfa', ac2: '67e8f9', sk: 'none', sf: '000000', so: '0', rad: '0', bw: '0', bc: 'ffffff', bo: '0', sh: '0', shs: 'soft', gl: '0', up: '0' })
  ];
  var FONT_URL = 'https://fonts.googleapis.com/css2?family=Inter:wght@700&family=Manrope:wght@700&family=Plus+Jakarta+Sans:wght@800&family=Sora:wght@700&family=Outfit:wght@700&family=Fredoka:wght@600&family=Cormorant+Garamond:wght@700&family=Press+Start+2P&family=JetBrains+Mono:wght@600&family=Unbounded:wght@700&family=Poppins:wght@700&display=swap';

  function hexA(h, a){ var n = parseInt(h, 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }
  function famOf(key){ var f = SK.FONTS.filter(function(x){ return x[0] === key; })[0]; return f ? "'" + f[1] + "'" : 'system-ui'; }
  function swatch(t){
    var v = t.v, d = document.createElement('span'); d.className = 'th-sw';
    var bg = v.sk === 'accent' ? 'linear-gradient(135deg,#' + v.ac + ',#' + v.ac2 + ')' : v.sk === 'none' ? 'transparent' : v.sk === 'outline' ? 'transparent' : hexA(v.sf, Math.max(.35, v.so / 100));
    d.style.background = (v.sk === 'glass' ? 'linear-gradient(160deg, rgba(255,255,255,.18), rgba(255,255,255,.03)),' : '') + bg;
    d.style.border = (v.sk === 'outline' ? '2px solid #' + v.ac : v.bw + 'px solid ' + hexA(v.bc, v.bo / 100));
    d.style.borderRadius = Math.min(14, v.rad / 100 * 18) + 'px';
    d.style.boxShadow = (v.shs === 'hard' ? '3px 3px 0 #000' : '') + (+v.gl ? (v.shs === 'hard' ? ',' : '') + '0 0 10px #' + v.ac : '');
    d.style.color = '#' + v.tx; d.style.fontFamily = famOf(v.font); d.style.fontWeight = v.fw;
    d.style.textShadow = v.sk === 'none' ? '0 0 3px #000' : '';
    var a = document.createElement('b'); a.textContent = v.font === 'press' ? 'Aa' : 'Aa'; a.style.textTransform = v.up === '1' ? 'uppercase' : 'none';
    var i = document.createElement('i'); i.style.background = 'linear-gradient(90deg,#' + v.ac + ',#' + v.ac2 + ')';
    d.appendChild(a); d.appendChild(i);
    return d;
  }

  SK.buildThemePanel = function(holder){
    var def = SK.THEMES.filter(function(t){ return t.name === (holder.getAttribute('data-theme-panel') || 'minimal'); })[0] || SK.THEMES[0];
    var v = def.v;
    if (!document.getElementById('sk-theme-fonts')){
      var l = document.createElement('link'); l.id = 'sk-theme-fonts'; l.rel = 'stylesheet'; l.href = FONT_URL; document.head.appendChild(l);
    }
    function opt(list, sel){ return list.map(function(o){ return '<option value="' + o[0] + '"' + (o[0] === sel ? ' selected' : '') + '>' + o[1] + '</option>'; }).join(''); }
    function range(name, label, min, max, val, unit, step){
      return '<label class="field"><span><span>' + label + '</span><output for="th-' + name + '" data-unit="' + (unit || '') + '"></output></span>' +
        '<input type="range" id="th-' + name + '" name="' + name + '" min="' + min + '" max="' + max + '" value="' + val + '"' + (step ? ' step="' + step + '"' : '') + '></label>';
    }
    function color(name, label){ return '<label class="color"><input type="color" name="' + name + '" value="#' + v[name] + '"><span>' + label + '</span></label>'; }
    var fs = document.createElement('fieldset');
    fs.className = 'theme-panel';
    fs.innerHTML =
      '<legend>Thème</legend>' +
      '<div class="themes"></div>' +
      '<details class="more"><summary>Tout personnaliser</summary>' +
        '<div class="more-body">' +
        '<p class="sub-legend">Texte</p>' +
        '<label class="field"><span>Police</span><select name="font">' + opt(SK.FONTS, v.font) + '</select></label>' +
        '<label class="field"><span>Ou n\'importe quelle police Google Fonts</span><input type="text" name="cf" maxlength="40" placeholder="ex. Lexend, Bricolage Grotesque…" spellcheck="false"><small>Tape son nom exact, il remplace la police choisie au-dessus.</small></label>' +
        '<label class="field"><span>Épaisseur</span><select name="fw">' + opt([['400', 'Normale'], ['500', 'Moyenne'], ['600', 'Semi-grasse'], ['700', 'Grasse'], ['800', 'Très grasse'], ['900', 'Noire']], v.fw) + '</select></label>' +
        '<label class="check"><input type="checkbox" name="up"' + (v.up === '1' ? ' checked' : '') + '><span>Titres en MAJUSCULES</span></label>' +
        '<p class="sub-legend">Couleurs</p>' +
        '<div class="field colors">' + color('tx', 'Texte') + color('ac', 'Accent') + color('ac2', 'Accent 2') + '</div>' +
        '<p class="sub-legend">Fond</p>' +
        '<label class="field"><span>Type de fond</span><select name="sk">' + opt([['solid', 'Plein'], ['glass', 'Verre dépoli'], ['gradient', 'Dégradé discret'], ['accent', 'Couleur d\'accent'], ['outline', 'Contour seul'], ['none', 'Aucun (texte détouré)']], v.sk) + '</select></label>' +
        '<div class="field colors">' + color('sf', 'Fond') + '</div>' +
        range('so', 'Opacité du fond', 0, 100, v.so, ' %') +
        '<p class="sub-legend">Forme</p>' +
        range('rad', 'Arrondi', 0, 100, v.rad, ' %') +
        range('bw', 'Épaisseur de la bordure', 0, 6, v.bw, ' px') +
        '<div class="field colors">' + color('bc', 'Bordure') + '</div>' +
        range('bo', 'Opacité de la bordure', 0, 100, v.bo, ' %') +
        '<p class="sub-legend">Effets</p>' +
        range('sh', 'Ombre', 0, 100, v.sh, ' %') +
        '<label class="field"><span>Type d\'ombre</span><select name="shs">' + opt([['soft', 'Douce'], ['hard', 'Décalée (style BD)']], v.shs) + '</select></label>' +
        range('gl', 'Lueur de la couleur d\'accent', 0, 100, v.gl, ' %') +
        '</div>' +
      '</details>';
    var grid = fs.querySelector('.themes');
    SK.THEMES.forEach(function(t){
      var b = document.createElement('button'); b.type = 'button'; b.className = 'th'; b.dataset.theme = t.name;
      b.appendChild(swatch(t));
      var s = document.createElement('span'); s.textContent = t.label; b.appendChild(s);
      b.addEventListener('click', function(){
        var form = holder.closest ? fs.closest('form') : null;
        var vals = Object.assign({ cf: '' }, t.v);
        if (SK._themeTarget) SK._themeTarget.set(vals);
        grid.querySelectorAll('.th').forEach(function(x){ x.classList.toggle('on', x === b); });
      });
      grid.appendChild(b);
    });
    holder.replaceWith(fs);
  };
  document.querySelectorAll('[data-theme-panel]').forEach(SK.buildThemePanel);

  document.addEventListener('DOMContentLoaded', function(){ SK.applyI18n(); });
})();
