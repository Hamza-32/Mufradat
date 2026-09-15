import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Generates the app icons. Run: npx tsx scripts/make-icons.ts
 *
 * Written by hand rather than pulled from an image library because the mark is
 * three rectangles and a dependency that only runs once at build time is a
 * dependency that will rot. PNG is encoded directly: IHDR, one deflated IDAT,
 * IEND.
 *
 * The mark is the matra — the headline stroke a line of Bengali type hangs
 * from — in lime wash over indigo, with the rubricator's red mark beneath it.
 * No glyph, so it needs no font and reads at 48px on a launcher.
 */

const NIL = [0x2a, 0x3d, 0x63] as const;
const CHUNA = [0xfb, 0xfb, 0xf8] as const;
const SHINGRAF = [0xa7, 0x2d, 0x1e] as const;

function crc32(buffer: Buffer): number {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(width: number, height: number, rgb: Uint8Array): Buffer {
  const stride = width * 3;
  // One filter byte (0 = none) per scanline.
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgb.subarray(y * stride, (y + 1) * stride)).copy(raw, y * (stride + 1) + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * @param safeArea Fraction of the canvas the mark is kept inside. Maskable
 * icons can be cropped to a circle, so the mark sits well within the middle.
 */
function drawIcon(size: number, safeArea: number): Uint8Array {
  const pixels = new Uint8Array(size * size * 3);
  const put = (x: number, y: number, colour: readonly number[]): void => {
    const index = (y * size + x) * 3;
    pixels[index] = colour[0]!;
    pixels[index + 1] = colour[1]!;
    pixels[index + 2] = colour[2]!;
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) put(x, y, NIL);
  }

  const inset = Math.round((size * (1 - safeArea)) / 2);
  const left = inset;
  const right = size - inset;
  const width = right - left;

  // The matra: a single heavy horizontal stroke.
  const matraTop = Math.round(size * 0.36);
  const matraHeight = Math.max(2, Math.round(size * 0.075));
  for (let y = matraTop; y < matraTop + matraHeight; y += 1) {
    for (let x = left; x < right; x += 1) put(x, y, CHUNA);
  }

  // Three descenders hanging from it, the way Bengali letters hang.
  const stemHeight = Math.round(size * 0.22);
  const stemWidth = Math.max(2, Math.round(size * 0.06));
  for (const fraction of [0.08, 0.44, 0.8]) {
    const x0 = left + Math.round(width * fraction);
    for (let y = matraTop + matraHeight; y < matraTop + matraHeight + stemHeight; y += 1) {
      for (let x = x0; x < x0 + stemWidth; x += 1) put(x, y, CHUNA);
    }
  }

  // The rubricator's mark: one small square in cinnabar.
  const markSize = Math.max(2, Math.round(size * 0.09));
  const markX = right - markSize;
  const markY = matraTop + matraHeight + stemHeight + Math.round(size * 0.06);
  for (let y = markY; y < markY + markSize && y < size; y += 1) {
    for (let x = markX; x < markX + markSize; x += 1) put(x, y, SHINGRAF);
  }

  return pixels;
}

const outputDir = join(process.cwd(), 'public', 'icons');
mkdirSync(outputDir, { recursive: true });

const icons = [
  { name: 'icon-192.png', size: 192, safeArea: 0.78 },
  { name: 'icon-512.png', size: 512, safeArea: 0.78 },
  { name: 'icon-maskable-512.png', size: 512, safeArea: 0.56 },
  { name: 'apple-touch-icon.png', size: 180, safeArea: 0.72 },
] as const;

for (const icon of icons) {
  writeFileSync(
    join(outputDir, icon.name),
    encodePng(icon.size, icon.size, drawIcon(icon.size, icon.safeArea)),
  );
  console.log(`✓ ${icon.name} (${icon.size}px)`);
}
