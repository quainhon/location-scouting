// Windows / Google Drive fallback: sequential native extraction avoids async write errors.
// Uses the exact npm lockfile and verifies package integrity before extraction.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve, relative, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8').replace(/^\uFEFF/, ''));
const cache = resolve(root, '.tmp/packages');
mkdirSync(cache, { recursive: true });
const supported = (list, value) => !list || (!list.includes('!'+value) && (list.every(v => v.startsWith('!')) || list.includes(value)));
const entries = Object.entries(lock.packages).filter(([path, p]) => path && supported(p.os, process.platform) && supported(p.cpu, process.arch));
for (const [index, [path, pkg]] of entries.entries()) {
  const destination = resolve(root, path);
  if (!destination.startsWith(resolve(root, 'node_modules') + sep)) throw new Error('Unexpected package path');
  const url = new URL(pkg.resolved);
  if (url.protocol !== 'https:' || url.hostname !== 'registry.npmjs.org') throw new Error('Only locked npm registry packages are allowed');
  const archive = resolve(cache, createHash('sha256').update(pkg.resolved).digest('hex')+'.tgz');
  const [algorithm, expected] = pkg.integrity.split('-');
  let bytes = existsSync(archive) ? readFileSync(archive) : null;
  if (!bytes || createHash(algorithm).update(bytes).digest('base64') !== expected) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Download failed: ${path} (${response.status})`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (createHash(algorithm).update(bytes).digest('base64') !== expected) throw new Error('Integrity check failed: '+path);
    writeFileSync(archive, bytes);
  }
  mkdirSync(destination, {recursive:true});
  const extraction = spawnSync('tar.exe', ['-xzf',archive,'-C',destination,'--strip-components','1'], {encoding:'utf8'});
  if (extraction.status !== 0) throw new Error(extraction.stderr || `Extraction failed: ${path}`);
  const manifest = JSON.parse(readFileSync(resolve(destination,'package.json'),'utf8'));
  const bins = typeof manifest.bin === 'string' ? {[manifest.name.split('/').pop()]:manifest.bin} : manifest.bin || {};
  const binFolder = resolve(dirname(destination), '.bin');
  // Scoped packages expose binaries in their parent node_modules/.bin.
  const actualBinFolder = basenameScope(dirname(destination)) ? resolve(dirname(destination),'../.bin') : binFolder;
  mkdirSync(actualBinFolder,{recursive:true});
  for (const [name, binary] of Object.entries(bins)) {
    if (!/^[a-zA-Z0-9_.-]+$/.test(name)) throw new Error('Invalid binary name');
    const executable = resolve(destination,binary);
    if (!executable.startsWith(destination+sep)) throw new Error('Invalid binary path');
    const target = relative(actualBinFolder,executable);
    writeFileSync(resolve(actualBinFolder,name+'.cmd'),`@echo off\r\nnode "%~dp0${target}" %*\r\n`);
  }
  if ((index+1)%20===0 || index===entries.length-1) console.log(`Installed ${index+1}/${entries.length} locked packages`);
}
function basenameScope(path) { return path.split(sep).pop().startsWith('@'); }
console.log('Dependencies ready. Run npm test and npm run build.');
