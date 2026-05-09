# GAS ユーザー管理ツール

Google Apps Script (GAS) で構築した、Google Workspace / rakumo のユーザー・グループ一括管理ツールです。スプレッドシートをインターフェースとして、ユーザーの登録・更新・削除やグループ管理をバッチ処理で実行できます。

## ツール構成

| ツール | ディレクトリ | 用途 |
|--------|-------------|------|
| 統合ユーザー管理ツール | `integrated-user-tool/` | GWS + rakumo を統合管理（推奨） |
| rakumo ユーザー管理ツール | `rakumo-user-tool/` | rakumo プロファイル管理のみ |
| GWS ユーザー管理ツール | `gws-user-tool/` | Google Workspace 管理のみ |

3つのツールは同一コードベースから `TOOL_MODE` フラグで派生しています。統合ツールがソースの基点となり、ビルドスクリプトで各派生ツールを生成します。

## 主な機能

### Google Workspace 管理（統合 / GWS モード）
- ユーザーの一括登録・更新・削除・停止
- グループの作成・削除・メンバー同期
- 既存ユーザー / グループのスプレッドシートへのインポート

### rakumo 管理（統合 / rakumo モード）
- プロファイル CSV のダウンロード / アップロード
- ユーザー詳細 CSV・ライセンス CSV・部門 CSV の生成
- Google 同期ジョブの実行・監視

### 統合フロー（統合モードのみ）
- GWS ユーザー登録 → Google 同期 → rakumo CSV 反映を自動連携
- GAS の 6 分実行制限に対応したバッチ処理・トリガー連鎖

## 前提条件

