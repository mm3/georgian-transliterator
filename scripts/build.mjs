#!/usr/bin/env node
// Builds the deployable site into dist/ (no dependencies, Node 18+).
//
// 1. Static assets (icons, manifest) are copied with a content hash in their file
//    name, e.g. icons/icon-192.3f9a1c2b.png. Their content can never change under
//    the same URL, so hosts that honour _headers may cache them "immutable" for a year.
// 2. index.html is rewritten to point at the hashed names.
// 3. sw.js gets VERSION (hash of the whole site) and the PRECACHE list, so every
//    deploy that changes anything ships a new service worker and a fresh cache.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const hash = buf => createHash('sha256').update(buf).digest('hex').slice(0, 10);

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'icons'), { recursive: true });

// Files published under a content-hashed name. Order matters: manifest last,
// because its own content depends on the icon names.
const ICONS = ['icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'];

const renamed = new Map(); // original path -> hashed path
const withHash = (path, buf) => {
  const ext = extname(path);
  return join(dirname(path), `${basename(path, ext)}.${hash(buf)}${ext}`).replace(/\\/g, '/');
};
const rewrite = text => {
  // longest names first so "icon.svg" never clobbers a longer match
  for (const [from, to] of [...renamed].sort((a, b) => b[0].length - a[0].length)) {
    text = text.split(`"${from}"`).join(`"${to}"`);
  }
  return text;
};

for (const path of ICONS) {
  const buf = readFileSync(join(root, path));
  const out = withHash(path, buf);
  writeFileSync(join(dist, out), buf);
  renamed.set(path, out);
}

const manifest = Buffer.from(rewrite(readFileSync(join(root, 'manifest.webmanifest'), 'utf8')));
JSON.parse(manifest.toString()); // fail the build on invalid JSON
const manifestOut = withHash('manifest.webmanifest', manifest);
writeFileSync(join(dist, manifestOut), manifest);
renamed.set('manifest.webmanifest', manifestOut);

const html = rewrite(readFileSync(join(root, 'index.html'), 'utf8'));
for (const ref of ['manifest.webmanifest', ...ICONS.filter(p => p !== 'icons/icon-maskable-512.png')]) {
  if (html.includes(`"${ref}"`)) throw new Error(`index.html still references unhashed ${ref}`);
}
writeFileSync(join(dist, 'index.html'), html);

// Site version = hash of everything the worker will cache.
const precache = ['./', 'index.html', ...renamed.values()];
const version = hash(precache.slice(1).sort().map(p => p + '\0' + readFileSync(join(dist, p)).toString('base64')).join('\n'));

let sw = readFileSync(join(root, 'sw.js'), 'utf8');
sw = sw.replace(/\/\*BUILD:VERSION\*\/[\s\S]*?\/\*END\*\//, JSON.stringify(version));
sw = sw.replace(/\/\*BUILD:PRECACHE\*\/[\s\S]*?\/\*END\*\//, JSON.stringify(precache, null, 2));
if (sw.includes('BUILD:')) throw new Error('sw.js placeholders were not replaced');
writeFileSync(join(dist, 'sw.js'), sw);

for (const f of ['_headers', '.nojekyll', 'robots.txt']) {
  if (existsSync(join(root, f))) copyFileSync(join(root, f), join(dist, f));
}

console.log(`Built dist/ — version ${version}`);
for (const p of precache) console.log('  ' + p);
