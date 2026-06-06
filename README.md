# GWS ユーザー情報一括更新ツール

Google スプレッドシートにバインドした Google Apps Script で、Google Workspace のユーザーを
**作成・更新・削除・停止・再開**を 1 シート上で**混合して一括実行**するツールです。
項目はすべて日本語表記。Directory API で更新可能な標準ユーザー属性を網羅します。

## 主な特徴

- 行ごとに `操作`（作成 / 更新 / 削除 / 停止 / 再開）を指定し、1 回の「一括実行」で混在処理。
- Directory API の標準属性を網羅（氏名・組織情報・複数の電話/住所/メール・社員番号・上長・リカバリ情報・別名 など）。
- 一括処理向けに高速化（成功時のシート書き込みを抑制、ステータスはチャンク単位でまとめ書き、作成時の事前照会を省略）。
- GWS の実行時間制限（30 分）に対応。上限に近づくと自動でトリガーを張って継続。

## セットアップ

1. 対象のスプレッドシートを開き、「拡張機能 → Apps Script」でバインドされたプロジェクトを作成。
2. ローカルから `clasp` でデプロイする場合:
   ```bash
   # ツールディレクトリ内で実行
   clasp login
   clasp create --type sheets   # もしくは既存プロジェクトに clone
   # .clasp.json の scriptId を設定し、
   clasp push
   ```
3. Admin SDK が有効な Google Workspace 管理者アカウントで承認すること（OAuth スコープに `admin.directory.user` 等を要求）。
4. スプレッドシートを再読み込みし、メニュー「ユーザー一括更新」を表示。
5. 「初期設定」で **GWS ドメイン**等を設定 → 「シート初期化」で各シートを作成。

## 使い方

1. **GWSからインポート**: 現在のユーザーを全属性列付きで取り込む（編集の起点）。
2. `操作` 列に 作成 / 更新 / 削除 / 停止 / 再開 を設定し、属性列を編集。
3. **一括実行**: 確認ダイアログで件数（削除件数は強調）を確認して実行。
4. 各行の `ステータス` / `メッセージ` 列に結果が反映され、完了時にサマリーを表示。

### シート構成

| シート       | 役割                                                                |
| ------------ | ------------------------------------------------------------------- |
| ユーザー一覧 | 操作対象。1=操作 / 2=ステータス / 3=メッセージ / 4=メールアドレス … |
| 設定         | キー / バリュー / 説明。`loadConfigFromSheet` で取り込む            |
| ログ         | ジョブ開始/完了・失敗行の記録                                       |

### 操作と属性

- 識別キーは `メールアドレス`（更新/削除/停止/再開で使用）。
- **作成**: `姓`・`名`・`パスワード` が必須。既存ユーザーはスキップ。
- **更新**: 空欄の項目は変更しない（部分更新, `patch`）。
  - `会社/部門/役職/コストセンター`、`姓/名` は現在値とマージするため、一部だけ編集しても他は消えません。
  - `電話 / 住所 / 予備メール` 等の複数値フィールドは、入力した列の値で**その種別を置換**します（インポートで全列が埋まるため通常の運用では消失しません）。
- **削除**: 破壊的操作。復元期間は約 20 日のみ。二段階確認あり。
- **停止 / 再開**: アカウントの無効化 / 再有効化（`suspended`）。

### 対応する属性列（Directory API ユーザーリソース）

更新可能フィールドをほぼ網羅します。

