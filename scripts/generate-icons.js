/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Générateur d'icônes autonome (zéro dépendance native) utilisant zlib intégré à Node.js :
 * - PWA : icon-192.png, icon-512.png (coins arrondis), icon-maskable-512.png (zone de sécurité 66%)
 * - iOS App Store : AppIcon-512@2x.png 1024x1024 en PNG RGB 24-bit SANS canal alpha (évite ITMS-90717)
 * - Android Adaptive Icons : ic_launcher.png, ic_launcher_round.png, ic_launcher_foreground.png (zone de sécurité 66%)
 */
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

// Table CRC32 standard PNG
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(width, height, pixels, opaqueRgb) {
  const channels = opaqueRgb ? 3 : 4;
  const stride = width * channels + 1;
  const raw = Buffer.alloc(stride * height);

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * stride;
    raw[rowOffset] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x += 1) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = rowOffset + 1 + x * channels;
      raw[dstIdx] = pixels[srcIdx];
      raw[dstIdx + 1] = pixels[srcIdx + 1];
      raw[dstIdx + 2] = pixels[srcIdx + 2];
      if (!opaqueRgb) {
        raw[dstIdx + 3] = pixels[srcIdx + 3];
      }
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = opaqueRgb ? 2 : 6; // 2 = Truecolor RGB (sans alpha !), 6 = RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(raw, { level: 9 });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  return Buffer.concat([
    signature,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", compressed),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}

// Distance signée d'un rectangle arrondi centré en (cx, cy) de demi-tailles (hx, hy) et rayon r
function sdRoundedBox(px, py, cx, cy, hx, hy, r) {
  const qx = Math.abs(px - cx) - hx + r;
  const qy = Math.abs(py - cy) - hy + r;
  const outX = Math.max(qx, 0);
  const outY = Math.max(qy, 0);
  return Math.hypot(outX, outY) + Math.min(Math.max(qx, qy), 0) - r;
}

// Distance signée d'une lettre "P" vectorielle nette normalisée dans [0..1] x [0..1]
function isInsideLetterP(nx, ny) {
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return false;
  const stroke = 0.24;
  // Fût vertical gauche
  if (nx >= 0 && nx <= stroke) return true;
  // Boucle supérieure du P (y de 0 à 0.58)
  if (ny <= 0.58) {
    const bowlCenterY = 0.29;
    const bowlCenterX = 0.54;
    const outerRx = 0.46;
    const outerRy = 0.29;
    const innerRx = 0.22;
    const innerRy = 0.11;

    // Partie rectangulaire reliant le fût au centre de la boucle
    if (nx >= stroke && nx <= bowlCenterX) {
      if (ny <= 0.18 || (ny >= 0.40 && ny <= 0.58)) return true;
    }
    // Demi-ellipse droite externe moins demi-ellipse interne
    if (nx >= bowlCenterX) {
      const dxOut = (nx - bowlCenterX) / outerRx;
      const dyOut = (ny - bowlCenterY) / outerRy;
      if (dxOut * dxOut + dyOut * dyOut <= 1.0) {
        const dxIn = (nx - (bowlCenterX - 0.02)) / innerRx;
        const dyIn = (ny - bowlCenterY) / innerRy;
        if (dxIn * dxIn + dyIn * dyIn >= 1.0) {
          return true;
        }
      }
    }
  }
  return false;
}

function samplePPGlyph(px, py, size, glyphScale) {
  // Sur-échantillonnage 4x4 pour un anticrénelage parfaitement lisse
  const groupW = size * 0.54 * glyphScale;
  const groupH = size * 0.42 * glyphScale;
  const letterW = groupW * 0.44;
  const gap = groupW * 0.12;
  const startX = (size - (letterW * 2 + gap)) / 2;
  const startY = (size - groupH) / 2;

  // Rejet rapide hors boîte englobante
  if (
    px < startX - 2 ||
    px > startX + letterW * 2 + gap + 2 ||
    py < startY - 2 ||
    py > startY + groupH + 2
  ) {
    return 0;
  }

  let hits = 0;
  const sub = 4;
  for (let sy = 0; sy < sub; sy += 1) {
    const y = py + (sy + 0.5) / sub;
    const ny = (y - startY) / groupH;
    if (ny < 0 || ny > 1) continue;
    for (let sx = 0; sx < sub; sx += 1) {
      const x = px + (sx + 0.5) / sub;
      const nx1 = (x - startX) / letterW;
      const nx2 = (x - (startX + letterW + gap)) / letterW;
      if (isInsideLetterP(nx1, ny) || isInsideLetterP(nx2, ny)) {
        hits += 1;
      }
    }
  }
  return hits / (sub * sub);
}

/**
 * modes :
 * - "rounded" : icône PWA classique à coins arrondis
 * - "circle"  : icône ronde Android legacy
 * - "opaque"  : carré plein 100% opaque sans canal alpha (iOS App Store / PWA maskable)
 * - "foreground" : premier plan transparent avec zone de sécurité 66% (Android Adaptive Icon)
 */
