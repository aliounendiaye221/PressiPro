const { createCanvas } = require("@napi-rs/canvas");
const fs = require("fs");
const path = require("path");

function generateIcon(size, outputPath) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // Background with rounded corners
  const radius = size * (32 / 192);
  ctx.fillStyle = "#2563eb";
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fill();

  // Text "PP"
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${size * (80 / 192)}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("PP", size / 2, size / 2 + size * 0.04);

  const buffer = canvas.toBuffer("image/png");
  fs.writeFileSync(outputPath, buffer);
  console.log(`Generated: ${outputPath} (${buffer.length} bytes)`);
}

const publicDir = path.join(__dirname, "..", "public");
generateIcon(192, path.join(publicDir, "icon-192.png"));
generateIcon(512, path.join(publicDir, "icon-512.png"));
console.log("Done!");
