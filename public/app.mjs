import { roles } from './catalog.mjs';
import { addSelection, blankDraft, findTools, isWeb, makePrompt, purposes, recommendations, scopeNotes } from './planner.mjs';

const $ = selector => document.querySelector(selector);
const storageKey = 'kdevelope-compose-v1';
const pageSize = 6;
const roleIcons = { frontend: '▱', hosting: '☁', database: '▤', writing: 'あ', image: '▦', motion: '▶',
  style: '◐', ui: '□', build: '▣', language: '型', api: '↔', fetch: '↓', test: '✓', general: '◇' };
const filter = { source: 'catalog', page: 0 };
let catalog;
let draft = structuredClone(blankDraft);
let tools;
let examples;
let exampleOpener;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function action(text, run, className) {
  const node = element('button', text, className);
  node.type = 'button';
  node.addEventListener('click', run);
  return node;
}

function external(text, value) {
  const link = element('a', text);
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') link.href = url.href;
  } catch {
    return element('span', text);
  }
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

function save() {
  try { sessionStorage.setItem(storageKey, JSON.stringify(draft)); } catch { /* Works without draft storage. */ }
}

function restore() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey));
    if (!saved || !Object.hasOwn(purposes, saved.purpose)) return;
    for (const key of ['goal', 'question', 'direction']) if (typeof saved[key] === 'string') draft[key] = saved[key].slice(0, 1600);
    for (const key of ['api', 'login', 'research']) draft[key] = saved[key] === true;
    draft.purpose = saved.purpose;
    if (['auto', 'local', 'pages', 'workers', 'vercel'].includes(saved.host)) draft.host = saved.host;
    if (['none', 'local', 'shared'].includes(saved.storage)) draft.storage = saved.storage;
    if (['Codex', 'Gemini'].includes(saved.assistant)) draft.assistant = saved.assistant;
    if (Array.isArray(saved.selected)) {
      draft.selected = saved.selected.filter(s => s && tools.has(s.id) && tools.get(s.id).price !== 'paid'
        && ['required', 'optional'].includes(s.mode) && typeof s.scope === 'string');
    }
    if (Array.isArray(saved.references)) draft.references = saved.references.filter(id => examples.has(id));
    if (Array.isArray(saved.comparison)) draft.comparison = saved.comparison.filter(id => tools.get(id)?.price === 'paid');
    if (draft.goal.trim() && [1, 2, 3, 4].includes(saved.step)) draft.step = saved.step;
  } catch { /* A stale draft can be ignored. */ }
}

function say(text) { $('#notice').textContent = text; }

function syncForm() {
  for (const id of ['goal', 'purpose', 'host', 'storage', 'question', 'direction']) $(`#${id}`).value = draft[id];
  for (const id of ['api', 'login', 'research']) $(`#${id}`).checked = draft[id];
  document.querySelectorAll('[name="assistant"]').forEach(input => { input.checked = input.value === draft.assistant; });
  $('#web-needs').hidden = !isWeb(draft);
  $('#question').hidden = !draft.research;
}

