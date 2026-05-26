const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const input = '/home/hatachi/Proyectos/IArcanIA/ui_kits/brand/IArcanIA-D3---Lluvia-blanca.png';
const outputDir = path.join(__dirname, '..', 'icons');
const bg = '#0a0614';

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

async function generate() {
  // Regular icons: trim transparent borders, resize contain, flatten to remove alpha
  for (const size of [512, 192, 180]) {
    await sharp(input)
      .trim({ threshold: 40 })
      .resize(size, size, { fit: 'contain', background: bg })
      .flatten({ background: bg })
      .png()
      .toFile(path.join(outputDir, `icon-${size}.png`));
    console.log(`icon-${size}.png OK`);
  }

  // Maskable: logo al 60% para respetar safe zone (80%), fondo dark, sin alfa
  const logoSize = Math.round(512 * 0.60);
  const pad = Math.floor((512 - logoSize) / 2);
  const padExtra = 512 - logoSize - pad * 2;
  await sharp(input)
    .resize(logoSize, logoSize, { fit: 'contain', background: bg })
    .extend({ top: pad, bottom: pad + padExtra, left: pad, right: pad + padExtra, background: bg })
    .flatten({ background: bg })
    .png()
    .toFile(path.join(outputDir, 'icon-maskable-512.png'));
  console.log('icon-maskable-512.png OK');

  console.log(`\nIconos generados en: ${outputDir}`);
}

generate().catch(console.error);
