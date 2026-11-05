import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const path = process.argv[2];
if (!path) throw new Error('Usage: npm run sync -- <kdevelope repository>');
const root = resolve(path);
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
if (pkg.name !== 'kdevelope') throw new Error('Expected the kdevelope site repository');

const target = resolve(root, 'public/compose');
await mkdir(target, { recursive: true });
for (const name of ['index.html', 'style.css', 'favicon.svg', 'catalog.mjs', 'planner.mjs', 'app.mjs']) {
  await copyFile(new URL(`../public/${name}`, import.meta.url), resolve(target, name));
}
console.log('kdevelope の公開画面へ制作スタックのソースを反映しました。');