- Node.js（v18 以上推奨）
- [clasp](https://github.com/google/clasp) — GAS ローカル開発ツール
- Google Workspace 管理者アカウント（GWS 機能を使用する場合）
- rakumo API キー・シークレットキー（rakumo 機能を使用する場合）

## セットアップ

### 1. リポジトリのクローンと依存関係のインストール

```bash
git clone https://github.com/kkatori/k.katori-gigei.jp.git
cd k.katori-gigei.jp
npm install
```

### 2. clasp のログイン

```bash
npx clasp login
```

### 3. GAS プロジェクトの作成と紐付け

使用するツールのディレクトリで GAS プロジェクトを作成し、`.clasp.json` の `scriptId` を設定します。

```bash
# 例: 統合ツールの場合
cd integrated-user-tool

# 新規 GAS プロジェクトを作成（スプレッドシートにバインド）
npx clasp create --type sheets --title "統合ユーザー管理ツール" --rootDir src
```

または、既存の GAS プロジェクトに紐付ける場合は `.clasp.json` の `scriptId` を手動で設定してください。

```json
{
  "scriptId": "YOUR_SCRIPT_ID_HERE",
  "rootDir": "src"
}
```

### 4. ビルド

共通モジュールを各ツールの `src/` にコピーします。

```bash
# プロジェクトルートで実行
# 全ツールをビルド
node scripts/build.js all

# 特定のツールのみビルド
node scripts/build.js integrated-user-tool
node scripts/build.js rakumo-user-tool
node scripts/build.js gws-user-tool
```

### 5. GAS へデプロイ

```bash
cd integrated-user-tool
npx clasp push
```

### 6. Admin SDK の有効化（GWS / 統合モードの場合）

GAS エディタ（`npx clasp open`）でプロジェクトを開き、以下を確認してください:

1. **サービス** → **Admin SDK Directory API (directory_v1)** が有効であること
2. Google Cloud プロジェクトで **Admin SDK API** が有効であること

## 使い方

### 初期設定

1. スプレッドシートを開き、メニュー「ユーザー管理」→「初期化」を実行
2. 自動作成される「設定」シートに以下を入力:

| 設定名 | 説明 | 必須 |
|--------|------|------|
| `TOOL_MODE` | `integrated` / `gws` / `rakumo` | 初期設定済み |
| `GWS_DOMAIN` | Google Workspace ドメイン（例: `example.com`） | GWS 使用時 |
| `GWS_DEFAULT_OU` | デフォルト組織単位パス（例: `/`） | GWS 使用時 |
| `RAKUMO_API_KEY` | rakumo API キー | rakumo 使用時 |
| `RAKUMO_SECRET_KEY` | rakumo シークレットキー | rakumo 使用時 |
| `BATCH_SIZE` | 1 回のバッチ処理件数（デフォルト: `50`） | 任意 |

### 基本操作

#### GWS ユーザー管理

1. メニュー「GWS ユーザー」→「ユーザーインポート」で既存ユーザーをシートに取り込み
2. 「ユーザー一覧」シートでデータを編集し、「操作」列に `create` / `update` / `delete` / `suspend` を指定
3. メニューから対応する操作を実行

#### rakumo 管理

1. メニュー「rakumo」→「CSV ダウンロード」で現在のプロファイルを取得
2. シート上で編集後、メニューから CSV アップロードを実行
3. 「Google 同期」で rakumo と Google Workspace を同期

#### 統合フロー

1. 「ユーザー一覧」シートにユーザー情報を入力
2. 「操作」列に `create` / `update` / `delete` を指定
3. メニュー「統合フロー」から実行（GWS 登録 → Google 同期 → rakumo 反映を自動実行）

### シートの列構成

「ユーザー一覧」シートには以下の列があります:

| 列 | 内容 | 備考 |
|----|------|------|
| ステータス | 処理結果（自動更新） | 待機中 / 処理中 / 成功 / 失敗 |
| メッセージ | エラー詳細（自動更新） | |
| メールアドレス | GWS primaryEmail / rakumo User ID | 必須 |
| 姓 / 名 | ユーザー名 | 必須 |
| パスワード | 初期パスワード（GWS 登録時） | 登録時のみ |
| 組織単位 | GWS 組織単位パス | GWS |
| 会社名〜社員番号 | rakumo プロファイル項目 | rakumo |
| Calendar〜Attendance | rakumo ライセンス（1/0） | rakumo |
| 操作 | `create` / `update` / `delete` / `suspend` | 必須 |

### バッチ処理

大量のユーザーを処理する場合、GAS の 6 分実行制限を超えないよう自動的にバッチ分割されます。

- 処理は自動的にトリガーで再開されます
- メニュー「バッチ管理」→「バッチ状態確認」で進捗を確認
- 「バッチキャンセル」で実行中の処理を停止可能
- 処理失敗した行はステータスを「待機中」に戻して再実行できます

## ディレクトリ構成

```
shared/src/             # 共通モジュール
  auth.js               #   rakumo HMAC-SHA1 認証
  config.js             #   設定管理（PropertiesService）
  csv.js                #   CSV 生成・パース
  sheetUtils.js         #   スプレッドシート操作
  apiClient.js          #   HTTP 通信（リトライ・レート制限）
  logger.js             #   ログ出力

integrated-user-tool/   # 統合ユーザー管理ツール（ソース基点）
  src/
    main.js             #   エントリポイント
    gwsUsers.js         #   GWS ユーザー CRUD
    gwsGroups.js        #   GWS グループ管理
    rakumoProfile.js    #   rakumo プロファイル CSV
    rakumoSync.js       #   Google 同期ジョブ
    csvGenerator.js     #   rakumo CSV 生成
    workflows.js        #   統合フロー・バッチ処理
    ui.js               #   メニュー・ダイアログ

rakumo-user-tool/       # rakumo 派生ツール
gws-user-tool/          # GWS 派生ツール
scripts/
  build.js              # 派生ツールビルドスクリプト
docs/                   # 開発ドキュメント
```

## 開発

### Lint

```bash
npm run lint
```

### コードフォーマット

```bash
npm run format
```

### ビルド → デプロイ

```bash
node scripts/build.js all
cd integrated-user-tool && npx clasp push
```

## 対象規模

50〜300 ユーザー規模の中小企業を想定しています。バッチサイズのデフォルトは 50 件/回で、設定シートから調整可能です。

## ライセンス

Private
