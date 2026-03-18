/**
 * Generate default OG image (1200x630) for MPSTATS Academy
 * Uses sharp to render SVG to PNG
 */
const path = require('path');
const fs = require('fs');

// sharp is installed in apps/web
const sharp = require(path.resolve(__dirname, '../apps/web/node_modules/sharp'));

const WIDTH = 1200;
const HEIGHT = 630;

const svg = `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#2C4FF8"/>
      <stop offset="100%" style="stop-color:#1a3ad4"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>

  <!-- Logo icon (play button mark) centered, white, ~120px tall -->
  <g transform="translate(550, 140) scale(0.84)">
    <path d="M91.5463 37.7559L27.0743 0.534714C24.4536 -0.982506 21.163 0.909093 21.163 3.94353V78.3858C21.163 81.4203 24.4536 83.3119 27.0743 81.7947L91.5463 44.5735C94.167 43.0563 94.167 39.2731 91.5463 37.7559Z" fill="#FFFFFF"/>
    <path d="M98.3041 82.2873L74.994 68.8294C73.7724 68.12 72.2749 68.12 71.0532 68.8294L16.3939 100.395C13.7732 101.913 10.4826 100.021 10.4826 96.9866V38.4653C10.4826 35.5688 8.13783 33.224 5.24131 33.224C2.3448 33.224 0 35.5688 0 38.4653V139.055C0 142.089 3.27089 143.981 5.91125 142.464L98.3238 89.105C100.944 87.5878 100.944 83.8046 98.3238 82.2873H98.3041Z" fill="#FFFFFF"/>
  </g>

  <!-- Title text -->
  <text x="600" y="360" text-anchor="middle"
    font-family="Inter, Arial, Helvetica, sans-serif"
    font-size="48" font-weight="700" fill="#FFFFFF">
    MPSTATS Academy
  </text>

  <!-- Subtitle -->
  <text x="600" y="420" text-anchor="middle"
    font-family="Inter, Arial, Helvetica, sans-serif"
    font-size="24" fill="rgba(255,255,255,0.8)">
    Образовательная платформа для селлеров маркетплейсов
  </text>
</svg>`;

const outputPath = path.resolve(__dirname, '../apps/web/public/og-default.png');

sharp(Buffer.from(svg))
  .resize(WIDTH, HEIGHT)
  .png()
  .toFile(outputPath)
  .then(() => {
    const stats = fs.statSync(outputPath);
    console.log('OG image generated:', outputPath);
    console.log('Size:', stats.size, 'bytes');
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
