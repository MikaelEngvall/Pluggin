// Generates simple PNG icons for the Chrome extension using only Node built-ins
// Creates a blue circle with a white clock face

const fs = require('fs');
const zlib = require('zlib');

function createPNG(size) {
  const width = size;
  const height = size;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 1;

  // Build raw RGBA pixel data
  const pixels = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > r) {
        // Transparent outside circle
        pixels[idx] = 0; pixels[idx+1] = 0; pixels[idx+2] = 0; pixels[idx+3] = 0;
      } else if (dist > r - 2) {
        // Dark blue border
        pixels[idx] = 26; pixels[idx+1] = 86; pixels[idx+2] = 140; pixels[idx+3] = 255;
      } else {
        // Blue fill
        pixels[idx] = 43; pixels[idx+1] = 108; pixels[idx+2] = 176; pixels[idx+3] = 255;
      }

      // Clock face: white circle in center (60% radius)
      const innerR = r * 0.6;
      if (dist < innerR && dist > innerR - 2) {
        pixels[idx] = 255; pixels[idx+1] = 255; pixels[idx+2] = 255; pixels[idx+3] = 255;
      }

      // Clock hands: 12 o'clock (up) and 3 o'clock (right)
      const handWidth = Math.max(1, size / 32);
      // Hour hand pointing to ~10 o'clock direction
      const angle = Math.atan2(dy, dx);
      const hourAngle = -Math.PI / 2 - Math.PI / 6; // 10 o'clock
      const minuteAngle = -Math.PI / 2; // 12 o'clock

      const hourLen = r * 0.35;
      const minuteLen = r * 0.5;

      // Draw hour hand
      const hx = cx + Math.cos(hourAngle) * hourLen;
      const hy = cy + Math.sin(hourAngle) * hourLen;
      const dToHour = pointToSegmentDist(x, y, cx, cy, hx, hy);
      if (dToHour < handWidth && dist < innerR - 1) {
        pixels[idx] = 255; pixels[idx+1] = 255; pixels[idx+2] = 255; pixels[idx+3] = 255;
      }

      // Draw minute hand
      const mx2 = cx + Math.cos(minuteAngle) * minuteLen;
      const my2 = cy + Math.sin(minuteAngle) * minuteLen;
      const dToMinute = pointToSegmentDist(x, y, cx, cy, mx2, my2);
      if (dToMinute < handWidth && dist < innerR - 1) {
        pixels[idx] = 255; pixels[idx+1] = 255; pixels[idx+2] = 255; pixels[idx+3] = 255;
      }
    }
  }

  return encodePNG(width, height, pixels);
}

function pointToSegmentDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px-ax)**2 + (py-ay)**2);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.sqrt((px - (ax + t*dx))**2 + (py - (ay + t*dy))**2);
}

function encodePNG(width, height, pixels) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Raw image data with filter bytes
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter type None
    pixels.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(raw);

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeB = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.concat([typeB, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcBuf), 0);
    return Buffer.concat([len, typeB, data, crc]);
  }

  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

function crc32(buf) {
  const table = makeCRCTable();
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeCRCTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
}

for (const size of [16, 32, 48, 128]) {
  const png = createPNG(size);
  fs.writeFileSync(`extension/icon${size}.png`, png);
  console.log(`Created extension/icon${size}.png`);
}

// Also overwrite icon.png with 128px version
fs.copyFileSync('extension/icon128.png', 'extension/icon.png');
console.log('Updated extension/icon.png');
