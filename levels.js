/* Paleta, generator razina i solver.
   Razina je determinirana svojim brojem (seedani RNG) - ista razina je uvijek ista slagalica,
   pa "Ponovno" vraca identicnu pocetnu poziciju. Svaka generirana razina je provjereno rjesiva. */
(function (global) {
  "use strict";

  var G = global.WSGame;
  var CAP = G.CAP;

  // Prvih nekoliko boja su najrazlicitije medusobno - lake razine koriste bas njih.
  var PALETTE = [
    "#ef3b4b",
    "#2f9bf5",
    "#ffd23f",
    "#21bf73",
    "#8b5cf6",
    "#f98e28",
    "#16c2c2",
    "#e341c4",
    "#8fd14f",
    "#3b4de0",
    "#a0693c",
    "#cfd8e3",
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
    mulberry32: mulberry32,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
