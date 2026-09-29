const sharp = require('sharp');
const { execSync } = require('child_process');

async function createFavicons() {
  const size = 512;
  const radius = 110;
  const padding = 8;
  const rectSize = size - padding * 2; // 496x496
  
  // 1. Create rounded squircle background SVG
  const bgSvg = Buffer.from(`
    <svg width="${size}" height="${size}">
      <rect 
        x="${padding}" 
        y="${padding}" 
        width="${rectSize}" 
        height="${rectSize}" 
        rx="${radius}" 
        ry="${radius}" 
        fill="#FFFFFF" 
        stroke="#16A66A" 
        stroke-width="8" 
        stroke-opacity="0.25"
      />
    </svg>
  `);
  
  // 2. Resize isolated parrot to fill ~84% of inner box (~415x415)
  const mascotTargetSize = Math.round(rectSize * 0.84);
  
  const resizedParrot = await sharp('/tmp/clean_parrot.png')
    .resize(mascotTargetSize, mascotTargetSize, {
      fit: 'inside',
      withoutEnlargement: false
    })
    .toBuffer();
    
  const mascotMeta = await sharp(resizedParrot).metadata();
  
  // Calculate center position
  const left = Math.round((size - mascotMeta.width) / 2);
  const top = Math.round((size - mascotMeta.height) / 2);
  
  // 3. Composite background + parrot for master 512x512
  const masterBuffer = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
  .composite([
    { input: bgSvg, top: 0, left: 0 },
    { input: resizedParrot, top: top, left: left }
  ])
  .png()
  .toBuffer();

  // Save public/favicon.png (512x512 master)
  await sharp(masterBuffer).toFile('public/favicon.png');
  console.log('✓ Created public/favicon.png (512x512)');

  // Save public/apple-touch-icon.png (180x180)
  await sharp(masterBuffer)
    .resize(180, 180)
    .toFile('public/apple-touch-icon.png');
  console.log('✓ Created public/apple-touch-icon.png (180x180)');

  // Save public/favicon-32x32.png (32x32)
  await sharp(masterBuffer)
    .resize(32, 32)
    .toFile('public/favicon-32x32.png');
  console.log('✓ Created public/favicon-32x32.png (32x32)');

  // Save public/favicon-16x16.png (16x16)
  await sharp(masterBuffer)
    .resize(16, 16)
    .toFile('public/favicon-16x16.png');
  console.log('✓ Created public/favicon-16x16.png (16x16)');

  // Generate public/favicon.ico using convert
  try {
    execSync('convert public/favicon-32x32.png public/favicon-16x16.png public/favicon.ico');
    console.log('✓ Created public/favicon.ico');
  } catch (err) {
    execSync('convert public/favicon-32x32.png public/favicon.ico');
    console.log('✓ Created public/favicon.ico (32x32 fallback)');
  }
}

createFavicons().catch(err => {
  console.error('Error generating favicons:', err);
  process.exit(1);
});
