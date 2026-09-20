/* Pravila igre - cista logika, bez DOM-a.
   Stanje = niz boca; boca = niz brojeva boja, indeks 0 je dno. */
(function (global) {
  "use strict";

  var CAP = 4; // segmenata po boci

  function topColor(bottle) {
    return bottle.length ? bottle[bottle.length - 1] : null;
  }

  // Koliko segmenata iste boje lezi na vrhu.
  function topRun(bottle) {
    if (!bottle.length) return 0;
    var c = bottle[bottle.length - 1];
    var n = 0;
    for (var i = bottle.length - 1; i >= 0 && bottle[i] === c; i--) n++;
    return n;
  }

  function canPour(state, from, to) {
    if (from === to) return false;
    var a = state[from];
    var b = state[to];
    if (!a.length) return false;
    if (b.length >= CAP) return false;
    if (b.length && b[b.length - 1] !== a[a.length - 1]) return false;
    return true;
  }

  // Koliko bi se segmenata stvarno prelilo.
  function pourCount(state, from, to) {
    if (!canPour(state, from, to)) return 0;
    return Math.min(topRun(state[from]), CAP - state[to].length);
  }

  // Mijenja stanje na mjestu, vraca broj prelivenih segmenata.
  function pour(state, from, to) {
    var n = pourCount(state, from, to);
    var c = topColor(state[from]);
    for (var i = 0; i < n; i++) {
      state[from].pop();
      state[to].push(c);
    }
    return n;
  }

  function isUniform(bottle) {
    for (var i = 1; i < bottle.length; i++) if (bottle[i] !== bottle[0]) return false;
    return true;
  }

  // Boca je "gotova" kad je prazna ili puna jedne boje.
  function isDone(bottle) {
    return bottle.length === 0 || (bottle.length === CAP && isUniform(bottle));
  }

  function isSolved(state) {
    for (var i = 0; i < state.length; i++) if (!isDone(state[i])) return false;
    return true;
  }

  function clone(state) {
    var out = [];
    for (var i = 0; i < state.length; i++) out.push(state[i].slice());
    return out;
  }

  // Kanonski kljuc stanja - redoslijed boca nije bitan.
  function key(state) {
    var parts = [];
    for (var i = 0; i < state.length; i++) parts.push(state[i].join(","));
    parts.sort();
    return parts.join("|");
  }

  // Ima li uopce iti jedan legalan potez.
  function hasAnyMove(state) {
    for (var f = 0; f < state.length; f++) {
      for (var t = 0; t < state.length; t++) {
        if (canPour(state, f, t) && !(isUniform(state[f]) && state[t].length === 0)) return true;
      }
    }
    return false;
  }

  global.WSGame = {
    CAP: CAP,
    topColor: topColor,
    topRun: topRun,
    canPour: canPour,
    pourCount: pourCount,
    pour: pour,
    isUniform: isUniform,
    isDone: isDone,
    isSolved: isSolved,
    clone: clone,
    key: key,
    hasAnyMove: hasAnyMove,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
