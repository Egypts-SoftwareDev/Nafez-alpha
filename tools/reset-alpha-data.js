// Reset alpha JSON data files from ./seeds
const fs = require('fs');
const path = require('path');

const ROOT = __dirname ? path.resolve(__dirname, '..') : process.cwd();
const seedsDir = path.join(ROOT, 'seeds');
const files = ['campaigns.json', 'applications.json', 'pledges.json'];

function copySeed(name) {
  const src = path.join(seedsDir, name);
  const dst = path.join(ROOT, name);
  if (!fs.existsSync(src)) {
    console.error('Seed missing:', src);
    process.exitCode = 1;
    return;
  }
  fs.copyFileSync(src, dst);
  console.log('Restored', name);
}

files.forEach(copySeed);
console.log('Done.');

