import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function createPNG(width, height, drawFn) {
  // Simple uncompressed or deflate PNG generator
  const buffer = Buffer.alloc(height * (1 + width * 4));
  let pos = 0;

  for (let y = 0; y < height; y++) {
    buffer[pos++] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawFn(x, y, width, height);
      buffer[pos++] = r;
      buffer[pos++] = g;
      buffer[pos++] = b;
      buffer[pos++] = a;
    }
  }

  const deflated = zlib.deflateSync(buffer);

  function createChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = crc32(Buffer.concat([typeBuf, data]));
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  // CRC32 table
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c;
  }
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: 6 = RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = createChunk('IHDR', ihdrData);

  // IDAT chunk
  const idat = createChunk('IDAT', deflated);

  // IEND chunk
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

// Brand draw function (Pure bright red circle)
function brandIconDraw(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const radius = w * 0.44;

  if (dist <= radius) {
    // Anti-aliased edge
    const alpha = dist > radius - 1.2 ? Math.max(0, Math.min(255, Math.round((radius - dist + 1.2) / 1.2 * 255))) : 255;
    return [220, 38, 38, alpha]; // #DC2626 bright red
  }

  return [0, 0, 0, 0];
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generate 192x192
const p192 = createPNG(192, 192, brandIconDraw);
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), p192);

// Generate 512x512
const p512 = createPNG(512, 512, brandIconDraw);
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), p512);

// Generate maskable 512x512 with safe zone padding
const pMaskable = createPNG(512, 512, (x, y, w, h) => {
  // Maskable full background
  return brandIconDraw(x, y, w, h);
});
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), pMaskable);

// Apple touch icon 180x180
const p180 = createPNG(180, 180, brandIconDraw);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), p180);

// Favicon 32x32
const p32 = createPNG(32, 32, brandIconDraw);
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), p32);

console.log('Successfully generated all PWA icons in /public');
