// Serves the game and pairs two devices on the same Wi-Fi.
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { build } = require('./build');

const PORT = 8787;
const MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const ROOT = __dirname;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon', '.webp': 'image/webp' };

build();

function lanIPs() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const n of list || []) {
      const v4 = n.family === 'IPv4' || n.family === 4;
      if (v4 && !n.internal) out.push(n.address);
    }
  }
  return out;
}
function safeFile(urlPath) {
  const raw = decodeURIComponent((urlPath || '/').split('?')[0]);
  const rel = raw === '/' ? 'index.html' : raw.replace(/^[/\\]+/, '');
  const full = path.normalize(path.join(ROOT, rel));
  const fromRoot = path.relative(ROOT, full);
  if (fromRoot.startsWith('..') || path.isAbsolute(fromRoot)) return null;
  if (fromRoot.split(path.sep).includes('node_modules')) return null;
  return full;
}

const rooms = new Map();
function makeCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += A[(Math.random() * A.length) | 0];
  return rooms.has(s) ? makeCode() : s;
}
function send(socket, obj) {
  if (!socket || socket.destroyed) return;
  const data = Buffer.from(JSON.stringify(obj));
  let header;
  if (data.length < 126) header = Buffer.from([0x81, data.length]);
  else if (data.length < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(data.length, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 127; header.writeBigUInt64BE(BigInt(data.length), 2); }
  socket.write(Buffer.concat([header, data]));
}
function other(sock) {
  const room = sock.room; if (!room) return null;
  return sock.role === 'host' ? room.guest : room.host;
}
function onText(sock, text) {
  let m; try { m = JSON.parse(text); } catch (e) { return; }
  if (m.t === 'host') {
    const code = makeCode();
    const room = { code, host: sock, guest: null };
    sock.room = room; sock.role = 'host'; rooms.set(code, room);
    send(sock, { t: 'room', code, port: PORT, ips: lanIPs() });
    return;
  }
  if (m.t === 'join') {
    const room = rooms.get(String(m.code || '').toUpperCase());
    if (!room) { send(sock, { t: 'err', m: 'No game with that code.' }); return; }
    if (room.guest && room.guest !== sock) { send(sock, { t: 'err', m: 'That game already has two players.' }); return; }
    room.guest = sock; sock.room = room; sock.role = 'guest';
    send(sock, { t: 'joined', code: room.code });
    send(room.host, { t: 'peer' }); send(sock, { t: 'peer' });
    return;
  }
  const peer = other(sock);
  if (peer) send(peer, m);
}
function detach(sock) {
  const room = sock.room; if (!room) return;
  if (sock.role === 'host') {
    if (room.guest) send(room.guest, { t: 'left' });
    rooms.delete(room.code);
  } else if (room.guest === sock) {
    room.guest = null;
    if (room.host) send(room.host, { t: 'left' });
  }
  sock.room = null;
}
function takeFrame(buf) {
  if (buf.length < 2) return null;
  const b0 = buf[0], b1 = buf[1];
  let len = b1 & 0x7f, off = 2;
  if (len === 126) { if (buf.length < 4) return null; len = buf.readUInt16BE(2); off = 4; }
  else if (len === 127) { if (buf.length < 10) return null; const n = buf.readBigUInt64BE(2); if (n > 1000000n) return { error: true }; len = Number(n); off = 10; }
  if (len > 1000000) return { error: true };
  const masked = (b1 & 0x80) !== 0;
  if (buf.length < off + (masked ? 4 : 0) + len) return null;
  let payload = buf.subarray(off + (masked ? 4 : 0), off + (masked ? 4 : 0) + len);
  if (masked) {
    const mask = buf.subarray(off, off + 4);
    payload = Buffer.from(payload);
    for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
  }
  return { fin: (b0 & 0x80) !== 0, opcode: b0 & 0x0f, payload, used: off + (masked ? 4 : 0) + len };
}
function attach(sock) {
  let buf = Buffer.alloc(0), frag = null;
  sock.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (true) {
      const frame = takeFrame(buf);
      if (!frame) return;
      if (frame.error) { sock.destroy(); return; }
      buf = buf.subarray(frame.used);
      const op = frame.opcode;
      if (op === 8) { detach(sock); sock.end(); return; }
      if (op === 9) { const pong = Buffer.concat([Buffer.from([0x8A, frame.payload.length]), frame.payload]); sock.write(pong); continue; }
      if (op === 10 || op === 0 && !frag) continue;
      const text = frame.payload.toString('utf8');
      if (op === 1 && !frame.fin) { frag = text; continue; }
      if (op === 0) { frag = (frag || '') + text; if (!frame.fin) continue; onText(sock, frag); frag = null; continue; }
      if (op === 1) onText(sock, text);
    }
  });
  sock.on('close', () => detach(sock));
  sock.on('error', () => detach(sock));
}

const server = http.createServer((req, res) => {
  const file = safeFile(req.url);
  if (!file) { res.writeHead(403); res.end('no'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});
server.on('upgrade', (req, socket) => {
  if ((req.url || '').split('?')[0] !== '/ws') { socket.destroy(); return; }
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + MAGIC).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  attach(socket);
});
server.listen(PORT, '0.0.0.0', () => {
  const ips = lanIPs();
  console.log('Home Defense is ready.');
  console.log('This computer:  http://localhost:' + PORT);
  for (const ip of ips) console.log('Other device:   http://' + ip + ':' + PORT);
  if (!ips.length) console.log('No LAN address found. Both players can still use this computer.');
});
