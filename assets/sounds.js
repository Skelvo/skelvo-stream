/* ==========================================================================
   Skelvo Stream — banque de sons synthétisés (WebAudio).
   Aucun fichier : chaque son est fabriqué par le navigateur à la volée.
   SKS.play('klaxon', 0.7)   SKS.list = [{ id, label, cmd }]
   Les sons perso (liens mp3/ogg) passent par SKS.playUrl(url, volume).
   ========================================================================== */
(function(){
  'use strict';
  var S = window.SKS = {};
  var ctx = null;
  function ac(){ ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); return ctx; }

  S.list = [
    { id: 'klaxon',   label: 'Klaxon',            cmd: 'klaxon' },
    { id: 'tambour',  label: 'Roulement de tambour', cmd: 'tambour' },
    { id: 'badum',    label: 'Ba-dum-tss',        cmd: 'badum' },
    { id: 'triste',   label: 'Trombone triste',   cmd: 'triste' },
    { id: 'bravo',    label: 'Applaudissements',  cmd: 'bravo' },
    { id: 'boing',    label: 'Boing',             cmd: 'boing' },
    { id: 'piece',    label: 'Pièce',             cmd: 'piece' },
    { id: 'victoire', label: 'Fanfare',           cmd: 'victoire' },
    { id: 'rate',     label: 'Buzzer raté',       cmd: 'rate' },
    { id: 'laser',    label: 'Laser',             cmd: 'laser' },
    { id: 'boom',     label: 'Explosion',         cmd: 'boom' },
    { id: 'suspense', label: 'Suspense',          cmd: 'suspense' },
    { id: 'ding',     label: 'Ding',              cmd: 'ding' },
    { id: 'wow',      label: 'Wow',               cmd: 'wow' }
  ];

  function noiseBuffer(c, sec){
    var b = c.createBuffer(1, Math.floor(c.sampleRate * sec), c.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function env(g, t, a, peak, dec, end){
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dec); if (end) g.gain.setValueAtTime(0, t + end);
  }
  function osc(c, out, type, f0, t, len, peak, f1, a){
    var o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + len);
    env(g, t, a || .01, peak, len); o.connect(g); g.connect(out); o.start(t); o.stop(t + len + .05);
    return o;
  }
  function noise(c, out, t, len, peak, filterType, freq, q){
    var n = c.createBufferSource(); n.buffer = noiseBuffer(c, len + .1);
    var f = c.createBiquadFilter(); f.type = filterType || 'highpass'; f.frequency.value = freq || 1000; if (q) f.Q.value = q;
    var g = c.createGain(); env(g, t, .005, peak, len);
    n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + len + .05);
  }

  var SYN = {
    klaxon: function(c, o, t){
      [0, .28, .56].forEach(function(dt, k){
        var len = k === 2 ? .9 : .22;
        [233, 293, 349].forEach(function(f){ var x = osc(c, o, 'sawtooth', f, t + dt, len, .12, f * .97, .02); x.detune.value = Math.random() * 20 - 10; });
      });
    },
    tambour: function(c, o, t){
      for (var i = 0; i < 34; i++) noise(c, o, t + i * .045, .06, .25 + i / 70, 'bandpass', 220, 1.2);
      noise(c, o, t + 1.6, 1.2, .5, 'highpass', 5000); osc(c, o, 'sine', 90, t + 1.6, .5, .6, 50);
    },
    badum: function(c, o, t){
      osc(c, o, 'sine', 190, t, .25, .7, 110); osc(c, o, 'sine', 150, t + .22, .3, .7, 80);
      noise(c, o, t + .55, 1.1, .35, 'highpass', 6000); osc(c, o, 'sine', 70, t + .55, .25, .5, 45);
    },
    triste: function(c, o, t){
      [[392, 0, .35], [370, .4, .35], [349, .8, .35], [330, 1.2, 1.2]].forEach(function(n){
        var x = osc(c, o, 'sawtooth', n[0], t + n[1], n[2], .14, n[0] * .97, .03);
        if (n[2] > 1){ var l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 6; lg.gain.value = 8; l.connect(lg); lg.connect(x.frequency); l.start(t + n[1]); l.stop(t + n[1] + n[2]); }
      });
    },
    bravo: function(c, o, t){
      for (var i = 0; i < 70; i++) noise(c, o, t + Math.random() * 2.2, .05 + Math.random() * .05, .15 + Math.random() * .25, 'bandpass', 1200 + Math.random() * 1800, .8);
    },
    boing: function(c, o, t){
      var x = osc(c, o, 'sine', 120, t, .7, .6, 620, .005);
      var l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 14; lg.gain.value = 60; l.connect(lg); lg.connect(x.frequency); l.start(t); l.stop(t + .7);
    },
    piece: function(c, o, t){ osc(c, o, 'square', 988, t, .09, .18); osc(c, o, 'square', 1319, t + .085, .45, .18); },
    victoire: function(c, o, t){ [[523, 0, .16], [659, .16, .16], [784, .32, .16], [1047, .48, .9]].forEach(function(n){ osc(c, o, 'triangle', n[0], t + n[1], n[2], .4); osc(c, o, 'square', n[0] / 2, t + n[1], n[2], .06); }); },
    rate: function(c, o, t){ osc(c, o, 'square', 110, t, .9, .2, 98); osc(c, o, 'sawtooth', 116, t, .9, .12, 100); },
    laser: function(c, o, t){ osc(c, o, 'square', 1800, t, .35, .18, 160); osc(c, o, 'sine', 1400, t + .02, .3, .2, 120); },
    boom: function(c, o, t){ noise(c, o, t, 1.6, .9, 'lowpass', 600); osc(c, o, 'sine', 80, t, 1, .8, 30); },
    suspense: function(c, o, t){ [[147, 0, .35], [139, .45, .35], [110, .9, 1.4]].forEach(function(n){ osc(c, o, 'sawtooth', n[0], t + n[1], n[2], .2); osc(c, o, 'sine', n[0] / 2, t + n[1], n[2], .3); }); },
    ding: function(c, o, t){ [1320, 2640, 3960].forEach(function(f, i){ osc(c, o, 'sine', f, t, 1.6 - i * .4, .35 / (i + 1)); }); },
    wow: function(c, o, t){
      var x = c.createOscillator(); x.type = 'sawtooth'; x.frequency.setValueAtTime(180, t); x.frequency.linearRampToValueAtTime(240, t + .4); x.frequency.linearRampToValueAtTime(170, t + .9);
      var f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 6; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(1400, t + .35); f.frequency.exponentialRampToValueAtTime(600, t + .9);
      var g = c.createGain(); env(g, t, .05, .5, .95); x.connect(f); f.connect(g); g.connect(o); x.start(t); x.stop(t + 1);
    }
  };

  S.play = function(id, vol){
    var fn = SYN[id]; if (!fn) return false;
    try {
      var c = ac(), out = c.createGain(); out.gain.value = Math.max(0, Math.min(1, vol == null ? .7 : vol)); out.connect(c.destination);
      fn(c, out, c.currentTime + .02); return true;
    } catch(e){ return false; }
  };
  S.playUrl = function(url, vol){
    if (!/^https:\/\/\S+$/i.test(url || '')) return false;
    try { var a = new Audio(url); a.volume = Math.max(0, Math.min(1, vol == null ? .7 : vol)); a.play().catch(function(){}); return true; } catch(e){ return false; }
  };
})();
