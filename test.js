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

assert.strictEqual(peg([c(2,'♥'), c(9,'♥'), c(4,'♥')]), 5, 'Auslegen: 15 für 2 + Flush 3');
assert.strictEqual(peg([c(2,'♥'), c(9,'♣'), c(4,'♥')]), 2, 'Auslegen: nur 15');
assert.strictEqual(peg([c(3,'♥'), c(4,'♥'), c(5,'♥')]), 6, 'Auslegen: Straße 3 + Flush 3');
assert.strictEqual(peg([c(3,'♥'), c(4,'♥'), c(5,'♥'), c(6,'♥')]), 8, 'Auslegen: Straße 4 + Flush 4');
assert.strictEqual(peg([c(7,'♠'), c(7,'♥'), c(7,'♦')]), 6, 'Auslegen: Drilling');

// Ganze Spiele zufällig durchspielen: keine Fehler, Ende bei 121
for (let n = 0; n < 300; n++) {
  const g = new Game(['A', 'B']);
  let guard = 0;
  while (!g.over && guard++ < 5000) {
    if (g.phase === 'discard') { for (const p of [0, 1]) if (!g.discards[p]) g.act(p, { type: 'discard', cards: g.hands[p].slice(0, 2).map(x => x.id) }); }
    else if (g.phase === 'peg') { const card = g.peg[g.turn].find(x => g.count + Math.min(x.r, 10) <= 31); g.act(g.turn, { type: 'play', card: card.id }); }
    else if (g.phase === 'count') g.act(0, { type: 'next', step: g.step });
  }
  assert.ok(g.over && Math.max(...g.score) === 121, 'Spiel endet bei 121');
}
console.log('Alle Tests bestanden.');
