# ユーザー管理機能開発 要件定義書

| 項目 | 内容 |
|------|------|
| 作成日 | 2026年3月8日 |
| 作成者 | rakumo株式会社 |
| バージョン | 2.1 |
| 対象 | 東邦ホールディングス株式会社 |
| 改訂履歴 | v1.1：rakumo Profile API仕様に基づき4.4・4.5・10章を更新、11章を追加 |
| | v1.2：rakumo Google同期API仕様に基づき4.4章を更新、12章を追加 |
| | v1.3：バックエンドをCloud Runに確定、DBをCloud SQLに確定、性能要件を追加 |
| | v1.4：レビュー指摘対応（冪等性・整合性・実現可能性・要件網羅性の修正） |
| | v1.5：PDFヒアリング確定事項（GWS命名規則・実行タイミング・rakumo管理項目・Appsheetアクセス権等）を反映 |
| | v1.6：PDFヒアリング確定事項（3/26分）を反映（ログ出力仕様・ログ保存期間・CSV連携方針・GWSアカウント/グループ出力項目・デフォルト登録情報） |
| | v1.7：AppSheetからのアカウント・グループ・グループメンバー直接入力→GWS即時更新フローを追加（4.1〜4.3・8.2節） |
| | v1.8：ユーザーID（A100000形式）・グループID（G100000形式）の採番仕様を追加（5.1〜5.3節・9.1・9.3節） |
| | v1.9：Google属性情報の決定シート・確認シートを反映。AppSheetからのアカウント・グループCRUD操作仕様（入力フィールド・デフォルト値・作成/変更/削除仕様）を追加。利用対象外属性を明記（4.2・4.3節） |
| | v2.0：AppSheet画面構成（セクション分割型4画面）を確定。テーブル構成（5テーブル分離）を追加。GWS停止時のrakumo自動連動仕様を明記（4.1・4.2・5.0節） |
| | v2.1：修正案反映 — 兼務組織を最大10箇所に拡張（5.1節）、ログ保存期間のデフォルト値・ローテーション仕様を具体化（13.2節）、AppSheet操作フローをAction/Automationに分離・明確化（4.1節） |

---

## 目次

