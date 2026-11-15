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
  /* Identifiant de l'appli Twitch de Skelvo Stream (dev.twitch.tv), pour « Se connecter avec Twitch » */
  SK.TWITCH_CLIENT_ID = '';
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
    (SK._imgShow || []).forEach(function(f){ f(); });

    function buildUrl(p){
      var u = new URL(base.href);
      Object.keys(p).forEach(function(k){ u.searchParams.set(k, p[k]); });
      // Outils qui profitent des connexions (page connexion/) : on ajoute les jetons au lien OBS
      if (opts.auth){
        var tw = SK.store.get('sk-twitch'), se = SK.store.get('sk-se-jwt');
        if (tw && tw.token) u.searchParams.set('tk', tw.token);
        if (se) u.searchParams.set('se', se);
      }
      return u.href;
    }

    // Pendant qu'on fait glisser un curseur, l'aperçu est mis à jour au plus
    // ~12 fois par seconde (assez pour être fluide, sans surcharger un téléphone).
    // Le lien OBS et la sauvegarde se font quand on relâche (ou 300 ms après).
    var raf, last = 0, pending = null, saveTimer = null, lastP = null, lastUrl = '';
    function apply(){
      pending = null; last = Date.now();
      syncOutputs(form);
      lastP = readForm(form); lastUrl = buildUrl(lastP);
      if (opts.onChange) opts.onChange(lastP, lastUrl);
      clearTimeout(saveTimer); saveTimer = setTimeout(save, 300);
    }
    function save(){
      if (!lastP) return;
      if (opts.urlInput) opts.urlInput.value = lastUrl;
      if (opts.openBtn) opts.openBtn.href = lastUrl;
      SK.store.set(opts.storageKey, lastP);
    }
    function update(e){
      var dragging = e && e.type === 'input' && e.target && e.target.type === 'range';
      if (!dragging){ cancelAnimationFrame(raf); clearTimeout(pending); raf = requestAnimationFrame(function(){ apply(); save(); }); return; }
      syncOutputs(form); // le chiffre à côté du curseur suit tout de suite
      var wait = 80 - (Date.now() - last);
      if (wait <= 0){ cancelAnimationFrame(raf); raf = requestAnimationFrame(apply); }
      else if (!pending) pending = setTimeout(function(){ raf = requestAnimationFrame(apply); }, wait);
    }

    form.addEventListener('input', update);
    form.addEventListener('change', function(){ update(); });
    form.addEventListener('submit', function(e){ e.preventDefault(); });

    if (opts.copyBtn) opts.copyBtn.addEventListener('click', function(){ SK.copy(opts.urlInput.value); });
    if (opts.urlInput) opts.urlInput.addEventListener('focus', function(){ this.select(); });
    if (opts.resetBtn) opts.resetBtn.addEventListener('click', function(){
      writeForm(form, defaults); SK.store.del(opts.storageKey); update();
    });

    update();

    var api = {
      get: function(){ return readForm(form); },
      set: function(p){ writeForm(form, p); (SK._imgShow || []).forEach(function(f){ f(); }); update(); },
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
    function fit(){
      var w = opts.stage.clientWidth;
      // hauteur explicite : Safari peut ignorer aspect-ratio
      opts.stage.style.height = Math.round(w * size.h / size.w) + 'px';
      opts.canvas.style.transform = 'scale(' + (w / size.w) + ')';
    }
    function set(w, h){
      size = { w: w, h: h };
      SK.store.set(opts.storageKey, size);
      if (opts.buttons) opts.buttons.forEach(function(b){ b.setAttribute('aria-pressed', String(+b.dataset.w === w && +b.dataset.h === h)); });
      opts.stage.style.aspectRatio = w + ' / ' + h;
      opts.stage.style.setProperty('--ar', String(w / h));
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

  /* ---------- Packs assortis (assets/packs.js) ---------- */
  var BG_ROOT = new URL('bg/', (document.currentScript && document.currentScript.src) || location.href);
  SK.packImage = function(id, mini){ return new URL(id + (mini ? '-mini' : '') + '.webp', BG_ROOT).href; };
  SK.buildPackGrid = function(onPick){
    var grid = document.createElement('div'); grid.className = 'packs';
    (window.SK_PACKS || []).forEach(function(pk){
      var b = document.createElement('button'); b.type = 'button'; b.className = 'pack'; b.dataset.pack = pk.id;
      b.style.backgroundImage = 'url("' + SK.packImage(pk.id, true) + '")';
      var dots = document.createElement('span'); dots.className = 'pack-dots';
      pk.c.forEach(function(c){ var i = document.createElement('i'); i.style.background = '#' + c; dots.appendChild(i); });
      var l = document.createElement('span'); l.className = 'pack-name'; l.textContent = pk.label;
      if (pk.light) b.classList.add('light');
      b.appendChild(dots); b.appendChild(l);
      b.addEventListener('click', function(){
        grid.querySelectorAll('.pack').forEach(function(x){ x.classList.toggle('on', x === b); });
        onPick(pk);
      });
      grid.appendChild(b);
    });
    return grid;
  };
  // Valeurs qu'un pack donne à n'importe quel éditeur (les champs absents sont ignorés)
  SK.packValues = function(pk){
    return Object.assign({ cf: '' }, pk.t, { lfont: pk.t.font, c1: pk.c[0], c2: pk.c[1], c3: pk.c[2], bgpack: pk.id, pdim: pk.light ? '0' : '25', bgimg: '', bgvid: '' });
  };
  // <div data-pack-picker></div> : sélecteur seul (ex. contour caméra, sans panneau Thème)
  function buildPackPicker(holder){
    var wrap = document.createElement('div'); wrap.className = 'field';
    wrap.appendChild(SK.buildPackGrid(function(pk){ if (SK._themeTarget) SK._themeTarget.set(SK.packValues(pk)); }));
    holder.replaceWith(wrap);
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
      '<p class="sub-legend">Packs assortis</p><p class="hint">Tout va ensemble : le thème de tes overlays, les couleurs de ton contour caméra et le fond de tes écrans, sous le même nom.</p>' +
      '<div class="packs-holder"></div>' +
      '<p class="sub-legend">Ou un thème seul</p>' +
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
    fs.querySelector('.packs-holder').replaceWith(SK.buildPackGrid(function(pk){
      if (SK._themeTarget) SK._themeTarget.set(SK.packValues(pk));
      fs.querySelectorAll('.th').forEach(function(x){ x.classList.remove('on'); });
    }));
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
  document.querySelectorAll('[data-pack-picker]').forEach(buildPackPicker);

  /* ======================================================================
     Champs d'image : <input type="text" name="img" data-image="256">
     Ajoute un bouton « Importer » : l'image est réduite (data-image = taille
     max en px), compressée en WebP et intégrée directement au lien de l'overlay.
     Un lien OBS doit rester court : au-delà d'environ 24 Ko, on demande un lien.
     ====================================================================== */
  var MAX_INLINE = 24000;
  SK.enhanceImageField = function(input){
    var max = +input.getAttribute('data-image') || 256;
    var wrap = document.createElement('div'); wrap.className = 'img-row';
    input.parentNode.insertBefore(wrap, input); wrap.appendChild(input);
    var file = document.createElement('input'); file.type = 'file'; file.accept = 'image/*'; file.hidden = true;
    var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn ghost small'; btn.textContent = 'Importer';
    var clear = document.createElement('button'); clear.type = 'button'; clear.className = 'btn ghost small'; clear.textContent = '✕'; clear.title = 'Retirer l\'image';
    var prev = document.createElement('img'); prev.className = 'img-prev'; prev.alt = '';
    wrap.appendChild(prev); wrap.appendChild(btn); wrap.appendChild(clear); wrap.appendChild(file);
    function show(){ var v = input.value.trim(); prev.style.display = v ? '' : 'none'; if (v) prev.src = v; clear.style.display = v ? '' : 'none';
      input.style.display = /^data:/.test(v) ? 'none' : ''; if (/^data:/.test(v)) prev.title = 'Image importée (' + Math.round(v.length / 1000) + ' Ko dans le lien)'; }
    function set(v){ input.value = v; input.dispatchEvent(new Event('input', { bubbles: true })); show(); }
    btn.addEventListener('click', function(){ file.click(); });
    clear.addEventListener('click', function(){ set(''); });
    input.addEventListener('input', show);
    file.addEventListener('change', function(){
      var f = file.files[0]; file.value = ''; if (!f) return;
      var reader = new FileReader();
      reader.onload = function(){
        // GIF animé : gardé tel quel s'il est assez léger, sinon il faut un lien
        if (f.type === 'image/gif'){
          if (reader.result.length <= MAX_INLINE) return set(reader.result);
          return SK.toast('GIF trop lourd pour être intégré : héberge-le (ex. imgur.com) et colle son lien');
        }
        var img = new Image();
        img.onload = function(){
          var sc = Math.min(1, max / Math.max(img.width, img.height));
          var c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
          var x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, c.width, c.height);
          var q = .9, out = c.toDataURL('image/webp', q);
          while (out.length > MAX_INLINE && q > .35){ q -= .1; out = c.toDataURL('image/webp', q); }
          while (out.length > MAX_INLINE && c.width > 48){
            var n = document.createElement('canvas'); n.width = Math.round(c.width * .8); n.height = Math.round(c.height * .8);
            n.getContext('2d').drawImage(c, 0, 0, n.width, n.height); c = n; out = c.toDataURL('image/webp', .7);
          }
          if (out.length > MAX_INLINE) return SK.toast('Image trop lourde : héberge-la et colle son lien');
          set(out);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(f);
    });
    show();
    SK._imgShow = SK._imgShow || []; SK._imgShow.push(show);
  };
  document.querySelectorAll('input[data-image]').forEach(SK.enhanceImageField);


  /* ======================================================================
     Version (comme sur Tribune) : version.txt, à la racine du site, porte le
     même numéro que SK.VERSION. Une page restée ouverte voit qu'une mise à jour
     est sortie et propose de rafraîchir avec un bandeau en haut.
     À chaque mise en ligne : changer les deux numéros ensemble.
     ====================================================================== */
  SK.VERSION = '2.6';
  var ROOT = new URL('../', (document.currentScript && document.currentScript.src) || location.href);
  function showInstalled(){
    var last = SK.store.get('sk-version');
    if (last && last !== SK.VERSION) setTimeout(function(){ SK.toast('Mise à jour installée : version ' + SK.VERSION); }, 600);
    SK.store.set('sk-version', SK.VERSION);
    var foot = document.querySelector('.foot .wrap');
    if (foot && !foot.querySelector('.ver')){ var v = document.createElement('span'); v.className = 'ver'; v.textContent = 'v' + SK.VERSION; foot.appendChild(v); }
  }
  // Toutes les pages du site : à chaque mise à jour, on force leur téléchargement
  // pour qu'aucune ne reste sur une ancienne copie (GitHub Pages les garde 10 min).
  var PAGES = ['', 'kit/', 'debuter/', 'connexion/', 'cadre/', 'tchat/', 'alertes/', 'emotes/', 'ecrans/', 'musique/', 'sous-titres/', 'compteur/', 'sondage/',
    'minuteur/', 'objectif/', 'giveaway/', 'derniers/', 'jeux/', 'horloge/', 'voix/', 'images/', 'transitions/', 'epingle/', 'classement/', 'bingo/', 'sons/'];
  function refreshAll(){
    var jobs = PAGES.map(function(u){ return fetch(new URL(u, ROOT).href, { cache: 'reload' }).catch(function(){}); });
    return Promise.race([Promise.all(jobs), new Promise(function(r){ setTimeout(r, 5000); })]);
  }
  function reloadFresh(){
    var u = new URL(location.href); u.searchParams.set('upd', Date.now());
    location.replace(u.href);
  }
  function ssGet(k){ try { return sessionStorage.getItem(k); } catch(e){ return null; } }
  function ssSet(k, v){ try { sessionStorage.setItem(k, v); } catch(e){} }
  var firstCheck = true;
  function checkUpdate(){
    var isFirst = firstCheck; firstCheck = false;
    fetch(new URL('version.txt?t=' + Date.now(), ROOT).href, { cache: 'no-store' }).then(function(r){ return r.ok ? r.text() : ''; }).then(function(v){
      v = String(v || '').trim();
      if (!/^\d+\.\d{1,3}$/.test(v) || v === SK.VERSION || document.querySelector('.upd')) return;
      // Page ouverte depuis une ancienne copie (relance de l'appli, retour au menu) :
      // on met tout à jour sans rien demander, une seule fois par version.
      if (isFirst && ssGet('sk-autoupd') !== v){
        ssSet('sk-autoupd', v);
        document.documentElement.style.opacity = '.4';
        refreshAll().then(reloadFresh);
        return;
      }
      var b = document.createElement('button'); b.type = 'button'; b.className = 'upd';
      var t = document.createElement('span'); t.textContent = 'Version ' + v + ' disponible';
      var go = document.createElement('b'); go.textContent = 'Rafraîchir';
      b.appendChild(t); b.appendChild(go);
      b.addEventListener('click', function(){
        b.disabled = true; t.textContent = 'Mise à jour…'; go.remove();
        ssSet('sk-autoupd', v);
        refreshAll().then(reloadFresh);
      });
      document.body.appendChild(b);
      requestAnimationFrame(function(){ b.classList.add('on'); });
    }).catch(function(){});
  }
  if (/[?&]upd=/.test(location.search)){ var cu = new URL(location.href); cu.searchParams.delete('upd'); history.replaceState(null, '', cu.pathname + cu.search + cu.hash); }
  showInstalled();
  checkUpdate();
  document.addEventListener('visibilitychange', function(){ if (!document.hidden) checkUpdate(); });
  setInterval(checkUpdate, 5 * 60 * 1000);

  /* Encart d'état des connexions : <div data-auth-box></div> */
  SK.authBox = function(holder){
    var tw = SK.store.get('sk-twitch'), se = SK.store.get('sk-se-jwt');
    var d = document.createElement('div'); d.className = 'tip auth-box';
    var on = [];
    if (tw && tw.token) on.push('Twitch (' + tw.login + ')');
    if (se) on.push('StreamElements');
    d.innerHTML = on.length
      ? '✅ Connecté : <b></b>. Les follows, les points de chaîne' + (se ? ' et les dons' : '') + ' sont inclus dans ce lien. <a href="../connexion/">Gérer</a>'
      : '🔌 Les follows, toutes les récompenses de points de chaîne et les dons StreamElements demandent une connexion. <a href="../connexion/">Connecter ma chaîne</a>';
    if (on.length) d.querySelector('b').textContent = on.join(' et ');
    holder.replaceWith(d);
  };
  document.querySelectorAll('[data-auth-box]').forEach(SK.authBox);

  /* ======================================================================
     Étapes : chaque bloc de réglages (fieldset avec un titre) devient une étape.
     Une seule étape ouverte à la fois, « Suivant » / « Précédent », et une barre
     d'étapes cliquable collée sous l'aperçu, qui reste toujours visible
     (en haut de l'écran sur téléphone, à droite sur ordinateur).
     La dernière étape contient le lien à copier dans OBS.
     ====================================================================== */
  function stepSummary(fs){
    if (fs.classList.contains('theme-panel') || fs.querySelector('.packs')){
      var pk = fs.querySelector('.pack.on .pack-name'); if (pk) return 'Pack ' + pk.textContent;
      var on = fs.querySelector('.th.on span'); if (on) return on.textContent;
    }
    var r = fs.querySelector('input[type=radio]:checked');
    if (r){ var l = fs.querySelector('label[for="' + r.id + '"]'); if (l) return (l.querySelector('span:last-child') || l).textContent.trim(); }
    var sel = fs.querySelector('select');
    if (sel && sel.selectedOptions[0]) return sel.selectedOptions[0].textContent.trim();
    var t = fs.querySelector('input[type=text]:not([readonly])');
    if (t && t.value && !/^data:/.test(t.value)) return t.value;
    return '';
  }
  SK.makeSteps = function(box){
    var settings = box.querySelector(':scope > .settings'); if (!settings || settings.dataset.steps) return;
    settings.dataset.steps = '1';
    var preview = box.querySelector(':scope > .preview-col') || box.querySelector(':scope > .panel.pad');
    var stageHolder = preview && (preview.querySelector('.stage') || preview.matches('.panel.pad')) ? preview : null;

    // Blocs supplémentaires marqués data-step (ex. le micro des sous-titres) : en premier
    var extra = preview ? Array.prototype.slice.call(preview.querySelectorAll(':scope > [data-step]')) : [];
    extra.reverse().forEach(function(el){
      var fs = document.createElement('fieldset'); fs.className = 'step-extra';
      var lg = document.createElement('legend'); lg.textContent = el.getAttribute('data-step'); fs.appendChild(lg);
      el.classList.remove('panel'); fs.appendChild(el);
      settings.insertBefore(fs, settings.firstChild);
    });

    var all = Array.prototype.slice.call(settings.querySelectorAll(':scope > fieldset'));
    var resetFs = all.filter(function(f){ return !f.querySelector(':scope > legend'); });
    var steps = all.filter(function(f){ return f.querySelector(':scope > legend'); });

    // Dernière étape : le lien OBS (ou le mode d'emploi)
    var out = preview && preview.querySelector(':scope > .panel.output');
    if (out){
      var fin = document.createElement('fieldset'); fin.className = 'step-final';
      var lg2 = document.createElement('legend'); var h2 = out.querySelector('h2');
      lg2.textContent = h2 ? h2.textContent : 'Terminé'; if (h2) h2.remove();
      fin.appendChild(lg2); out.classList.remove('panel'); fin.appendChild(out);
      settings.appendChild(fin); steps.push(fin);
    }
    resetFs.forEach(function(f){ (steps[steps.length - 1] || settings).appendChild(f); f.classList.add('step-reset'); });
    if (steps.length < 2) return;

    // Barre d'étapes
    var nav = document.createElement('nav'); nav.className = 'steps-nav'; nav.setAttribute('aria-label', 'Étapes');
    var chips = steps.map(function(fs, i){
      var b = document.createElement('button'); b.type = 'button'; b.className = 'step-chip';
      var n = document.createElement('i'); n.textContent = i + 1;
      var t = document.createElement('span'); t.textContent = fs.querySelector(':scope > legend').textContent;
      var sm = document.createElement('small');
      b.appendChild(n); b.appendChild(t); b.appendChild(sm);
      b.addEventListener('click', function(){ go(i, true); });
      nav.appendChild(b);
      // En-tête et pied de chaque étape
      var head = document.createElement('div'); head.className = 'step-count'; head.textContent = 'Étape ' + (i + 1) + ' sur ' + steps.length;
      fs.insertBefore(head, fs.firstChild);
      var foot = document.createElement('div'); foot.className = 'step-foot';
      if (i > 0){ var pv = document.createElement('button'); pv.type = 'button'; pv.className = 'btn ghost small'; pv.textContent = '← Précédent'; pv.addEventListener('click', function(){ go(i - 1, true); }); foot.appendChild(pv); }
      if (i < steps.length - 1){
        var nx = document.createElement('button'); nx.type = 'button'; nx.className = 'btn small step-next';
        nx.textContent = 'Suivant : ' + steps[i + 1].querySelector(':scope > legend').textContent + ' →';
        nx.addEventListener('click', function(){ go(i + 1, true); }); foot.appendChild(nx);
      }
      fs.appendChild(foot);
      fs.classList.add('step');
      return b;
    });
    if (stageHolder){
      stageHolder.classList.add('sticky-preview');
      var host = stageHolder.querySelector('.panel');
      if (host) host.appendChild(nav); else { nav.classList.add('top'); stageHolder.insertBefore(nav, stageHolder.firstChild); }
    }
    else { nav.classList.add('alone'); settings.insertBefore(nav, settings.firstChild); }
    box.classList.add('has-steps');

    var cur = 0, seen = {};
    function refresh(){
      chips.forEach(function(c, i){
        c.classList.toggle('on', i === cur);
        c.classList.toggle('done', !!seen[i] && i !== cur);
        var sum = steps[i].classList.contains('step-final') ? '' : stepSummary(steps[i]);
        c.querySelector('small').textContent = seen[i] && i !== cur ? sum.slice(0, 24) : '';
      });
    }
    function go(i, user){
      seen[cur] = true; cur = Math.max(0, Math.min(steps.length - 1, i));
      if (box === document.querySelector('.editor, .tool-grid:not([hidden])') || box.classList.contains('editor')) SK.saveStep(cur);
      steps.forEach(function(fs, k){ fs.classList.toggle('active', k === cur); });
      refresh();
      var chip = chips[cur]; if (chip.scrollIntoView) nav.scrollTo({ left: chip.offsetLeft - nav.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' });
      if (user){
        // Remonte au début de l'étape, juste sous l'aperçu collé en haut
        var top = settings.getBoundingClientRect().top + window.scrollY;
        var stickH = stageHolder && getComputedStyle(stageHolder).position === 'sticky' && window.innerWidth <= 920 ? stageHolder.offsetHeight : 0;
        var target = top - ((document.querySelector('.topbar') || {}).offsetHeight || 64) - 8 - stickH;
        if (window.scrollY > target + 4 || window.scrollY < target - 400) window.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
      }
    }
    var rt; function later(){ clearTimeout(rt); rt = setTimeout(refresh, 250); }
    settings.addEventListener('input', later); settings.addEventListener('change', later);
    settings.addEventListener('click', function(){ setTimeout(refresh, 0); });
    var back = box.classList.contains('editor') ? SK.savedStep() : -1;
    if (back > 0){ for (var k = 0; k < back; k++) seen[k] = true; }
    go(back > 0 ? back : 0, false);
  };
  function initSteps(){ document.querySelectorAll('.editor, .tool-grid').forEach(SK.makeSteps); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSteps); else setTimeout(initSteps, 0);

  /* Hauteur réelle de la barre du haut (plus haute en appli sur iPhone) */
  function topbarH(){ var t = document.querySelector('.topbar'); if (t) document.documentElement.style.setProperty('--topbar-h', t.offsetHeight + 'px'); }
  topbarH(); window.addEventListener('resize', topbarH); window.addEventListener('orientationchange', function(){ setTimeout(topbarH, 300); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', topbarH);

  /* ======================================================================
     Retour au bon endroit : chaque page retient (pour cet onglet) où on en
     était. En revenant sur une page par un lien (menu, « Tous les outils »),
     on retrouve la même position, et la même étape dans les outils.
     Un lien vers une ancre (#outils) ou un rechargement gardent leur
     comportement normal.
     ====================================================================== */
  var SCROLL_KEY = 'sk-scroll:' + location.pathname;
  function ss(){ try { return window.sessionStorage; } catch(e){ return null; } }
  var saveTimer = null;
  function saveScroll(){ var st = ss(); if (st) try { st.setItem(SCROLL_KEY, String(Math.round(window.scrollY))); } catch(e){} }
  window.addEventListener('scroll', function(){ clearTimeout(saveTimer); saveTimer = setTimeout(saveScroll, 150); }, { passive: true });
  window.addEventListener('pagehide', saveScroll);
  SK.savedStep = function(){ var st = ss(); var v = st && st.getItem('sk-step:' + location.pathname); return v == null ? -1 : +v; };
  SK.saveStep = function(i){ var st = ss(); if (st) try { st.setItem('sk-step:' + location.pathname, String(i)); } catch(e){} };
  function reveal(){ document.documentElement.classList.remove('sk-restoring'); }
  function jump(y){ window.scrollTo({ top: y, left: 0, behavior: 'instant' }); }
  function restoreScroll(){
    var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    var type = nav ? nav.type : 'navigate';
    if (type === 'reload' || type === 'back_forward' || location.hash) return reveal(); // le navigateur s'en occupe
    var st = ss(), y = st && st.getItem(SCROLL_KEY);
    if (y == null) return reveal();
    var target = +y, tries = 0;
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    // saut immédiat (sans défilement animé), page encore cachée ; puis on vérifie
    // tant que la page grandit encore (étapes, images), et on l'affiche
    jump(target);
    (function check(){
      if (Math.abs(window.scrollY - target) > 2 && tries++ < 15){ jump(target); return setTimeout(check, 30); }
      reveal();
    })();
  }
  // Tout de suite (le script est en bas de page : le contenu est déjà là),
  // puis une dernière fois quand les étapes ont été construites
  restoreScroll();
  setTimeout(function(){ if (document.documentElement.classList.contains('sk-restoring')) restoreScroll(); }, 0);

  /* Pas de zoom (comme sur Tribune) : iOS ignore parfois user-scalable=no,
     on bloque donc aussi le pincement à la main. Le double-tap est bloqué en CSS. */
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function(t){ document.addEventListener(t, function(e){ e.preventDefault(); }, { passive: false }); });
  document.addEventListener('touchmove', function(e){ if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false });

  document.addEventListener('DOMContentLoaded', function(){ SK.applyI18n(); });
})();
