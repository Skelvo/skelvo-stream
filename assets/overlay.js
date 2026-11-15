/* ==========================================================================
   Skelvo Stream — utilitaires communs des overlays (pages collées dans OBS).
   Volontairement minuscule : aucune dépendance, aucun style.
   ========================================================================== */
(function(){
  'use strict';
  var O = window.SKO = {};

  O.num = function(v, min, max, def){ v = parseFloat(v); if (isNaN(v)) v = def; return Math.min(max, Math.max(min, v)); };
  O.hex = function(v, def){ return /^[0-9a-f]{6}$/i.test(v || '') ? '#' + v : '#' + def; };
  O.el = function(tag, cls, text){ var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  O.rgb = function(h){ var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  O.textOn = function(h){ var c = O.rgb(h); return (c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000 > 150 ? '#14121f' : '#ffffff'; };

  // Stockage local : dans OBS, il survit aux redémarrages (même source, même adresse)
  O.store = {
    get: function(k){ try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch(e){ return null; } },
    set: function(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} },
    del: function(k){ try { localStorage.removeItem(k); } catch(e){} }
  };

  // Charge une police Google à la demande
  var fonts = {};
  O.font = function(family){
    if (!family || fonts[family]) return;
    fonts[family] = 1;
    var l = document.createElement('link'); l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + family + '&display=swap';
    document.head.appendChild(l);
  };
  O.FONTS = {
    grotesk: { css: "'Space Grotesk'", g: 'Space+Grotesk:wght@500;700' },
    rounded: { css: "'Nunito'",        g: 'Nunito:wght@600;800;900' },
    rubik:   { css: "'Rubik'",         g: 'Rubik:wght@500;700;800' },
    bebas:   { css: "'Bebas Neue'",    g: 'Bebas+Neue' },
    pixel:   { css: "'VT323'",         g: 'VT323' },
    marker:  { css: "'Permanent Marker'", g: 'Permanent+Marker' },
    system:  { css: 'system-ui' }
  };
  O.useFont = function(key){
    var f = O.FONTS[key] || O.FONTS.grotesk;
    if (f.g) O.font(f.g);
    return f.css + ', system-ui, sans-serif';
  };

  // Prévient l'éditeur (aperçu en iframe) de l'état de la connexion
  O.tellParent = function(state, extra){
    if (window.parent === window) return;
    try { window.parent.postMessage(Object.assign({ type: 'sk-status', state: state }, extra || {}), location.origin); } catch(e){}
  };

  /**
   * Réglages : d'abord ceux de l'URL, puis en direct depuis l'éditeur.
   * cb(params, isUpdate)
   */
  O.params = function(defaults, cb){
    var p = {};
    new URLSearchParams(location.search).forEach(function(v, k){ p[k] = v; });
    cb(Object.assign({}, defaults, p), false);
    window.addEventListener('message', function(e){
      if (e.origin !== location.origin || !e.data || e.data.type !== 'sk-params') return;
      cb(Object.assign({}, defaults, e.data.params), true);
    });
  };

  // Durées lisibles : 3725 s -> "1:02:05"
  O.clock = function(sec, forceHours){
    sec = Math.max(0, Math.round(sec));
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    var mm = (h || forceHours) && m < 10 ? '0' + m : String(m);
    return (h || forceHours ? h + ':' : '') + mm + ':' + (s < 10 ? '0' : '') + s;
  };
  // "5m", "1h30", "90s", "2:30", "10" (minutes) -> secondes
  O.parseDuration = function(str){
    str = String(str || '').trim().toLowerCase();
    if (!str) return NaN;
    if (/^\d+:\d{1,2}(:\d{1,2})?$/.test(str)){
      var parts = str.split(':').map(Number);
      return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
    }
    if (/^\d+(\.\d+)?$/.test(str)) return parseFloat(str) * 60;
    var total = 0, found = false, re = /(\d+(?:\.\d+)?)\s*(h|m|min|s|sec)?/g, m;
    while ((m = re.exec(str))){
      found = true;
      var v = parseFloat(m[1]), u = m[2] || (total ? 'm' : 'm');
      // "1h30" : le nombre sans unité après des heures = minutes
      total += u === 'h' ? v * 3600 : (u === 's' || u === 'sec') ? v : v * 60;
    }
    return found ? total : NaN;
  };
})();
