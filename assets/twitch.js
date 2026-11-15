/* ==========================================================================
   Skelvo Stream — connexion au tchat Twitch, partagée par tous les overlays.

   - Lecture anonyme via le WebSocket IRC officiel (pseudo justinfanXXXX) :
     aucun compte, aucune clé.
   - Ce qu'on reçoit sans connexion : messages, badges, emotes, bits,
     abonnements / réabonnements / subs offerts, raids, annonces, messages
     supprimés. (Les follows et les points de chaîne demandent une connexion.)
   - Emotes 7TV / BTTV / FFZ via leurs API publiques.
   - Mode démo : faux tchat réaliste pour les aperçus des éditeurs.

   Sécurité : tout ce qui vient du tchat est inséré avec createTextNode /
   textContent, jamais avec innerHTML.

   Utilisation :
     var conn = SKT.connect('pseudo', {
       status(state), message(msg), event(evt), clear({ msgId | userId | all }), room(roomId)
     });
     conn.close();
   ========================================================================== */
(function(){
  'use strict';
  var T = window.SKT = {};

  function el(tag, cls){ var e = document.createElement(tag); if (cls) e.className = cls; return e; }

  T.cleanChannel = function(ch){ return String(ch || '').toLowerCase().replace(/^[#@]/, '').replace(/[^a-z0-9_]/g, '').slice(0, 25); };

  /* ---------- Parsing IRC ---------- */
  function unescapeTag(v){
    return v.replace(/\\(.)/g, function(_, c){ return { s: ' ', ':': ';', '\\': '\\', r: '\r', n: '\n' }[c] || c; });
  }
  T.parse = function(line){
    var m = { tags: {}, prefix: '', cmd: '', params: [] }, i;
    if (line[0] === '@'){
      i = line.indexOf(' ');
      line.slice(1, i).split(';').forEach(function(kv){
        var eq = kv.indexOf('='); m.tags[kv.slice(0, eq)] = unescapeTag(kv.slice(eq + 1));
      });
      line = line.slice(i + 1);
    }
    if (line[0] === ':'){ i = line.indexOf(' '); m.prefix = line.slice(1, i); line = line.slice(i + 1); }
    var trail = line.indexOf(' :');
    var head = trail >= 0 ? line.slice(0, trail) : line;
    m.params = head.split(' ').filter(Boolean);
    m.cmd = m.params.shift() || '';
    if (trail >= 0) m.params.push(line.slice(trail + 2));
    return m;
  };

  function badgeSet(raw){
    var s = {};
    String(raw || '').split(',').forEach(function(b){ if (b) s[b.split('/')[0]] = b.split('/')[1] || '1'; });
    return s;
  }
  function tierOf(plan){ return plan === '3000' ? 3 : plan === '2000' ? 2 : 1; }

  // "!Mort+ 3" -> { name: 'mort+', args: ['3'], rest: '3' }
  T.command = function(text){
    if (!text || text.charAt(0) !== '!') return null;
    var parts = text.slice(1).trim().split(/\s+/);
    var name = (parts.shift() || '').toLowerCase();
    return name ? { name: name, args: parts, rest: text.slice(1).trim().slice(name.length).trim() } : null;
  };

  /* Construit un objet message propre à partir d'une ligne PRIVMSG */
  function toMessage(m){
    var login = m.prefix.split('!')[0].toLowerCase();
    var text = m.params[1] || '', action = false;
    var me = /^\u0001ACTION (.*)\u0001$/.exec(text);
    if (me){ text = me[1]; action = true; }
    var b = badgeSet(m.tags.badges);
    return {
      id: m.tags.id, uid: m.tags['user-id'], login: login, name: m.tags['display-name'] || login,
      color: m.tags.color, badges: m.tags.badges || '', badgeSet: b,
      isBroadcaster: !!b.broadcaster, isMod: !!(b.broadcaster || b.moderator || m.tags.mod === '1'),
      isVip: !!b.vip, isSub: !!(b.subscriber || b.founder || m.tags.subscriber === '1'),
      text: text, emotes: m.tags.emotes || '', action: action,
      bits: parseInt(m.tags.bits, 10) || 0, rewardId: m.tags['custom-reward-id'] || '',
      cmd: T.command(text)
    };
  }

  /* ---------- Connexion ---------- */
  T.connect = function(channel, h){
    h = h || {};
    var ch = T.cleanChannel(channel);
    var ws = null, closed = false, retry = 0, retryTimer = null, roomTimer = null;
    var bombs = {}; // subs offerts en masse : pseudo -> nombre restant à recevoir
    function status(s){ if (h.status) h.status(s, ch); }

    function open(){
      if (closed || !ch) return;
      status('connecting');
      try { ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443'); } catch(e){ return later(); }
      var sock = ws;
      sock.onopen = function(){
        sock.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
        sock.send('PASS SCHMOOPIIE');
        sock.send('NICK justinfan' + (10000 + Math.floor(Math.random() * 80000)));
        sock.send('JOIN #' + ch);
        clearTimeout(roomTimer);
        roomTimer = setTimeout(function(){ status('notfound'); }, 6000);
      };
      sock.onmessage = function(e){
        String(e.data).split('\r\n').forEach(function(line){ if (line) handle(T.parse(line), sock); });
      };
      sock.onclose = function(){ if (sock === ws){ ws = null; later(); } };
      sock.onerror = function(){ try { sock.close(); } catch(e){} };
    }
    function later(){
      if (closed) return;
      status('retry');
      retry = Math.min(retry + 1, 6);
      retryTimer = setTimeout(open, 1000 * Math.pow(2, retry - 1));
    }

    function handle(m, sock){
      switch (m.cmd){
        case 'PING': sock.send('PONG :' + (m.params[0] || 'tmi.twitch.tv')); break;
        case 'RECONNECT': try { sock.close(); } catch(e){} break;
        case 'ROOMSTATE':
          if (m.tags['room-id']){
            retry = 0; clearTimeout(roomTimer); status('connected');
            if (h.room) h.room(m.tags['room-id']);
          }
          break;
        case 'PRIVMSG': {
          var msg = toMessage(m);
          T.stats.record(ch, 'msg', msg);
          if (msg.bits) T.stats.record(ch, 'event', { type: 'bits', id: msg.id + ':b', amount: msg.bits, name: msg.name });
          if (h.message) h.message(msg);
          if (msg.bits && h.event) h.event({ type: 'bits', id: msg.id + ':b', amount: msg.bits, name: msg.name, login: msg.login, color: msg.color, text: msg.text, emotes: msg.emotes });
          break;
        }
        case 'USERNOTICE': {
          var t = m.tags, id = t['msg-id'], login = (t.login || '').toLowerCase();
          var base = { id: t.id || '', name: t['display-name'] || login, login: login, color: t.color, text: m.params[1] || '', emotes: t.emotes || '', sys: t['system-msg'] || '' };
          var emit = function(e){ T.stats.record(ch, 'event', e); if (h.event) h.event(e); };
          if (id === 'sub' || id === 'resub'){
            emit(Object.assign(base, { type: id, tier: tierOf(t['msg-param-sub-plan']), prime: t['msg-param-sub-plan'] === 'Prime', months: parseInt(t['msg-param-cumulative-months'], 10) || 1 }));
          } else if (id === 'submysterygift'){
            var n = parseInt(t['msg-param-mass-gift-count'], 10) || 1;
            bombs[login] = (bombs[login] || 0) + n;
            emit(Object.assign(base, { type: 'giftbomb', count: n, tier: tierOf(t['msg-param-sub-plan']) }));
          } else if (id === 'subgift'){
            var fromBomb = false;
            if (bombs[login] > 0){ bombs[login]--; fromBomb = true; }
            emit(Object.assign(base, { type: 'subgift', tier: tierOf(t['msg-param-sub-plan']), fromBomb: fromBomb,
              recipient: t['msg-param-recipient-display-name'] || t['msg-param-recipient-user-name'] || '' }));
          } else if (id === 'raid'){
            emit(Object.assign(base, { type: 'raid', name: t['msg-param-displayName'] || base.name, count: parseInt(t['msg-param-viewerCount'], 10) || 0 }));
          } else if (id === 'announcement'){
            emit(Object.assign(base, { type: 'announcement' }));
          } else if (id === 'giftpaidupgrade' || id === 'primepaidupgrade'){
            emit(Object.assign(base, { type: 'upgrade' }));
          }
          break;
        }
        case 'CLEARMSG': if (h.clear) h.clear({ msgId: m.tags['target-msg-id'] }); break;
        case 'CLEARCHAT':
          if (h.clear) h.clear(m.tags['target-user-id'] ? { userId: m.tags['target-user-id'] } : { all: true });
          break;
      }
    }

    if (!ch) status('idle'); else open();

    return {
      channel: ch,
      close: function(){
        closed = true; clearTimeout(retryTimer); clearTimeout(roomTimer);
        if (ws){ var s = ws; ws = null; try { s.close(); } catch(e){} }
      }
    };
  };

  /* ---------- Statistiques du live (top tchatteurs, récap) ----------
     Tout overlay connecté compte pendant le live ; plusieurs sources dans OBS
     partagent le même stockage (même site), d'où l'anti-doublon par
     identifiant de message. Données du jour + cumul du mois. */
  var BOTS = { nightbot: 1, streamelements: 1, streamlabs: 1, moobot: 1, fossabot: 1, wizebot: 1, sery_bot: 1, soundalerts: 1, kofistreambot: 1 };
  function lsGet(k){ try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch(e){ return null; } }
  function lsSet(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
  function dayKey(d){ d = d || new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function monthKey(d){ d = d || new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1); }
  T.stats = {
    day: function(ch){ return lsGet('sk-stats:' + T.cleanChannel(ch) + ':' + dayKey()) || null; },
    month: function(ch){ return lsGet('sk-stats-m:' + T.cleanChannel(ch) + ':' + monthKey()) || null; },
    top: function(map, n){
      return Object.keys(map || {}).map(function(l){ return { login: l, name: map[l].n, count: map[l].c }; })
        .sort(function(a, b){ return b.count - a.count; }).slice(0, n || 5);
    },
    record: function(ch, kind, x){
      ch = T.cleanChannel(ch); if (!ch || !x) return;
      var id = x.id; if (!id) return;
      // anti-doublon entre plusieurs sources OBS
      var seenK = 'sk-stats-seen:' + ch, seen = lsGet(seenK) || [];
      if (seen.indexOf(id) >= 0) return;
      seen.push(id); if (seen.length > 400) seen = seen.slice(-300); lsSet(seenK, seen);
      var dk = 'sk-stats:' + ch + ':' + dayKey(), D = lsGet(dk) || { start: Date.now(), msgs: {}, subs: 0, gifts: 0, bits: 0, raids: [], first: '', last: 0 };
      var mk = 'sk-stats-m:' + ch + ':' + monthKey(), M = lsGet(mk) || { msgs: {} };
      D.last = Date.now();
      if (kind === 'msg'){
        if (BOTS[x.login] || (x.text || '').charAt(0) === '!') { lsSet(dk, D); return; }
        if (!D.first) D.first = x.name;
        var a = D.msgs[x.login] || { n: x.name, c: 0 }; a.c++; a.n = x.name; D.msgs[x.login] = a;
        var b = M.msgs[x.login] || { n: x.name, c: 0 }; b.c++; b.n = x.name; M.msgs[x.login] = b;
        lsSet(mk, M);
      } else if (x.type === 'sub' || x.type === 'resub') D.subs++;
      else if (x.type === 'subgift') D.gifts++;
      else if (x.type === 'bits') D.bits += x.amount || 0;
      else if (x.type === 'raid'){ D.raids.push({ n: x.name, c: x.count }); D.raids = D.raids.slice(-20); }
      lsSet(dk, D);
    },
    reset: function(ch){ ch = T.cleanChannel(ch); try { localStorage.removeItem('sk-stats:' + ch + ':' + dayKey()); } catch(e){} }
  };

  /* ---------- Emotes 7TV / BTTV / FFZ ---------- */
  T.thirdParty = {};
  var layers = { c7: {}, cb: {}, cf: {}, g7: {}, gb: {}, gf: {} };
  var globalsLoaded = false, loadedRoom = '';
  function getJSON(url){ return fetch(url).then(function(r){ if (!r.ok) throw r.status; return r.json(); }); }
  function add(map, name, url){ if (name && url && !map[name]) map[name] = url; }
  function from7tv(list, map){
    (list || []).forEach(function(e){
      var hst = e.data && e.data.host; if (!hst || !hst.url) return;
      add(map, e.name, (hst.url.indexOf('//') === 0 ? 'https:' : '') + hst.url + '/2x.webp');
    });
  }
  function fromBttv(list, map){ (list || []).forEach(function(e){ add(map, e.code, 'https://cdn.betterttv.net/emote/' + e.id + '/2x'); }); }
  function fromFfz(sets, map){
    Object.keys(sets || {}).forEach(function(k){
      (sets[k].emoticons || []).forEach(function(e){
        var u = e.urls && (e.urls['2'] || e.urls['1']); if (!u) return;
        add(map, e.name, u.indexOf('//') === 0 ? 'https:' + u : u);
      });
    });
  }
  function rebuild(){
    var out = {};
    ['c7', 'cb', 'cf', 'g7', 'gb', 'gf'].forEach(function(k){ Object.keys(layers[k]).forEach(function(n){ if (!out[n]) out[n] = layers[k][n]; }); });
    T.thirdParty = out;
  }
  T.loadGlobalEmotes = function(){
    if (globalsLoaded) return; globalsLoaded = true;
    getJSON('https://7tv.io/v3/emote-sets/global').then(function(d){ from7tv(d.emotes, layers.g7); rebuild(); }).catch(function(){});
    getJSON('https://api.betterttv.net/3/cached/emotes/global').then(function(d){ fromBttv(d, layers.gb); rebuild(); }).catch(function(){});
    getJSON('https://api.frankerfacez.com/v1/set/global').then(function(d){
      var sets = {}; (d.default_sets || []).forEach(function(id){ if (d.sets[id]) sets[id] = d.sets[id]; });
      fromFfz(sets, layers.gf); rebuild();
    }).catch(function(){});
  };
  T.loadChannelEmotes = function(roomId){
    if (!roomId || roomId === loadedRoom) return;
    loadedRoom = roomId;
    layers.c7 = {}; layers.cb = {}; layers.cf = {}; rebuild();
    getJSON('https://7tv.io/v3/users/twitch/' + roomId).then(function(d){ from7tv(d.emote_set && d.emote_set.emotes, layers.c7); rebuild(); }).catch(function(){});
    getJSON('https://api.betterttv.net/3/cached/users/twitch/' + roomId).then(function(d){ fromBttv((d.channelEmotes || []).concat(d.sharedEmotes || []), layers.cb); rebuild(); }).catch(function(){});
    getJSON('https://api.frankerfacez.com/v1/room/id/' + roomId).then(function(d){ fromFfz(d.sets, layers.cf); rebuild(); }).catch(function(){});
  };

  T.twitchEmoteUrl = function(id){ return 'https://static-cdn.jtvnw.net/emoticons/v2/' + encodeURIComponent(id) + '/default/dark/2.0'; };

  /**
   * Découpe un texte en morceaux { text } et { emote: url, name }.
   * emotesTag : format Twitch "25:0-4,12-16/1902:6-10" (positions en caractères Unicode)
   */
  T.pieces = function(text, emotesTag, useThirdParty){
    var chars = Array.from(text || ''), ranges = [], out = [];
    if (emotesTag){
      emotesTag.split('/').forEach(function(part){
        var bits = part.split(':'); if (bits.length < 2) return;
        bits[1].split(',').forEach(function(r){ var ab = r.split('-'); ranges.push({ id: bits[0], a: +ab[0], b: +ab[1] }); });
      });
      ranges.sort(function(x, y){ return x.a - y.a; });
    }
    function words(str){
      if (!useThirdParty){ out.push({ text: str }); return; }
      var buf = '';
      str.split(/(\s+)/).forEach(function(w){
        if (w && T.thirdParty[w]){ if (buf){ out.push({ text: buf }); buf = ''; } out.push({ emote: T.thirdParty[w], name: w }); }
        else buf += w;
      });
      if (buf) out.push({ text: buf });
    }
    var pos = 0;
    ranges.forEach(function(r){
      if (r.a < pos) return;
      if (r.a > pos) words(chars.slice(pos, r.a).join(''));
      out.push({ emote: T.twitchEmoteUrl(r.id), name: chars.slice(r.a, r.b + 1).join('') });
      pos = r.b + 1;
    });
    if (pos < chars.length) words(chars.slice(pos).join(''));
    return out;
  };

  /* Rend un texte + emotes dans un <span class="text"> sans jamais utiliser innerHTML */
  T.renderText = function(text, emotesTag, useThirdParty){
    var span = el('span', 'text'), emotes = 0, hasText = false, urls = [];
    T.pieces(text, emotesTag, useThirdParty).forEach(function(p){
      if (p.emote){
        var i = el('img', 'emote'); i.src = p.emote; i.alt = p.name; span.appendChild(i);
        emotes++; urls.push(p.emote);
      } else {
        span.appendChild(document.createTextNode(p.text));
        if (/\S/.test(p.text)) hasText = true;
      }
    });
    return { node: span, emoteOnly: emotes > 0 && emotes <= 4 && !hasText, urls: urls };
  };

  /* ---------- Faux tchat pour les aperçus ---------- */
  var DEMO_EMOTES = { Kappa: '25', LUL: '425618', HeyGuys: '30259', SeemsGood: '64138', '<3': '9', VoHiYo: '81274', NotLikeThis: '58765', BibleThump: '86', CoolCat: '58127', DinoDance: '300151345' };
  T.DEMO_USERS = [
    { n: 'Lunaa_', c: '#ff69b4', b: 'subscriber/12' }, { n: 'KevGaming', c: '#1e90ff', b: '' },
    { n: 'Mamie_Gameuse', c: '#9acd32', b: 'moderator/1,subscriber/24' }, { n: 'xXDarkSasukeXx', c: '#0000ff', b: '' },
    { n: 'Choupette', c: '#ff7f50', b: 'vip/1' }, { n: 'Tonton_Raclette', c: '', b: 'subscriber/3' },
    { n: 'PixelPaulo', c: '#00ff7f', b: '' }, { n: 'Nightbot', c: '#7c7cff', b: 'moderator/1', bot: true }
  ];
  var DEMO_MSGS = [
    'Salut tout le monde HeyGuys', 'GG !!! LUL', 'mais non il a raté le saut LUL LUL', 'Kappa',
    'Trop beau le nouveau cadre <3', 'tu joues à quoi après ?', 'Première fois que je passe ici, ça a l\'air cool',
    'NotLikeThis NotLikeThis', 'c\'est quoi ta config ?', 'SeemsGood', 'allez on y croit !!', 'BibleThump il est mort',
    'la musique est trop bien', 'VoHiYo', 'bonne soirée à tous <3', 'jsuis sûr il va réussir cette fois Kappa',
    'CoolCat CoolCat CoolCat', 'DinoDance DinoDance', '1', '2', 'LUL LUL LUL LUL'
  ];
  T.demoEmotesTag = function(text){
    var map = {}, pos = 0;
    text.split(' ').forEach(function(w){
      var len = Array.from(w).length;
      if (DEMO_EMOTES[w]) (map[DEMO_EMOTES[w]] = map[DEMO_EMOTES[w]] || []).push(pos + '-' + (pos + len - 1));
      pos += len + 1;
    });
    return Object.keys(map).map(function(id){ return id + ':' + map[id].join(','); }).join('/');
  };
  /* Fabrique un faux message comme s'il venait de Twitch */
  T.fakeMessage = function(user, text, extra){
    var b = badgeSet(user.b);
    return Object.assign({
      id: 'demo' + Math.random().toString(36).slice(2), uid: 'u-' + user.n, login: user.n.toLowerCase(), name: user.n,
      color: user.c, badges: user.b, badgeSet: b, isBroadcaster: !!b.broadcaster, isMod: !!(b.broadcaster || b.moderator),
      isVip: !!b.vip, isSub: !!b.subscriber, text: text, emotes: T.demoEmotesTag(text), action: false, bits: 0, rewardId: '',
      cmd: T.command(text)
    }, extra || {});
  };

  /**
   * Démo : envoie de faux messages (et, si opts.events, de faux événements)
   * aux mêmes fonctions que T.connect. opts.extra(n) peut renvoyer un message
   * ou un événement personnalisé (ex. commande de modo pour les compteurs).
   */
  T.demo = function(h, opts){
    opts = opts || {};
    var n = 0, timer = null, stopped = false;
    if (h.status) h.status('demo', '');
    function rnd(a){ return a[Math.floor(Math.random() * a.length)]; }
    function tick(){
      if (stopped) return;
      n++;
      var custom = opts.extra && opts.extra(n);
      if (custom){
        if (custom.type && h.event) h.event(custom);
        else if (custom.text != null && h.message) h.message(custom);
      } else if (opts.events && n % 7 === 0 && h.event){
        var u = rnd(T.DEMO_USERS.slice(0, 7));
        var e = rnd([
          { type: 'sub', tier: 1, months: 1, sys: u.n + ' s\'est abonné(e) au niveau 1.' },
          { type: 'resub', tier: 1, months: 6, text: 'Toujours là <3', sys: u.n + ' s\'est abonné(e) au niveau 1. Ça fait 6 mois d\'affilée !' },
          { type: 'giftbomb', count: 5, tier: 1, sys: u.n + ' offre 5 abonnements à la communauté !' },
          { type: 'bits', amount: 500, text: 'Cheer500 trop fort' },
          { type: 'raid', count: 42, sys: '42 spectateurs de ' + u.n + ' arrivent en raid !' }
        ]);
        e.name = u.n; e.login = u.n.toLowerCase(); e.color = u.c; e.text = e.text || ''; e.emotes = T.demoEmotesTag(e.text);
        h.event(e);
        if (e.type === 'giftbomb') for (var i = 0; i < e.count; i++) h.event({ type: 'subgift', tier: 1, fromBomb: true, name: u.n, login: u.n.toLowerCase(), recipient: rnd(T.DEMO_USERS).n, text: '', emotes: '' });
      } else if (h.message){
        var user = rnd(T.DEMO_USERS);
        var text = user.bot ? '!discord → rejoins le serveur ici' : rnd(opts.messages || DEMO_MSGS);
        h.message(T.fakeMessage(user, text, { action: !user.bot && Math.random() < .04 }));
      }
      timer = setTimeout(tick, (opts.min || 900) + Math.random() * (opts.spread || 1600));
    }
    for (var k = 0; k < (opts.burst || 0); k++) tick(), clearTimeout(timer);
    timer = setTimeout(tick, 600);
    return { close: function(){ stopped = true; clearTimeout(timer); } };
  };
})();
