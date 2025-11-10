const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const iconsDir = path.join(__dirname, 'icons');
const sizes = [16, 48, 128];

// Wingman theme colors: purple gradient from #667eea to #764ba2
const gradientStart = { r: 102, g: 126, b: 234 }; // #667eea
const gradientEnd = { r: 118, g: 75, b: 162 };   // #764ba2

async function createGradientIcon(size) {
  // Create SVG with gradient
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:rgb(${gradientStart.r},${gradientStart.g},${gradientStart.b});stop-opacity:1" />
          <stop offset="100%" style="stop-color:rgb(${gradientEnd.r},${gradientEnd.g},${gradientEnd.b});stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#grad)" rx="${size * 0.15}" />
      ${size >= 48 ? `<text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.4}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">WM</text>` : ''}
    </svg>
  `;

  // Convert SVG to PNG
  const pngBuffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();

  return pngBuffer;
}

async function generateIcons() {
  // Ensure icons directory exists
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  console.log('Generating extension icons...');

  for (const size of sizes) {
    const iconPath = path.join(iconsDir, `icon${size}.png`);
    const iconBuffer = await createGradientIcon(size);
    
    await sharp(iconBuffer)
      .resize(size, size)
      .png()
      .toFile(iconPath);
    
    console.log(`✓ Created ${iconPath}`);
  }

  console.log('All icons generated successfully!');
}

generateIcons().catch((error) => {
  console.error('Error generating icons:', error);
  process.exit(1);
});

