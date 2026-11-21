// Kleiner Cribbage-Server für genau zwei Spieler. Keine Abhängigkeiten außer Node.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Game } = require('./game');

const PORT = Number(process.env.PORT) || 3000;
const PASSWORD = process.env.PASSWORD || ''; // optional: Passwort zum Hinsetzen (Unraid-Variable PASSWORD)

const seats = [null, null]; // { name, token }
let game = null;
const clients = new Set(); // { res, seat }

function seatOf(token) { return token ? seats.findIndex(s => s && s.token === token) : -1; }

function stateFor(seat) {
  const lobby = { names: seats.map(s => (s ? s.name : null)), joinCode: !!PASSWORD };
  if (seat < 0) return { lobby, seat: -1, full: !!(seats[0] && seats[1]) };
  if (!game) return { lobby, seat };
  return { lobby, seat, game: game.view(seat) };
}

function broadcast() {
  for (const c of clients) c.res.write(`data: ${JSON.stringify(stateFor(seatOf(c.token)))}\n\n`);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', d => { b += d; if (b.length > 1e4) req.destroy(); });
    req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch { reject(new Error('Ungültige Anfrage (kein JSON).')); } });
  });
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    const page = { '/': ['index.html', 'text/html; charset=utf-8'], '/impressum': ['impressum.html', 'text/html; charset=utf-8'],
      '/logo.svg': ['logo.svg', 'image/svg+xml'] }[url.pathname];
    if (req.method === 'GET' && page) {
      res.writeHead(200, { 'Content-Type': page[1] });
      return fs.createReadStream(path.join(__dirname, 'public', page[0])).pipe(res);
    }
    if (req.method === 'GET' && url.pathname === '/api/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      const c = { res, token: url.searchParams.get('token') || '' };
      clients.add(c);
      res.write(`data: ${JSON.stringify(stateFor(seatOf(c.token)))}\n\n`);
      req.on('close', () => clients.delete(c));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/join') {
      const { name, code } = await readBody(req);
      const n = String(name || '').trim().slice(0, 20);
      if (!n) return json(res, 400, { error: 'Bitte gib einen Namen ein.' });
      if (PASSWORD && code !== PASSWORD) return json(res, 403, { error: 'Das Passwort stimmt nicht.' });
      const free = seats.findIndex(s => !s);
      if (free < 0) return json(res, 409, { error: `Beide Plätze sind belegt (${seats[0].name} und ${seats[1].name}).` });
      if (seats.some(s => s && s.name.toLowerCase() === n.toLowerCase())) return json(res, 409, { error: `Der Name „${n}“ ist schon vergeben.` });
      const token = crypto.randomBytes(16).toString('hex');
      seats[free] = { name: n, token };
      if (seats[0] && seats[1]) game = new Game([seats[0].name, seats[1].name]);
      json(res, 200, { token, seat: free });
      return broadcast();
    }
    if (req.method === 'POST' && url.pathname === '/api/action') {
      const body = await readBody(req);
      const seat = seatOf(body.token);
      if (seat < 0) return json(res, 403, { error: 'Du sitzt nicht am Tisch – bitte neu beitreten.' });
      if (body.type === 'newgame') {
        if (!game || !game.over) return json(res, 400, { error: 'Ein neues Spiel geht erst, wenn das aktuelle vorbei ist.' });
        game = new Game([seats[0].name, seats[1].name]);
      } else if (body.type === 'leave') {
        seats[seat] = null; game = null;
      } else {
        if (!game) return json(res, 400, { error: 'Es fehlt noch der zweite Spieler.' });
        game.act(seat, body);
      }
      json(res, 200, { ok: true });
      return broadcast();
    }
    res.writeHead(404); res.end('Nicht gefunden');
  } catch (e) {
    json(res, 400, { error: e.message });
  }
});

setInterval(() => { for (const c of clients) c.res.write(': ping\n\n'); }, 25000);
server.listen(PORT, () => console.log(`Cribbage läuft auf Port ${PORT}${PASSWORD ? ' (mit Passwort)' : ' (ohne Passwort)'}`));
