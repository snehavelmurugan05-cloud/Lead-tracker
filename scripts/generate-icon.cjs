const { Jimp } = require('jimp');
const fs = require('fs');
const path = require('path');

async function generate() {
  try {
    const inputPath = path.join(__dirname, '../public/global_minds_logo.jpg');
    const pngPath = path.join(__dirname, '../public/icon.png');
    const icoPath = path.join(__dirname, '../public/icon.ico');

    console.log('Reading input image from:', inputPath);
    const image = await Jimp.read(inputPath);
    
    // Resize to 256x256 square for crisp Windows desktop icon
    image.resize({ w: 256, h: 256 });
    await image.write(pngPath);
    console.log('Wrote valid 256x256 PNG to:', pngPath);

    const pngToIcoMod = require('png-to-ico');
    const pngToIco = pngToIcoMod.default || pngToIcoMod;

    const icoBuffer = await pngToIco(pngPath);
    fs.writeFileSync(icoPath, icoBuffer);
    console.log('Successfully generated Windows .ico icon at:', icoPath, 'Bytes:', icoBuffer.length);
  } catch (err) {
    console.error('Failed to generate icon:', err);
    process.exit(1);
  }
}

generate();
