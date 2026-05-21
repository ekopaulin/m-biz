const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const svgPath = path.join(__dirname, 'public', 'logo_mbiz.svg');
const iconDir = path.join(__dirname, 'public', 'icons');

if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir, { recursive: true });
}

const out192 = path.join(iconDir, 'icon-192.png');
const out512 = path.join(iconDir, 'icon-512.png');

async function convert() {
  try {
    console.log('Converting SVG to 192x192 PNG...');
    await sharp(svgPath)
      .resize(192, 192)
      .png()
      .toFile(out192);
    console.log('Successfully saved to:', out192);

    console.log('Converting SVG to 512x512 PNG...');
    await sharp(svgPath)
      .resize(512, 512)
      .png()
      .toFile(out512);
    console.log('Successfully saved to:', out512);

    console.log('Done!');
  } catch (err) {
    console.error('Error during conversion:', err);
  }
}

convert();
