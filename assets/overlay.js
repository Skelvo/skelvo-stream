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
  /* Polices proposées : clé -> [famille, graisses disponibles sur Google Fonts] */
  O.FONTS = {
    inter: ['Inter', '400;500;600;700;800;900'], manrope: ['Manrope', '400;500;600;700;800'], sora: ['Sora', '400;500;600;700;800'],
    outfit: ['Outfit', '400;500;600;700;800;900'], jakarta: ['Plus Jakarta Sans', '400;500;600;700;800'], dmsans: ['DM Sans', '400;500;600;700;800;900'],
    grotesk: ['Space Grotesk', '400;500;600;700'], syne: ['Syne', '400;500;600;700;800'], unbounded: ['Unbounded', '400;500;600;700;800;900'],
    archivo: ['Archivo', '400;500;600;700;800;900'], montserrat: ['Montserrat', '400;500;600;700;800;900'], poppins: ['Poppins', '400;500;600;700;800;900'],
    rubik: ['Rubik', '400;500;600;700;800;900'], nunito: ['Nunito', '400;500;600;700;800;900'], rounded: ['Nunito', '400;500;600;700;800;900'],
    fredoka: ['Fredoka', '400;500;600;700'], bebas: ['Bebas Neue', '400'], oswald: ['Oswald', '400;500;600;700'], anton: ['Anton', '400'],
    playfair: ['Playfair Display', '400;500;600;700;800;900'], cormorant: ['Cormorant Garamond', '400;500;600;700'], dmserif: ['DM Serif Display', '400'],
    jetbrains: ['JetBrains Mono', '400;500;600;700;800'], pixel: ['VT323', '400'], press: ['Press Start 2P', '400'],
    marker: ['Permanent Marker', '400'], caveat: ['Caveat', '400;500;600;700'], system: ['system-ui', '']
  };
  O.useFont = function(key, custom){
    if (custom && /^[\w \-]{2,40}$/.test(custom)){
      O.font(custom.trim().replace(/ /g, '+') + ':wght@400;700');
      O.font(custom.trim().replace(/ /g, '+'));
      return "'" + custom.trim() + "', system-ui, sans-serif";
    }
    var f = O.FONTS[key] || O.FONTS.inter;
    if (f[1]) O.font(f[0].replace(/ /g, '+') + ':wght@' + f[1]);
    return f[1] ? "'" + f[0] + "', system-ui, sans-serif" : 'system-ui, sans-serif';
  };

  /* ---------- Thème commun à tous les overlays ----------
     Les mêmes réglages (police, couleurs, fond, arrondi, bordure, ombre, lueur)
     marchent partout, pour que les overlays d'un streamer s'accordent. */
  O.THEME = {
    font: 'inter', cf: '', fw: '700', tx: 'ffffff', ac: 'a78bfa', ac2: '67e8f9',
    sk: 'solid', sf: '0b0b10', so: '78', rad: '40', bw: '1', bc: 'ffffff', bo: '12',
    sh: '35', shs: 'soft', gl: '0', up: '0'
  };
  function rgba(h, a){ var c = O.rgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  O.rgba = rgba;
  O.mix = function(a, b, t){ var x = O.rgb(a), y = O.rgb(b); return 'rgb(' + x.map(function(v, i){ return Math.round(v + (y[i] - v) * t); }).join(',') + ')'; };
  O.theme = function(P){
    var r = document.documentElement.style, D = O.THEME;
    var tx = O.hex(P.tx, D.tx), ac = O.hex(P.ac, D.ac), ac2 = O.hex(P.ac2, D.ac2), sf = O.hex(P.sf, D.sf), bc = O.hex(P.bc, D.bc);
    var so = O.num(P.so, 0, 100, 78) / 100, sh = O.num(P.sh, 0, 100, 35) / 100, gl = O.num(P.gl, 0, 100, 0) / 100;
    r.setProperty('--font', O.useFont(P.font || D.font, P.cf));
    r.setProperty('--fw', String(O.num(P.fw, 100, 900, 700)));
    r.setProperty('--tx', tx);
    r.setProperty('--muted', O.mix(tx, sf, .38));
    r.setProperty('--ac', ac); r.setProperty('--ac2', ac2);
    r.setProperty('--ac-tx', O.textOn(ac));
    r.setProperty('--sf', rgba(sf, so));
    r.setProperty('--sf-solid', sf);
    var tint = O.rgb(sf).map(function(v, i){ return Math.round(v + (O.rgb(ac)[i] - v) * .22); });
    r.setProperty('--sf-tint', 'rgba(' + tint.join(',') + ',' + so + ')');
    r.setProperty('--rad', (O.num(P.rad, 0, 100, 40) / 100 * 1.1) + 'em');
    r.setProperty('--bw', O.num(P.bw, 0, 8, 1) + 'px');
    r.setProperty('--bc', rgba(bc, O.num(P.bo, 0, 100, 12) / 100));
    r.setProperty('--shadow', P.shs === 'hard'
      ? '.14em .14em 0 rgba(0,0,0,' + sh + ')'
      : '0 .3em 1.4em rgba(0,0,0,' + (sh * .8) + '), 0 .05em .2em rgba(0,0,0,' + (sh * .5) + ')');
    r.setProperty('--glow', gl ? '0 0 ' + (gl * 1.6) + 'em ' + rgba(ac, .25 + gl * .5) : '0 0 0 transparent');
    r.setProperty('--glow-text', gl ? '0 0 ' + (gl * .8) + 'em ' + rgba(ac, .5 + gl * .4) : 'none');
    r.setProperty('--up', P.up === '1' ? 'uppercase' : 'none');
    r.setProperty('--ls', P.up === '1' ? '.06em' : '0');
    var kinds = ['solid', 'glass', 'gradient', 'accent', 'outline', 'none'];
    kinds.forEach(function(k){ document.documentElement.classList.remove('sk-' + k); });
    document.documentElement.classList.add('sk-' + (kinds.indexOf(P.sk) >= 0 ? P.sk : 'solid'));
  };
  /* Image donnée par le streamer : lien https ou petite image intégrée au lien */
  O.safeImage = function(u){ u = String(u || '').trim(); return /^https:\/\/[^\s"'()<>]+$/i.test(u) || /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[a-z0-9+\/=]+$/i.test(u) ? u : ''; };

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
  // "5m", "1h30", "90s", "2:30" (2 h 30), "10" (minutes) -> secondes
  O.parseDuration = function(str){
    str = String(str || '').trim().toLowerCase();
    if (!str) return NaN;
    if (/^\d+:\d{1,2}(:\d{1,2})?$/.test(str)){
      var parts = str.split(':').map(Number);
      // "2:30" = 2 h 30 (le plus naturel pour un minuteur de subathon), "1:02:05" = h:mm:ss
      return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 3600 + parts[1] * 60;
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
