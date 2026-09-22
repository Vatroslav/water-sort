/* UI, animacija i spremanje napretka. */
(function () {
  "use strict";

  var G = window.WSGame;
  var L = window.WSLevels;
  var SFX = window.WSAudio;
  var CAP = G.CAP;
  var ASPECT = 3.05; // odnos visine i sirine boce

  var KEY_SAVE = "ws:save";
  var KEY_OPTS = "ws:opts";
  var KEY_BEST = "ws:best";
  var KEY_SEEN = "ws:seen-tip";

  var state = [];
  var level = 1;
  var moves = 0;
  var undoStack = [];
  var extraUsed = false;
  var selected = -1;
  var busy = false;
  var solved = false;
  var best = {};
  var bottleEls = [];
  var segEls = [];
  var opts = { sound: true, haptics: true, block: true };

  var board = document.getElementById("board");
  var fx = document.getElementById("fx");
  var levelNum = document.getElementById("level-num");
  var movesEl = document.getElementById("moves");
  var bestEl = document.getElementById("best");
  var toastEl = document.getElementById("toast");
  var winEl = document.getElementById("win");
  var winMoves = document.getElementById("win-moves");
  var plan = null; // zapamceno rjesenje koje gumb "Potez" servira potez po potez
  var planKey = null;

  var bottlesWrap = document.createElement("div");
  bottlesWrap.id = "bottles";
  board.insertBefore(bottlesWrap, fx);

  var stream = document.createElement("div");
  stream.className = "stream";
  board.appendChild(stream);

  function sleep(ms) {
    return new Promise(function (r) {
      setTimeout(r, ms);
    });
  }

  function vibrate(ms) {
    if (opts.haptics && navigator.vibrate) {
      try {
        navigator.vibrate(ms);
      } catch (e) {
        /* nema haptike, nista strasno */
      }
    }
  }

  function toast(msg, ms) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      toastEl.classList.remove("show");
    }, ms || 2600);
  }

  /* --- Spremanje --------------------------------------------------------- */

  function loadAll() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY_OPTS) || "null");
      if (o) opts = { sound: o.sound !== false, haptics: o.haptics !== false, block: o.block !== false };
    } catch (e) {
      /* pokvareni zapis - ostaju zadane postavke */
    }
    try {
      best = JSON.parse(localStorage.getItem(KEY_BEST) || "{}") || {};
    } catch (e) {
      best = {};
    }
    try {
      var s = JSON.parse(localStorage.getItem(KEY_SAVE) || "null");
      if (s && s.state && s.state.length) {
        level = s.level || 1;
        state = s.state;
        moves = s.moves || 0;
        extraUsed = !!s.extraUsed;
        undoStack = s.undo || [];
        return true;
      }
    } catch (e) {
      /* pokvareni zapis - krece se od prve razine */
    }
    return false;
  }

  function save() {
    try {
      localStorage.setItem(
        KEY_SAVE,
        JSON.stringify({
          level: level,
          state: state,
          moves: moves,
          extraUsed: extraUsed,
          undo: undoStack.slice(-40),
        })
      );
    } catch (e) {
      /* pun storage - igra i dalje radi, samo se ne pamti */
    }
  }

  function saveOpts() {
    try {
      localStorage.setItem(KEY_OPTS, JSON.stringify(opts));
      localStorage.setItem(KEY_BEST, JSON.stringify(best));
    } catch (e) {
      /* ignoriraj */
    }
  }

  /* --- Razina ------------------------------------------------------------ */

  function startLevel(n) {
    level = n;
    var lv = L.makeLevel(n);
    state = lv.state;
    moves = 0;
    undoStack = [];
    extraUsed = false;
    selected = -1;
    solved = false;
    dropPlan();
    winEl.hidden = true;
    render();
    save();
  }

  /* --- Crtanje ----------------------------------------------------------- */

  function computeLayout(count) {
    var W = board.clientWidth;
    var H = board.clientHeight;
    var gap = 12;
    var pick = null;
    for (var rows = 1; rows <= 3; rows++) {
      var cols = Math.ceil(count / rows);
      var byW = (W - gap * (cols + 1)) / cols;
      var byH = (H - gap * 1.7 * (rows + 1)) / rows / ASPECT;
      var bw = Math.min(byW, byH, 76);
      pick = { rows: rows, cols: cols, bw: bw, gap: gap };
      if (bw >= 44 || rows === 3) break;
    }
    if (pick.bw < 26) pick.bw = 26;
    return pick;
  }

  function render() {
    var lay = computeLayout(state.length);
    document.documentElement.style.setProperty("--bw", lay.bw.toFixed(1) + "px");
    document.documentElement.style.setProperty("--bh", (lay.bw * ASPECT).toFixed(1) + "px");
    document.documentElement.style.setProperty("--gap", lay.gap + "px");

    bottlesWrap.innerHTML = "";
    bottleEls = [];
    segEls = [];

    var perRow = [];
    var left = state.length;
    for (var r = 0; r < lay.rows; r++) {
      var take = Math.ceil(left / (lay.rows - r));
      perRow.push(take);
      left -= take;
    }

    var idx = 0;
    for (var ri = 0; ri < perRow.length; ri++) {
      var row = document.createElement("div");
      row.className = "row";
      for (var k = 0; k < perRow[ri]; k++) {
        row.appendChild(makeBottle(idx));
        idx++;
      }
      bottlesWrap.appendChild(row);
    }

    updateHud();
    sizeCanvas();
  }

  function makeBottle(i) {
    var el = document.createElement("div");
    el.className = "bottle";
    el.dataset.i = String(i);
    var glass = document.createElement("div");
    glass.className = "glass";
    var segs = [];
    for (var s = 0; s < state[i].length; s++) {
      var seg = makeSeg(state[i][s], s);
      glass.appendChild(seg);
      segs.push(seg);
    }
    var gloss = document.createElement("div");
    gloss.className = "gloss";
    glass.appendChild(gloss);
    el.appendChild(glass);
    if (G.isDone(state[i]) && state[i].length) el.classList.add("done");
    if (i === selected) el.classList.add("selected");
    bottleEls[i] = el;
    segEls[i] = segs;
    return el;
  }

  function makeSeg(colorIdx, slot) {
    var seg = document.createElement("div");
    seg.className = "seg";
    seg.style.setProperty("--c", L.PALETTE[colorIdx % L.PALETTE.length]);
    seg.style.bottom = ((slot * 100) / CAP).toFixed(3) + "%";
    return seg;
  }

  function updateHud() {
    levelNum.textContent = String(level);
    movesEl.textContent = moves + (moves % 10 === 1 && moves % 100 !== 11 ? " potez" : " poteza");
    var b = best[level];
    bestEl.textContent = b ? "najbolje: " + b : "";
    document.getElementById("undo-btn").disabled = undoStack.length === 0 || solved;
    document.getElementById("addbottle-btn").disabled = extraUsed || solved;
    document.getElementById("hint-btn").disabled = solved;
  }

  /* --- Slijepa ulica ------------------------------------------------------ */

  /* Potez nakon kojeg solver dokaze da vise nema rjesenja se ne dopusta, pa se u
     zaglavljenu poziciju ne moze ni uci. Zabranjuje se samo na dokaz (null) - prekid
     na limitu (undefined) pusta potez. Izmjereno na 111k poteza (razine 1-120):
     prosjek 0,2 ms, nula krivih zabrana u usporedbi s iscrpnom pretragom.
     Ako rjesenja nema vec sada (spremljena igra iz verzije prije ove zabrane), svaki
     potez bi bio zabranjen - tada se ne zabranjuje nista. */
  function leadsToDeadEnd(from, to) {
    var next = G.clone(state);
    G.pour(next, from, to);
    if (L.solve(next, 30000) !== null) return false;
    return L.solve(state, 30000) !== null;
  }

  function markBlocked(i) {
    var el = bottleEls[i];
    var old = el.querySelector(".block-x");
    if (old) el.removeChild(old);
    var x = document.createElement("div");
    x.className = "block-x";
    el.appendChild(x);
    setTimeout(function () {
      if (x.parentNode) x.parentNode.removeChild(x);
    }, 950);
  }

  /* --- Odabir i potezi ---------------------------------------------------- */

  function select(i) {
    selected = i;
    for (var k = 0; k < bottleEls.length; k++) bottleEls[k].classList.toggle("selected", k === i);
  }

  function deselect() {
    selected = -1;
    for (var k = 0; k < bottleEls.length; k++) bottleEls[k].classList.remove("selected");
  }

  function shake(i) {
    var el = bottleEls[i];
    el.classList.remove("nope");
    void el.offsetWidth;
    el.classList.add("nope");
    setTimeout(function () {
      el.classList.remove("nope");
    }, 320);
  }

  function onTap(i) {
    if (busy || solved) return;
    SFX.unlock();
    clearHintMark();
    if (selected === -1) {
      if (!state[i].length || G.isDone(state[i])) {
        SFX.nope();
        return;
      }
      SFX.select();
      vibrate(6);
      select(i);
      return;
    }
    if (selected === i) {
      SFX.drop();
      deselect();
      return;
    }
    if (G.canPour(state, selected, i)) {
      if (opts.block && leadsToDeadEnd(selected, i)) {
        // Izvor ostaje podignut - igrac bira drugi cilj.
        SFX.nope();
        vibrate([30, 60, 30]);
        shake(i);
        markBlocked(i);
        return;
      }
      doPour(selected, i);
      return;
    }
    SFX.nope();
    shake(i);
    if (state[i].length && !G.isDone(state[i])) select(i);
    else deselect();
  }

  function doPour(from, to) {
    busy = true;
    undoStack.push({ s: G.clone(state), m: moves, e: extraUsed });
    if (undoStack.length > 200) undoStack.shift();

    var n = G.pourCount(state, from, to);
    var color = G.topColor(state[from]);
    var src = bottleEls[from];
    var dst = bottleEls[to];
    deselect();

    var bw = src.offsetWidth;
    var bh = src.offsetHeight;
    var srcCx = src.offsetLeft + bw / 2;
    var dstCx = dst.offsetLeft + bw / 2;
    var dir = dstCx >= srcCx ? 1 : -1;
    var mouthX = dstCx - dir * bw * 0.42;
    var mouthY = dst.offsetTop - bh * 0.3;
    var dx = mouthX - srcCx;
    var dy = mouthY - src.offsetTop;

    src.classList.add("pouring");
    src.style.transformOrigin = "50% 0%";
    src.style.transform = "translate(" + dx + "px," + dy + "px) rotate(" + dir * 72 + "deg)";

    var fill0 = state[to].length;

    function surfaceY(fill) {
      return dst.offsetTop + bh * (1 - fill / CAP);
    }

    sleep(310)
      .then(function () {
        stream.style.setProperty("--c", L.PALETTE[color % L.PALETTE.length]);
        stream.style.left = mouthX - 4.5 + "px";
        stream.style.top = mouthY + "px";
        stream.style.height = Math.max(10, surfaceY(fill0) - mouthY) + "px";
        stream.classList.add("on");
        return pourUnits(from, to, n, color, fill0, surfaceY);
      })
      .then(function () {
        stream.classList.remove("on");
        return sleep(90);
      })
      .then(function () {
        src.style.transform = "";
        return sleep(300);
      })
      .then(function () {
        src.classList.remove("pouring");
        src.style.transformOrigin = "";
        var followedPlan =
          plan && plan.length && planKey === G.key(state) && plan[0][0] === from && plan[0][1] === to;
        G.pour(state, from, to);
        moves++;
        if (followedPlan) {
          plan.shift();
          planKey = G.key(state);
        } else {
          dropPlan();
        }
        if (G.isDone(state[to]) && state[to].length === CAP) {
          SFX.complete();
          vibrate([10, 40, 10]);
          burst(dstCx, dst.offsetTop + bh * 0.1, L.PALETTE[color % L.PALETTE.length], 18);
        }
        busy = false;
        render();
        save();
        if (G.isSolved(state)) win();
      });
  }

  function pourUnits(from, to, n, color, fill0, surfaceY) {
    var i = 0;
    function step() {
      if (i >= n) return Promise.resolve();
      var segs = segEls[from];
      var top = segs.pop();
      if (top) {
        top.style.height = "0%";
        (function (el) {
          setTimeout(function () {
            if (el.parentNode) el.parentNode.removeChild(el);
          }, 140);
        })(top);
      }
      var slot = fill0 + i;
      var seg = makeSeg(color, slot);
      seg.style.height = "0%";
      var glass = bottleEls[to].querySelector(".glass");
      glass.insertBefore(seg, glass.querySelector(".gloss"));
      segEls[to].push(seg);
      requestAnimationFrame(function () {
        seg.style.height = "";
      });
      stream.style.height = Math.max(6, surfaceY(slot + 1) - parseFloat(stream.style.top)) + "px";
      burst(parseFloat(stream.style.left) + 4.5, surfaceY(slot + 1), L.PALETTE[color % L.PALETTE.length], 5);
      SFX.glug(i);
      vibrate(7);
      i++;
      return sleep(125).then(step);
    }
    return step();
  }

  /* --- Gumbi -------------------------------------------------------------- */

  function undo() {
    if (busy || !undoStack.length) return;
    var snap = undoStack.pop();
    state = snap.s;
    moves = snap.m;
    extraUsed = snap.e;
    selected = -1;
    solved = false;
    dropPlan();
    winEl.hidden = true;
    SFX.undo();
    render();
    save();
  }

  function restart() {
    if (busy) return;
    SFX.drop();
    startLevel(level);
  }

  function addBottle() {
    if (busy || extraUsed || solved) return;
    undoStack.push({ s: G.clone(state), m: moves, e: extraUsed });
    state.push([]);
    extraUsed = true;
    selected = -1;
    dropPlan();
    SFX.select();
    render();
    save();
  }

  /* Cijelo rjesenje se izracuna jednom i onda se servira potez po potez. Dok se igrac
     drzi plana, plan vodi do kraja - novo racunanje bi smjelo izabrati drugo, jednako
     kratko rjesenje, pa bi hint preskakao s jednog plana na drugi.
     Plan je najkrace rjesenje; dubinski solve() je rezerva ako A* stane na limitu. */
  function nextPlanned() {
    if (plan && plan.length && planKey === G.key(state)) return plan[0];
    var sol = L.solveShortest(state, 30000);
    if (sol === undefined) sol = L.solve(state, 120000);
    if (!sol) {
      plan = null;
      planKey = null;
      return sol; // null = dokazano nerjesivo, undefined = prekid na limitu
    }
    plan = sol;
    planKey = G.key(state);
    return plan[0];
  }

  function dropPlan() {
    plan = null;
    planKey = null;
  }

  function clearHintMark() {
    for (var i = 0; i < bottleEls.length; i++) bottleEls[i].classList.remove("hint-target");
  }

  function hint() {
    if (busy || solved) return;
    var m = nextPlanned();
    if (m === null) {
      // Moguce samo u spremljenoj igri iz verzije prije zabrane poteza.
      toast("Odavde nema rješenja - vrati potez ili kreni ispočetka.", 3000);
      SFX.nope();
      return;
    }
    if (m === undefined) {
      toast("Ne mogu naći potez odavde.", 2400);
      SFX.nope();
      return;
    }
    // Izvorna boca se podigne kao da si je sam tapnuo, ciljna zasvijetli - smjer je time
    // nedvosmislen. Tapkanje istog para u obrnutom smjeru zna biti legalno, ali gubitnicko.
    SFX.select();
    clearHintMark();
    select(m[0]);
    bottleEls[m[1]].classList.add("hint-target");
  }

  function win() {
    solved = true;
    selected = -1;
    var prev = best[level];
    if (!prev || moves < prev) best[level] = moves;
    saveOpts();
    updateHud();
    SFX.win();
    vibrate([12, 60, 12, 60, 24]);
    confetti();
    winMoves.textContent =
      "Razina " + level + " u " + moves + " poteza" + (prev && moves < prev ? " - novi rekord!" : "");
    setTimeout(function () {
      winEl.hidden = false;
    }, 650);
  }

  function nextLevel() {
    startLevel(level + 1);
  }

  /* --- Cestice ------------------------------------------------------------ */

  var parts = [];
  var fxCtx = fx.getContext("2d");
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var rafId = 0;

  function sizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    fx.width = Math.max(1, Math.round(board.clientWidth * dpr));
    fx.height = Math.max(1, Math.round(board.clientHeight * dpr));
    fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function burst(x, y, color, count) {
    for (var i = 0; i < count; i++) {
      parts.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 2.6,
        vy: -Math.random() * 2.4 - 0.4,
        r: Math.random() * 2.6 + 1.4,
        life: 1,
        decay: 0.024 + Math.random() * 0.02,
        color: color,
        g: 0.12,
      });
    }
    startFx();
  }

  function confetti() {
    var w = board.clientWidth;
    for (var i = 0; i < 110; i++) {
      parts.push({
        x: w / 2 + (Math.random() - 0.5) * w * 0.6,
        y: board.clientHeight * 0.45,
        vx: (Math.random() - 0.5) * 9,
        vy: -Math.random() * 9 - 2,
        r: Math.random() * 3.6 + 2,
        life: 1,
        decay: 0.008 + Math.random() * 0.008,
        color: L.PALETTE[Math.floor(Math.random() * L.PALETTE.length)],
        g: 0.22,
      });
    }
    startFx();
  }

  function startFx() {
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  function tick() {
    fxCtx.clearRect(0, 0, board.clientWidth, board.clientHeight);
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) {
        parts.splice(i, 1);
        continue;
      }
      fxCtx.globalAlpha = Math.max(0, p.life);
      fxCtx.fillStyle = p.color;
      fxCtx.beginPath();
      fxCtx.arc(p.x, p.y, p.r, 0, 6.283);
      fxCtx.fill();
    }
    fxCtx.globalAlpha = 1;
    if (parts.length) {
      rafId = requestAnimationFrame(tick);
    } else {
      rafId = 0;
      fxCtx.clearRect(0, 0, board.clientWidth, board.clientHeight);
    }
  }

  /* --- Vezanje dogadaja --------------------------------------------------- */

  bottlesWrap.addEventListener("click", function (e) {
    var el = e.target.closest ? e.target.closest(".bottle") : null;
    if (!el) return;
    onTap(Number(el.dataset.i));
  });

  document.getElementById("undo-btn").addEventListener("click", undo);
  document.getElementById("restart-btn").addEventListener("click", restart);
  document.getElementById("addbottle-btn").addEventListener("click", addBottle);
  document.getElementById("hint-btn").addEventListener("click", hint);
  document.getElementById("next-btn").addEventListener("click", nextLevel);

  /* --- Izbornik ----------------------------------------------------------- */

  var menuEl = document.getElementById("menu");
  var menuMain = document.getElementById("menu-main");
  var menuOpts = document.getElementById("menu-opts");
  var menuLevels = document.getElementById("menu-levels");
  var levelGrid = document.getElementById("level-grid");
  var optSound = document.getElementById("opt-sound");
  var optBlock = document.getElementById("opt-block");

  function openMenu() {
    if (busy) return;
    clearHintMark();
    deselect();
    document.getElementById("menu-level").textContent = "Razina " + level;
    showCard(menuMain);
    menuEl.hidden = false;
  }

  function showCard(card) {
    menuMain.hidden = card !== menuMain;
    menuOpts.hidden = card !== menuOpts;
    menuLevels.hidden = card !== menuLevels;
  }

  /* Otkljucane su sve razine do prve nerijesene - izvodi se iz rekorda (ws:best) i
     trenutne razine, pa ne treba zaseban zapis. */
  function maxUnlocked() {
    var m = level;
    for (var k in best) if (best.hasOwnProperty(k) && Number(k) + 1 > m) m = Number(k) + 1;
    return m;
  }

  function openLevels() {
    SFX.unlock();
    SFX.select();
    levelGrid.innerHTML = "";
    var max = maxUnlocked();
    var cur = null;
    for (var n = 1; n <= max; n++) {
      var b = document.createElement("button");
      b.className = "lvl";
      b.dataset.n = String(n);
      b.appendChild(document.createTextNode(String(n)));
      if (best[n]) {
        b.classList.add("solved");
        var bs = document.createElement("span");
        bs.className = "lvl-best";
        bs.textContent = best[n];
        b.appendChild(bs);
      }
      if (n === level) {
        b.classList.add("current");
        cur = b;
      }
      levelGrid.appendChild(b);
    }
    showCard(menuLevels);
    if (cur) cur.scrollIntoView({ block: "center" });
  }

  levelGrid.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest(".lvl") : null;
    if (!b) return;
    var n = Number(b.dataset.n);
    // Trenutna razina se nastavlja gdje je stala, ostale krecu ispocetka.
    if (n !== level) startLevel(n);
    play();
  });

  function play() {
    SFX.unlock();
    SFX.select();
    menuEl.hidden = true;
    showFirstTip();
  }

  document.getElementById("menu-btn").addEventListener("click", openMenu);
  document.getElementById("play-btn").addEventListener("click", play);
  document.getElementById("opts-btn").addEventListener("click", function () {
    SFX.unlock();
    SFX.select();
    optSound.checked = opts.sound;
    optBlock.checked = opts.block;
    showCard(menuOpts);
  });
  document.getElementById("levels-btn").addEventListener("click", openLevels);
  function back() {
    SFX.drop();
    showCard(menuMain);
  }
  document.getElementById("opts-back").addEventListener("click", back);
  document.getElementById("levels-back").addEventListener("click", back);

  optSound.addEventListener("change", function () {
    opts.sound = optSound.checked;
    SFX.setEnabled(opts.sound);
    if (opts.sound) SFX.select();
    saveOpts();
  });

  optBlock.addEventListener("change", function () {
    opts.block = optBlock.checked;
    SFX.select();
    saveOpts();
  });

  document.addEventListener("contextmenu", function (e) {
    e.preventDefault();
  });

  var resizeT = 0;
  window.addEventListener("resize", function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () {
      if (!busy) render();
    }, 150);
  });

  /* --- Start -------------------------------------------------------------- */

  // Verzija se cita iz package.json da ne postoji drugi izvor istine.
  // Preko file:// fetch ne prolazi - tada se broj jednostavno ne prikazuje.
  function showVersion() {
    fetch("package.json")
      .then(function (r) {
        return r.json();
      })
      .then(function (p) {
        if (p && p.version) document.getElementById("version").textContent = "v" + p.version;
      })
      .catch(function () {
        /* nema verzije za prikaz */
      });
  }

  function boot() {
    var restored = loadAll();
    SFX.setEnabled(opts.sound);
    showVersion();
    if (restored) {
      render();
      if (G.isSolved(state)) win();
    } else {
      startLevel(1);
    }
    openMenu();
  }

  function showFirstTip() {
    if (localStorage.getItem(KEY_SEEN)) return;
    toast("Tapni bocu pa drugu - ista boja se slijeva na istu.", 4200);
    try {
      localStorage.setItem(KEY_SEEN, "1");
    } catch (e) {
      /* ignoriraj */
    }
  }

  boot();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {
        /* offline rad nije dostupan, igra i dalje radi */
      });
    });
  }
})();