function renderNav() {
  document.querySelectorAll('[data-step]').forEach(button => {
    const step = Number(button.dataset.step);
    button.disabled = step > 1 && !draft.goal.trim();
    if (step === draft.step) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
}

function go(step, focus = true) {
  if (step > 1 && !draft.goal.trim()) step = 1;
  draft.step = step;
  for (const n of [1, 2, 3, 4]) $(`#step-${n}`).hidden = n !== step;
  renderNav();
  if (step === 2) {
    $('#goal-summary').textContent = draft.goal.trim();
    renderRecommendations();
    renderCandidates();
    renderStack();
  }
  if (step === 3) $('#image-prompt').value = makePrompt(draft, tools, examples, 'image');
  if (step === 4) $('#build-prompt').value = makePrompt(draft, tools, examples);
  say('');
  save();
  if (focus) $(`#step-${step} h2`).focus();
}

function renderRecommendations() {
  const panel = $('#recommendation');
  const suggestions = recommendations(draft).filter(item => tools.has(item.id));
  panel.hidden = suggestions.length === 0;
  if (panel.hidden) return;
  const list = element('ul');
  for (const item of suggestions) {
    const tool = tools.get(item.id);
    const row = element('li');
    row.append(element('strong', tool.name), document.createTextNode(`　${item.reason}`));
    list.append(row);
  }
  const apply = action('この構成を追加', () => {
    for (const item of suggestions) addSelection(draft, tools.get(item.id), item.scope, item.mode);
    updateChoices('目的に合う構成を追加しました。');
  });
  apply.disabled = suggestions.every(item => draft.selected.some(s => s.id === item.id));
  panel.replaceChildren(element('h3', '目的に合う構成'), list, apply);
}

function updateChoices(message) {
  save();
  renderRecommendations();
  renderCandidates();
  renderStack();
  say(message);
}

function renderPager(length) {
  const pages = Math.max(1, Math.ceil(length / pageSize));
  const move = direction => {
    filter.page += direction;
    renderCandidates();
    $('#pager button:not(:disabled)')?.focus();
  };
  const previous = action('前へ', () => move(-1));
  previous.disabled = filter.page === 0;
  const next = action('次へ', () => move(1));
  next.disabled = filter.page + 1 >= pages;
  $('#pager').replaceChildren(previous, element('span', `${length}件 · ${filter.page + 1} / ${pages}`), next);
}

function renderCandidates() {
  const showingExamples = filter.source === 'examples';
  $('#example-filters').hidden = !showingExamples;
  $('#tool-filters').hidden = showingExamples;
  $('#paid-filter').hidden = showingExamples;
  const query = $('#search').value;
  const group = $('#example-group').value;
  const normalized = query.trim().normalize('NFKC').toLowerCase();
  const rows = showingExamples
    ? catalog.examples.filter(item => (!group || item.group === group) && `${item.title} ${item.summary} ${item.tools.join(' ')}`.normalize('NFKC').toLowerCase().includes(normalized))
    : findTools(catalog.tools, draft, { query, github: filter.source === 'github', paid: $('#show-paid').checked,
      role: $('#role-filter').value, sort: $('#sort').value });
  filter.page = Math.min(filter.page, Math.max(0, Math.ceil(rows.length / pageSize) - 1));
  const visible = rows.slice(filter.page * pageSize, (filter.page + 1) * pageSize);
  const list = $('#candidate-list');
  list.replaceChildren(...visible.map(item => showingExamples ? exampleRow(item) : toolRow(item)));
  if (!visible.length) list.append(element('p', '見つかりませんでした。検索語や絞り込みを変えてください。', 'empty'));
  renderPager(rows.length);
}

function toolRow(tool) {
  const row = element('article', undefined, 'candidate');
  const main = element('div', undefined, 'candidate-main');
  const copy = element('div', undefined, 'candidate-name');
  const metadata = [roles[tool.role], tool.priceLabel];
  if (tool.repository) metadata.push(`★ ${tool.repository.stars.toLocaleString('ja-JP')}（${tool.repository.checkedOn}確認）`);
  if (tool.repository?.trending) metadata.push('GitHub Trending掲載');
  copy.append(element('h4', tool.name), element('p', tool.use), element('p', metadata.join(' · '), 'meta'));
  const paid = tool.price === 'paid';
  const added = paid ? draft.comparison.includes(tool.id) : draft.selected.some(s => s.id === tool.id);
  const button = action(added ? '追加済み' : paid ? '比較に追加' : '追加', () => {
    const suggestion = recommendations(draft).find(item => item.id === tool.id);
    addSelection(draft, tool, suggestion?.scope, suggestion?.mode);
    updateChoices(`${tool.name}を${paid ? '比較候補' : 'スタック'}に追加しました。`);
    $('#stack-heading')?.focus();
  });
  button.disabled = added;
  button.setAttribute('aria-label', `${tool.name}を${paid ? '比較に' : ''}${added ? '追加済み' : '追加'}`);
  main.append(copy, button);
  row.append(main);
  const links = element('div', undefined, 'candidate-examples');
  if (tool.exampleIds.length) {
    const example = examples.get(tool.exampleIds[0]);
    if (example) links.append(action('作例を見る', () => openExample(example, tool.exampleIds), 'text-action'));
  }
  links.append(external('公式情報 ↗', tool.url));
  if (tool.repository?.url && tool.repository.url !== tool.url) links.append(external('GitHub ↗', tool.repository.url));
  if (tool.repository?.trending) links.append(external('Trendingの出典 ↗', tool.repository.trending.url));
  row.append(links);
  return row;
}

function exampleRow(example) {
  const row = element('article', undefined, 'candidate');
  const main = element('div', undefined, 'candidate-main');
  const copy = element('div', undefined, 'candidate-name');
  copy.append(element('h4', example.title), element('p', example.summary),
    element('p', `${example.group === 'art' ? '絵・画像' : 'Skills・ツール'} · ${example.scope}`, 'meta'));
  main.append(copy, action('作例を見る', () => openExample(example)));
  row.append(main);
  return row;
}

function renderStack() {
  const list = $('#stack');
  list.replaceChildren();
  const anchor = element('div');
  anchor.id = 'stack-heading';
  anchor.tabIndex = -1;
  list.append(anchor);
  if (!draft.selected.length) list.append(element('p', '候補から追加すると、役割と使う範囲がここに並びます。', 'stack-empty'));
  for (const item of draft.selected) {
    const tool = tools.get(item.id);
    if (!tool) continue;
    const card = element('article', undefined, 'stack-item');
    const row = element('div', undefined, 'stack-row');
    const icon = element('span', roleIcons[tool.role], 'role-icon');
    icon.setAttribute('aria-hidden', 'true');
    const name = element('div', undefined, 'stack-name');
    const currentScope = element('small', `${roles[tool.role]} · ${item.scope || tool.scope}`);
    name.append(element('strong', tool.name), currentScope);
    const mode = element('select');
    mode.setAttribute('aria-label', `${tool.name}の必須・任意`);
    for (const [value, label] of [['required', '必須'], ['optional', '任意']]) {
      const option = element('option', label);
      option.value = value;
      mode.append(option);
    }
    mode.value = item.mode;
    mode.addEventListener('change', () => { item.mode = mode.value; save(); });
    const remove = action('×', () => {
      draft.selected = draft.selected.filter(s => s.id !== item.id);
      updateChoices(`${tool.name}を外しました。`);
      $('#stack-heading').focus();
    }, 'remove');
    remove.setAttribute('aria-label', `${tool.name}を外す`);
    row.append(icon, name, mode, remove);
    const details = element('details');
    const label = element('label', '今回担当すること');
    const scope = element('input');
    scope.type = 'text';
    scope.id = `scope-${item.id}`;
    scope.maxLength = 300;
    scope.value = item.scope;
    label.htmlFor = scope.id;
    scope.addEventListener('input', () => {
      item.scope = scope.value;
      currentScope.textContent = `${roles[tool.role]} · ${item.scope || tool.scope}`;
      save();
    });
    details.append(element('summary', 'どんな道具？'), element('p', `得意なこと　${tool.use}`), label, scope);
    if (tool.conditions) details.append(element('p', tool.conditions));
    details.append(external('公式情報 ↗', tool.url));
    card.append(row, details);
    list.append(card);
  }
  const notes = scopeNotes(draft, tools);
  renderSublist('#scope-notes', '公開・保存の確認', notes.map(text => element('li', text)));
  renderSublist('#reference-list', '参考作例', draft.references.map(id => {
    const example = examples.get(id);
    return sublistRow(example.title, () => {
      draft.references = draft.references.filter(current => current !== id);
      updateChoices('参考作例を外しました。');
    });
  }));
  renderSublist('#comparison-list', '比較候補', draft.comparison.map(id => {
    const tool = tools.get(id);
    return sublistRow(`${tool.name}（${tool.priceLabel}）`, () => {
      draft.comparison = draft.comparison.filter(current => current !== id);
      updateChoices('比較候補を外しました。');
    });
  }));
}

function renderSublist(selector, title, rows) {
  const container = $(selector);
  container.className = 'sublist';
  container.hidden = !rows.length;
  const list = element('ul');
  list.append(...rows);
  container.replaceChildren(element('h3', title), list);
}

function sublistRow(text, remove) {
  const row = element('li', text);
  row.append(action('外す', remove));
  return row;
}

function openExample(example, related = []) {
  const dialog = $('#example-dialog');
  $('#example-title').textContent = example.title;
  const body = $('#example-body');
  body.replaceChildren(element('p', example.summary), element('p', example.scope));
  const media = element('div', undefined, 'media-pair');
  for (const item of [example.before, example.after].filter(Boolean)) {
    const figure = element('figure');
    figure.append(element('figcaption', item.label));
    if (item.type === 'text') figure.append(element('pre', item.text));
    if (item.type === 'image') {
      const img = element('img');
      img.src = item.url;
      img.alt = item.label || example.title;
      figure.append(img);
    }
    media.append(figure);
  }
  if (media.childNodes.length) body.append(media);
  const add = action(draft.references.includes(example.id) ? '参考に追加済み' : '参考に追加', () => {
    if (!draft.references.includes(example.id)) draft.references.push(example.id);
    updateChoices('作例を参考に追加しました。');
    add.textContent = '参考に追加済み';
    add.disabled = true;
  }, 'primary');
  add.disabled = draft.references.includes(example.id);
  const links = element('div', undefined, 'actions');
  links.append(add, external('作例と再現手順を開く ↗', example.url));
  body.append(links);
  if (related.length > 1) {
    const alternatives = element('div', undefined, 'sublist');
    alternatives.append(element('h3', '同じ道具の作例'));
    for (const id of related.filter(id => id !== example.id).slice(0, 6)) {
      const other = examples.get(id);
      if (other) alternatives.append(action(other.title, () => openExample(other, related), 'text-action'));
    }
    body.append(alternatives);
  }
  if (!dialog.open) {
    exampleOpener = document.activeElement;
    dialog.showModal();
  }
}

function connectControls() {
  $('#example-dialog').addEventListener('close', () => {
    (exampleOpener?.isConnected ? exampleOpener : $('#search')).focus();
  });
  for (const [role, label] of Object.entries(roles)) {
    const option = element('option', label);
    option.value = role;
    $('#role-filter').append(option);
  }
  for (const id of ['goal', 'purpose', 'host', 'storage', 'question', 'direction', 'api', 'login', 'research']) {
    const field = $(`#${id}`);
    field.addEventListener('input', () => {
      draft[id] = field.type === 'checkbox' ? field.checked : field.value;
      if (id === 'goal') renderNav();
      if (id === 'purpose') $('#web-needs').hidden = !isWeb(draft);
      if (id === 'research') $('#question').hidden = !draft.research;
      save();
    });
  }
  $('#use-example').addEventListener('click', () => {
    draft.goal = 'ピクセル素材と再現手順を見られるギャラリー';
    draft.purpose = 'site';
    draft.host = 'auto';
    draft.storage = 'none';
    draft.api = false;
    draft.login = false;
    syncForm();
    renderNav();
    save();
  });
  $('#purpose-form').addEventListener('submit', event => { event.preventDefault(); go(2); });
  document.querySelectorAll('[data-step], [data-go]').forEach(button => button.addEventListener('click', () => go(Number(button.dataset.step || button.dataset.go))));
  document.querySelectorAll('[data-source]').forEach(button => button.addEventListener('click', () => {
    filter.source = button.dataset.source;
    filter.page = 0;
    document.querySelectorAll('[data-source]').forEach(tab => tab.setAttribute('aria-pressed', String(tab === button)));
    $('#sort').value = filter.source === 'github' ? 'stars' : 'fit';
    renderCandidates();
  }));
  for (const id of ['search', 'role-filter', 'sort', 'example-group', 'show-paid']) {
    $(`#${id}`).addEventListener('input', () => { filter.page = 0; renderCandidates(); });
  }
  document.querySelectorAll('[name="assistant"]').forEach(input => input.addEventListener('change', () => {
    draft.assistant = input.value;
    $('#image-prompt').value = makePrompt(draft, tools, examples, 'image');
    save();
  }));
  document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', async () => {
    const field = $(`#${button.dataset.copy}`);
    try {
      await navigator.clipboard.writeText(field.value);
      say('コピーしました。');
    } catch {
      field.focus();
      field.select();
      say('選択した文章をコピーしてください。');
    }
  }));
  $('#download').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([$('#build-prompt').value], { type: 'text/markdown;charset=utf-8' }));
    const link = element('a');
    link.href = url;
    link.download = '制作プロンプト.md';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

try {
  const response = await fetch('./catalog.json');
  if (!response.ok) throw new Error(`Catalog ${response.status}`);
  catalog = await response.json();
  tools = new Map(catalog.tools.map(tool => [tool.id, tool]));
  examples = new Map(catalog.examples.map(example => [example.id, example]));
  restore();
  syncForm();
  connectControls();
  $('#loading').hidden = true;
  go(draft.step, false);
} catch (error) {
  $('#loading').hidden = true;
  $('#load-error').hidden = false;
  console.error(error);
}
