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

// Brand draw function (Soft light rose canvas with bold crimson central seal)
function brandIconDraw(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Background: soft light red / rose tint (#FFF1F2)
  let r = 255, g = 241, b = 242, a = 255;

  // Outer circle ring
  const outerR = w * 0.44;
  const innerR = w * 0.36;
  const badgeR = w * 0.26;

  if (dist < outerR && dist >= outerR - 4) {
    // Subtle border
    r = 254; g = 205; b = 211; // rose-200
  } else if (dist < outerR && dist >= innerR) {
    // Soft circle layer
    r = 255; g = 255; b = 255;
  } else if (dist < innerR) {
    // Crimson core (#E11D48)
    if (dist < badgeR) {
      // In center: crimson red
      r = 225; g = 29; b = 72;
      // Simple inner ledger symbol (cross/box)
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      const iconSize = w * 0.12;
      if ((absDx < iconSize && absDy < iconSize * 1.3) && (absDx > iconSize * 0.7 || absDy > iconSize * 0.9 || (absDy < 3 && absDx < iconSize * 0.5))) {
        // white ledger symbol
        r = 255; g = 255; b = 255;
      }
    } else {
      r = 255; g = 228; b = 230; // rose-100
    }
  }

  return [r, g, b, a];
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
