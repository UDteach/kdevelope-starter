# kdevelope starter

作りたいものに合う技術と作例を選び、CodexやGeminiでの画像相談と、制作を頼むプロンプトにまとめるスターターです。[公開版](https://kdevelope.pages.dev/compose/)

Node.js 22以上で動きます。インストールする依存パッケージはありません。

```sh
git clone https://github.com/UDteach/kdevelope-starter.git
cd kdevelope-starter
npm run dev
```

ブラウザーで `http://127.0.0.1:4173` を開きます。「ギャラリーの見本を入れる」で一通り試せます。

1. 作るものと必要な機能を選ぶと、その場で構成と理由が変わります。公開先を指定した場合は、その条件で必要なものも確認できます。
2. 候補や作例を探し、役割、必須・任意、参考作例、調査することを選びます。有料は表示を選べば比較候補に入れられます。
3. 画像で相談する場合は、CodexまたはGemini向けの指示をコピーします。相談で決めた方向を記録できます。
4. 制作プロンプトをコピーするか、Markdownで保存します。

kdevelope本体では、道具の詳細から選択中のスタックへ、ギャラリーの詳細から参考作例へ引き継げます。同じタブの下書きに追加されます。

## データと更新

- `public/catalog.json` は公開済みの道具と作例をまとめた同梱データです。スター数には確認日があります。
- `public/planner.mjs` に目的と候補を結びつける規則があります。Cloudflare Pages、Workers、D1、Vercelは別の役割として扱います。
- `public/catalog.mjs` はkdevelopeの公開用データから、この画面が使う項目を取り出します。公開用の `resources.json` と `experiments.json` がある場合は `npm run catalog -- resources.json experiments.json` で再生成できます。
- `npm test` で目的との対応、料金の絞り込み、出力の引き継ぎを確認します。
- 静的ホストへ置く場合は `public/` を公開します。kdevelopeでは `/compose/` にこの画面を置き、サイトのビルド時に現在の公開データからカタログを生成します。
- kdevelope本体を管理する場合は、スターターで `npm run sync -- <kdevelope本体のディレクトリ>` を実行すると、確認した画面のソースを本体へ反映できます。

下書きは現在のブラウザータブに保存されます。画像生成・検索・制作は、利用者がコピーしたプロンプトを貼り付けた先で行います。プレビュー画像と詳細リンクはkdevelopeの公開作例を参照します。各ツールや作例の素材には配布元の条件が適用されます。

## アイコンの出典

`public/icons.mjs` の Astro、React、Svelte、Vite、shadcn/ui、Hono のパスは、[Simple Icons 16.36.0](https://github.com/simple-icons/simple-icons/tree/16.36.0/icons) の各SVGから取得しています。Simple Iconsの[ライセンス](https://github.com/simple-icons/simple-icons/blob/16.36.0/LICENSE.md)と[個々のロゴについての案内](https://github.com/simple-icons/simple-icons/blob/16.36.0/DISCLAIMER.md)を参照してください。ロゴは各技術の識別に使用します。公開・処理・保存・検索などの役割には、この画面用のアイコンを使います。