1. [概要](#1-概要)
2. [開発の目的・背景](#2-開発の目的背景)
3. [システム概要](#3-システム概要)
4. [機能要件](#4-機能要件)
   - 4.1 [Web画面表示機能（Appsheet）](#41-web画面表示機能appsheet)
   - 4.2 [Googleアカウント登録機能](#42-googleアカウント登録機能)
   - 4.3 [Googleグループ登録機能](#43-googleグループ登録機能)
   - 4.4 [Google同期実行機能](#44-google同期実行機能)
   - 4.5 [rakumoコンタクト更新機能](#45-rakumoコンタクト更新機能)
   - 4.6 [Appsheet表示用スプレッドシート作成機能](#46-appsheet表示用スプレッドシート作成機能)
   - 4.7 [他システム連携用CSVダウンロード機能](#47-他システム連携用csvダウンロード機能)
   - 4.8 [定期実行・予約実行機能](#48-定期実行予約実行機能)
5. [ユーザーマスタ仕様](#5-ユーザーマスタ仕様)
   - 5.1 [ユーザーマスタ項目](#51-ユーザーマスタ項目)
   - 5.2 [グループマスタ主要項目](#52-グループマスタ主要項目)
   - 5.3 [ID採番仕様](#53-id採番仕様)
6. [システム構成](#6-システム構成)
7. [非機能要件](#7-非機能要件)
8. [運用要件](#8-運用要件)
9. [CSV仕様](#9-csv仕様)
10. [制約・前提条件](#10-制約前提条件)
11. [rakumo Profile API仕様](#11-rakumo-profile-api仕様)
12. [rakumo Google同期API仕様](#12-rakumo-google同期api仕様)
13. [ログ出力仕様](#13-ログ出力仕様)

---

## 1. 概要

本書は、東邦ホールディングス株式会社におけるユーザー管理機能の開発に関する要件定義書である。
StarOffice廃止に伴うユーザーマスタ機能の新規開発を目的とし、Google Workspace および Google Cloud を活用したシステムの仕様を定義する。

---

## 2. 開発の目的・背景

### 2.1 課題①：ユーザーマスタの廃止

- これまで StarOffice が社員情報のマスターデータとして機能していた
- Google Workspace および rakumo の導入に伴い StarOffice が廃止される
- StarOffice 廃止により、各システムとの CSV 連携も廃止となる
- StarOffice に代わるユーザーマスタ機能が必要となった

### 2.2 課題②：Google グループ・rakumo コンタクトの管理工数

- Google グループが Google ドライブのアクセス権限管理目的で多数作成されている
- rakumo コンタクトの組織階層表示と実際の組織情報に乖離が生じている
- 人事異動・組織改編の都度、手動での作業が発生しており工数が大きい

### 2.3 解決策：6機能の新規開発

以下の機能を新規開発することで上記課題を解決する。

1. StarOffice に代わるユーザーマスタ機能
2. Google Workspace のアカウントとグループを一括登録・更新する機能
3. rakumo コンタクトの情報を更新する機能
4. ユーザーマスタから他システムへ連携する CSV を作成・ダウンロードする機能
5. 定期実行や予約実行を行う機能
6. Google Cloud にユーザーマスタのデータベースを構築

---

## 3. システム概要

### 3.1 システム構成概要

| 分類 | コンポーネント | 役割 |
|------|---------------|------|
| フロントエンド | Appsheet（Google Workspace上） | ユーザー向け操作画面 |
| バックエンド | Cloud Run | API処理・バッチ処理 |
| データベース | Cloud SQL | 人事情報マスタ |
| ストレージ | Cloud Storage | CSVデータ保管 |
| ログ管理 | Cloud Logging → Cloud Pub/Sub → BigQuery | 監視・ログ蓄積 |
| 外部連携 | Google Workspace API、rakumo API | 外部サービス連携 |

### 3.2 外部システム連携

- **Google Workspace**：ユーザー・グループの登録・更新・削除
- **rakumo**：コンタクト情報の更新（rakumo Profile API 使用）
- **他システム**：CSV ファイルによるデータ連携

---

## 4. 機能要件

### 4.1 Web画面表示機能（Appsheet）

Appsheet を用いた Web 操作画面を提供する。

**提供する画面・機能：**

- ユーザー情報一覧表示
- グループ情報一覧表示
- グループメンバー一覧表示
- ユーザー情報入力・編集・削除（AppSheet フォームからアカウントを個別に追加・変更・削除し、Google Workspace へ即時反映）
- グループ情報入力・編集・削除（AppSheet フォームからグループを個別に追加・変更・削除し、Google Workspace へ即時反映）
- グループメンバーの追加・削除（AppSheet フォームからグループメンバーを個別に追加・削除し、Google Workspace へ即時反映）
- CSV アップロード機能の UI（アカウント・グループ・グループメンバーの一括処理用）
- CSV ダウンロード機能の UI
- Google 同期機能の UI
- rakumo コンタクトアップデート機能の UI
- 定期実行・予約実行のスケジュール設定 UI（実行日時・時刻の設定・変更）
- 実行ログ表示

**AppSheet画面構成（確定・4画面構成）：**

AppSheetの画面はセクション分割型統合画面＋グループ系独立の4画面で構成する。Google管理コンソールは使用せず、すべてAppSheetから操作する。

| 画面 | 画面名 | 主な用途 | 対応テーブル |
|------|--------|---------|-----------|
| A | ユーザー一覧 | ユーザーの検索・選択の起点 | Googleアカウント（主）、会社・個人情報（参照） |
| B | ユーザー詳細・編集 | 1ユーザーに関する全情報の閲覧・編集 | Googleアカウント、rakumoプロファイル、会社・個人情報、グループメンバー（参照） |
| C | グループ一覧・設定 | グループの作成・変更・削除 | グループ設定 |
| D | グループメンバー管理 | メンバーの追加・削除 | グループメンバー |

**画面A：ユーザー一覧**

| 項目 | 内容 |
|------|------|
| 表示項目 | UserID、primaryEmail、First Name、Last Name、社員番号、suspended、主務組織名 |
| 機能 | 検索・フィルタ、新規登録ボタン、各ユーザーの詳細画面（画面B）への遷移 |

**画面B：ユーザー詳細・編集（セクション分割型）**

1画面内に3つのセクションとインライン表示を配置し、ユーザーに関する全情報を1画面で閲覧・編集できるようにする。

| セクション | 対応テーブル | 含む項目 | 用途 |
|-----------|-----------|---------|------|
| セクション1: Googleアカウント設定 | Googleアカウント | primaryEmail、password、First Name、Last Name、suspended、changePasswordAtNextLogin、includeInGlobalAddressList、orgUnitPath、recoveryEmail、recoveryPhone ＋ 読取専用項目（UserID、isAdmin、aliases等） | Googleアカウントの作成・変更・削除 |
| セクション2: rakumo設定 | rakumoプロファイル | ライセンスフラグ×6（Calendar/Contacts/Workflow/Board/Expense/Attendance）、表示フラグ（Display）、プライマリフラグ（Primary）、主務組織名、主務組織メールアドレス、兼務組織名1〜10、兼務組織メールアドレス1〜10、兼務組織役職1〜10、備考 | rakumoプロファイルの設定 |
| セクション3: 会社・個人情報 | 会社・個人情報 | 姓よみ、名よみ、会社名、会社名よみ、社員番号、役職、会社電話番号、内線番号、携帯電話番号、FAX番号、会社住所、生年月日、メールアドレス2、メールアドレス3 | 会社固有情報の管理 |
| インライン: 所属グループ一覧 | グループメンバー（参照） | 所属グループメールアドレス、グループ名 | ユーザーの所属グループ確認 |

> セクション分割の利点：新入社員登録時は全セクションを順に入力して1画面で完結できる。パスワードリセットやライセンス変更などの個別操作はセクション内で完結する。

**画面C：グループ一覧・設定**

| 項目 | 内容 |
|------|------|
| 一覧表示項目 | GroupID、email、name、description |
| 詳細/編集項目 | email、name、description ＋ 15種のアクセス権設定（whoCanJoin等） |
| グループ種別 | 「rakumo用」「ドライブ用」の選択により、デフォルト値を自動設定 |
| 機能 | グループ作成・変更・削除（各項目の詳細は4.3節参照） |

**画面D：グループメンバー管理**

| 項目 | 内容 |
|------|------|
| 表示項目 | グループメールアドレス、メンバーメールアドレス一覧 |
| アクセス方法 | 画面C（グループ詳細）からインライン表示、または画面B（ユーザー詳細）からインライン表示（双方向） |
| 機能 | メンバー追加・削除、一括追加（CSV） |

**テーブルと画面の対応関係：**

| テーブル | 画面A（一覧） | 画面B（詳細） | 画面C（グループ） | 画面D（メンバー） |
|---------|:---:|:---:|:---:|:---:|
| Googleアカウント | 主テーブル | セクション1 | ― | ― |
| rakumoプロファイル | ― | セクション2 | ― | ― |
| 会社・個人情報 | 参照 | セクション3 | ― | ― |
| グループ設定 | ― | ― | 主テーブル | ― |
| グループメンバー | ― | インライン | インライン | 主テーブル |

**AppSheet 操作時の処理フロー：**

AppSheetからの操作は、データ整合性と即時反映を優先し、以下のフローで実行する。

**1. 個別操作（追加・変更・削除・同期ボタン）：**

AppSheet **アクション（Webhook）** から直接 Cloud Run API を呼び出し、処理結果を待機して画面に完了メッセージを表示する。

```
AppSheet フォーム操作（追加・変更・削除・同期ボタン）
    │
    ▼（AppSheet Action → Webhook）
Cloud Run API 呼び出し（同期）
    ├── Cloud SQL 更新
    ├── Google Workspace API（アカウント・グループ・グループメンバー更新）
    └── rakumo コンタクト更新（アカウント変更時）
    │
    ▼
処理結果を AppSheet に返却 → 完了メッセージ表示
```

**2. 一括操作（CSVアップロード）：**

AppSheet **オートメーション（Bot）** が、Google Driveへのファイル保存を検知して Cloud Run API を非同期で呼び出す。

```
CSV ファイルを Google Drive にアップロード
    │
    ▼（AppSheet Automation → Bot がファイル保存を検知）
Cloud Run API 呼び出し（非同期）
    ├── Cloud SQL 一括更新
    ├── Google Workspace API（アカウント・グループ一括更新）
    └── rakumo コンタクト更新
    │
    ▼
処理結果をログに記録 → AppSheet から結果確認可能
```

> 個別操作と一括操作は、いずれも同じ Cloud Run API を経由して処理する。Cloud SQL・Google Workspace への反映処理は共通である。

### 4.2 Googleアカウント登録機能

Google Workspace のユーザーアカウントを登録・更新・削除する機能。

**入力チャネル：**

アカウントの登録・更新・削除は以下の2方式で実施できる。

| 方式 | 概要 | 主な用途 |
|------|------|---------|
| CSVアップロード（一括） | アカウント用CSVをCloud Storageにアップロードし、一括処理 | 人事異動時の大量変更・初期データ投入 |
| AppSheet画面（個別操作） | AppSheet の入力フォームからアカウントを個別に追加・変更・削除 | 都度発生する個別変更（新入社員登録・退職処理等） |

AppSheet 個別操作時は、AppSheet Automation 経由で Cloud Run API を呼び出し、Cloud SQL および Google Workspace をリアルタイムに更新する。

**機能詳細：**

- アカウント用 CSV のアップロード（Cloud Storage への保存）
- アカウント用 CSV のダウンロード（Cloud SQL のユーザーマスタから生成。役職・社員番号等を含む）
- AppSheet フォームからのアカウント個別追加・変更・削除
- アカウントの追加・変更・削除の実行（Cloud SQL への登録 ＋ Google Workspace API 反映）

**Googleアカウント命名規則（確定）：**

- Googleアカウント（メールアドレス）の命名規則は設けない
- 同姓同名のユーザーが存在する場合も同様に命名規則は適用しない
- 同姓同名ユーザーの識別はメールアドレスまたは社員番号で行う

**実行タイミング（確定）：**

| 実行方式 | 内容 |
|---------|------|
| 即時実行（CSV） | CSV取込後に即時処理（アカウントの追加・変更・削除をリアルタイムで反映） |
| 即時実行（AppSheet） | AppSheet フォーム操作後に即時処理（アカウントの追加・変更・削除をリアルタイムで反映） |

**冪等性の保証：**

| 変更種別 | 対象が存在する場合 | 対象が存在しない場合 |
|---------|-----------------|------------------|
| 追加 | **変更（UPSERT）として処理**（エラーにしない） | 新規登録 |
| 変更 | 更新 | エラー（スキップし件数を記録） |
| 削除 | 論理削除 | **成功（スキップ）として処理**（エラーにしない） |

> 同一操作を複数回実行しても結果が同じになるよう、追加はUPSERT、削除は冪等に扱う（CSVアップロード・AppSheet操作ともに共通）。

**Googleアカウント情報出力項目（確定 3/26）：**

| # | プロパティ名 | 型 | 説明 | 備考 |
|---|------------|-----|------|------|
| 1 | UserID | string | ユーザーを識別するID（6桁の数字） | |
| 2 | primaryEmail | string | ユーザーのメインのメールアドレス | |
| 3 | password | string | パスワード（8〜100文字のASCII文字） | |
| 4 | isAdmin | boolean | 特権管理者権限を持つユーザーか | 出力専用 |
| 5 | suspended | boolean | ユーザーが一時停止されているか | |
| 6 | changePasswordAtNextLogin | boolean | 次回ログイン時にパスワード変更が必要か | デフォルト: `TRUE` |
| 7 | First Name | string | ユーザーの姓 | |
| 8 | Last Name | string | ユーザーの名 | |
| 9 | name | string | ユーザーの氏名（姓・名のフルネーム） | |
| 10 | aliases[] | string | エイリアスメールアドレスのリスト | 出力専用 |
| 11 | isMailboxSetup | boolean | Googleメールボックスが作成されているか | 出力専用 |
| 12 | suspensionReason | string | アカウント停止の理由（suspended=trueの場合のみ） | 出力専用 |
| 13 | creationTime | string | アカウント作成日時（YYYY-MM-DDThh:mm:ssTZD形式） | 出力専用 |
| 14 | includeInGlobalAddressList | boolean | グローバルアドレス一覧（GAL）に表示するか | デフォルト: `TRUE` |
| 15 | deletionTime | string | アカウント削除日時（YYYY-MM-DDThh:mm:ssTZD形式） | 出力専用 |
| 16 | isEnrolledIn2Sv | boolean | 2段階認証プロセスに登録されているか | 出力専用 |
| 17 | isEnforcedIn2Sv | boolean | 2段階認証プロセスが適用されているか | 出力専用 |
| 18 | orgUnitPath | string | 所属する親組織のフルパス（例: `/営業部`） | |
| 19 | recoveryEmail | string | アカウント再設定用メールアドレス | |
| 20 | recoveryPhone | string | アカウント復元用スマートフォン（E.164形式、例: `+818011112222`） | |

> 「出力専用」の項目はシステム側での書き込み対象外（参照のみ）。

**Googleアカウント入力項目（確定・決定シート）：**

アカウント作成・変更時に入力可能な項目と読取専用項目の区別は以下のとおり。

| # | プロパティ名 | 型 | 入力/読取専用 | デフォルト値 | 備考 |
|---|------------|-----|-----------|-----------|------|
| 1 | UserID | string | 読取専用 | ― | システムが自動採番（A100000形式） |
| 2 | primaryEmail | string | 入力可 | ― | 一意である必要がある |
| 3 | password | string | 入力可 | ― | 8〜100文字のASCII文字 |
| 4 | isAdmin | boolean | 読取専用 | ― | 特権管理者権限（出力専用） |
| 5 | suspended | boolean | 入力可 | ― | ユーザーの一時停止 |
| 6 | changePasswordAtNextLogin | boolean | 入力可 | `TRUE` | 次回ログイン時パスワード変更 |
| 7 | First Name | string | 入力可 | ― | ユーザーの姓 |
| 8 | Last Name | string | 入力可 | ― | ユーザーの名 |
| 9 | name | string | 入力可 | ― | ユーザーの氏名（姓＋名） |
| 10 | aliases[] | string | 読取専用 | ― | エイリアスメールアドレスのリスト |
| 11 | isMailboxSetup | boolean | 読取専用 | ― | Googleメールボックスが作成されているか |
| 12 | suspensionReason | string | 読取専用 | ― | アカウント停止の理由 |
| 13 | creationTime | string | 読取専用 | ― | アカウント作成日時 |
| 14 | includeInGlobalAddressList | boolean | 入力可 | `TRUE` | GALに表示するか |
| 15 | deletionTime | string | 読取専用 | ― | アカウント削除日時 |
| 16 | isEnrolledIn2Sv | boolean | 読取専用 | ― | 2段階認証に登録されているか |
| 17 | isEnforcedIn2Sv | boolean | 読取専用 | ― | 2段階認証が適用されているか |
| 18 | orgUnitPath | string | 入力可 | ― | 所属する親組織のフルパス |
| 19 | recoveryEmail | string | 入力可 | ― | アカウント再設定用メールアドレス |
| 20 | recoveryPhone | string | 入力可 | ― | アカウント復元用スマートフォン（E.164形式） |

> 「入力可」はアカウント作成・変更時に値を設定できる項目。「読取専用」はGoogle Workspace側が管理しシステムからは参照のみ可能な項目。

**利用対象外のGoogle Workspace属性（確定・確認シート）：**

以下のGoogle Workspace APIユーザー属性は、東邦HD様の要件確認の結果「利用対象外」と判定された。本システムでは取り扱わない。

| # | プロパティ名 | 型 | 説明 | 利用可否 |
|---|------------|-----|------|---------|
| 1 | emails | string | ユーザーのメールアドレスのリスト（許容データサイズ上限: 10KB） | 不可 |
| 2 | relations | string | ユーザーと他のユーザーの関係のリスト（manager, assistant等） | 不可 |
| 3 | addresses | string | ユーザーの住所のリスト（国、市区町村、郵便番号等） | 不可 |
| 4 | organizations | string | ユーザーが所属する組織のリスト（部門、役職、コストセンター等） | 不可 |
| 5 | phones | string | ユーザーの電話番号のリスト（種別: home, mobile, work等） | 不可 |
| 6 | locations | string | ユーザーの現在地のリスト（建物ID、フロアセクション等） | 不可 |
| 7 | gender | string | ユーザーの性別（female / male / other / unknown） | 不可 |
| 8 | archived | boolean | ユーザーがアーカイブされているかどうか | 不可 |

> 上記属性はGoogle Workspace Admin SDKで利用可能な属性であるが、本システムの管理対象外とする。必要に応じて将来的に追加を検討する。

**AppSheetからのGoogleアカウント作成仕様（確定）：**

AppSheetフォームからアカウントを作成する際の入力フィールドとデフォルト値。Google管理コンソールは使用せず、すべてAppSheetから操作する。

| # | フィールド名 | 入力 | デフォルト値 | 備考 |
|---|-----------|------|-----------|------|
| 1 | UserID | 自動 | システム採番（A100000形式） | ユーザー入力不可 |
| 2 | primaryEmail | 必須 | ― | 一意であること。命名規則なし |
| 3 | password | 必須 | ― | 8〜100文字のASCII文字 |
| 4 | First Name | 必須 | ― | ユーザーの姓 |
| 5 | Last Name | 必須 | ― | ユーザーの名 |
| 6 | orgUnitPath | 任意 | ― | 所属する親組織のフルパス（例: `/営業部`） |
| 7 | suspended | 任意 | `FALSE` | ユーザーの一時停止 |
| 8 | changePasswordAtNextLogin | 任意 | `TRUE` | 初回ログイン時にパスワード変更を強制 |
| 9 | includeInGlobalAddressList | 任意 | `TRUE` | GALへの表示をデフォルトで有効化 |
| 10 | recoveryEmail | 任意 | ― | アカウント再設定用メールアドレス |
| 11 | recoveryPhone | 任意 | ― | E.164形式（例: `+818011112222`） |

> デフォルト値が設定されている項目は、AppSheetフォーム上でデフォルト値を初期表示する。操作者が必要に応じて変更できる。

**AppSheetからのGoogleアカウント変更仕様（確定）：**

| # | フィールド名 | 編集 | 備考 |
|---|-----------|------|------|
| 1 | UserID | 表示のみ | 変更不可 |
| 2 | primaryEmail | 表示のみ | 主キーのため変更不可 |
| 3 | password | 編集可 | 変更時は新しいパスワードを入力 |
| 4 | First Name | 編集可 | |
| 5 | Last Name | 編集可 | |
| 6 | orgUnitPath | 編集可 | |
| 7 | suspended | 編集可 | 休職・停止時に `TRUE` に変更 |
| 8 | changePasswordAtNextLogin | 編集可 | |
| 9 | includeInGlobalAddressList | 編集可 | |
| 10 | recoveryEmail | 編集可 | |
| 11 | recoveryPhone | 編集可 | |
| ― | isAdmin | 表示のみ | 読取専用（Google Workspace側で管理） |
| ― | aliases[] | 表示のみ | 読取専用 |
| ― | isMailboxSetup | 表示のみ | 読取専用 |
| ― | suspensionReason | 表示のみ | suspended=true時のみ表示 |
| ― | creationTime | 表示のみ | 読取専用 |
| ― | isEnrolledIn2Sv | 表示のみ | 読取専用 |
| ― | isEnforcedIn2Sv | 表示のみ | 読取専用 |

> 変更操作では、未入力（空欄）のフィールドは既存値を保持する。変更内容はCloud SQL更新後、Google Workspace APIへ即時反映する。

**AppSheetからのGoogleアカウント削除仕様（確定）：**

| 項目 | 内容 |
|------|------|
| 削除方式 | 論理削除（`suspended = TRUE` に変更）＋ Cloud SQL 上のステータスを `deleted` に更新 |
| 必要な情報 | primaryEmail（対象アカウントの特定） |
| Google Workspace反映 | 即時実行（Google Workspace API経由でアカウントを停止） |
| 削除日時の記録 | deletionTime をCloud SQLに記録 |

> 物理削除（Google Workspaceからの完全なアカウント削除）は本システムからは行わない。必要な場合はGoogle管理コンソールから手動で実施する。

**rakumo側の自動連動（確定）：**

Google Workspaceでアカウントを「停止（suspended）」または「アーカイブ（archived）」に変更すると、rakumo側でも以下が自動的に行われる。

- rakumoライセンスの除外
- rakumoコンタクトでの非表示化
- rakumo用グループからの除外

> この自動連動により、退職処理・休職処理はGoogle Workspace側でアカウントを停止するだけで完結する。本システムから複数サービスに対して個別に操作する複合アクションボタン等は不要である。

### 4.3 Googleグループ登録機能

Google Workspace のグループを登録・更新・削除する機能。

**入力チャネル：**

グループおよびグループメンバーの登録・更新・削除は以下の2方式で実施できる。

| 方式 | 概要 | 主な用途 |
|------|------|---------|
| CSVアップロード（一括） | グループ用・グループメンバー用CSVをCloud Storageにアップロードし、一括処理 | 人事異動時の大量変更・初期データ投入 |
| AppSheet画面（個別操作） | AppSheet の入力フォームからグループ・グループメンバーを個別に追加・変更・削除 | 都度発生する個別変更（新グループ作成・メンバー変更等） |

AppSheet 個別操作時は、AppSheet Automation 経由で Cloud Run API を呼び出し、Cloud SQL および Google Workspace をリアルタイムに更新する。

**機能詳細：**

- グループ用 CSV のアップロード（Cloud Storage への保存）
- グループ用 CSV のダウンロード（Cloud SQL のグループマスタから生成）
- グループメンバー用 CSV のアップロード（Cloud Storage への保存）
- AppSheet フォームからのグループ個別追加・変更・削除
- AppSheet フォームからのグループメンバー個別追加・削除
- グループの追加・変更・削除の実行（Cloud SQL への登録 ＋ Google Workspace API 反映）
- グループメンバーの追加・削除の実行（Cloud SQL への登録 ＋ Google Workspace API 反映）

**実行タイミング（確定）：**

| 実行方式 | 内容 |
|---------|------|
| 即時実行（CSV） | CSV取込後に即時処理（グループ・グループメンバーの追加・変更・削除をリアルタイムで反映） |
| 即時実行（AppSheet） | AppSheet フォーム操作後に即時処理（グループ・グループメンバーの追加・変更・削除をリアルタイムで反映） |

**冪等性の保証：**

4.2節と同様。グループおよびグループメンバーの「追加」はUPSERT、「削除」は存在しない場合もスキップとして扱う（CSVアップロード・AppSheet操作ともに共通）。

**Googleグループ情報出力項目（確定 3/26）：**

| # | プロパティ名 | 型 | 説明 |
|---|------------|-----|------|
| 1 | GroupID | string | グループを識別するID |
| 2 | email | string | グループのメールアドレス |
| 3 | name | string | グループの名前（最大75文字） |
| 4 | description | string | グループの説明（最大4,096文字） |
| 5 | whoCanJoin | string | グループに参加できるユーザーの権限 |
| 6 | whoCanViewMembership | string | メンバーリストを表示できるユーザーの権限 |
| 7 | whoCanViewGroup | string | グループのメッセージを閲覧できるユーザーの権限 |
| 8 | whoCanPostMessage | string | グループにメッセージを送信できるユーザーの権限 |
| 9 | allowWebPosting | string | Googleグループアプリからのメール送信を許可するか |
| 10 | isArchived | string | グループに送信されたメッセージをアーカイブするか |
| 11 | membersCanPostAsTheGroup | string | メンバーがグループアドレスを差出人としてメール送信できるか |
| 12 | includeInGlobalAddressList | string | グループをグローバルアドレス一覧（GAL）に含めるか |
| 13 | whoCanLeaveGroup | string | グループを自分で退会できるユーザーの権限 |
| 14 | whoCanModerateMembers | string | グループメンバーを管理できるユーザー |
| 15 | whoCanModerateContent | string | グループのコンテンツを管理できるユーザー |
| 16 | whoCanAssistContent | string | グループコンテンツのメタデータを管理できるユーザー |
| 17 | enableCollaborativeInbox | string | グループの共同トレイ機能を有効にするか |
| 18 | whoCanDiscoverGroup | string | グループを検索できるユーザーの種類 |
| 19 | defaultSender | string | グループとしてメッセージを送信できるメンバーのデフォルト送信者 |

**Googleグループ入力項目（確定・決定シート）：**

グループ作成・変更時に入力可能な項目とデフォルト値の一覧。グループ種別（rakumo用／ドライブ用）により一部デフォルト値が異なる。

| # | プロパティ名 | 型 | 入力/読取専用 | デフォルト値（rakumo用） | デフォルト値（ドライブ用） |
|---|------------|-----|-----------|----------------------|------------------------|
| 1 | GroupID | string | 読取専用 | ― | ― |
| 2 | email | string | 入力可 | ― | ― |
| 3 | name | string | 入力可 | ― | ― |
| 4 | description | string | 入力可 | ― | ― |
| 5 | whoCanJoin | string | 入力可 | `INVITED_CAN_JOIN` | `INVITED_CAN_JOIN` |
| 6 | whoCanViewMembership | string | 入力可 | `ALL_MEMBERS_CAN_VIEW` | `ALL_MEMBERS_CAN_VIEW` |
| 7 | whoCanViewGroup | string | 入力可 | `ALL_MEMBERS_CAN_VIEW` | `ALL_MEMBERS_CAN_VIEW` |
| 8 | whoCanPostMessage | string | 入力可 | `NONE_CAN_POST` | `ALL_IN_DOMAIN_CAN_POST` |
| 9 | allowWebPosting | string | 入力可 | `FALSE` | `FALSE` |
| 10 | isArchived | string | 入力可 | `TRUE` | `TRUE` |
| 11 | membersCanPostAsTheGroup | string | 入力可 | `TRUE` | `TRUE` |
| 12 | includeInGlobalAddressList | string | 入力可 | `FALSE` | `TRUE` |
| 13 | whoCanLeaveGroup | string | 入力可 | `NONE_CAN_LEAVE` | `NONE_CAN_LEAVE` |
| 14 | whoCanModerateMembers | string | 入力可 | `NONE` | `NONE` |
| 15 | whoCanModerateContent | string | 入力可 | `NONE` | `NONE` |
| 16 | whoCanAssistContent | string | 入力可 | `NONE` | `NONE` |
| 17 | enableCollaborativeInbox | string | 入力可 | `FALSE` | `FALSE` |
| 18 | whoCanDiscoverGroup | string | 入力可 | `ALL_MEMBERS_CAN_DISCOVER` | `ALL_MEMBERS_CAN_DISCOVER` |
| 19 | defaultSender | string | 入力可 | 空白 | 空白 |

> GroupIDはシステムが自動採番する読取専用項目。その他は全て入力可能。

**利用対象外のGoogle Workspace属性（グループ・確定・確認シート）：**

以下のGoogle Groups Settings API属性は、東邦HD様の要件確認の結果「利用対象外」と判定された。本システムでは取り扱わない。

| # | プロパティ名 | 説明 | 利用可否 |
|---|------------|------|---------|
| 1 | allowExternalMembers | 組織外のユーザーをグループメンバーとして追加できるかどうか | 不可 |
| 2 | archiveOnly | グループをアーカイブのみ（新規メッセージ受信不可）にするかどうか | 不可 |
| 3 | messageModerationLevel | 受信メールの配信管理（全メッセージ承認、非メンバーのみ承認等） | 不可 |
| 4 | spamModerationLevel | スパムメールとして検出されたメールの管理 | 不可 |
| 5 | replyTo | メッセージへのデフォルトの返信先 | 不可 |
| 6 | customReplyTo | カスタム返信先メールアドレス（replyToがREPLY_TO_CUSTOMの場合） | 不可 |
| 7 | includeCustomFooter | グループのメールにカスタムフッターを追加するかどうか | 不可 |
| 8 | customFooterText | カスタムフッターのテキスト（最大1,000文字） | 不可 |
| 9 | sendMessageDenyNotification | メッセージが拒否された場合に送信者へ通知するかどうか | 不可 |
| 10 | defaultMessageDenyNotificationText | メッセージ拒否通知のテキスト（最大10,000文字） | 不可 |
| 11 | whoCanContactOwner | グループのオーナーに連絡できるユーザーの権限 | 不可 |
| 12 | favoriteRepliesOnTop | お気に入りの返信を他の返信より上部に表示するかどうか | 不可 |

> 上記属性はGoogle Groups Settings APIで利用可能な属性であるが、本システムの管理対象外とする。必要に応じて将来的に追加を検討する。

**AppSheetからのGoogleグループ作成仕様（確定）：**

AppSheetフォームからグループを作成する際の入力フィールドとデフォルト値。Google管理コンソールは使用せず、すべてAppSheetから操作する。グループ種別（rakumo用／ドライブ用）によりデフォルト値が一部異なる。

| # | フィールド名 | 入力 | デフォルト値（rakumo用） | デフォルト値（ドライブ用） | 備考 |
|---|-----------|------|----------------------|------------------------|------|
| 1 | GroupID | 自動 | システム採番（G100000形式） | 同左 | ユーザー入力不可 |
| 2 | email | 必須 | ― | ― | rakumo用: `rk-番号@so.tohoyk.co.jp`、ドライブ用: 命名規則なし |
| 3 | name | 必須 | ― | ― | グループの表示名（最大75文字） |
| 4 | description | 任意 | ― | ― | グループの説明（最大4,096文字） |
| 5 | whoCanJoin | 任意 | `INVITED_CAN_JOIN` | `INVITED_CAN_JOIN` | 招待されたユーザーのみ参加可 |
| 6 | whoCanViewMembership | 任意 | `ALL_MEMBERS_CAN_VIEW` | `ALL_MEMBERS_CAN_VIEW` | |
| 7 | whoCanViewGroup | 任意 | `ALL_MEMBERS_CAN_VIEW` | `ALL_MEMBERS_CAN_VIEW` | |
| 8 | whoCanPostMessage | 任意 | `NONE_CAN_POST` | `ALL_IN_DOMAIN_CAN_POST` | rakumo用はメール送信不可 |
| 9 | allowWebPosting | 任意 | `FALSE` | `FALSE` | Webからの投稿不可 |
| 10 | isArchived | 任意 | `TRUE` | `TRUE` | メッセージをアーカイブする |
| 11 | membersCanPostAsTheGroup | 任意 | `TRUE` | `TRUE` | グループアドレスでの送信を許可 |
| 12 | includeInGlobalAddressList | 任意 | `FALSE` | `TRUE` | rakumo用はGALに非表示 |
| 13 | whoCanLeaveGroup | 任意 | `NONE_CAN_LEAVE` | `NONE_CAN_LEAVE` | メンバーが自分で退会不可 |
| 14 | whoCanModerateMembers | 任意 | `NONE` | `NONE` | |
| 15 | whoCanModerateContent | 任意 | `NONE` | `NONE` | |
| 16 | whoCanAssistContent | 任意 | `NONE` | `NONE` | |
| 17 | enableCollaborativeInbox | 任意 | `FALSE` | `FALSE` | 共同トレイ無効 |
| 18 | whoCanDiscoverGroup | 任意 | `ALL_MEMBERS_CAN_DISCOVER` | `ALL_MEMBERS_CAN_DISCOVER` | |
| 19 | defaultSender | 任意 | 空白 | 空白 | |

> デフォルト値が設定されている項目は、AppSheetフォーム上でグループ種別に応じたデフォルト値を初期表示する。操作者が必要に応じて変更できる。
> グループ種別の判定は、メールアドレスの `rk-` プレフィックスにより自動的にrakumo用グループと判定する。それ以外はドライブ用のデフォルト値を適用する。

**AppSheetからのGoogleグループ変更仕様（確定）：**

| # | フィールド名 | 編集 | 備考 |
|---|-----------|------|------|
| 1 | GroupID | 表示のみ | 変更不可 |
| 2 | email | 表示のみ | 主キーのため変更不可 |
| 3 | name | 編集可 | |
| 4 | description | 編集可 | |
| 5 | whoCanJoin | 編集可 | |
| 6 | whoCanViewMembership | 編集可 | |
| 7 | whoCanViewGroup | 編集可 | |
| 8 | whoCanPostMessage | 編集可 | |
| 9 | allowWebPosting | 編集可 | |
| 10 | isArchived | 編集可 | |
| 11 | membersCanPostAsTheGroup | 編集可 | |
| 12 | includeInGlobalAddressList | 編集可 | |
| 13 | whoCanLeaveGroup | 編集可 | |
| 14 | whoCanModerateMembers | 編集可 | |
| 15 | whoCanModerateContent | 編集可 | |
| 16 | whoCanAssistContent | 編集可 | |
| 17 | enableCollaborativeInbox | 編集可 | |
| 18 | whoCanDiscoverGroup | 編集可 | |
| 19 | defaultSender | 編集可 | |

> 変更操作では、未入力（空欄）のフィールドは既存値を保持する。変更内容はCloud SQL更新後、Google Workspace APIへ即時反映する。

**AppSheetからのGoogleグループ削除仕様（確定）：**

| 項目 | 内容 |
|------|------|
| 削除方式 | Cloud SQL上のステータスを `deleted` に更新 ＋ Google Workspace APIでグループを削除 |
| 必要な情報 | email（対象グループの特定） |
| Google Workspace反映 | 即時実行（Google Workspace API経由でグループを削除） |
| グループメンバー | グループ削除に伴い、所属メンバー情報もCloud SQL上で論理削除する |

> グループ削除前に、所属メンバーがいないことを確認する警告を表示する。メンバーが存在する場合は操作者に確認を求める。

### 4.4 Google同期実行機能

Appsheet 画面から rakumo Google同期 API を呼び出し、Google同期を実行する機能。
（詳細は [12章](#12-rakumo-google同期api仕様) 参照）

**機能詳細：**

- Appsheet のボタン・画面から Google 同期を実行
- Google Workspace への登録完了後、バックエンドから Google同期APIを呼び出す

**Google同期API呼び出し手順（3ステップ）：**

1. **実行可否確認**（GoogleSyncJob GETCURRENT API）
   - `GET https://a-rakumo.appspot.com/api/google-sync/v1/jobs/current`
   - レスポンスの `status` が `waiting` の場合のみ同期実行可能
   - `running` または `locked` の場合は処理完了まで待機

2. **Google同期実行**（GoogleSyncJob CREATE API）
   - `POST https://a-rakumo.appspot.com/api/google-sync/v1/jobs`
   - リクエストボディ：`{}`（空オブジェクト）
   - 成功時：`202 Accepted`。レスポンスの `selfLink` URLで状況確認可能

3. **実行状況・結果確認**
   - `GET https://a-rakumo.appspot.com/api/google-sync/v1/jobs/current` を定期ポーリング（30秒間隔、最大10分）し、`status` が `waiting` または `success` になるまで監視する
   - 完了後：`GET https://a-rakumo.appspot.com/api/google-sync/v1/jobs/last` で最終結果を取得

**事前準備（初回のみ）：**

> API利用前に rakumo 管理画面にて以下を実施すること（お客様作業）
> 1. ユーザー・グループ情報・カレンダー情報へのアクセス許可（OAuth認可）
> 2. 手動による Google同期を1回実行（`https://a-rakumo.appspot.com/admin/gapps_sync/`）

**制約事項：**
- 実行権限：Google 特権管理者 または rakumo 管理者 のアカウントが必要
- 別の同期処理実行中・CSV インポート処理中は `409 Conflict` が返却され実行不可
- OAuth 認可未実施の場合は `401 Unauthorized` が返却される（認可 URL がレスポンスヘッダーで返る）

### 4.5 rakumoコンタクト更新機能

データベース更新後に rakumo コンタクト情報を最新化する機能。
rakumo ユーザープロファイル API（REST）を使用してプロファイル CSV をアップロードすることで、
rakumo コンタクトの表示情報を更新する。

**機能詳細：**

- データベース更新後、プロファイルアップデート用 CSV を作成（詳細は [11章](#11-rakumo-profile-api仕様) 参照）
- 作成した CSV を Cloud Storage に保存
- 以下の手順で rakumo Profile API を呼び出しCSV をアップロードする：

**rakumo Profile APIアップロード手順（4ステップ）：**

1. **ロック確認**（CSV IMPORT LOCK API）
   - `GET https://a-rakumo.appspot.com/api/1/master/profiles/lock`
   - 他のアップロード処理が実行中でないことを確認する
   - `state: Locked` の場合は処理完了（ロック解除）まで待機してリトライする

2. **アップロードURL発行**（CSV CREATE URL API）
   - `POST https://a-rakumo.appspot.com/api/1/master/profiles`
   - レスポンスで `upload_url` および有効期限（`expires`）を取得
   - URL有効期限はリクエスト後 **約10分間**
   - URL発行中は rakumo 管理画面からのアップロードがロックされる

3. **CSVアップロード**（CSV UPLOAD API）
   - 取得した `upload_url` に対して `POST`（`multipart/form-data`）
   - パラメータ：`file`（CSVファイル）、`target`（`in`：社内 / `out`：社外、デフォルト：`in`）
   - API はアップロード完了を **待たずに** レスポンスを返す（非同期処理）
   - アップロードURLは **1回限り** 有効。エラー時は手順1から再実行

4. **完了確認**（LOCK APIによる代替確認）
   - `GET https://a-rakumo.appspot.com/api/1/master/profiles/lock` をポーリングし、`state` がロック解除（`Unlocked` またはロックなし）になったことをもって処理完了と判断する
   - ※ rakumo Profile APIには完了通知専用のエンドポイントが存在しないため、ロック解除を完了の代替指標として使用する
   - 詳細な処理結果は rakumo 管理画面の「APIログの確認」ページ（`https://a-rakumo.appspot.com/admin/api_logs`）で確認可能

**エラー時の再実行手順：**
```
1. LOCK APIでロック状態を確認
2. ロック中 → ロック解除を待つ（または UNLOCK APIで手動解除）
3. 手順1（ロック確認）から再実行する
```

**制約事項：**
- 実行権限：Google 特権管理者 または rakumo 管理者 のアカウントが必要

**rakumoコンタクト属性情報（確定）：**

| 項目 | 内容 |
|------|------|
| 管理属性 | rakumo標準項目 ＋「備考」カスタム項目 |
| 「備考」カスタム項目 | ユーザーマスタに項目を追加し、rakumoプロファイルCSVのカスタム項目としてアップロードする |

**属性情報の変更運用（確定）：**

- rakumoコンタクト属性（カスタム項目含む）の追加・変更・削除は **ユーザーマスタ上で任意のタイミングで実施する**
- 追加したカスタム項目はプロファイルCSVに反映され、次回のrakumoコンタクト更新時に同期される

**同姓同名ユーザーの表示名ルール：**
- rakumo コンタクトに表示する氏名は、同姓同名であっても **Google Workspace アカウントの氏名をそのまま使用する**
- 区別のための数字・記号・括弧等の付加は行わない（例：「山田 太郎」と「山田 太郎」は同じ表示名のまま）
- 同姓同名ユーザーの識別はメールアドレスまたは社員番号で行う

### 4.6 Appsheet表示用スプレッドシート作成機能

Appsheet 表示のためのスプレッドシートを作成・管理する機能。

**作成するスプレッドシート一覧：**

| # | スプレッドシート名 |
|---|------------------|
| 1 | ユーザー情報一覧 |
| 2 | グループ情報一覧 |
| 3 | グループメンバー一覧 |
| 4 | アカウント・グループ・グループメンバー更新ログ |
| 5 | Google同期実行ログ |
| 6 | rakumoコンタクトアップロードログ |
| 7 | CSVダウンロード実行ログ |

### 4.7 他システム連携用CSVダウンロード機能

他システムへのデータ連携用 CSV を作成・ダウンロードする機能。

**機能詳細：**

- Cloud SQL のユーザーマスタから他システム連携用 CSV を生成（フォーマット：1種類）
- 生成した CSV を Cloud Storage（csv-output バケット）に保存し、署名付き URL（有効期限1時間）を発行する
- 担当者は AppSheet のダウンロード画面または署名付き URL を使用して CSV をダウンロードする
- ダウンロードした CSV は担当者が手動でファイルサーバーに格納する

**ファイルサーバーへの格納フロー：**
```
Cloud Run → Cloud Storage（CSV生成・保存）
             ↓ 署名付きURL
担当者PC  → AppSheet / ブラウザ（CSVダウンロード）
             ↓ 手動格納
ファイルサーバー（ローカルネットワーク）
```

> Cloud Run（GCP上）からローカルネットワーク上のファイルサーバーへの直接書き込みは行わない。担当者による手動格納を前提とする。

**他システム連携CSVフォーマット・追加削除の運用（確定 3/26）：**

| 項目 | 内容 |
|------|------|
| 出力するCSVの項目 | 未定（連携する必要が生じたときに設定で出力連携） |
| 入力するCSVの項目 | 未定（連携する必要が生じたときに設定で入力連携） |
| CSVの追加・削除の運用 | 出力・入力ともに未定（連携の必要が生じたときに設定で追加・削除） |

---

### 4.8 定期実行・予約実行機能

Cloud Scheduler を使用して、バックエンド処理を自動・定期的に実行する機能。

**対象処理と実行スケジュール（確定）：**

| 処理名 | 対象機能 | 実行タイミング | 備考 |
|--------|---------|--------------|------|
| Google同期（定期） | 4.4 Google同期実行機能 | 1日1回、指定の時刻 | 時刻はユーザーマスタ上で日付と時刻（1時間単位）を設定 |
| Google同期（即時） | 4.4 Google同期実行機能 | ユーザーマスタ更新のタイミング | アカウント・グループ操作後に即時実行 |
| rakumoコンタクト更新（定期） | 4.5 rakumoコンタクト更新機能 | Google同期（定期）完了後 | Google同期に続いて自動実行 |
| rakumoコンタクト更新（即時） | 4.5 rakumoコンタクト更新機能 | ユーザーマスタ更新のタイミング | アカウント操作後に即時実行 |

**予約実行の設定仕様（確定）：**

| 項目 | 仕様 |
|------|------|
| 設定方法 | ユーザーマスタ画面から日付と時刻を指定して更新する |
| 時刻の粒度 | 1時間単位で指定（例：06:00、07:00 等） |
| 設定変更 | 実行前であれば任意のタイミングで変更可能 |

**機能詳細：**

- Cloud Scheduler が Cloud Run の対象エンドポイントを HTTP POST で呼び出す
- OIDC 認証トークンを使用し、不正な外部からの呼び出しを防止する
- 定期実行の結果は Cloud SQL の実行ログおよび Cloud Logging に記録する
- rakumo API の実行頻度に制限はない

---

## 5. ユーザーマスタ仕様

Google Workspace のユーザー情報とグループ情報をマージし、Cloud SQL に格納する。

### 5.0 テーブル構成

ユーザーマスタのデータは以下の5テーブルに分離して管理する。各テーブルはprimaryEmail（ユーザー系）またはemail（グループ系）をキーとして結合する。

| # | テーブル名 | 結合キー | 格納データ | AppSheet画面 |
|---|----------|---------|----------|-------------|
| 1 | Googleアカウント | primaryEmail | Google Workspace アカウント属性（primaryEmail、password、suspended、orgUnitPath等） | 画面A（一覧）、画面B（セクション1） |
| 2 | rakumoプロファイル | primaryEmail | rakumoライセンスフラグ、表示制御、組織情報、備考 | 画面B（セクション2） |
| 3 | 会社・個人情報 | primaryEmail | 社員番号、役職、電話番号、住所等の会社固有情報 | 画面B（セクション3） |
| 4 | グループ設定 | email | Google Workspace グループ属性（email、name、19種の設定項目） | 画面C |
| 5 | グループメンバー | グループemail + メンバーemail | グループとメンバーの関連（多対多） | 画面D、画面B・C（インライン） |

**テーブル間リレーション：**

```
[Googleアカウント] ──primaryEmail── [rakumoプロファイル]
        │                                    │
        └──────primaryEmail──────[会社・個人情報]
        │
        └──メンバーemail──[グループメンバー]──グループemail──[グループ設定]
```

> ユーザー系の3テーブル（Googleアカウント、rakumoプロファイル、会社・個人情報）は、primaryEmail を共通キーとして1対1で対応する。画面B（ユーザー詳細・編集）では3テーブルをセクション分割で統合表示する。

**各テーブルの役割と連携先：**

| テーブル | Cloud SQL保存 | Google Workspace API連携 | rakumo Profile CSV連携 |
|---------|:---:|:---:|:---:|
| Googleアカウント | o | o（作成・変更・削除） | ―（氏名・メールは共通フィールドとして参照） |
| rakumoプロファイル | o | ― | o（ライセンス・組織・表示制御を出力） |
| 会社・個人情報 | o | ― | o（社員番号・電話番号・住所等を出力） |
| グループ設定 | o | o（作成・変更・削除） | ― |
| グループメンバー | o | o（追加・削除） | ― |

> Googleアカウントテーブルの氏名（First Name、Last Name）はrakumoプロファイルCSV出力時にも参照される共通フィールドである。

---

### 5.1 ユーザーマスタ項目

#### 基本情報

| # | 項目名 | 説明 | rakumoプロファイルCSV対応 |
|---|--------|------|--------------------------|
| 0 | ユーザーID | システムが自動採番する識別ID（A100000形式）。変更不可 | ― |
| 1 | メールアドレス | Google Workspace メールアドレス（主キー） | User ID |
| 2 | 姓 | ユーザーの姓 | Family Name |
| 3 | 名 | ユーザーの名 | Given Name |
| 4 | 姓よみ | 姓のふりがな | Family Name Yomi |
| 5 | 名よみ | 名のふりがな | Given Name Yomi |
| 6 | 会社名 | 所属会社名 | Company |
| 7 | 会社名よみ | 会社名のふりがな | Company Yomi |
| 8 | 社員番号 | 社員識別番号 | Employee Number |
| 9 | 役職 | 主務組織の職位・役職名。rakumoプロファイルCSVの主務組織行（1行目）の Job Title に出力する | Job Title（主務組織行） |
| 10 | 会社電話番号 | 会社固定電話番号 | Business Phone |
| 11 | 内線番号 | 内線電話番号 | Business Phone Extension |
| 12 | 携帯電話番号 | 携帯電話番号 | Mobile Phone |
| 13 | FAX番号 | 会社FAX番号 | Business Fax |
| 14 | 会社住所 | 会社所在地住所 | Business Address |
| 15 | 生年月日 | 社員の生年月日（YYYY-MM-DD形式） | Birthday |
| 16 | メールアドレス2 | サブメールアドレス1 | E-mail 2 Address |
| 17 | メールアドレス3 | サブメールアドレス2 | E-mail 3 Address |

#### rakumo表示制御フラグ

以下の項目は rakumo コンタクト表示の制御に使用する。各項目はアカウントごとに個別設定する。

| # | 項目名 | 説明 | rakumoプロファイルCSV対応 | 設定方針（確定） |
|---|--------|------|--------------------------|----------------|
| 18 | プライマリフラグ | コンタクトの優先組織設定 | Primary | 基本は設定しない（デフォルト空欄）。設定可能な項目として用意する |
| 19 | 表示フラグ | コンタクトへの表示有無 | Display | アカウント個別に設定 |
| 20 | カレンダー有効 | rakumoカレンダーライセンス割当 | Calendar Enabled | アカウント個別に設定 |
| 21 | コンタクト有効 | rakumoコンタクトライセンス割当 | Contacts Enabled | アカウント個別に設定 |
| 22 | ワークフロー有効 | rakumoワークフローライセンス割当 | Workflow Enabled | アカウント個別に設定 |
| 23 | ボード有効 | rakumoボードライセンス割当 | Board Enabled | アカウント個別に設定 |
| 24 | 経費有効 | rakumo経費ライセンス割当 | Expense Enabled | アカウント個別に設定 |
| 25 | 勤怠有効 | rakumo勤怠ライセンス割当 | Attendance Enabled | アカウント個別に設定 |

> **並び順（確定）：** rakumoコンタクトの並び順は「姓よみ」（Family Name Yomi）をASCIIコード（文字コード）昇順で並び替える。

> **注意：** プライマリフラグ（Primary）は基本設定しない（空欄）。ライセンス・表示フラグはアカウント個別に設定する。空欄の場合は rakumo 側のデフォルト設定が適用される。

#### カスタム項目

| # | 項目名 | 説明 | rakumoプロファイルCSV対応 | 設定方針（確定） |
|---|--------|------|--------------------------|----------------|
| 26 | 備考 | 任意のメモ・補足情報 | （カスタム項目）備考 | ユーザーマスタで追加・変更・削除を管理 |

#### 組織情報（最大10組織の兼務に対応）

| # | 項目名 | 説明 | rakumoプロファイルCSV対応 |
|---|--------|------|--------------------------|
| 27 | 主務組織名 | 主たる所属組織の名称 | Department（1行目） |
| 28 | 主務組織メールアドレス | 主務組織のメールアドレス | Department Email（1行目） |
| 29 | 兼務組織名1 | 兼務先組織1の名称 | Department（2行目） |
| 30 | 兼務組織メールアドレス1 | 兼務先1のメールアドレス | Department Email（2行目） |
| 31 | 兼務組織役職1 | 兼務先1の役職名 | Job Title（2行目） |
| 32 | 兼務組織名2 | 兼務先組織2の名称 | Department（3行目） |
| 33 | 兼務組織メールアドレス2 | 兼務先2のメールアドレス | Department Email（3行目） |
| 34 | 兼務組織役職2 | 兼務先2の役職名 | Job Title（3行目） |
| 35 | 兼務組織名3 | 兼務先組織3の名称 | Department（4行目） |
| 36 | 兼務組織メールアドレス3 | 兼務先3のメールアドレス | Department Email（4行目） |
| 37 | 兼務組織役職3 | 兼務先3の役職名 | Job Title（4行目） |
| 38 | 兼務組織名4 | 兼務先組織4の名称 | Department（5行目） |
| 39 | 兼務組織メールアドレス4 | 兼務先4のメールアドレス | Department Email（5行目） |
| 40 | 兼務組織役職4 | 兼務先4の役職名 | Job Title（5行目） |
| 41 | 兼務組織名5 | 兼務先組織5の名称 | Department（6行目） |
| 42 | 兼務組織メールアドレス5 | 兼務先5のメールアドレス | Department Email（6行目） |
| 43 | 兼務組織役職5 | 兼務先5の役職名 | Job Title（6行目） |
| 44 | 兼務組織名6 | 兼務先組織6の名称 | Department（7行目） |
| 45 | 兼務組織メールアドレス6 | 兼務先6のメールアドレス | Department Email（7行目） |
| 46 | 兼務組織役職6 | 兼務先6の役職名 | Job Title（7行目） |
| 47 | 兼務組織名7 | 兼務先組織7の名称 | Department（8行目） |
| 48 | 兼務組織メールアドレス7 | 兼務先7のメールアドレス | Department Email（8行目） |
| 49 | 兼務組織役職7 | 兼務先7の役職名 | Job Title（8行目） |
| 50 | 兼務組織名8 | 兼務先組織8の名称 | Department（9行目） |
| 51 | 兼務組織メールアドレス8 | 兼務先8のメールアドレス | Department Email（9行目） |
| 52 | 兼務組織役職8 | 兼務先8の役職名 | Job Title（9行目） |
| 53 | 兼務組織名9 | 兼務先組織9の名称 | Department（10行目） |
| 54 | 兼務組織メールアドレス9 | 兼務先9のメールアドレス | Department Email（10行目） |
| 55 | 兼務組織役職9 | 兼務先9の役職名 | Job Title（10行目） |
| 56 | 兼務組織名10 | 兼務先組織10の名称 | Department（11行目） |
| 57 | 兼務組織メールアドレス10 | 兼務先10のメールアドレス | Department Email（11行目） |
| 58 | 兼務組織役職10 | 兼務先10の役職名 | Job Title（11行目） |

> **兼務組織のCSV出力ルール（1行1組織）：** rakumoプロファイルCSVは **1ユーザー＝1行1組織** の形式で出力する。兼務組織がある場合、同一ユーザーの行を組織数分生成し、行ごとに `Department Email`・`Department`・`Job Title` を変えて出力する。`User ID` 等の共通フィールドは全行に同一値を記載する。主務組織行の `Job Title` には項目#9「役職」を使用し、兼務組織行にはそれぞれの兼務役職（#31, #34, #37 等）を使用する。未設定の兼務組織は出力しない。

---

### 5.2 グループマスタ主要項目

グループマスタの主要項目を示す。全項目は Cloud SQL `groups` テーブルに格納する。

| # | 項目名 | 説明 |
|---|--------|------|
| 0 | グループID | システムが自動採番する識別ID（G100000形式）。変更不可 |
| 1 | グループメールアドレス | Google Workspace グループメールアドレス（主キー） |
| 2 | グループ名 | グループの表示名 |
| 3 | グループの説明 | グループの説明文（最大4,096文字） |
| 4 | グループ種別 | drive / mailing / rakumo / other |
| 5 | ステータス | active / deleted |

---

### 5.3 ID採番仕様

ユーザーIDおよびグループIDはシステムが自動採番する。ユーザーとグループを種別区別するためのプレフィックスを付与する。

| 項目 | ユーザーID | グループID |
|------|-----------|-----------|
| プレフィックス | `A` | `G` |
| 番号部分 | 6桁の数字 | 6桁の数字 |
| 開始番号 | 100000 | 100000 |
| 採番例 | A100000、A100001、A100002 … | G100000、G100001、G100002 … |
| 桁数（合計） | 7文字固定 | 7文字固定 |
| 採番タイミング | ユーザー作成時に自動発行 | グループ作成時に自動発行 |
| 変更 | 不可（作成後は固定） | 不可（作成後は固定） |
| ユーザー入力 | 不可（システム採番のみ） | 不可（システム採番のみ） |

> **採番方式：** 既存レコードの最大番号に +1 した値をゼロパディングして発行する（例：既存最大 A100005 → 次は A100006）。

---

## 6. システム構成

### 6.1 構成コンポーネント

```
[ユーザー]
    │
    ▼
[Appsheet（Google Workspace）]
    │
    ▼
[Cloud Run（バックエンド）]
    ├── Cloud SQL（人事情報マスタ）
    ├── Cloud Storage（CSVデータ）
    └── Cloud Logging → Cloud Pub/Sub → BigQuery（ログ）
    │
    ├──▶ Google Workspace API（ユーザー・グループ管理）
    └──▶ rakumo API（コンタクト更新）
```

### 6.2 利用サービス一覧

| カテゴリ | サービス | 用途 |
|---------|---------|------|
| Google Workspace | ユーザー管理 | アカウント・グループ管理 |
| Google Workspace | Appsheet | 操作画面 |
| Google Cloud | Cloud Run | バックエンド処理 |
| Google Cloud | Cloud SQL | 人事情報マスタDB |
| Google Cloud | Cloud Storage | CSVファイル保管 |
| Google Cloud | Cloud Logging | ログ収集・監視 |
| Google Cloud | Cloud Pub/Sub | ログメッセージング |
| Google Cloud | BigQuery | ログ分析・蓄積 |
| Google Cloud | Cloud Scheduler | 定期実行・予約実行 |
| Google Cloud | Secret Manager | APIキー・DB接続情報の管理 |
| Google Cloud | Artifact Registry | コンテナイメージ管理 |
| rakumo | 共通管理 | rakumo設定管理 |
| rakumo | コンタクト | 組織・連絡先管理 |

---

## 7. 非機能要件

| 分類 | 観点 | 要件 |
|------|------|------|
| 可用性 | システム利用可能時間 | 24時間365日（Google Cloud / Google Workspace の障害時を除く） |
| 可用性 | メンテナンス時間 | なし（デプロイ作業時を除く） |
| 可用性 | 冗長構成 | なし |
| 性能 | 処理件数 | ユーザー・グループともに数万件規模のデータを処理できること |
| 性能 | バックエンド（Cloud Run） | 数万件のCSV処理・API呼び出しに耐えられるよう、メモリ・CPU・タイムアウト値を適切に設定すること |
| 性能 | データベース（Cloud SQL） | 数万件規模のレコードを扱える容量・接続数を確保すること。インスタンスタイプは処理量に応じて選定する |
| 性能 | バッチ処理 | Google Workspace API のレート制限（QPS）を考慮し、一括処理時は適切なウェイト・リトライ制御を実装すること |
| 信頼性 | データの整合性 | Cloud SQL をマスタとし、Google Workspace との整合性を確保する |
| 信頼性 | エラーハンドリング | DB更新エラー時はロールバックを実施。Google Workspace / rakumo エラー時は再実行可能とする |
| セキュリティ | 認証・認可 | Google の認証基盤を利用する |
| 運用・保守 | ログ管理 | Cloud Logging により 24時間365日 の監視・アラート出力を行う |
| 運用・保守 | エラー通知 | ERRORレベルのログ発生時に Cloud Monitoring アラートでメール通知を行う。通知先・通知条件はお客様と協議のうえ確定する |
| 運用・保守 | 保守対応 | 保守対応なし（アラート確認後、問い合わせによる対応） |

---

## 8. 運用要件

### 8.1 グループ種別管理

#### グループメールアドレスの命名規則

| グループ種別 | 命名規則 | 例 | 用途 |
|------------|---------|-----|------|
| Googleドライブ用 | **命名規則なし** | ― | Googleドライブのアクセス権限管理 |
| rakumoサービス用 | `rk-` プレフィックス + 番号 | `rk-10000@so.tohoyk.co.jp` | rakumoサービスの利用グループ |
| その他（例） | `ml-` プレフィックス等 | `ml-xxxx@so.tohoyk.co.jp` | メーリングリスト等（設定により追加可能） |

> **注意：** Googleドライブ用グループは命名規則を設けない。rakumo用グループは `rk-` に続けて番号を付与する形式とする（例：`rk-10000@so.tohoyk.co.jp`）。

#### 更新対象グループの管理

本システムが同期・更新するグループの種別は、**設定ファイル（環境変数または設定テーブル）で管理**し、コードを変更せずに更新対象グループを追加・変更できるようにする。

- **初期対象：Googleドライブ用・rakumoサービス用（`rk-`）の2種別**
- 設定変更のみで新しいグループ種別・プレフィックス（メーリングリスト用等）を対象に追加できること

### 8.2 人事異動時の作業順序

人事異動・組織改編時の操作（CSV 一括アップロード・AppSheet 個別操作のいずれも）は、以下の順序で実施する。

1. グループの追加・変更・削除
2. グループメンバーの変更
3. ユーザー情報の変更

> **注意：** 上記順序を守らないと、データの整合性が保てない場合がある。グループが存在しない状態でグループメンバーを追加しようとするとエラーになる等、依存関係があるため順序を遵守すること。

---

## 9. CSV仕様

### 9.0 共通仕様

| 項目 | 仕様 |
|------|------|
| ファイル形式 | CSV（カンマ区切り） |
| 文字コード | UTF-8（BOM付き） |
| 改行コード | LF または CRLF |
| ヘッダー行 | あり（1行目） |
| 変更種別の値 | `追加` / `変更` / `削除` |

### 9.1 グループCSV

| カラム名 | 必須 | 説明 |
|---------|------|------|
| グループID | △ | グループID（G100000形式）。追加時は空欄可（システムが自動採番）。変更・削除時は必須 |
| グループ名 | ○ | グループの表示名 |
| メールアドレス | ○ | グループのメールアドレス（主キー） |
| 変更種別 | ○ | 追加 / 変更 / 削除 |

### 9.2 グループメンバーCSV

| カラム名 | 必須 | 説明 |
|---------|------|------|
| ID | ○ | レコード識別ID |
| グループ名 | ○ | 所属グループ名 |
| グループメールアドレス | ○ | グループのメールアドレス |
| メンバー | ○ | メンバーのメールアドレス |
| 変更種別 | ○ | 追加 / 変更 / 削除 |

### 9.3 ユーザーCSV

ユーザーマスタ（5.1節）の全項目に対応したCSVフォーマット。

| カラム名 | 必須 | 説明 |
|---------|------|------|
| ユーザーID | △ | ユーザーID（A100000形式）。追加時は空欄可（システムが自動採番）。変更・削除時は参照用 |
| メールアドレス | ○ | Google Workspace メールアドレス（主キー） |
| 変更種別 | ○ | 追加 / 変更 / 削除 |
| 姓 | △ | ユーザーの姓（追加・変更時は必須） |
| 名 | △ | ユーザーの名（追加・変更時は必須） |
| 姓よみ | ― | 姓のふりがな |
| 名よみ | ― | 名のふりがな |
| 会社名 | ― | 所属会社名 |
| 会社名よみ | ― | 会社名のふりがな |
| 社員番号 | ― | 社員識別番号 |
| 役職 | ― | 職位・役職名 |
| 会社電話番号 | ― | 会社固定電話番号 |
| 内線番号 | ― | 内線電話番号 |
| 携帯電話番号 | ― | 携帯電話番号 |
| FAX番号 | ― | 会社FAX番号 |
| 会社住所 | ― | 会社所在地住所 |
| 生年月日 | ― | 生年月日（YYYY-MM-DD形式） |
| メールアドレス2 | ― | サブメールアドレス1 |
| メールアドレス3 | ― | サブメールアドレス2 |
| 備考 | ― | 任意のメモ・補足情報（カスタム項目） |
| 主務組織名 | ― | 主たる所属組織の名称 |
| 主務組織メールアドレス | ― | 主務組織のメールアドレス |
| 兼務組織名1〜10 | ― | 兼務先組織1〜10の名称 |
| 兼務組織メールアドレス1〜10 | ― | 兼務先1〜10のメールアドレス |
| 兼務組織役職1〜10 | ― | 兼務先1〜10の役職名 |

> **注意：** 変更種別が「変更」の場合、未入力のカラムは更新しない（既存値を保持する）。「削除」の場合はメールアドレスと変更種別のみ必要。

---

## 10. 制約・前提条件

### 10.1 開発環境

- 開発環境は Google Cloud（お客様環境）に構築する
- 検証用環境の構築も合わせて実施する

### 10.2 API利用

- Google Workspace API を利用する
- rakumo Profile API を利用する（詳細は [11章](#11-rakumo-profile-api仕様) 参照）
- 各 API の利用上限・制約はそれぞれのサービス仕様に従う

**rakumo Profile API 利用に関する前提条件：**
- API キーは rakumo 管理画面（`https://a-rakumo.appspot.com/admin`）の「API設定」から発行する
- API キーおよび秘密鍵の発行は **rakumo 管理者権限** が必要
- API キー・秘密鍵はログインアカウントに紐付き、管理者相当の権限を持つため **厳重に管理** すること
- 秘密鍵はシステム側で安全に保管し、外部に漏洩しないよう管理すること（Google Cloud Secret Manager 等の利用を推奨）

### 10.3 お客様対応事項

以下の作業はお客様側での実施を前提とする。

- Google Workspace の基本設定
- Google Cloud の基本設定（プロジェクト作成・課金設定等）
- rakumo 管理画面での OAuth 認可および初回 Google同期の実施（4.4節 事前準備）
- rakumo Profile API キーおよび秘密鍵の発行

### 10.4 ネットワーク制約

- 他システム連携用 CSV のダウンロード機能は、Cloud Storage 経由で担当者が手動ダウンロードする方式とする
- ファイルサーバーへの格納は担当者が手動で行う（Cloud Run からの直接書き込みは行わない）

### 10.5 AppSheetのアクセス制御

- AppSheet へのアクセスは Google Workspace アカウントによる認証を必須とする
- アクセス可能なドメインを特定のドメインに制限する（ドメイン名はお客様と協議のうえ確定）
- **Appsheetアクセス権はGoogleグループで管理する（確定）。アクセス用グループはユーザーマスタ機能で作成・管理する**

**ビュー表示制御（確定）：**

- Appsheetから参照するデータは制御しない（データレベルのアクセス制限なし）
- Appsheetにアクセス可能なユーザーはすべての機能を利用可能（機能によるアクセス制限なし）

### 10.6 初期データ移行

- 新システム稼働時の初期データ（StarOffice の社員情報）の移行方針は以下のいずれかとする：
  - (A) お客様が StarOffice のデータを本書の 9.3 ユーザーCSV形式に変換してインポートする
  - (B) 別途、初期データ移行スクリプトを開発する（スコープ・費用を別途合意する）
- 初期データ移行の方針はお客様と協議のうえ確定すること

---

## 11. rakumo Profile API仕様

### 11.1 概要

rakumo ユーザープロファイル API は、ユーザーの属性情報を CSV ファイルで管理するための REST API。
HTTPS リクエストにより CSV ファイルのアップロード・ダウンロードが可能。

### 11.2 認証方式

**APIキー認証（HMAC-SHA1署名）**

| 項目 | 内容 |
|------|------|
| 認証方式 | HMAC-SHA1署名 + Base64エンコード |
| ヘッダー | `Authorization: RWS [APIKEY]:[SIGNATURE]` |
| 署名対象 | `HTTPメソッド[LF]Content-Type[LF]Date(RFC822 GMT形式)` |
| 時刻有効範囲 | リクエスト到達時刻の **±15分以内**（超過時は認証失敗） |
| APIキー発行 | rakumo 管理画面 > API設定 > 新しいAPIキーを作成 |
| 必要権限 | rakumo 管理者権限 |

**署名生成式：**
```
Signature = Base64( HMAC-SHA1( SecretKey, MessageToBeSigned ) )
```

**MessageToBeSigned例（POSTの場合）：**
```
POST
application/x-www-form-urlencoded
Thu, 13 Oct 2021 21:30:05 GMT
```

### 11.3 API一覧

| API名 | HTTP Method | URI | 用途 |
|-------|-------------|-----|------|
| CSV DOWNLOAD | GET | `https://a-rakumo.appspot.com/api/1/master/profiles` | CSVファイルのダウンロード |
| CSV CREATE URL | POST | `https://a-rakumo.appspot.com/api/1/master/profiles` | アップロードURL発行・取得 |
| CSV UPLOAD | POST | CREATE URLで取得したupload_url | CSVファイルのアップロード |
| CSV IMPORT LOCK | GET | `https://a-rakumo.appspot.com/api/1/master/profiles/lock` | アップロードロック状態確認 |
| CSV IMPORT UNLOCK | DELETE | `https://a-rakumo.appspot.com/api/1/master/profiles/lock` | アップロードロック解除 |

### 11.4 各APIの詳細

#### CSV DOWNLOAD
| 項目 | 内容 |
|------|------|
| Method | GET |
| Content-Type（レスポンス） | `text/csv`（文字コードはアップロード時と同一） |
| パラメータ `t` | `in`（社内）または `out`（社外）、デフォルト：`in` |
| 成功レスポンス | `200 OK`：CSVデータ |
| エラーレスポンス | `404 Not Found`：CSVがまだアップロードされていない |

#### CSV CREATE URL（アップロードURL発行）
| 項目 | 内容 |
|------|------|
| Method | POST |
| Content-Type | `application/x-www-form-urlencoded` |
| パラメータ `target` | `in`（社内）または `out`（社外）、デフォルト：`in` |
| URL有効期限 | リクエスト後 **約10分間**（`expires`で指定） |
| 発行中の制限 | rakumo管理画面からのアップロードがロックされる |
| 成功レスポンス | `201 Created`：`{"expires": "...", "upload_url": "..."}` |
| エラー | 他のアップロード処理実行中の場合はエラー |

#### CSV UPLOAD
| 項目 | 内容 |
|------|------|
| Method | POST |
| URI | CREATE URLで取得した `upload_url` |
| Content-Type | `multipart/form-data` |
| パラメータ `file` | （必須）アップロードするCSVファイル |
| パラメータ `target` | `in`（社内）または `out`（社外）、デフォルト：`in` |
| 処理方式 | **非同期**：APIはアップロード完了を待たずにレスポンスを返す |
| 成功レスポンス | `202 Accepted`：`{"message": "Accepted", "result": ""}` |
| エラーレスポンス | `409 Conflict`：他のアップロード処理が実行中 |
| URL有効回数 | **1リクエスト限り**。エラー時はCREATE URLから再実行 |
| 完了確認 | 管理画面「APIログの確認」ページで確認 |

#### CSV IMPORT LOCK（ロック確認）
| 項目 | 内容 |
|------|------|
| Method | GET |
| 用途 | アップロードURL発行・アップロードが可能か確認 |
| ロックが発生する操作 | 管理画面からのCSVアップロード、Google同期実行 |
| 成功レスポンス | `200 OK`：`{"owner": "", "reason": "", "expires": "...", "state": "Locked"}` |

#### CSV IMPORT UNLOCK（ロック解除）
| 項目 | 内容 |
|------|------|
| Method | DELETE |
| 用途 | アップロードロックの手動解除（主にテスト・開発時） |
| 自動解除条件 | アップロード処理完了時、または約10分経過時 |
| 成功レスポンス | `200 OK`：`{"message": "Deleted"}` |
| エラーレスポンス | `404 Not Found`：ロックされていない |

### 11.5 プロファイルCSVフォーマット

列の順序・項目名はrakumoマニュアル（【rakumo共通】管理者マニュアル 付録3 / 【rakumoコンタクト】管理者マニュアル 第9章）に準拠する。全列の最大入力文字数は **256文字**。

| # | カラム名（英語） | 日本語項目名 | 必須/任意 | 備考 |
|---|----------------|------------|---------|------|
| 1 | User ID | ユーザーID | **必須** | Google Workspaceに登録しているメールアドレス。**必ず小文字**で登録する |
| 2 | Family Name | 姓 | 任意 | |
| 3 | Given Name | 名 | 任意 | |
| 4 | Family Name Yomi | 姓のよみがな | 任意 | ひらがな・カタカナで入力 |
| 5 | Given Name Yomi | 名のよみがな | 任意 | ひらがな・カタカナで入力 |
| 6 | Company | 会社名 | 任意 | 管理画面の「組織名の設定」で設定した値が出力される |
| 7 | Company Yomi | 会社名のよみがな | 任意 | ひらがな・カタカナで入力 |
| 8 | Department Email | 所属部署のEmailアドレス | **必須** | 所属部署のメーリングリストアドレス。**必ず小文字**で登録する |
| 9 | Department | 所属部署名 | 任意 | |
| 10 | Job Title | 役職 | 任意 | `Job Title Code`列との併用時は本列の値がコンタクト表示に優先される |
| 11 | Birthday | 誕生日 | 任意 | |
| 12 | Business Address | 会社住所 | 任意 | |
| 13 | Business Phone | 会社電話番号 | 任意 | |
| 14 | Business Phone Extension | 会社電話の内線番号 | 任意 | |
| 15 | Business Fax | 会社FAX番号 | 任意 | |
| 16 | Mobile Phone | 携帯電話番号 | 任意 | |
| 17 | E-mail Address | メールアドレス1 | 任意 | `User ID`と同じ値を入力する |
| 18 | E-mail 2 Address | メールアドレス2 | 任意 | |
| 19 | E-mail 3 Address | メールアドレス3 | 任意 | |
| 20 | Employee Number | 社員番号 | 任意 | |
| 21 | Primary | 優先組織設定 | 任意 | `1`（優先組織）または`0`（非優先）。複数グループ所属ユーザーの本務グループを指定する |
| 22 | Display | 表示/非表示設定 | 任意 | `1`（表示）または`0`（非表示）。同一ユーザーの全行に同じ値を入力すること |
| 23 | Calendar Enabled | カレンダーライセンス | 任意 | `1`（割り当て）または`0`（削除）。契約中のアプリのみ列が出力される |
| 24 | Contacts Enabled | コンタクトライセンス | 任意 | `1`（割り当て）または`0`（削除） |
| 25 | Workflow Enabled | ワークフローライセンス | 任意 | `1`（割り当て）または`0`（削除） |
| 26 | Board Enabled | ボードライセンス | 任意 | `1`（割り当て）または`0`（削除） |
| 27 | Expense Enabled | ケイヒライセンス | 任意 | `1`（割り当て）または`0`（削除） |
| 28 | Attendance Enabled | キンタイライセンス | 任意 | `1`（割り当て）または`0`（削除） |
| 29 | Protected | 削除対象ユーザー保護設定 | 任意 | システムでのCSV生成時は含めない。不要な場合は列ごと削除してアップロード可 |
| 30 | 備考 | 備考（カスタム項目） | 任意 | ユーザーマスタで管理する東邦HD固有のカスタム項目。ユーザーマスタ上で追加・変更・削除を管理する |
| 31 | （その他カスタム項目） | 独自追加項目 | 任意 | 会社独自の項目を最大50項目まで追加可能（備考を含む）。システム予約語と同名の列名は使用不可 |
| 32 | Job Title Code | 役職コード | 任意 | 「役職と職位の設定」の役職コード。初期CSVには存在しない。`Job Title`列と両方入力時は`Job Title`の値がコンタクト表示に優先 |

> **注意：** アップロードすると既存の全データが上書きされる。必ず管理画面から最新CSVをダウンロードしてから編集・アップロードすること。
> **注意：** 第1行目のヘッダー行はシステム既定のため変更禁止。カスタム項目はシステム既定項目列の後ろに追加する。
> **注意：** CSVの文字コードはダウンロード時のものが維持される。アップロード時の文字コードがそのままダウンロード時に使用される。

#### 11.5.1 兼務組織の出力ルール（1行1組織）

rakumoプロファイルCSVは **1ユーザー＝1行1組織** の形式で出力する。
兼務組織がある場合、同一ユーザーの行を組織数分生成し、行ごとに `Department Email`・`Department`・`Job Title` を変えて出力する。

**出力行数：**

| ユーザー状態 | 出力行数 |
|------------|---------|
| 主務組織のみ | 1行 |
| 主務＋兼務1組織 | 2行 |
| 主務＋兼務N組織（最大10） | N+1行（最大11行） |

**出力例（兼務2組織の場合）：**

| User ID | Department Email | Department | Job Title | （その他共通フィールド） |
|---------|-----------------|------------|-----------|----------------------|
| user@example.com | primary@example.com | 営業部 | 部長 | 同一値 |
| user@example.com | concurrent1@example.com | 企画部 | 担当 | 同一値 |
| user@example.com | concurrent2@example.com | 総務部 | 課長 | 同一値 |

> `User ID`・氏名・ライセンスフラグ等の共通フィールドは全行に同一値を出力する。`Department Email`・`Department`・`Job Title` は行ごとに各組織の値を設定する。主務組織行の `Job Title` にはユーザーマスタの「役職」（項目#9）を使用し、兼務組織行の `Job Title` にはそれぞれの「兼務組織役職」（項目#31, #34, #37 等）を使用する。未設定の兼務組織は出力しない。

### 11.6 API利用時の注意事項

- **頻度制限：** なし
- **エラーハンドリング：**
  - `50x` エラー：Exponential backoff でリトライ（過負荷を避けること）
  - `401` エラー：Authorizationヘッダー・URLを確認。認証失敗
  - `40x` エラー：リトライせず、リクエスト内容を修正すること
- **必要権限：** Google 特権管理者 または rakumo 管理者

---

## 12. rakumo Google同期API仕様

### 12.1 概要

rakumo Google同期 API は、Google Workspace と rakumo のデータ同期処理を API 経由で実行・監視するための REST API。
同期の実行、現在の実行状況確認、最終実行結果の取得の3種類が提供されている。

> **認証方式は [11.2章](#112-認証方式) の rakumo API 共通認証（HMAC-SHA1署名）と同一。**

### 12.2 API一覧

| API名 | HTTP Method | URI | 用途 |
|-------|-------------|-----|------|
| GoogleSyncJob CREATE | POST | `https://a-rakumo.appspot.com/api/google-sync/v1/jobs` | Google同期を実行する |
| GoogleSyncJob GETCURRENT | GET | `https://a-rakumo.appspot.com/api/google-sync/v1/jobs/current` | 現在の実行状況を確認する |
| GoogleSyncJob GETLASTRESULT | GET | `https://a-rakumo.appspot.com/api/google-sync/v1/jobs/last` | 最後の実行結果を取得する |

### 12.3 各APIの詳細

#### GoogleSyncJob CREATE（Google同期実行）
| 項目 | 内容 |
|------|------|
| Method | POST |
| Content-Type | `application/json` |
| Request Body | `{}`（空オブジェクト、パラメータなし） |
| 成功レスポンス | `202 Accepted`：`{"status": "running", "selfLink": "https://...", ...}` |
| エラー `401` | OAuth認可未実施。レスポンスヘッダー `X-OAuth-Token-Location` の URLで認可が必要 |
| エラー `403` | Google特権管理者以外のユーザーによる実行 |
| エラー `409` | 別の同期処理が実行中、またはCSVインポート処理が実行中 |

#### GoogleSyncJob GETCURRENT（実行状況確認）
| 項目 | 内容 |
|------|------|
| Method | GET |
| Content-Type | `application/json` |
| 成功レスポンス | `200 OK`：GoogleSyncJob データセット（status フィールドで状態確認） |
| エラー `403` | Google特権管理者以外のユーザーによるリクエスト |

**statusフィールドの値：**

| status値 | 意味 | 同期実行可否 |
|----------|------|------------|
| `waiting` | 実行待機中 | **実行可能** |
| `running` | 同期処理中 | 実行不可（完了まで待機） |
| `locked` | ロック中 | 実行不可（解除まで待機） |

#### GoogleSyncJob GETLASTRESULT（最終結果取得）
| 項目 | 内容 |
|------|------|
| Method | GET |
| Content-Type | `application/json` |
| 成功レスポンス | `200 OK`：GoogleSyncJob データセット（実行結果の情報） |
| エラー `403` | Google特権管理者以外のユーザーによるリクエスト |
| エラー `404` | 実行結果なし（一度も実行していない場合など） |
| 注意 | 現在実行中の同期情報は返却されない |

### 12.4 GoogleSyncJob データセット

| フィールド名 | 型 | 説明 | 備考 |
|------------|----|----|------|
| `kind` | string | `"google-sync#job"`（固定値） | |
| `id` | string | `"current"` または `"last"`（固定値） | |
| `selfLink` | string | この情報を参照するURL（`/api/google-sync/v1/jobs/current` または `/last`） | |
| `startedBy` | string | 実行開始ユーザーのメールアドレス | |
| `startedTime` | datetime | 実行開始日時 | |
| `finishedTime` | datetime | 実行完了日時 | 実行中またはエラー終了時は `null` |
| `status` | string | 実行状態（`waiting` / `running` / `locked` / `success` など） | |

### 12.5 利用フロー

```
[Appsheetボタン押下]
      │
      ▼
1. GETCURRENT で status 確認
   ├─ waiting → 手順2へ
   └─ running / locked → 完了まで待機してリトライ
      │
      ▼
2. CREATE で Google同期実行（POST {}）
   ├─ 202 Accepted → selfLink 取得
   ├─ 401 → OAuth認可が必要（管理者対応）
   └─ 409 → 他処理実行中（待機してリトライ）
      │
      ▼
3. GETCURRENT（/jobs/current）を30秒間隔でポーリング（最大10分）
      ├─ status: waiting / success → 完了
      └─ status: running / locked → 継続ポーリング
      │
      ▼
4. GETLASTRESULT で最終結果取得・ログ記録
```

### 12.6 事前準備（初回のみ・お客様作業）

API を利用する前に、以下の事前準備をお客様側で実施する必要がある。

1. rakumo 管理画面にてユーザー・グループ情報・カレンダー情報へのアクセスを許可（OAuth認可）
2. rakumo 管理画面にて手動による Google同期を1回実行
   - 管理画面URL：`https://a-rakumo.appspot.com/admin/gapps_sync/`

> **上記未実施の場合、API呼び出し時に `401 Unauthorized` が返却される。**

### 12.7 利用上の制約

- **実行頻度：** 制限なし
- **必要権限：** Google 特権管理者 または rakumo 管理者
- **競合制御：** 以下の処理が実行中の場合は Google同期を開始できない（`409 Conflict`）
  - 管理画面・定期実行・API からの Google同期が実行中
  - ユーザー詳細 CSV（社内外）のインポート処理が実行中

---

## 13. ログ出力仕様

### 13.1 出力するログ情報（確定 3/26）

処理実行時に出力するログ情報は以下のとおり確定した。

**出力情報：**

| 項目 | 内容 |
|------|------|
| 実行日時 | 処理を実行した日時 |
| 実行種類 | 実行した処理の種別（アカウント追加・変更・削除、グループ追加・変更・削除、Google同期、rakumoコンタクト更新 等） |
| 実行内容 | 処理対象のアカウント・グループの詳細情報 |
| 確認・リカバリー手順 | エラー発生時の確認手順および復旧手順 |

**出力レベル：**

| 出力レベル | 内容 |
|-----------|------|
| サマリ | 処理件数・成功/失敗の概要を出力 |
| 詳細 | 処理対象の各レコード詳細を出力 |

> 出力レベルは「サマリ」と「詳細」を切り替えられること。

### 13.2 保存するログのライフサイクル（確定 3/26）

管理者がAppSheet画面から以下の保存期間（日数）を設定できるものとし、システムは設定に基づき自動的にログをローテーション（削除）する。

| 設定項目 | 説明 | デフォルト値 | 備考 |
|---------|------|------------|------|
| 成功ログ保存期間 | 正常終了した操作ログ・同期ログの保存日数 | 90日 | 0指定で無期限保存 |
| 失敗ログ保存期間 | エラー終了した操作ログ・同期ログの保存日数 | 365日 | 調査のため成功ログより長く設定可能 |
| CSVファイル保持期間 | Cloud Storageに保存されたインポート/エクスポートCSVの保持日数 | 30日 | ストレージ容量節約のため短めに設定 |

**ローテーション実行仕様：**
- 1日1回、深夜帯にバックエンド処理（Cloud Run）にて、設定期間を超過したログレコードおよびファイルを一括削除する。
- 設定値はCloud SQLの `settings` テーブルに格納し、コードの変更なしに変更可能とする。

---

*以上*
