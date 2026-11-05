import { roles } from './catalog.mjs';

export const starterUrl = 'https://github.com/UDteach/kdevelope-starter';
export const purposes = { site: '作品サイト・ブログ', app: 'Webアプリ', art: '画像・動画', writing: '文章・制作手順' };
export const blankDraft = {
  step: 1, goal: '', purpose: 'site', host: 'auto', storage: 'none', api: false, login: false,
  selected: [], references: [], comparison: [], research: false, question: '', assistant: 'Codex', direction: ''
};

export function isWeb(draft) {
  return draft.purpose === 'site' || draft.purpose === 'app';
}

export function needsServer(draft) {
  return isWeb(draft) && (draft.api || draft.login || draft.storage === 'shared');
}

export function recommendations(draft) {
  if (draft.purpose === 'art') return [{ id: 'saved-Y002', reason: 'ピクセル素材を作る場合に、コマ画像を書き出せます。', mode: 'optional' }];
  if (draft.purpose === 'writing') return [{ id: 'R45', reason: '用途や条件が伝わる新しい文章を書く手順があります。', mode: 'optional' },
    { id: 'R01', reason: '元の意味を保ちながら既存文を読みやすく整えます。', mode: 'optional' }];

  const server = needsServer(draft);
  const hosting = draft.host === 'auto'
    ? (server ? (draft.storage === 'shared' ? 'workers' : 'vercel') : 'pages')
    : draft.host;
  const result = [];
  if (hosting === 'vercel' && (server || draft.purpose === 'app')) {
    result.push({ id: 'R81', reason: '画面とサーバー側の処理を同じWebアプリで組めます。' });
  } else {
    result.push(draft.purpose === 'site'
      ? { id: 'R80', reason: '記事や作例が中心なので、一覧と詳細を持つサイトに向きます。' }
      : { id: 'R74', reason: '入力や表示の状態を持つ画面を部品に分けて作れます。' });
  }
  if (hosting === 'pages') {
    result.push({ id: 'cloudflare-pages', reason: server ? '画面を配信し、APIはPages Functionsに置きます。' : 'ビルド済みのページと素材を公開できます。',
      scope: server ? '画面と静的ファイルを配信し、Pages FunctionsでAPIを処理する。' : 'ビルド済みのページと素材を公開する。' });
  }
  if (hosting === 'workers') result.push({ id: 'cloudflare-workers', reason: server ? 'APIを実行し、静的ファイルも同じ構成で配信できます。' : '静的ファイルをWorkers Static Assetsで配信できます。',
    scope: server ? '画面と静的ファイルを配信し、必要なAPIをWorkerで処理する。' : 'Workers Static Assetsでビルド済みファイルを配信する。' });
  if (hosting === 'vercel') result.push({ id: 'vercel', reason: server ? '画面の公開と必要なサーバー処理に使います。' : '画面の公開とプレビューに使います。',
    scope: server ? '画面を公開し、必要なサーバー処理をVercel上で実行する。' : 'ビルド済みの画面を公開し、プレビューで確認する。' });
  if (draft.storage === 'shared' && (hosting === 'workers' || hosting === 'pages')) {
    result.push({ id: 'cloudflare-d1', reason: '端末間で共有するレコードをSQLで保存します。',
      scope: `共有データを保存し、${hosting === 'workers' ? 'Workers' : 'Pages Functions'}のバインディングから読み書きする。` });
  }
  return result;
}

export function addSelection(draft, tool, scope = tool.scope, mode = 'required') {
  if (tool.price === 'paid') {
    if (!draft.comparison.includes(tool.id)) draft.comparison.push(tool.id);
    return;
  }
  if (draft.selected.some(item => item.id === tool.id)) return;
  draft.selected.push({ id: tool.id, mode, scope });
}

export function scopeNotes(draft, tools) {
  const chosen = draft.selected.map(s => tools.get(s.id)).filter(Boolean);
  const hosts = chosen.filter(tool => tool.role === 'hosting');
  const host = hosts[0]?.id;
  const database = chosen.some(tool => tool.id === 'cloudflare-d1');
  const notes = [];
  if (chosen.some(tool => tool.id === 'R86')) notes.push('shadcn/uiで取り込む部品と、その部品が使うフレームワーク・スタイル設定を確認してください。');
  if (hosts.length > 1) notes.push('公開先が複数あります。画面とAPIをどこに置くか決めてください。');
  if (chosen.filter(tool => tool.role === 'frontend').length > 1) notes.push('画面の道具が複数あります。主に使う技術と組み合わせ方を確認してください。');
  if (database && draft.storage !== 'shared') notes.push('D1で共有するデータが決まっていません。保存対象を決めてから採用してください。');
  if (database && !hosts.some(tool => ['cloudflare-pages', 'cloudflare-workers'].includes(tool.id))) {
    notes.push('この構成のD1はCloudflare側のサーバー処理から読み書きします。Vercel等と組み合わせる場合は、接続先のAPIと権限を決めてください。');
  }
  if (database && host === 'cloudflare-pages') notes.push('D1の読み書きはPages Functionsに置き、ブラウザーには認証情報を渡さない構成にします。');
  if (database && host === 'cloudflare-workers') notes.push('D1の読み書きはWorkerに置き、ブラウザーには認証情報を渡さない構成にします。');
  if (isWeb(draft) && draft.storage === 'shared' && !database) notes.push('共有データの保存先を決める必要があります。保存する項目と読み書きの権限を確認してください。');
  if (isWeb(draft) && draft.storage === 'local') notes.push('端末内保存として設計し、再読み込み後の復元を確認します。');
  if (isWeb(draft) && draft.login) notes.push('ログイン方法と、利用者ごとに読めるデータの範囲を設計してください。');
  if (isWeb(draft) && draft.host === 'local' && hosts.length) notes.push('目的ではローカルを選んでいます。公開する場合は目的と公開先を揃えてください。');
  return notes;
}

