const origin = 'https://kdevelope.pages.dev';

export const roles = {
  frontend: '画面', build: 'ビルド', language: '言語', style: 'スタイル', ui: 'UI部品', api: 'API', fetch: 'データ取得',
  hosting: '公開先', database: 'データ保存', writing: '日本語・文章',
  image: '画像・素材', motion: '映像・動き', test: '検証', general: '制作支援'
};

const platforms = [
  ['html-css', 'HTML / CSS', 'frontend', 'https://developer.mozilla.org/ja/docs/Learn_web_development/Core',
    '少ないページと基本の操作から始める。', 'ページの構造と見た目を作る。', 'Web標準'],
  ['cloudflare-pages', 'Cloudflare Pages', 'hosting', 'https://developers.cloudflare.com/pages/',
    'ビルド済みのサイトを配信する。', 'HTML・CSS・画像を公開する。', 'プランを確認'],
  ['cloudflare-workers', 'Cloudflare Workers', 'hosting', 'https://developers.cloudflare.com/workers/',
    'HTTPリクエストを処理し、必要に応じて静的ファイルも配信する。', 'Web公開とサーバー側の処理を担当する。', 'プランを確認'],
  ['cloudflare-d1', 'Cloudflare D1', 'database', 'https://developers.cloudflare.com/d1/',
    '作品情報など、表にできるデータをSQLで扱う。', '共有データを保存し、サーバー側から検索・更新する。', 'プランを確認'],
  ['vercel', 'Vercel', 'hosting', 'https://vercel.com/docs/frameworks',
    'Next.jsの公開、プレビュー、必要なサーバー処理。', 'Web画面を公開し、必要に応じてAPIを動かす。', 'プランを確認']
];

const fromCases = [
  ['saved-Y002', 'image', 'コードでピクセルエフェクトを描く。', '攻撃や魔法のコマ画像を作る。', 'free', 'コードはMIT'],
  ['new-20261103-08', 'image', '拡大したドット絵を元の画素数へ戻す。', '入力と保存PNGを比べ、格子のずれを確かめる。', 'freemium', 'PNG保存を無料で確認'],
  ['new-20261103-20', 'image', '波や図形の背景をSVGで作る。', 'ポスターや見出しに背景を添える。', 'freemium', 'BasicのSVG出力を確認'],
  ['new-20261103-21', 'style', '実際の画面に配色を当てて比較する。', '文字・背景・ボタンの配色を決める。', 'freemium', '配色の保存を無料で確認'],
  ['new-20261103-25', 'ui', 'Reactで動くUI部品を使う。', 'ボタンなど、必要な部品だけを試す。', 'free', '公開コード'],
  ['new-20261103-05', 'motion', 'Aseprite上で骨組みを使ってキャラクターを動かす。', '2Dスプライト用の動きを組む。', 'paid', '有料・未試行']
];

function publicUrl(value) {
  if (typeof value !== 'string' || !value) return '';
  if (value.startsWith('/') && !value.startsWith('//')) return `${origin}${value}`;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch {
    return '';
  }
}

function media(entry, localAssets) {
  if (entry?.type === 'image') {
    const url = publicUrl(entry.src);
    if (!url.startsWith(`${origin}/assets/`)) return null;
    return { type: 'image', url: localAssets ? url.slice(origin.length) : url, label: entry.label };
  }
  if (entry?.type === 'text') return { type: 'text', text: entry.text.slice(0, 450), label: entry.label };
  return null;
}

export function buildCatalog(content, experiments, { localAssets = false } = {}) {
  const examples = experiments.cases.map(item => ({
    id: item.id,
    title: item.title,
    group: item.galleryGroup === 'art' ? 'art' : 'skills',
    summary: item.summary,
    scope: item.scope,
    tools: item.tools.map(tool => tool.name),
    url: `${origin}/experiments?view=${item.galleryGroup === 'art' ? 'art' : 'skills'}#${encodeURIComponent(item.id)}`,
    before: media(item.before, localAssets),
    after: media(item.after, localAssets) || media({ type: 'image', src: item.preview, label: '作例' }, localAssets)
  }));
  const tools = content.resources.map(item => ({
    id: item.id,
    name: item.name,
    role: item.stack?.role || ({ '日本語・文章': 'writing', 'ゲーム・画像': 'image' }[item.category] || 'general'),
    use: item.use,
    scope: item.stack?.scope || item.first_trial,
    conditions: item.conditions,
    price: item.pricing.kind,
    priceLabel: item.pricing.label,
    url: publicUrl(item.url),
    repository: item.repository || null,
    exampleIds: experiments.cases
      .filter(c => c.resourceIds.includes(item.id) || item.stack?.exampleIds?.includes(c.id))
      .map(c => c.id)
  }));
  for (const [id, name, role, url, use, scope, priceLabel] of platforms) {
    tools.push({ id, name, role, url, use, scope, priceLabel, price: 'unknown', exampleIds: [] });
  }
  for (const [id, role, use, scope, price, priceLabel] of fromCases) {
    const row = experiments.coverage.find(item => item.id === id);
    if (!row || tools.some(tool => tool.name === row.name)) continue;
    tools.push({ id, name: row.name, role, use, scope, price, priceLabel, url: publicUrl(row.url),
      conditions: row.constraint, exampleIds: experiments.cases
        .filter(item => item.resourceIds.some(resourceId => row.resourceIds.includes(resourceId)))
        .map(item => item.id) });
  }
  return { date: content.updated_on, tools, examples };
}
