/**
 * Run with Node.js to generate simple icon PNGs for the extension.
 * Usage: node generate-icons.js
 * Requires the `canvas` npm package OR falls back to writing minimal valid PNGs.
 *
 * This script writes minimal 1x1-upscaled solid PNGs without any dependencies
 * by embedding a base64-encoded PNG for each required size.
 */

const fs = require("fs");
const path = require("path");

// Minimal valid PNG generator (no dependencies)
// Draws a dark circle on a transparent background for each size.
function createPNG(size) {
  // We'll use a simple approach: embed a tiny hard-coded PNG and let Chrome scale it.
  // For a real release you'd want proper icons, but this works for local dev.
  // This is a 1x1 dark pixel PNG base64 — we'll write proper sized ones below.

  // Build a raw PNG manually for a filled dark-moon icon
  const { createCanvas } = (() => {
    try { return require("canvas"); } catch { return null; }
  })() || {};

  if (createCanvas) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext("2d");
    // Background
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    // Moon crescent
    ctx.fillStyle = "#4caf7f";
    const r = size * 0.3;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.arc(size / 2 + r * 0.4, size / 2 - r * 0.1, r * 0.75, 0, Math.PI * 2);
    ctx.fill();
    return canvas.toBuffer("image/png");
  }

  // Fallback: minimal valid 1x1 PNG (dark pixel), Chrome will scale
  // PNG signature + IHDR + IDAT + IEND for a 1x1 RGBA dark pixel
  const PNG_1x1_DARK = Buffer.from(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
    "1f15c4890000000a49444154789c6260606000000002000172657e" + // this is approximate
    "00000000049454e44ae426082",
    "hex"
  );
  // Return a proper minimal PNG
  return getMinimalPNG(size);
}

function getMinimalPNG(size) {
  // Pre-baked 16x16 dark circle icon as base64
  // We'll just write the same small PNG for all sizes in fallback mode
  const b64 =
    "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAb0lEQVQ4T2NkIBIw" +
    "EqmHgWoGTP///2YkUj8DAwMDIzUMYGBg+M9AZQMYqG0AI7UNYKSyAQxUNoABBg" +
    "YGBmobwEBtAxipbQADlQ1goLIBDFQ2gIHKBjBQ2QAGKhvAQGUDGKhsAAOVDWCg" +
    "sgEMVDaAAQDqbQMRbFJc0QAAAABJRU5ErkJggg==";
  return Buffer.from(b64, "base64");
}

const sizes = [16, 48, 128];
const dir = path.join(__dirname, "icons");
if (!fs.existsSync(dir)) fs.mkdirSync(dir);

sizes.forEach((s) => {
  const buf = createPNG(s);
  fs.writeFileSync(path.join(dir, `icon${s}.png`), buf);
  console.log(`Written icons/icon${s}.png`);
});
