/* Paleta, generator razina i solver.
   Razina je determinirana svojim brojem (seedani RNG) - ista razina je uvijek ista slagalica,
   pa "Ponovno" vraca identicnu pocetnu poziciju. Svaka generirana razina je provjereno rjesiva. */
(function (global) {
  "use strict";

  var G = global.WSGame;
  var CAP = G.CAP;

  /* Paleta je namjerno podijeljena u dvije obitelji: pune boje (svjetlina 0.5-0.7,
     zasicenost 0.15-0.23) i pastelne (svjetlina 0.83-0.92, zasicenost 0.08-0.15), plus
     jedna tamna (smeda). Obitelj nosi razliku i ondje gdje je ton slican, pa se boje
     razdvajaju i na uskim segmentima.
     Redoslijed nije proizvoljan - rane razine koriste prvih N boja, pa je poredak
     slozen pohlepno tako da je svaki prefiks palete sto razlicitiji (3 boje: min 0.354,
     6 boja: 0.201, svih 12: 0.149 OKLab udaljenosti).
     Provjera i crtez: python scripts/palette-wheel.py */
  var PALETTE = [
    "#1f5ed9", // plava (puna)
    "#fed454", // zuta (pastel)
    "#e52300", // crvena (puna)
    "#25984d", // zelena (puna)
    "#94cdff", // nebo (pastel)
    "#7c5223", // smeda (tamna)
    "#d533ad", // magenta (puna)
    "#dd9300", // narancasta (puna)
    "#a8f9d8", // menta (pastel)
    "#935adf", // ljubicasta (puna)
    "#ffbdcf", // roza (pastel)
    "#00b6be", // tirkizna (puna)
  ];

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rnd) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  function levelConfig(level) {
    var ramp = [3, 4, 4, 5, 6, 7, 8, 9, 10];
    var colors;
    var empty = 2;
    if (level <= ramp.length) {
      colors = ramp[level - 1];
    } else {
      var cycle = [9, 11, 10, 12, 9, 12, 10, 11];
      colors = cycle[(level - ramp.length - 1) % cycle.length];
      // Svaka peta razina od 15. nadalje je tijesna: manje boja, ali samo jedna prazna boca.
      // Iznad 7 boja je jedna prazna boca gotovo uvijek nerjesiva, pa se broj boja spusta.
      if (level >= 15 && level % 5 === 0) {
        colors = 7;
        empty = 1;
      }
    }
    return { colors: colors, empty: empty };
  }

  /* --- Solver ---------------------------------------------------------- */

  // Legalni potezi, bez ekvivalentnih duplikata, poredani po korisnosti.
  function genMoves(state) {
    var n = state.length;
    var out = [];
    var srcSeen = {};
    for (var f = 0; f < n; f++) {
      var a = state[f];
      if (!a.length) continue;
      var ak = a.join(",");
      if (srcSeen[ak]) continue;
      srcSeen[ak] = 1;
      var uniformA = G.isUniform(a);
      if (uniformA && a.length === CAP) continue; // gotova boca, ne dirati
      var dstSeen = {};
      for (var t = 0; t < n; t++) {
        if (!G.canPour(state, f, t)) continue;
        var b = state[t];
        var bk = b.join(",");
        if (dstSeen[bk]) continue;
        dstSeen[bk] = 1;
        if (!b.length && uniformA) continue; // samo seljenje hrpe, stanje ostaje isto
        var cnt = G.pourCount(state, f, t);
        var score = 0;
        if (b.length && b.length + cnt === CAP && G.isUniform(b)) score += 100; // dovrsava bocu
        if (cnt === a.length) score += 40; // prazni izvor
        if (b.length) score += 20; // spajanje je bolje od trosenja prazne boce
        out.push([f, t, score]);
      }
    }
    out.sort(function (x, y) {
      return y[2] - x[2];
    });
    return out;
  }

  /* Vraca: niz poteza (rjesenje), null (dokazano nerjesivo) ili undefined (prekid na limitu). */
  function solve(state, nodeLimit, depthLimit) {
    nodeLimit = nodeLimit || 60000;
    depthLimit = depthLimit || 160;
    var seen = {};
    var path = [];
    var nodes = 0;
    var aborted = false;

    function dfs(s, depth) {
      if (G.isSolved(s)) return true;
      if (depth >= depthLimit) return false;
      if (++nodes > nodeLimit) {
        aborted = true;
        return false;
      }
      var k = G.key(s);
      if (seen[k]) return false;
      seen[k] = 1;
      var ms = genMoves(s);
      for (var i = 0; i < ms.length; i++) {
        var ns = G.clone(s);
        G.pour(ns, ms[i][0], ms[i][1]);
        path.push([ms[i][0], ms[i][1]]);
        if (dfs(ns, depth + 1)) return true;
        path.pop();
        if (aborted) return false;
      }
      return false;
    }

    var ok = dfs(G.clone(state), 0);
    if (ok) return path.slice();
    return aborted ? undefined : null;
  }

  /* Donja granica broja poteza do rjesenja: broj hrpa minus broj razlicitih boja na dnu.
     Jedan potez to smanji za najvise jedan (spajanje hrpe na istu boju ili prelijevanje
     boje koje nema na dnu u praznu bocu), a rijesena pozicija ima nulu. Nikad ne
     precijeni, pa A* vraca najkrace rjesenje. */
  function lowerBound(state) {
    var runs = 0;
    var bottoms = {};
    var nBottoms = 0;
    for (var i = 0; i < state.length; i++) {
      var b = state[i];
      if (!b.length) continue;
      if (!bottoms[b[0]]) {
        bottoms[b[0]] = 1;
        nBottoms++;
      }
      for (var j = 0; j < b.length; j++) if (j === 0 || b[j] !== b[j - 1]) runs++;
    }
    return runs - nBottoms;
  }

  /* Najkrace rjesenje (A*) - za gumb "Potez". solve() nade bilo koje rjesenje, a dubinska
     pretraga u njega ubaci poteze koji nicemu ne sluze (prosjecno 3,9 po planu), npr.
     jednu od tri crvene na bocu u koju stane samo jedna. Medu jednako kratkim rjesenjima
     bira ono s najmanje takvih trganja hrpe: cijena poteza je 1000, trganje dodaje 1.
     Izmjereno na 450 pozicija (razine 1-150, pocetak i usred igre): plan prosjecno 24,7
     poteza umjesto 31,4, najvise 48 ms, bez prekida na limitu. Ostalo je jedno trganje
     u 450 planova, i tamo rjesenja bez njega nema.
     Vraca isto sto i solve(): niz poteza, null ili undefined (prekid na limitu). */
  function solveShortest(state, nodeLimit) {
    nodeLimit = nodeLimit || 30000;
    var MOVE = 1000;
    var SPLIT = 1;
    var heap = [];
    var best = {};
    var seq = 0;

    function less(a, b) {
      if (a.f !== b.f) return a.f < b.f;
      if (a.g !== b.g) return a.g > b.g; // dublji prvi - brze do cilja
      return a.id < b.id;
    }

    function push(n) {
      heap.push(n);
      var i = heap.length - 1;
      while (i > 0) {
        var p = (i - 1) >> 1;
        if (!less(heap[i], heap[p])) break;
        var t = heap[i];
        heap[i] = heap[p];
        heap[p] = t;
        i = p;
      }
    }

    function pop() {
      var top = heap[0];
      var last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        var i = 0;
        for (;;) {
          var l = 2 * i + 1;
          var r = l + 1;
          var m = i;
          if (l < heap.length && less(heap[l], heap[m])) m = l;
          if (r < heap.length && less(heap[r], heap[m])) m = r;
          if (m === i) break;
          var t = heap[i];
          heap[i] = heap[m];
          heap[m] = t;
          i = m;
        }
      }
      return top;
    }

    var root = { s: G.clone(state), k: G.key(state), g: 0, p: null, m: null, id: 0 };
    root.f = MOVE * lowerBound(root.s);
    best[root.k] = 0;
    push(root);
    var expanded = 0;

    while (heap.length) {
      var n = pop();
      if (n.g > best[n.k]) continue; // u medjuvremenu naden kraci put do iste pozicije
      if (G.isSolved(n.s)) {
        var path = [];
        for (var x = n; x.p; x = x.p) path.push(x.m);
        return path.reverse();
      }
      if (++expanded > nodeLimit) return undefined;
      var ms = genMoves(n.s);
      for (var i = 0; i < ms.length; i++) {
        var from = ms[i][0];
        var to = ms[i][1];
        var split = n.s[to].length > 0 && G.pourCount(n.s, from, to) < G.topRun(n.s[from]);
        var ns = G.clone(n.s);
        G.pour(ns, from, to);
        var k = G.key(ns);
        var g = n.g + MOVE + (split ? SPLIT : 0);
        if (best[k] !== undefined && best[k] <= g) continue;
        best[k] = g;
        push({ s: ns, k: k, g: g, f: g + MOVE * lowerBound(ns), p: n, m: [from, to], id: ++seq });
      }
    }
    return null;
  }

  /* --- Generator ------------------------------------------------------- */

  function makeLevel(level) {
    var cfg = levelConfig(level);
    var rnd = mulberry32(level * 2654435761 + 12345);
    var relax = 0;
    for (var attempt = 0; attempt < 400; attempt++) {
      var pool = [];
      for (var c = 0; c < cfg.colors; c++) for (var i = 0; i < CAP; i++) pool.push(c);
      shuffle(pool, rnd);
      var state = [];
      var bad = false;
      for (var b = 0; b < cfg.colors; b++) {
        var bottle = pool.slice(b * CAP, (b + 1) * CAP);
        // Boca koja je vec sortirana na startu = besplatan poklon, preskoci takav razmjestaj.
        if (G.isUniform(bottle)) bad = true;
        state.push(bottle);
      }
      if (bad && relax < 1) continue;
      for (var e = 0; e < cfg.empty; e++) state.push([]);
      var sol = solve(state, 40000);
      if (sol && sol.length >= cfg.colors) {
        return { state: state, colors: cfg.colors, empty: cfg.empty };
      }
      // Ako se dugo mucimo, popustimo kriterije umjesto da blokiramo UI.
      if (attempt === 120) relax = 1;
      if (attempt === 240 && cfg.empty < 2) cfg.empty = 2;
    }
    // Zadnja linija obrane: lagana, ali sigurno rjesiva pozicija.
    var fallback = [];
    for (var fc = 0; fc < cfg.colors; fc++) {
      fallback.push([fc, fc, (fc + 1) % cfg.colors, (fc + 1) % cfg.colors]);
    }
    fallback.push([]);
    fallback.push([]);
    return { state: fallback, colors: cfg.colors, empty: 2 };
  }

  global.WSLevels = {
    PALETTE: PALETTE,
    levelConfig: levelConfig,
    makeLevel: makeLevel,
    solve: solve,
    solveShortest: solveShortest,
    mulberry32: mulberry32,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
