/* ==========================================================================
   Skelvo Stream — utilitaires communs des overlays (pages collées dans OBS).
   Volontairement minuscule : aucune dépendance, aucun style.
   ========================================================================== */
(function(){
  'use strict';
  var O = window.SKO = {};

  /* Langue : ?lang=en dans le lien OBS, ou celle de l'éditeur pour l'aperçu. */
  O.lang = (function(){
    var l = new URLSearchParams(location.search).get('lang');
    // aperçu dans un éditeur (iframe) : même choix de langue que le site
    if (!l && window.parent !== window){
      try { l = (window.parent.SK && window.parent.SK.lang) || JSON.parse(localStorage.getItem('sk-lang') || 'null') || (/^fr/i.test(navigator.language || 'fr') ? 'fr' : 'en'); } catch(e){}
    }
    return l === 'en' ? 'en' : 'fr';
  })();
  O.locale = O.lang === 'en' ? 'en-US' : 'fr-FR';
  O.EN = {
    // alertes
    "{name} s'abonne !": '{name} just subscribed!', '{name} se réabonne · {months} mois !': '{name} resubscribed · {months} months!',
    '{name} offre un abonnement à {recipient} !': '{name} gifted a sub to {recipient}!', '{name} offre {count} abonnements !': '{name} gifted {count} subs!',
    '{name} envoie {amount} bits !': '{name} cheered {amount} bits!', 'Raid de {name} avec {count} viewers !': '{name} is raiding with {count} viewers!',
    '{name} suit la chaîne !': '{name} just followed!', '{name} utilise « {reward} »': '{name} redeemed “{reward}”', '{name} fait un don de {amount} !': '{name} donated {amount}!',
    'Merci pour les lives !': 'Thanks for the streams!', "Trop contente d'être là <3": 'So happy to be here <3', 'Cheer500 GG pour la win !': 'Cheer500 GG on the win!',
    'Toujours fidèle au poste SeemsGood': 'Still here, loyal as ever SeemsGood',
    // bingo
    'Bingo du stream': 'Stream bingo', 'Il meurt au premier boss': 'Dies to the first boss', 'Rage-quit': 'Rage quit', "« Je l'avais dit »": '“I told you so”',
    'Problème de micro': 'Mic problems', 'Le chat passe devant la cam': 'The cat walks past the cam', 'Bug du jeu': 'Game bug', "« Une dernière et j'arrête »": '“One more and I\'m done”',
    'Raid surprise': 'Surprise raid', 'Il oublie de lancer la musique': 'Forgets to start the music', 'Gros mot': 'Swear word', 'Spoiler du tchat': 'Chat spoiler',
    'Il chante': 'Starts singing', 'Victoire écrasante': 'Crushing win', 'Il se perd': 'Gets lost', 'Coupure internet': 'Internet drops', 'Il dit « gg »': 'Says “gg”',
    'Abonnement offert': 'Gifted sub', 'Il boit son café': 'Sips their coffee', 'Musique trop forte': 'Music too loud', 'Il lit mal un pseudo': 'Misreads a username',
    'Fou rire': 'Laughing fit', 'Il fait un saut raté': 'Misses a jump', "« C'est la faute du jeu »": '“It\'s the game\'s fault”', 'Le tchat a raison': 'Chat was right',
    'Il remercie un raid': 'Thanks a raid', 'Case ': 'Square ', 'BINGO !': 'BINGO!',
    // classement
    'Top tchatteurs': 'Top chatters', 'Ce mois-ci': 'This month', "Aujourd'hui": 'Today', 'En attente des premiers messages…': 'Waiting for the first messages…',
    '🥇 Premier arrivé : ': '🥇 First to arrive: ', 'msg': 'msg',
    // derniers
    'Dernier abonné': 'Latest sub', 'Dernier sub offert': 'Latest gifted sub', 'Dernier raid': 'Latest raid', 'Derniers bits': 'Latest bits',
    'Top bits du jour': "Today's top cheerer", 'Top donneur du jour': "Today's top gifter", 'Top tchatteur du jour': "Today's top chatter",
    'Dernier follow': 'Latest follow', 'Dernier don': 'Latest donation', ' mois': ' months', 'Personne pour l\'instant': 'Nobody yet',
    // écrans
    'Bienvenue': 'Welcome', 'Le live commence bientôt': 'Stream starting soon', "C'est parti !": "Here we go!", 'Pause': 'Break',
    'Je reviens tout de suite': 'Be right back', 'Ça reprend !': "We're back!", 'À bientôt': 'See you soon', 'Fin du live': 'Stream ending',
    "Merci d'avoir regardé": 'Thanks for watching', 'À bientôt !': 'See you soon!', 'Nouveaux abonnés': 'New subs', 'Durée': 'Duration', 'Raids': 'Raids', 'Bits': 'Bits',
    // épinglé
    'Épinglé': 'Pinned', 'Allez le suivre !': 'Go follow them!', 'Passez voir sa chaîne !': 'Go check out their channel!', 'Merci pour le raid avec ': 'Thanks for the raid with ',
    ' Le Discord est dans la description, venez ! <3': ' The Discord link is in the description, come hang out! <3',
    // giveaway
    'Giveaway !': 'Giveaway!', 'Tirage au sort': 'Giveaway', 'Tape ': 'Type ', ' (abonnés)': ' (subscribers)', ' pour participer': ' to enter',
    'Participations fermées · tirage imminent': 'Entries closed · drawing soon', 'Les gagnants': 'The winners', 'Le gagnant': 'The winner',
    ' start Une carte cadeau de 20 €': ' start A $20 gift card',
    // horloge
    'En live depuis': 'Live for', 'Début dans': 'Starts in', 'Heure': 'Time',
    // jeux
    'Duel': 'Duel', 'Course': 'Race', ' défie ': ' challenges ', ' pour accepter (60 s)': ' to accept (60 s)', " n'a pas répondu… 🐔": " didn't answer… 🐔",
    'Qui veut courir ?': 'Who wants to race?', ' pour participer · ': ' to join · ', 'Pas assez de coureurs… la course est annulée.': 'Not enough racers… the race is cancelled.',
    ' gagne la course !': ' wins the race!', ' gagne !': ' wins!', '3… 2… 1… Partez !': '3… 2… 1… Go!',
    // minuteur
    'Terminé !': 'Done!', 'En pause': 'Paused', 'Raid ': 'Raid ',
    // musique
    'En écoute': 'Now playing', 'Nuit blanche sur la Côte': 'Sleepless on the Coast', 'Les Pixels Perdus': 'The Lost Pixels',
    'Respawn (Version longue qui ne tient pas dans la case)': 'Respawn (Extended version that doesn\'t fit in the box)', 'Boss final': 'Final Boss',
    // objectif
    'Objectif abonnés': 'Sub goal',
    // sondage
    'Oui': 'Yes', 'Non': 'No', 'Terminé': 'Ended', 'Résultats · ': 'Results · ', 'Tape le numéro dans le tchat · ': 'Type the number in chat · ', 'Quel jeu après ce live ?': 'Which game after this stream?',
    // sons
    'Klaxon': 'Air horn', 'Roulement de tambour': 'Drum roll', 'Trombone triste': 'Sad trombone', 'Applaudissements': 'Applause', 'Pièce': 'Coin', 'Fanfare': 'Fanfare',
    'Buzzer raté': 'Fail buzzer', 'Explosion': 'Explosion',
    // commandes par défaut
    'sondage': 'poll', 'participer': 'join', 'mort': 'death', 'objectif': 'goal', 'pluie': 'rain', 'accepte': 'accept', 'course': 'race', 'Morts': 'Deaths',
    // démo du tchat (twitch.js)
    'Quelqu\'un': 'Someone', 'Salut tout le monde HeyGuys': 'Hi everyone HeyGuys', 'mais non il a raté le saut LUL LUL': 'nooo he missed the jump LUL LUL',
    'Trop beau le nouveau cadre <3': 'Love the new frame <3', 'tu joues à quoi après ?': 'what are you playing next?',
    'Première fois que je passe ici, ça a l\'air cool': 'First time here, looks cool', "c'est quoi ta config ?": "what's your setup?", 'BibleThump il est mort': 'BibleThump he died',
    'la musique est trop bien': 'the music is so good', 'bonne soirée à tous <3': 'have a good night everyone <3', 'jsuis sûr il va réussir cette fois Kappa': 'pretty sure he gets it this time Kappa',
    ' s\'est abonné(e) au niveau 1.': ' subscribed at Tier 1.', 'Toujours là <3': 'Still here <3', ' s\'est abonné(e) au niveau 1. Ça fait 6 mois d\'affilée !': ' subscribed at Tier 1. They\'ve subscribed for 6 months in a row!',
    ' offre 5 abonnements à la communauté !': ' is gifting 5 subs to the community!', '42 spectateurs de ': '42 raiders from ', ' arrivent en raid !': ' have joined!',
    '!discord → rejoins le serveur ici': '!discord → join the server here',
    'allez on y croit !!': 'let\'s gooo!!', ', tape ': ', type ', ' !': '!', ' restant': ' left', ' viewers !': ' viewers!', 'Test': 'Test'
  };
  O.tr = function(s){ return O.lang === 'en' && s != null && Object.prototype.hasOwnProperty.call(O.EN, s) ? O.EN[s] : s; };

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
  // Polices « d'affichage » : belles en titre, pénibles à lire en petit.
  // Avec elles, les textes courants (messages, petites lignes) passent en Inter.
  O.DISPLAY_ONLY = { playfair: 1, cormorant: 1, dmserif: 1, bebas: 1, oswald: 1, anton: 1, unbounded: 1, syne: 1, press: 1, pixel: 1, marker: 1, caveat: 1, jetbrains: 1 };
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
    var fkey = P.font || D.font;
    r.setProperty('--font', O.useFont(fkey, P.cf));
    r.setProperty('--font-body', !P.cf && O.DISPLAY_ONLY[fkey] ? O.useFont('inter') : O.useFont(fkey, P.cf));
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
