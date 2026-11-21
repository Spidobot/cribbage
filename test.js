// Prüft die Wertung, v. a. die Hausregel „Flush zählt immer“.
const assert = require('assert');
const { Game, scoreHand, pegScore, total } = require('./game');
const c = (r, s) => ({ r, s, id: s + r });
const hand = (h, st) => total(scoreHand(h, st));
const peg = cards => total(pegScore(cards, cards.reduce((a, x) => a + Math.min(x.r, 10), 0)));

const flush4 = [c(2,'♥'), c(3,'♥'), c(7,'♥'), c(9,'♥')];
assert.strictEqual(hand(flush4, c(13,'♠')), 6, 'Hand: 15 für 2 + Flush 4');
assert.strictEqual(hand(flush4, c(10,'♥')), 7, 'Hand: 15 für 2 + Flush 5 mit Startkarte');
assert.strictEqual(hand([c(5,'♠'), c(5,'♥'), c(5,'♦'), c(11,'♣')], c(5,'♣')), 29, 'Höchste Hand 29');
assert.strictEqual(hand([c(2,'♥'), c(3,'♥'), c(7,'♥'), c(9,'♣')], c(13,'♥')), 2, 'kein Flush mit nur 3 Handkarten');

assert.strictEqual(peg([c(2,'♥'), c(9,'♥'), c(4,'♥')]), 2, 'Auslegen: 3 gleichfarbige sind kein Flush, nur 15');
assert.strictEqual(peg([c(2,'♥'), c(9,'♥'), c(4,'♥'), c(13,'♥')]), 4, 'Auslegen: Flush aus 4');
assert.strictEqual(peg([c(2,'♥'), c(9,'♣'), c(4,'♥')]), 2, 'Auslegen: nur 15');
assert.strictEqual(peg([c(3,'♥'), c(4,'♥'), c(5,'♥')]), 3, 'Auslegen: 3 gleichfarbige = nur Straße 3');
assert.strictEqual(peg([c(3,'♥'), c(4,'♥'), c(5,'♥'), c(6,'♥')]), 8, 'Auslegen: Straße 4 + Flush 4');
assert.strictEqual(peg([c(7,'♠'), c(7,'♥'), c(7,'♦')]), 6, 'Auslegen: Drilling');

// Ganze Spiele zufällig durchspielen: keine Fehler, Ende bei 121
for (let n = 0; n < 30; n++) {
  const g = new Game(['A', 'B']);
  let guard = 0;
  while (!g.over && guard++ < 5000) {
    if (g.phase === 'discard') { for (const p of [0, 1]) if (!g.discards[p]) g.act(p, { type: 'discard', cards: g.hands[p].slice(0, 2).map(x => x.id) }); }
    else if (g.phase === 'peg') { const card = g.peg[g.turn].find(x => g.count + Math.min(x.r, 10) <= 31); g.act(g.turn, { type: 'play', card: card.id }); }
    else if (g.phase === 'count') { for (const p of [0, 1]) if (g.cview[p] < g.csteps.length) g.act(p, { type: 'next', step: g.cview[p] }); }
  }
  assert.ok(g.over && Math.max(...g.score) === 121, 'Spiel endet bei 121');
}
console.log('Alle Tests bestanden.');

// Bewertung: beste Wahl = 100 %, schlechteste = 0 %
{
  const g = new Game(['A', 'B']);
  const { evalDiscards } = require('./game');
  const opts = evalDiscards(g.hands[0], g.dealer === 0);
  const best = opts.reduce((a, b) => (b.ev > a.ev ? b : a));
  g.act(0, { type: 'discard', cards: best.toss.map(c => c.id) });
  const d = g.decisions[0];
  assert.ok(d.pct >= 95, 'beste Auswahl ~100 %, war ' + d.pct);
  const v = g.view(0), w = g.view(1);
  assert.strictEqual(v.decisions.length, 1, 'eigene Bewertung sofort sichtbar');
  assert.strictEqual(w.decisions.length, 0, 'gegnerische Bewertung erst nach dem Auslegen');
}
console.log('Bewertungstests bestanden.');

// Zählen im eigenen Tempo: erst wenn beide durch sind, geht es weiter
{
  let g;
  do {
    g = new Game(['A', 'B']);
    for (const p of [0, 1]) g.act(p, { type: 'discard', cards: g.hands[p].slice(0, 2).map(x => x.id) });
    while (g.phase === 'peg') { const card = g.peg[g.turn].find(x => g.count + Math.min(x.r, 10) <= 31); g.act(g.turn, { type: 'play', card: card.id }); }
  } while (g.over);
  const before = g.view(1).score.slice();
  g.act(0, { type: 'next', step: -1 });
  g.act(0, { type: 'next', step: 0 });
  assert.strictEqual(g.view(0).step, 1, 'A ist bei Schritt 1');
  assert.deepStrictEqual(g.view(1).score, before, 'B sieht noch den alten Stand');
  assert.strictEqual(g.view(1).breakdown, null, 'B sieht noch keine Zählung');
  g.act(0, { type: 'next', step: 1 }); g.act(0, { type: 'next', step: 2 });
  assert.strictEqual(g.round, 1, 'A ist fertig, aber B noch nicht – keine neue Runde');
  for (let k = -1; k < 3; k++) g.act(1, { type: 'next', step: k });
  assert.strictEqual(g.round, 2, 'beide fertig – neue Runde');
}
console.log('Tempo-Tests bestanden.');