function sortByFit(a, b, fit, preferredRoles) {
  const score = tool => (fit.has(tool.id) ? 10 : 0) + (preferredRoles.has(tool.role) ? 2 : 0);
  return score(b) - score(a) || a.name.localeCompare(b.name, 'ja');
}

export function findTools(tools, draft, filter) {
  const words = filter.query.normalize('NFKC').toLowerCase().trim().split(/\s+/u).filter(Boolean);
  const fit = new Set(recommendations(draft).map(item => item.id));
  const preferredRoles = new Set(isWeb(draft) ? ['frontend', 'style', 'ui', 'hosting', 'test']
    : draft.purpose === 'art' ? ['image', 'motion'] : ['writing']);
  return tools.filter(tool => {
    if (!filter.paid && tool.price === 'paid') return false;
    if (filter.github && (!tool.repository || !tool.repository.openSource)) return false;
    if (filter.role && tool.role !== filter.role) return false;
    const text = `${tool.name} ${tool.use} ${tool.scope} ${roles[tool.role]} ${tool.repository?.url || ''}`.normalize('NFKC').toLowerCase();
    return words.every(word => text.includes(word));
  }).sort((a, b) => {
    if (filter.sort === 'stars') return (b.repository?.stars ?? -1) - (a.repository?.stars ?? -1) || a.name.localeCompare(b.name, 'ja');
    if (filter.sort === 'recent') {
      return Number(Boolean(b.repository?.trending)) - Number(Boolean(a.repository?.trending)) || sortByFit(a, b, fit, preferredRoles);
    }
    return sortByFit(a, b, fit, preferredRoles);
  });
}

function section(title, lines) {
  return lines.length ? `## ${title}\n${lines.join('\n')}` : '';
}

export function makePrompt(draft, tools, examples, kind = 'build') {
  const visuals = kind === 'image';
  const goal = draft.goal.trim();
  const intro = visuals
    ? `${draft.assistant}で制作前の方向を相談します。次の条件と参考作例を読み、比較できる画像案を2案出してください。画像出力が使えない場合は、各案の画像生成用プロンプトを出してください。案ごとの違いと、選ぶ前に確認したい点を添えてください。`
    : '次の要件から制作を進めてください。まず既存リポジトリと公式資料を確認し、必須条件、費用、実行環境に矛盾があれば制作前に示してください。';
  const selected = draft.selected.flatMap(item => {
    const tool = tools.get(item.id);
    return tool ? [{ ...item, tool }] : [];
  });
  const toolLines = mode => selected.filter(s => s.mode === mode)
    .map(s => `- ${roles[s.tool.role]} / ${s.tool.name}：${s.scope.trim() || s.tool.scope}（${s.tool.url}）`);
  const references = draft.references.flatMap(id => {
    const example = examples.get(id);
    return example ? [`- ${example.title} ${example.url}。出力と再現手順を確認し、今回に取り入れる点を示してください。`] : [];
  });
  const comparison = draft.comparison.flatMap(id => {
    const tool = tools.get(id);
    return tool ? [`- ${tool.name}（${tool.priceLabel}） ${tool.url}。公式情報から用途・条件と無料の代替候補を比較してください。`] : [];
  });
  const scope = isWeb(draft) ? [
    `- 公開先の希望：${{ auto: '候補から決める', local: 'ローカル', vercel: 'Vercel', pages: 'Cloudflare Pages', workers: 'Cloudflare Workers' }[draft.host]}`,
    `- 保存範囲：${{ none: '永続保存は要件外', local: 'この端末に保存', shared: '端末間で共有するデータを保存' }[draft.storage]}`,
    `- サーバー側の処理：${needsServer(draft) ? '必要' : '要件外'}。ログイン：${draft.login ? '必要' : '要件外'}。`,
    ...scopeNotes(draft, tools).map(note => `- ${note}`)
  ] : [];
  return [intro, section('作りたいもの', [goal, `用途：${purposes[draft.purpose]}`]),
    section('必須', toolLines('required')), section('任意', toolLines('optional')),
    section('公開・サーバー・保存の範囲', scope), section('参考作例', references),
    section('比較候補', comparison),
    section('調べてほしいこと', draft.research ? [draft.question.trim() || '用途に合う候補と使い始める手順を調べてください。',
      '公式情報と作例を参照し、確認できた事実・未試行の点・無料で試せる範囲を分けてください。'] : []),
    section('画像で決めた方向', draft.direction.trim() ? [draft.direction.trim()] : []),
    visuals ? '画像案を出した段階で、採用する方向を確認してください。' :
      'まず小さな作例を動かし、使った技術と設定、再現手順、確認結果を残してください。公開・購入・アカウント作成は、実行前に対象と条件を示してください。'
  ].filter(Boolean).join('\n\n');
}