| 列                    | API フィールド                     | 列            | API フィールド                             |
| --------------------- | ---------------------------------- | ------------- | ------------------------------------------ |
| メールアドレス        | `primaryEmail`                     | 住所          | `addresses[work].formatted`                |
| 姓 / 名               | `name.familyName/givenName`        | 建物ID / 座席 | `locations[desk].buildingId/deskCode`      |
| 表示名                | `name.displayName`                 | 予備メール    | `emails[work]`                             |
| パスワード            | `password`                         | 社員番号      | `externalIds[organization]`                |
| 次回PW変更            | `changePasswordAtNextLogin`        | 上長          | `relations[manager]`                       |
| 組織単位              | `orgUnitPath`                      | ウェブサイト  | `websites[work]`                           |
| 会社 / 部門           | `organizations[].name/department`  | IM            | `ims[]`（`protocol:アカウント`）           |
| 役職 / コストセンター | `organizations[].title/costCenter` | 言語          | `languages[]`（例 `ja`、カンマ区切り可）   |
| 勤務電話              | `phones[work]`                     | 性別          | `gender`（male/female/other など）         |
| 携帯電話              | `phones[mobile]`                   | メモ          | `notes`                                    |
| FAX                   | `phones[work_fax]`                 | キーワード    | `keywords[]`（カンマ区切り）               |
| リカバリメール        | `recoveryEmail`                    | 名簿に表示    | `includeInGlobalAddressList`（TRUE/FALSE） |
| リカバリ電話          | `recoveryPhone`                    | アーカイブ    | `archived`（TRUE/FALSE）                   |
| 別名                  | `Users.Aliases`（別API）           | IP許可リスト  | `ipWhitelisted`（TRUE/FALSE）              |

**既定で除外**（必要なら追加可能）: `posixAccounts`（Unix アカウント）、`sshPublicKeys`（SSH 公開鍵）、`hashFunction`（事前ハッシュ済みパスワード用）。複雑・ニッチなため列化していません。

> 注: `アーカイブ` を TRUE にするには Archived User ライセンスが必要です。

### よみがな・内線（任意）

`姓(よみ) / 名(よみ) / 内線` は Directory API の標準属性に存在しないため、
**カスタムスキーマを設定した場合のみ**反映します。設定シートで以下を指定してください。

- `CUSTOM_SCHEMA_NAME` … カスタムスキーマ名
- `CUSTOM_FIELD_LASTNAME_YOMI` / `CUSTOM_FIELD_FIRSTNAME_YOMI` / `CUSTOM_FIELD_EXTENSION` … 各フィールド名

未設定の場合、これらの列は無視されます。

## 設定項目（設定シート）

| キー                  | 既定      | 説明                                                   |
| --------------------- | --------- | ------------------------------------------------------ |
| `GWS_DOMAIN`          | （必須）  | Google Workspace ドメイン                              |
| `GWS_DEFAULT_OU`      | `/`       | デフォルト組織単位パス                                 |
| `BATCH_SIZE`          | `100`     | チェックポイント間隔（件）。シート書込・状態保存の頻度 |
| `TIME_LIMIT_MS`       | `1620000` | 1 実行の上限（既定 27 分 / GWS 上限 30 分）            |
| `MAX_RETRIES`         | `5`       | API リトライ上限                                       |
| `RETRY_BASE_DELAY_MS` | `1000`    | リトライ基準間隔（ミリ秒）                             |
| `DEBUG_LOGGING`       | `false`   | 詳細ログ（`true` で各 API 呼び出しを記録）             |

## バッチ制御

- **バッチ状態を確認** / **バッチを再開** / **バッチをキャンセル** をメニューから操作可能。
- 中断時は時間トリガー `resumeBatch` が自動再開。✅成功行は再処理されません（冪等）。

## 開発

```bash
npm run lint     # ESLint（GAS グローバル定義済み）
npm run format   # Prettier
```

ファイル構成（`src/`）:

| ファイル        | 役割                                                     |
| --------------- | -------------------------------------------------------- |
| `config.gs`     | 設定・バッチ状態管理                                     |
| `sheetUtils.gs` | シート読み書き・行ステータス更新                         |
| `apiClient.gs`  | Directory API 呼び出し（リトライ/レート制限/エラー分類） |
| `logger.gs`     | ログシート出力                                           |
| `fieldMap.gs`   | 列 ⇔ Directory API 属性の双方向マッピング                |
| `gwsUsers.gs`   | 全属性ユーザー CRUD・別名同期                            |
| `bulkRunner.gs` | 混合一括処理・状態機械・トリガー連鎖                     |
| `ui.gs`         | メニュー・各種ダイアログ                                 |
| `main.gs`       | エントリポイント・初期化・インポート                     |

`fieldMap.gs` の `runFieldMapSelfTest()` を GAS エディタから実行すると、列⇔API の往復マッピングを検証できます。
