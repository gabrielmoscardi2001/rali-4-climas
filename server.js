/* ============================================================
   RALI 4 CLIMAS - servidor
   - serve a tela (host) e o controle (celular)
   - gera QR Codes
   - WebSocket: salas + relay de input (o host roda a física)
   ============================================================ */
const path = require('path');
const os = require('os');
const http = require('http');
const express = require('express');
const QRCode = require('qrcode');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const app = express();
// nunca cacheia as telas: em kiosk o Chrome segura HTML velho por dias
app.use((req, res, next) => {
  if (/\.html$|^\/(host|controle|index)?$/.test(req.path))
    res.set('Cache-Control', 'no-store, must-revalidate');
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

function lanIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const i of ifaces[name] || []) {
      if (i.family === 'IPv4' && !i.internal) return i.address;
    }
  }
  return '127.0.0.1';
}

app.get('/qr', async (req, res) => {
  try {
    const buf = await QRCode.toBuffer(String(req.query.d || ''), {
      type: 'png', width: 460, margin: 1, errorCorrectionLevel: 'M',
      color: { dark: '#101418', light: '#ffffff' }
    });
    res.type('png').set('Cache-Control', 'public, max-age=3600').send(buf);
  } catch (e) { res.status(400).end(); }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

/** salas: code -> { code, host, players: {1..4: ws} } */
const rooms = new Map();
const AB = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => {
  let c;
  do { c = Array.from({ length: 4 }, () => AB[(Math.random() * AB.length) | 0]).join(''); }
  while (rooms.has(c));
  return c;
};
const send = (ws, o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }

    // ---------- TELA (host) ----------
    if (m.t === 'host') {
      const code = newCode();
      rooms.set(code, { code, host: ws, players: {} });
      ws.role = 'host'; ws.room = code;
      return send(ws, { t: 'room', code, lan: `http://${lanIP()}:${PORT}` });
    }

    // ---------- CELULAR entra ----------
    if (m.t === 'join') {
      const room = rooms.get(String(m.code || '').toUpperCase());
      if (!room) return send(ws, { t: 'err', m: 'Sala não encontrada. Escaneie o QR Code da tela de novo.' });
      const slot = Number(m.slot);
      if (!(slot >= 1 && slot <= 4)) return send(ws, { t: 'err', m: 'Vaga inválida.' });
      if (room.players[slot]) {
        const livres = [1, 2, 3, 4].filter(s => !room.players[s]);
        return send(ws, { t: 'err', m: 'Esse carro já tem piloto.', free: livres });
      }
      room.players[slot] = ws;
      ws.role = 'player'; ws.room = room.code; ws.slot = slot;
      ws.name = (String(m.name || '').trim() || `Piloto ${slot}`).slice(0, 12);
      send(ws, { t: 'ok', slot, code: room.code });
      send(room.host, { t: 'p', slot, name: ws.name, on: true, ready: false });
      return;
    }

    if (ws.role === 'player') {
      const room = rooms.get(ws.room);
      if (!room) return;
      if (m.t === 'in') { // input do controle
        return send(room.host, { t: 'in', slot: ws.slot, s: m.s, b: m.b, u: m.u, k: m.k });
      }
      if (m.t === 'ready') {
        return send(room.host, { t: 'ready', slot: ws.slot, v: !!m.v });
      }
      return;
    }

    if (ws.role === 'host') {
      const room = rooms.get(ws.room);
      if (!room) return;
      if (m.t === 'to') return send(room.players[m.v], { t: 'st', d: m.d });   // 1 jogador
      if (m.t === 'all') { [1, 2, 3, 4].forEach(s => send(room.players[s], { t: 'st', d: m.d })); return; }
    }
  });

  ws.on('close', () => {
    const room = rooms.get(ws.room);
    if (!room) return;
    if (ws.role === 'host') {
      [1, 2, 3, 4].forEach(s => { send(room.players[s], { t: 'err', m: 'A tela do jogo foi desconectada.' }); });
      rooms.delete(room.code);
    } else if (ws.role === 'player' && room.players[ws.slot] === ws) {
      delete room.players[ws.slot];
      send(room.host, { t: 'p', slot: ws.slot, on: false });
    }
  });
});

setInterval(() => {
  wss.clients.forEach(ws => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false; ws.ping();
  });
}, 25000);

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n  RALI 4 CLIMAS no ar');
  console.log(`  Tela (totem):  http://localhost:${PORT}/host`);
  console.log(`  Rede local:    http://${lanIP()}:${PORT}/host`);
  console.log('  Os celulares entram pelo QR Code da tela.\n');
});
