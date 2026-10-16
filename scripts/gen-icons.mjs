// Generates PWA icons with zero dependencies (Node built-ins only).
// Simple low-poly barn scene rasterized into raw RGBA, encoded as PNG via zlib.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

function crc32(buf) {
  let table = crc32.t;
  if (!table) {
    table = crc32.t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const parts = [
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ];
  return Buffer.concat(parts);
}

function hex(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

function draw(size, pad) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, c) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
  };
  const rect = (x0, y0, x1, y1, c) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) set(x, y, c);
  };
  const circle = (cx, cy, r, c) => {
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) set(x, y, c);
  };
  const tri = (x0, y0, x1, y1, x2, y2, c) => {
    const minX = Math.floor(Math.min(x0, x1, x2)), maxX = Math.ceil(Math.max(x0, x1, x2));
    const minY = Math.floor(Math.min(y0, y1, y2)), maxY = Math.ceil(Math.max(y0, y1, y2));
    const sign = (ax, ay, bx, by, cx, cy) => (ax - cx) * (by - cy) - (bx - cx) * (ay - cy);
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const d1 = sign(x, y, x0, y0, x1, y1), d2 = sign(x, y, x1, y1, x2, y2), d3 = sign(x, y, x2, y2, x0, y0);
      if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) set(x, y, c);
    }
  };
  const S = size, u = S / 512; // unit scale
  const m = pad ? S * 0.12 : 0; // maskable safe-zone padding
  rect(0, 0, S, S, hex('#1E2A32')); // bg
  const ix0 = m, ix1 = S - m; // inner box
  rect(ix0, ix0, ix1, S * 0.68, hex('#87CEEB')); // sky
  rect(ix0, S * 0.68, ix1, ix1, hex('#7EC850')); // grass
  circle(S * 0.74, S * 0.24, 44 * u, hex('#FFC93C')); // sun
  // barn
  const bx0 = S * 0.3, bx1 = S * 0.7, by0 = S * 0.44, by1 = S * 0.68;
  rect(bx0, by0, bx1, by1, hex('#C94F4F'));
  tri(bx0 - 20 * u, by0, bx1 + 20 * u, by0, S / 2, S * 0.3, hex('#7A4A3A'));
  rect(S * 0.45, S * 0.54, S * 0.55, by1, hex('#FFF6E9')); // door
  // crop rows
  for (let i = 0; i < 4; i++) rect(S * (0.2 + i * 0.16), S * 0.78, S * (0.28 + i * 0.16), S * 0.86, hex('#3E9B4F'));
  return encodePNG(S, S, px);
}

mkdirSync(new URL('../public/icons', import.meta.url), { recursive: true });
const out = (n, b) => writeFileSync(new URL(`../public/icons/${n}`, import.meta.url), b);
out('icon-192.png', draw(192, false));
out('icon-512.png', draw(512, false));
out('maskable-512.png', draw(512, true));
out('apple-touch-180.png', draw(180, false));
console.log('icons written');
