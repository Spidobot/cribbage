// Cribbage-Spiellogik für zwei Spieler. Hausregel: Flush zählt immer.
'use strict';

const SUITS = ['♠', '♥', '♦', '♣'];
const RN = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'D', 'K'];
const WIN = 121;
const PEG_FLUSH_MIN = 4; // Auslegen: ab so vielen gleichfarbigen Karten in Folge zählt ein Flush

const val = c => Math.min(c.r, 10);
const fmt = c => RN[c.r] + c.s;
const fmtAll = cs => cs.map(fmt).join(' ');
const total = items => items.reduce((a, i) => a + i.p, 0);

function newDeck() {
  const d = [];
  for (const s of SUITS) for (let r = 1; r <= 13; r++) d.push({ r, s, id: s + r });
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}

function isRun(cs) {
  const rs = cs.map(c => c.r).sort((a, b) => a - b);
  for (let i = 1; i < rs.length; i++) if (rs[i] !== rs[i - 1] + 1) return false;
  return true;
}

// Hand oder Krippe (4 Karten) mit Startkarte zählen
function scoreHand(hand, starter) {
  const all = starter ? [...hand, starter] : [...hand];
  const n = all.length, items = [], subsets = [];
  for (let m = 1; m < (1 << n); m++) {
    const cs = []; for (let i = 0; i < n; i++) if (m >> i & 1) cs.push(all[i]);
    subsets.push(cs);
  }
  for (const cs of subsets) if (cs.length >= 2 && cs.reduce((a, c) => a + val(c), 0) === 15)
    items.push({ t: '15', p: 2, cs });
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (all[i].r === all[j].r)
    items.push({ t: 'Paar', p: 2, cs: [all[i], all[j]] });
  for (let L = n; L >= 3; L--) {
    const runs = subsets.filter(cs => cs.length === L && isRun(cs));
    if (runs.length) { runs.forEach(cs => items.push({ t: 'Straße', p: L, cs })); break; }
  }
  // Hausregel: Flush zählt immer – auch in der Krippe schon mit 4 Karten
  if (hand.length >= 4 && hand.every(c => c.s === hand[0].s)) {
    if (starter && starter.s === hand[0].s) items.push({ t: 'Flush', p: 5, cs: all, flush: true });
    else items.push({ t: 'Flush', p: 4, cs: hand, flush: true });
  }
  if (starter) for (const c of hand) if (c.r === 11 && c.s === starter.s)
    items.push({ t: 'Junge der Startfarbe', p: 1, cs: [c] });
  return items;
}

// Punkte für die zuletzt gelegte Karte beim Auslegen
function pegScore(pile, count) {
  const items = [], last = pile[pile.length - 1];
  if (count === 15) items.push({ t: '15', p: 2 });
  if (count === 31) items.push({ t: '31', p: 2 });
  let k = 1; while (k < pile.length && pile[pile.length - 1 - k].r === last.r) k++;
  if (k >= 2) items.push({ t: ['', '', 'Paar', 'Drilling', 'Vierling'][k], p: [0, 0, 2, 6, 12][k] });
  for (let L = pile.length; L >= 3; L--) {
    const seq = pile.slice(-L);
    if (new Set(seq.map(c => c.r)).size === L && isRun(seq)) { items.push({ t: 'Straße aus ' + L, p: L }); break; }
  }
  let f = 1; while (f < pile.length && pile[pile.length - 1 - f].s === last.s) f++;
  if (f >= PEG_FLUSH_MIN) items.push({ t: 'Flush aus ' + f, p: f, flush: true });
  return items;
}

const itemText = i => (i.cs ? `${i.t} für ${i.p} (${fmtAll(i.cs)})` : `${i.t} für ${i.p}`);
const sortHand = h => h.sort((a, b) => a.r - b.r || a.s.localeCompare(b.s));

