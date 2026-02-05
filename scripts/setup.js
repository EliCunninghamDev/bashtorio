const fs = require('fs');
const path = require('path');
const https = require('https');

const V86_DIR = path.join(__dirname, '../public/v86');
const NODE_MODULES_V86 = path.join(__dirname, '../node_modules/v86/build');

// Ensure v86 directory exists
if (!fs.existsSync(V86_DIR)) {
  fs.mkdirSync(V86_DIR, { recursive: true });
}

// Copy files from node_modules/v86/build
const filesToCopy = ['libv86.js', 'v86.wasm'];

for (const file of filesToCopy) {
  const src = path.join(NODE_MODULES_V86, file);
  const dest = path.join(V86_DIR, file);
  
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`✓ Copied ${file}`);
  } else {
    console.log(`✗ Missing ${file} in node_modules/v86/build`);
  }
}

// Download function
function download(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) {
      console.log(`✓ ${path.basename(dest)} already exists`);
      resolve();
      return;
    }
    
    console.log(`↓ Downloading ${path.basename(dest)}...`);
    
    const file = fs.createWriteStream(dest);
    
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Follow redirect
        download(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      
      const total = parseInt(response.headers['content-length'], 10);
      let downloaded = 0;
      
      response.on('data', (chunk) => {
        downloaded += chunk.length;
        if (total) {
          const pct = Math.round((downloaded / total) * 100);
          process.stdout.write(`\r  ${pct}% (${Math.round(downloaded/1024/1024)}MB)`);
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`\n✓ Downloaded ${path.basename(dest)}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

// Files to download from copy.sh/v86
const downloads = [
  { url: 'https://copy.sh/v86/bios/seabios.bin', file: 'seabios.bin' },
  { url: 'https://copy.sh/v86/bios/vgabios.bin', file: 'vgabios.bin' },
  { url: 'https://copy.sh/v86/images/linux4.iso', file: 'linux4.iso' },
];

async function main() {
  console.log('\n🏭 Bashtorio Setup\n');
  
  console.log('Copying v86 core files...');
  // Files already copied above
  
  console.log('\nDownloading BIOS and Linux image...');
  
  for (const { url, file } of downloads) {
    try {
      await download(url, path.join(V86_DIR, file));
    } catch (err) {
      console.error(`✗ Failed to download ${file}: ${err.message}`);
      console.log(`  Please download manually from ${url}`);
    }
  }
  
  console.log('\n✓ Setup complete!\n');
  console.log('Run: npx serve public');
  console.log('Open: http://localhost:3000\n');
}

main().catch(console.error);