function renderIcon({ size, mode, glyphScale = 1.0, outputPath }) {
  const pixels = new Uint8Array(size * size * 4);
  const half = size / 2;
  const radius = size * (36 / 192);

  for (let y = 0; y < size; y += 1) {
    // Léger dégradé vertical moderne PressiPro (#2563eb -> #1d4ed8)
    const t = y / Math.max(1, size - 1);
    const bgR = Math.round(37 * (1 - t) + 29 * t);
    const bgG = Math.round(99 * (1 - t) + 78 * t);
    const bgB = Math.round(235 * (1 - t) + 216 * t);

    for (let x = 0; x < size; x += 1) {
      const idx = (y * size + x) * 4;
      let bgAlpha = 1.0;

      if (mode === "foreground") {
        bgAlpha = 0.0;
      } else if (mode === "rounded") {
        const d = sdRoundedBox(x + 0.5, y + 0.5, half, half, half, half, radius);
        bgAlpha = Math.max(0, Math.min(1, 0.5 - d));
      } else if (mode === "circle") {
        const d = Math.hypot(x + 0.5 - half, y + 0.5 - half) - half;
        bgAlpha = Math.max(0, Math.min(1, 0.5 - d));
      }

      const fgCoverage = samplePPGlyph(x, y, size, glyphScale);

      if (mode === "foreground") {
        pixels[idx] = 255;
        pixels[idx + 1] = 255;
        pixels[idx + 2] = 255;
        pixels[idx + 3] = Math.round(fgCoverage * 255);
      } else {
        const r = Math.round(bgR * (1 - fgCoverage) + 255 * fgCoverage);
        const g = Math.round(bgG * (1 - fgCoverage) + 255 * fgCoverage);
        const b = Math.round(bgB * (1 - fgCoverage) + 255 * fgCoverage);
        pixels[idx] = r;
        pixels[idx + 1] = g;
        pixels[idx + 2] = b;
        pixels[idx + 3] = mode === "opaque" ? 255 : Math.round(bgAlpha * 255);
      }
    }
  }

  const buffer = encodePng(size, size, pixels, mode === "opaque");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);
  console.log(
    `Generated [${mode}${mode === "opaque" ? " RGB24" : " RGBA"}]: ${outputPath} (${size}x${size}, ${buffer.length} bytes)`
  );
}

const rootDir = path.join(__dirname, "..");
const publicDir = path.join(rootDir, "public");

// 1. Icônes PWA (any + maskable dédié avec safe-zone)
renderIcon({
  size: 192,
  mode: "rounded",
  glyphScale: 1.0,
  outputPath: path.join(publicDir, "icon-192.png"),
});
renderIcon({
  size: 512,
  mode: "rounded",
  glyphScale: 1.0,
  outputPath: path.join(publicDir, "icon-512.png"),
});
renderIcon({
  size: 512,
  mode: "opaque",
  glyphScale: 0.72,
  outputPath: path.join(publicDir, "icon-maskable-512.png"),
});

// 2. Icône iOS App Store 1024x1024 100% opaque (PNG RGB 24-bit sans canal alpha -> conforme ITMS-90717)
renderIcon({
  size: 1024,
  mode: "opaque",
  glyphScale: 0.88,
  outputPath: path.join(
    rootDir,
    "ios",
    "App",
    "App",
    "Assets.xcassets",
    "AppIcon.appiconset",
    "AppIcon-512@2x.png"
  ),
});

// 3. Icônes Android (mipmaps legacy + foreground adaptatif 108dp avec zone de sécurité 66%)
const androidResDir = path.join(rootDir, "android", "app", "src", "main", "res");
const androidDensities = [
  { folder: "mipmap-mdpi", legacy: 48, foreground: 108 },
  { folder: "mipmap-hdpi", legacy: 72, foreground: 162 },
  { folder: "mipmap-xhdpi", legacy: 96, foreground: 216 },
  { folder: "mipmap-xxhdpi", legacy: 144, foreground: 324 },
  { folder: "mipmap-xxxhdpi", legacy: 192, foreground: 432 },
];

for (const density of androidDensities) {
  const dir = path.join(androidResDir, density.folder);
  renderIcon({
    size: density.legacy,
    mode: "rounded",
    glyphScale: 0.92,
    outputPath: path.join(dir, "ic_launcher.png"),
  });
  renderIcon({
    size: density.legacy,
    mode: "circle",
    glyphScale: 0.85,
    outputPath: path.join(dir, "ic_launcher_round.png"),
  });
  renderIcon({
    size: density.foreground,
    mode: "foreground",
    glyphScale: 0.56,
    outputPath: path.join(dir, "ic_launcher_foreground.png"),
  });
}

console.log("All PWA, iOS (RGB24 no-alpha), and Android adaptive icons generated!");
