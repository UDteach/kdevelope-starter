import { readFile, writeFile } from 'node:fs/promises';
import { buildCatalog } from '../public/catalog.mjs';

const [resourcesFile, experimentsFile] = process.argv.slice(2);
if (!resourcesFile || !experimentsFile) throw new Error('Usage: npm run catalog -- resources.json experiments.json');
const content = JSON.parse(await readFile(resourcesFile, 'utf8'));
const experiments = JSON.parse(await readFile(experimentsFile, 'utf8'));
const catalog = buildCatalog(content, experiments);
await writeFile(new URL('../public/catalog.json', import.meta.url), `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`${catalog.tools.length} tools / ${catalog.examples.length} examples`);
