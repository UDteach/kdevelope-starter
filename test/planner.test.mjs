import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { addSelection, blankDraft, findTools, makePrompt, recommendations, scopeNotes } from '../public/planner.mjs';

const catalog = JSON.parse(await readFile(new URL('../public/catalog.json', import.meta.url), 'utf8'));
const tools = new Map(catalog.tools.map(tool => [tool.id, tool]));
const examples = new Map(catalog.examples.map(example => [example.id, example]));
const example = 'xnew-topixel-grid';
const paid = 'new-20261103-05';
const draft = overrides => Object.assign(structuredClone(blankDraft), { goal: '作品を公開する' }, overrides);
const ids = items => items.map(item => item.id);

test('公開する静的な作品集と、共有データを扱うWebアプリの範囲が分かれる', () => {
  assert.deepEqual(ids(recommendations(draft())), ['R80', 'cloudflare-pages']);
  assert.deepEqual(ids(recommendations(draft({ purpose: 'app', storage: 'shared' }))), ['R74', 'cloudflare-workers', 'cloudflare-d1']);
  assert.deepEqual(ids(recommendations(draft({ purpose: 'app', api: true, host: 'vercel' }))), ['R81', 'vercel']);
  assert.ok(!ids(recommendations(draft({ purpose: 'art', storage: 'shared', host: 'workers' }))).includes('cloudflare-d1'));
  const storage = draft({ storage: 'shared', host: 'pages' });
  const suggestions = recommendations(storage);
  assert.match(suggestions.find(item => item.id === 'cloudflare-pages').scope, /Pages Functions/);
  assert.match(suggestions.find(item => item.id === 'cloudflare-d1').scope, /バインディング/);
});

test('有料候補はチェックで現れ、実装スタックに入らない', () => {
  const state = draft();
  const filter = { query: 'Bonebase', paid: false, sort: 'fit' };
  assert.equal(findTools(catalog.tools, state, filter).length, 0);
  assert.deepEqual(ids(findTools(catalog.tools, state, { ...filter, paid: true })), [paid]);
  addSelection(state, tools.get(paid));
  addSelection(state, tools.get(paid));
  assert.deepEqual(state.selected, []);
  assert.deepEqual(state.comparison, [paid]);
});

test('Github OSSの役割絞り込みとスター順に、既知のライセンス・確認日がある候補が出る', () => {
  const rows = findTools(catalog.tools, draft(), { query: '', github: true, paid: false, sort: 'stars', role: 'frontend' });
  assert.ok(rows.length >= 5);
  assert.ok(rows.every(item => item.repository.openSource && item.repository.checkedOn));
  assert.ok(rows.every((item, index) => !index || rows[index - 1].repository.stars >= item.repository.stars));
  assert.equal(findTools(catalog.tools, draft(), { query: 'ｓｈａｄｃｎ', github: true, paid: false, sort: 'stars' })[0].id, 'R86');
});

test('必須、任意、作例、調査、壁打ちで決めた方向を別項目にまとめる', () => {
  const state = draft({ purpose: 'app', host: 'vercel', storage: 'shared', references: [example],
    research: true, question: '無料で使える最適化を比較', assistant: 'Gemini', direction: '作品を2列で見せる' });
  addSelection(state, tools.get('R81'));
  addSelection(state, tools.get('R86'), '詳細を開くダイアログ1個', 'optional');
  addSelection(state, tools.get('vercel'));
  addSelection(state, tools.get('cloudflare-d1'));
  addSelection(state, tools.get(paid));
  assert.ok(scopeNotes(state, tools).some(note => note.includes('接続先のAPI')));
  const build = makePrompt(state, tools, examples);
  for (const text of ['## 必須', '## 任意', '詳細を開くダイアログ1個', example, '## 比較候補', 'Bonebase', '無料で使える最適化を比較', '作品を2列で見せる']) assert.ok(build.includes(text), text);
  const image = makePrompt(state, tools, examples, 'image');
  assert.match(image, /^Geminiで/);
  assert.ok(image.includes(example));
  assert.ok(image.includes('採用する方向を確認'));
});

test('同梱カタログのIDと作例リンクを検査する', () => {
  assert.equal(tools.size, catalog.tools.length);
  assert.equal(examples.size, catalog.examples.length);
  for (const tool of catalog.tools) {
    assert.equal(new URL(tool.url).protocol, 'https:', tool.name);
    assert.ok(tool.exampleIds.every(id => examples.has(id)), tool.name);
  }
  const raw = JSON.stringify(catalog);
  assert.ok(!/chatgpt\.com\/(?:c|space)\/|github\.com\/UDteach\/|sk-proj-/iu.test(raw), '公開対象外の参照は含めない');
  const strings = [];
  JSON.stringify(catalog, (key, value) => {
    if (typeof value === 'string') strings.push(value);
    return value;
  });
  assert.ok(!strings.some(value => /(?:^|[\s"'(])[a-z]:[\\/][^\s"']/iu.test(value)), 'ローカル絶対パスは含めない');
});