/* ---------- Bewertung: wie gut war ein Zug mit dem, was man wusste? ---------- */
const FULL = (() => { const d = []; for (const s of SUITS) for (let r = 1; r <= 13; r++) d.push({ r, s, id: s + r }); return d; })();
function pickRandom(arr, n) {
  const a = arr.slice();
  for (let i = 0; i < n; i++) { const j = i + Math.floor(Math.random() * (a.length - i)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}

// Alle 15 Möglichkeiten, 2 von 6 Karten abzulegen: erwartete Punkte (Hand ± Krippe)
function evalDiscards(hand6, isDealer) {
  const ids = new Set(hand6.map(c => c.id));
  const unseen = FULL.filter(c => !ids.has(c.id));
  const samples = Array.from({ length: 300 }, () => pickRandom(unseen, 3)); // Startkarte + 2 Krippenkarten des Gegners
  const opts = [];
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) {
    const keep = hand6.filter((_, k) => k !== i && k !== j), toss = [hand6[i], hand6[j]];
    let h = 0; for (const s of unseen) h += total(scoreHand(keep, s));
    let cr = 0; for (const [s, a, b] of samples) cr += total(scoreHand([...toss, a, b], s));
    h /= unseen.length; cr /= samples.length;
    opts.push({ toss, ev: h + (isDealer ? cr : -cr) });
  }
  return opts;
}

// Für jede legbare Karte: eigene Punkte minus erwartete beste Antwort des Gegners
function evalPeg(pile, count, playable, unseen, oppCount) {
  const samples = oppCount ? Array.from({ length: 150 }, () => pickRandom(unseen, Math.min(oppCount, unseen.length))) : [];
  return playable.map(c => {
    const pile2 = [...pile, c], cnt = count + val(c);
    const pts = total(pegScore(pile2, cnt));
    let risk = 0;
    if (cnt < 31 && samples.length) {
      for (const hand of samples) {
        let best = 0;
        for (const oc of hand) if (cnt + val(oc) <= 31) best = Math.max(best, total(pegScore([...pile2, oc], cnt + val(oc))));
        risk += best;
      }
      risk /= samples.length;
    }
    return { card: c, ev: pts - risk, pts, risk };
  });
}

function rate(opts, chosenEv) {
  const evs = opts.map(o => o.ev), best = Math.max(...evs), worst = Math.min(...evs);
  return { bestEv: best, worstEv: worst, ev: chosenEv, pct: best - worst < 0.05 ? 100 : Math.round(100 * (chosenEv - worst) / (best - worst)) };
}

class Game {
  constructor(names) {
    this.names = names; // [name0, name1]
    this.score = [0, 0];
    this.back = [0, 0]; // hinterer Stecker auf dem Brett
    this.dealer = Math.random() < 0.5 ? 0 : 1;
    this.over = false;
    this.winner = null;
    this.log = [];
    this.events = []; this.evId = 0;
    this.decisions = []; // bewertete Entscheidungen beider Spieler
    this.round = 0;
    // Kennzahlen für Vergleich und Siegerehrung
    this.tally = [0, 1].map(() => ({ peg: 0, hand: 0, crib: 0, best: 0, flush: 0, go: 0, t31: 0, zero: 0 }));
    this.addLog(`${names[this.dealer]} gibt zuerst.`);
    this.newRound();
  }

  addLog(text, kind) { this.log.push({ text, kind }); if (this.log.length > 150) this.log.shift(); }
  emit(e) { this.events.push({ id: ++this.evId, ...e }); if (this.events.length > 40) this.events.shift(); }

  award(p, pts, why, items) {
    if (this.over || pts <= 0) return;
    this.back[p] = this.score[p];
    this.score[p] = Math.min(WIN, this.score[p] + pts);
    this.addLog(`${this.names[p]} +${pts}: ${why}`, 'pts');
    this.emit({ kind: 'points', p, pts, why: items ? items.map(i => `${i.t} +${i.p}`).join(' · ') : why });
    if (this.score[p] >= WIN) {
      this.over = true; this.winner = p; this.phase = 'over';
      this.addLog(`${this.names[p]} gewinnt ${WIN} zu ${this.score[1 - p]}.`, 'win');
      this.emit({ kind: 'win', p });
    }
  }

  newRound() {
    const d = newDeck();
    this.round++;
    this.deck = d;
    this.hands = [sortHand(d.splice(0, 6)), sortHand(d.splice(0, 6))];
    this.orig = [[...this.hands[0]], [...this.hands[1]]];
    this.discards = [null, null];
    this.crib = []; this.starter = null; this.phase = 'discard';
    this.seqs = [{ cards: [], end: null }]; // alle Auslege-Folgen der Runde bleiben sichtbar
    this.count = 0; this.peg = null; this.turn = null; this.lastPlayer = null;
    this.step = -1; this.breakdown = null;
    this.addLog(`Neue Runde – Geber: ${this.names[this.dealer]}`, 'round');
    this.emit({ kind: 'round' });
  }

  get pile() { return this.seqs[this.seqs.length - 1].cards; }

  endSeq(type) {
    this.seqs[this.seqs.length - 1].end = { type, p: this.lastPlayer };
    this.seqs.push({ cards: [], end: null });
    this.count = 0;
  }

  // Aktion eines Spielers; wirft Error mit konkretem Text bei ungültigem Zug
  act(p, a) {
    if (this.over) throw new Error('Das Spiel ist vorbei.');
    if (a.type === 'discard') return this.discard(p, a.cards);
    if (a.type === 'play') return this.play(p, a.card);
    if (a.type === 'next') {
      if (this.phase === 'count' && a.step !== this.step) return; // beide haben gleichzeitig geklickt
      return this.nextCount();
    }
    throw new Error('Unbekannte Aktion: ' + a.type);
  }

  discard(p, ids) {
    if (this.phase !== 'discard') throw new Error('Gerade wird nicht abgelegt.');
    if (this.discards[p]) throw new Error('Du hast schon 2 Karten in die Krippe gelegt.');
    if (!Array.isArray(ids) || ids.length !== 2 || ids[0] === ids[1]) throw new Error('Wähle genau 2 verschiedene Karten.');
    const cards = ids.map(id => this.hands[p].find(c => c.id === id));
    if (cards.some(c => !c)) throw new Error('Diese Karte ist nicht in deiner Hand.');

    const opts = evalDiscards(this.hands[p], this.dealer === p);
    const mine = opts.find(o => o.toss.every(c => cards.includes(c)));
    const bestOpt = opts.reduce((a, b) => (b.ev > a.ev ? b : a));
    this.decisions.push({ p, round: this.round, kind: 'discard', chosen: cards, best: bestOpt.toss, ...rate(opts, mine.ev) });

    this.discards[p] = cards;
    this.hands[p] = this.hands[p].filter(c => !cards.includes(c));
    this.addLog(`${this.names[p]} hat 2 Karten in die Krippe gelegt.`);
    this.emit({ kind: 'discard', p });
    if (!this.discards[0] || !this.discards[1]) return;

    this.crib = [...this.discards[0], ...this.discards[1]];
    this.starter = this.deck.shift();
    this.addLog(`Startkarte: ${fmt(this.starter)}`);
    this.emit({ kind: 'starter' });
    if (this.starter.r === 11) this.award(this.dealer, 2, `Junge als Startkarte (${fmt(this.starter)})`, [{ t: 'Junge als Startkarte', p: 2 }]);
    if (this.over) return;
    this.phase = 'peg';
    this.peg = [[...this.hands[0]], [...this.hands[1]]];
    this.turn = 1 - this.dealer;
    this.resolve();
  }

  canPlay(p) { return this.peg[p].some(c => this.count + val(c) <= 31); }

  play(p, id) {
    if (this.phase !== 'peg') throw new Error('Gerade wird nicht ausgelegt.');
    if (this.turn !== p) throw new Error(`${this.names[1 - p]} ist dran.`);
    const card = this.peg[p].find(c => c.id === id);
    if (!card) throw new Error('Diese Karte hast du nicht mehr.');
    if (this.count + val(card) > 31) throw new Error(`${fmt(card)} geht nicht: ${this.count} + ${val(card)} wäre über 31.`);

    const playable = this.peg[p].filter(c => this.count + val(c) <= 31);
    if (playable.length > 1) {
      const o = 1 - p, played = this.seqs.flatMap(s => s.cards);
      const known = new Set([...this.orig[p], this.starter, ...played].map(c => c.id));
      const opts = evalPeg(this.pile, this.count, playable, FULL.filter(c => !known.has(c.id)), this.peg[o].length);
      const mine = opts.find(x => x.card === card), bestOpt = opts.reduce((a, b) => (b.ev > a.ev ? b : a));
      this.decisions.push({ p, round: this.round, kind: 'peg', chosen: [card], best: [bestOpt.card], count: this.count, ...rate(opts, mine.ev) });
    }

    this.peg[p] = this.peg[p].filter(c => c !== card);
    this.pile.push(card); this.count += val(card); this.lastPlayer = p;
    const items = pegScore(this.pile, this.count);
    this.addLog(`${this.names[p]} legt ${fmt(card)} → ${this.count}`);
    this.emit({ kind: 'play', p, card: card.id, count: this.count });
    if (items.length) {
      const T = this.tally[p];
      T.peg += total(items);
      if (items.some(i => i.flush)) T.flush++;
      if (this.count === 31) T.t31++;
    }
    if (items.length) this.award(p, total(items), items.map(itemText).join(', '), items);
    if (this.over) return;
    if (this.count === 31) { this.endSeq('31'); this.addLog('31 – Zählstand zurück auf 0.'); }
    this.turn = 1 - p;
    this.resolve();
  }

  // Go und Rundenende automatisch abwickeln, bis jemand legen kann
  resolve() {
    for (;;) {
      if (this.over) return;
      if (!this.peg[0].length && !this.peg[1].length) {
        if (this.count > 0) {
          this.tally[this.lastPlayer].peg++;
          this.award(this.lastPlayer, 1, `letzte Karte (Zählstand ${this.count})`, [{ t: 'Letzte Karte', p: 1 }]);
          this.seqs[this.seqs.length - 1].end = { type: 'last', p: this.lastPlayer };
        }
        if (this.over) return;
        this.phase = 'count'; this.step = -1; this.breakdown = null;
        this.addLog('Alle Karten gelegt – jetzt wird gezählt.');
        return;
      }
      const p = this.turn, o = 1 - p;
      if (this.canPlay(p)) return;
      if (!this.canPlay(o)) {
        this.tally[this.lastPlayer].peg++; this.tally[this.lastPlayer].go++;
        this.award(this.lastPlayer, 1, `Go – keiner kann mehr legen (Zählstand ${this.count})`, [{ t: 'Go', p: 1 }]);
        if (this.over) return;
        this.endSeq('go');
        this.turn = 1 - this.lastPlayer;
        this.addLog('Zählstand zurück auf 0.');
        continue;
      }
      if (this.peg[p].length) {
        this.addLog(`${this.names[p]}: Go (keine Karte passt, Zählstand ${this.count})`);
        this.emit({ kind: 'go', p, count: this.count });
      }
      this.turn = o;
    }
  }

  nextCount() {
    if (this.phase !== 'count') throw new Error('Gerade wird nicht gezählt.');
    this.step++;
    const nd = 1 - this.dealer, d = this.dealer;
    const steps = [
      { p: nd, cards: this.hands[nd], label: `Hand von ${this.names[nd]}` },
      { p: d, cards: this.hands[d], label: `Hand von ${this.names[d]}` },
      { p: d, cards: this.crib, label: `Krippe von ${this.names[d]}` },
    ];
    if (this.step >= steps.length) { this.dealer = 1 - this.dealer; return this.newRound(); }
    const s = steps[this.step], items = scoreHand(s.cards, this.starter), pts = total(items);
    this.breakdown = { ...s, items, pts };
    this.emit({ kind: 'count', p: s.p, pts });
    const T = this.tally[s.p];
    T[this.step === 2 ? 'crib' : 'hand'] += pts;
    T.best = Math.max(T.best, pts);
    if (items.some(i => i.flush)) T.flush++;
    if (!pts) T.zero++;
    if (pts) this.award(s.p, pts, `${s.label}: ${items.map(itemText).join(', ')}`, [{ t: s.label.split(' ')[0], p: pts }]);
    else this.addLog(`${s.label}: 19 🤡 – 0 Punkte (${fmtAll(s.cards)} + ${fmt(this.starter)})`);
  }

  // Was Spieler p sehen darf
  view(p) {
    const o = 1 - p;
    const reveal = this.phase === 'count' || this.phase === 'over';
    const oppCards = this.phase === 'peg' ? this.peg[o] : this.hands[o];
    // Bewertungen des Gegners aus der laufenden Runde erst nach dem Auslegen zeigen (sonst verraten sie seine Karten)
    const decisions = this.decisions.filter(d => d.p === p || d.round < this.round || reveal);
    const stats = [0, 1].map(q => {
      const s = {};
      for (const kind of ['discard', 'peg', 'all']) {
        const ds = decisions.filter(d => d.p === q && (kind === 'all' || d.kind === kind));
        const possible = ds.reduce((a, d) => a + d.bestEv - d.worstEv, 0), got = ds.reduce((a, d) => a + d.ev - d.worstEv, 0);
        s[kind] = { n: ds.length, pct: possible < 0.05 ? (ds.length ? 100 : null) : Math.round(100 * got / possible), lost: ds.reduce((a, d) => a + d.bestEv - d.ev, 0) };
      }
      return s;
    });
    return {
      phase: this.phase, me: p, names: this.names, score: this.score, back: this.back, dealer: this.dealer,
      winner: this.winner, win: WIN, round: this.round,
      hand: this.phase === 'peg' ? this.peg[p] : this.hands[p],
      opp: reveal ? oppCards : oppCards.map(() => null),
      crib: this.crib.map(c => (reveal && (this.step >= 2 || this.phase === 'over') ? c : null)),
      starter: this.starter, seqs: this.seqs, count: this.count, turn: this.turn,
      discarded: this.discards.map(Boolean),
      breakdown: this.breakdown, step: this.step,
      log: this.log.slice(-80), events: this.events,
      stats, decisions: decisions.slice(-60),
      tally: this.tally,
    };
  }
}

module.exports = { Game, scoreHand, pegScore, evalDiscards, evalPeg, total, val, fmt };
