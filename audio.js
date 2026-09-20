/* Zvuk se sintetizira u WebAudiju - nema audio datoteka, nema dodatnog prometa. */
(function (global) {
  "use strict";

  var ctx = null;
  var master = null;
  var enabled = true;
  var noiseBuf = null;

  function ensure() {
    if (!enabled) return null;
    if (!ctx) {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.32;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, freq2, dur, type, vol, delay) {
    var c = ensure();
    if (!c) return;
    var t0 = c.currentTime + (delay || 0);
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (freq2 && freq2 !== freq) osc.frequency.exponentialRampToValueAtTime(freq2, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.5, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, filterFreq, vol) {
    var c = ensure();
    if (!c) return;
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate * 0.4, c.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var t0 = c.currentTime;
    var src = c.createBufferSource();
    src.buffer = noiseBuf;
    var bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = filterFreq || 900;
    bp.Q.value = 1.2;
    var g = c.createGain();
    g.gain.setValueAtTime(vol || 0.12, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp);
    bp.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur);
  }

  var SFX = {
    setEnabled: function (v) {
      enabled = !!v;
      if (enabled) ensure();
    },
    isEnabled: function () {
      return enabled;
    },
    unlock: function () {
      ensure();
    },
    select: function () {
      tone(560, 820, 0.07, "triangle", 0.35);
    },
    drop: function () {
      tone(420, 300, 0.06, "sine", 0.25);
    },
    // Svaki preliveni segment zvuci malo vise - cuje se koliko je otislo.
    glug: function (i) {
      var base = 200 + i * 45;
      tone(base, base * 1.9, 0.14, "sine", 0.4);
      noise(0.1, 600 + i * 120, 0.07);
    },
    complete: function () {
      tone(880, 880, 0.18, "triangle", 0.35);
      tone(1320, 1320, 0.22, "sine", 0.28, 0.06);
    },
    nope: function () {
      tone(150, 110, 0.12, "square", 0.18);
    },
    undo: function () {
      tone(340, 240, 0.08, "triangle", 0.22);
    },
    win: function () {
      var notes = [523, 659, 784, 1047];
      for (var i = 0; i < notes.length; i++) {
        tone(notes[i], notes[i], 0.32, "triangle", 0.34, i * 0.1);
      }
    },
  };

  global.WSAudio = SFX;
})(typeof globalThis !== "undefined" ? globalThis : this);
