# AppSheet設計書　ユーザー管理機能

## 目次

1. [アプリ概要](#1-アプリ概要)
2. [データ設計](#2-データ設計)
3. [画面設計](#3-画面設計)
4. [アクション設計](#4-アクション設計)
5. [オートメーション設計](#5-オートメーション設計)
6. [セキュリティ設計](#6-セキュリティ設計)
7. [AppSheet-Cloud Run連携フロー](#7-appsheet-cloud-run連携フロー)

---

## 1. アプリ概要

### 1.1 基本情報

| 項目 | 内容 |
|------|------|
| アプリ名 | ユーザー管理システム |
| プラットフォーム | AppSheet（Google Workspace上） |
| 利用者 | システム管理者、人事担当者（数名想定） |
| 認証 | Google Workspaceアカウント（SSO） |
| アクセス端末 | PC ブラウザ（スマートフォン対応は対象外） |

### 1.2 アーキテクチャ概要

AppSheetは**表示・操作UI**に特化し、データ処理はCloud Runに委譲する構成とする。

```
【データフロー】

  Cloud SQL（マスタDB）
       │
       │ Cloud Runが同期（操作後に自動更新）
       ▼
  Google スプレッドシート（7種）  ←── AppSheetのデータソース
       │
       ▼
  AppSheet（UI）
       │ ユーザー操作（ボタン押下・CSV選択等）
       ▼
  Automation（Webhook）
       │ HTTPS POST
       ▼
  Cloud Run API（処理実行）
       │
       ├──▶ Cloud SQL 更新
       ├──▶ Google Workspace API
       ├──▶ rakumo API
       └──▶ Google スプレッドシート 更新（AppSheet表示に反映）
```

### 1.3 設計方針

- AppSheetのデータソースは **Google スプレッドシート** を使用する
  - AppSheetはCloud SQLへの直接接続を推奨しない
  - Cloud Runが各操作後にスプレッドシートを更新し、AppSheetに最新データを反映する
- ユーザーの書き込み操作（追加・変更・削除）は **AppSheetからは行わない**
  - すべてCloud Run API経由で実行し、結果をスプレッドシートに反映する
  - AppSheetのテーブルは原則 **Read Only**
  - 例外：CSVファイルアップロードのみAppSheetから直接Google Driveへ保存

---

## 2. データ設計

### 2.1 データソース構成

要件定義書 4.6「Appsheet表示用スプレッドシート作成機能」に基づき、Cloud Runが7種のGoogle スプレッドシートを管理する。AppSheetはこれらを読み込む。

| # | スプレッドシート名 | AppSheetテーブル名 | 更新タイミング |
|---|----------------|-----------------|-------------|
| 1 | ユーザー情報一覧 | Users | ユーザーCSVインポート後 / AppSheetからのユーザー個別操作後 |
| 2 | グループ情報一覧 | Groups | グループCSVインポート後 / AppSheetからのグループ個別操作後 |
| 3 | グループメンバー一覧 | GroupMembers | グループメンバーCSVインポート後 / AppSheetからのグループメンバー個別操作後 |
| 4 | アカウント・グループ・グループメンバー更新ログ | OperationLogs | 各インポート処理後 / AppSheetからの個別操作後 |
| 5 | 同期実行ログ | SyncLogs | Google同期実行後 / rakumoコンタクト更新後 |
| 6 | CSVダウンロード実行ログ | CsvDownloadLogs | CSVダウンロード後 |

### 2.2 テーブル定義

#### Users（ユーザー情報一覧）

| カラム名 | AppSheet型 | Key | 説明 |
|---------|-----------|-----|------|
| `user_id` | Text | | ユーザーID（A100000形式。システム自動採番・表示のみ） |
| `email` | Email | ✓ | Google Workspaceメールアドレス |
| `family_name` | Text | | 姓 |
| `given_name` | Text | | 名 |
| `family_name_yomi` | Text | | 姓よみ |
| `given_name_yomi` | Text | | 名よみ |
| `company` | Text | | 会社名 |
| `company_yomi` | Text | | 会社名よみ |
| `employee_number` | Text | | 社員番号 |
| `job_title` | Text | | 役職 |
| `business_phone` | Phone | | 会社電話番号 |
| `extension` | Text | | 内線番号 |
| `mobile_phone` | Phone | | 携帯電話番号 |
| `notes` | Text | | 備考（カスタム項目） |
| `primary_org_name` | Text | | 主務組織名 |
| `primary_org_email` | Email | | 主務組織メールアドレス |
| `concurrent_org1_name` | Text | | 兼務組織名1 |
| `concurrent_org1_email` | Email | | 兼務組織メールアドレス1 |
| `concurrent_org1_job_title` | Text | | 兼務組織役職1 |
| `concurrent_org2_name` | Text | | 兼務組織名2 |
| `concurrent_org2_email` | Email | | 兼務組織メールアドレス2 |
| `concurrent_org2_job_title` | Text | | 兼務組織役職2 |
| `concurrent_org3_name` | Text | | 兼務組織名3 |
| `concurrent_org3_email` | Email | | 兼務組織メールアドレス3 |
| `concurrent_org3_job_title` | Text | | 兼務組織役職3 |
| `concurrent_org4_name` | Text | | 兼務組織名4 |
| `concurrent_org4_email` | Email | | 兼務組織メールアドレス4 |
| `concurrent_org4_job_title` | Text | | 兼務組織役職4 |
| `concurrent_org5_name` | Text | | 兼務組織名5 |
| `concurrent_org5_email` | Email | | 兼務組織メールアドレス5 |
| `concurrent_org5_job_title` | Text | | 兼務組織役職5 |
| `concurrent_org6_name` | Text | | 兼務組織名6 |
| `concurrent_org6_email` | Email | | 兼務組織メールアドレス6 |
| `concurrent_org6_job_title` | Text | | 兼務組織役職6 |
| `concurrent_org7_name` | Text | | 兼務組織名7 |
| `concurrent_org7_email` | Email | | 兼務組織メールアドレス7 |
| `concurrent_org7_job_title` | Text | | 兼務組織役職7 |
| `concurrent_org8_name` | Text | | 兼務組織名8 |
| `concurrent_org8_email` | Email | | 兼務組織メールアドレス8 |
| `concurrent_org8_job_title` | Text | | 兼務組織役職8 |
| `concurrent_org9_name` | Text | | 兼務組織名9 |
| `concurrent_org9_email" | Email | | 兼務組織メールアドレス9 |
| `concurrent_org9_job_title` | Text | | 兼務組織役職9 |
| `concurrent_org10_name` | Text | | 兼務組織名10 |
| `concurrent_org10_email` | Email | | 兼務組織メールアドレス10 |
| `concurrent_org10_job_title` | Text | | 兼務組織役職10 |
| `status` | Enum | | ステータス（active / inactive / deleted） |
| `updated_at` | DateTime | | 最終更新日時 |

- **テーブル権限**：Read Only
- **PII設定**：`family_name`、`given_name`、`email`、`mobile_phone`

#### Groups（グループ情報一覧）

| カラム名 | AppSheet型 | Key | 説明 |
|---------|-----------|-----|------|
| `group_id` | Text | | グループID（G100000形式。システム自動採番・表示のみ） |
| `email` | Email | ✓ | グループメールアドレス |
| `group_name` | Text | | グループ表示名 |
| `description` | Text | | グループの説明 |
| `group_type` | Enum | | グループ種別（drive / mailing / rakumo / other） |
| `status` | Enum | | ステータス（active / deleted） |
| `updated_at` | DateTime | | 最終更新日時 |

- **テーブル権限**：Read Only
- **備考**：GWS設定項目（whoCanJoin等）はAppSheet画面に表示しない。グループCSVエクスポート時にgroup_typeから導出する

#### GroupMembers（グループメンバー一覧）

| カラム名 | AppSheet型 | Key | 説明 |
|---------|-----------|-----|------|
| `id` | Number | ✓ | レコードID |
| `group_email` | Email | | グループメールアドレス |
| `member_email` | Email | | メンバーメールアドレス |
| `status` | Enum | | ステータス（active / deleted） |
| `updated_at` | DateTime | | 最終更新日時 |

- **テーブル権限**：Read Only
- **参照関係**：`group_email` → Groups.`email`（Ref型）

#### OperationLogs（更新ログ）

| カラム名 | AppSheet型 | Key | 説明 |
|---------|-----------|-----|------|
| `id` | Number | ✓ | ログID |
| `operation_type` | Enum | | 操作種別（user_import / user_create / user_update / user_delete / group_import / group_create / group_update / group_delete / member_import / member_add / member_remove） |
| `change_type` | Enum | | 変更種別（add / update / delete） |
| `target_email` | Email | | 対象メールアドレス |
| `status` | Enum | | 結果（success / error） |
| `error_message` | LongText | | エラーメッセージ（エラー時のみ） |
| `executed_by` | Email | | 実行ユーザー |
| `executed_at` | DateTime | | 実行日時 |

- **テーブル権限**：Read Only
- **デフォルト並び順**：`executed_at` 降順

#### SyncLogs（同期実行ログ）

Cloud SQLの `sync_logs` テーブル（`sync_type` で `google_sync` / `rakumo_contact` を区別）から全件書き出す。

| カラム名 | AppSheet型 | Key | 説明 |
|---------|-----------|-----|------|
| `id` | Number | ✓ | ログID |
| `sync_type` | Enum | | 同期種別（google_sync / rakumo_contact） |
| `status` | Enum | | ステータス（running / success / error） |
| `started_by` | Email | | 実行ユーザー |
| `started_at` | DateTime | | 開始日時 |
| `finished_at` | DateTime | | 完了日時 |
| `error_message` | LongText | | エラーメッセージ |

- **テーブル権限**：Read Only
- **デフォルト並び順**：`started_at` 降順
- **備考**：`sync_type` フィルタで「Google同期ログ」「rakumoコンタクトログ」を別ビューとして表示する

#### CsvDownloadLogs（CSVダウンロード実行ログ）

| カラム名 | AppSheet型 | Key | 説明 |
|---------|-----------|-----|------|
| `id` | Number | ✓ | ログID |
| `download_type` | Text | | ダウンロード種別 |
| `file_name` | Text | | ファイル名 |
| `record_count` | Number | | レコード件数 |
| `executed_by` | Email | | 実行ユーザー |
| `executed_at` | DateTime | | 実行日時 |

- **テーブル権限**：Read Only
- **デフォルト並び順**：`executed_at` 降順

#### CsvUploads（CSVアップロード用 ※書き込み専用）

AppSheet内でファイルをGoogle Driveに保存するための専用テーブル。

| カラム名 | AppSheet型 | Key | 説明 |
|---------|-----------|-----|------|
| `upload_id` | Text | ✓ | UNIQUEID()で自動生成 |
| `file` | File | | CSVファイル実体（Google Driveに保存） |
| `upload_type` | Enum | | アップロード種別（user / group / member） |
| `uploaded_at` | DateTime | | NOW()で自動設定 |
| `uploaded_by` | Email | | USEREMAIL()で自動設定 |

- **テーブル権限**：Adds Only
- **データソース**：Google スプレッドシート（アップロード記録管理用、別シート）

---

## 3. 画面設計

### 3.1 ナビゲーション構成

```
ボトムナビゲーション
  ├── ホーム（Dashboard）
  ├── ユーザー管理
  ├── グループ管理
  ├── CSV連携
  ├── スケジュール設定
  └── ログ
```

### 3.2 各画面詳細

---

#### ホーム（Dashboard）

**ビュー種別**：Dashboard

| セクション | 表示内容 | ビュー種別 |
|-----------|---------|----------|
| Google同期状況 | SyncLogs（sync_type='google_sync'）の最新1件（status・開始日時・完了日時） | Detail（Inline） |
| rakumo更新状況 | SyncLogs（sync_type='rakumo_contact'）の最新1件 | Detail（Inline） |
| ユーザー数 | `COUNTIF(Users[status], "active")` | Chart（KPI） |
| グループ数 | `COUNTIF(Groups[status], "active")` | Chart（KPI） |
| クイックアクション | Google同期実行・rakumoコンタクト更新ボタン | Action |

---

#### ユーザー管理

**ビュー構成**：

| ビュー名 | 種別 | 説明 |
|---------|------|------|
| ユーザー一覧 | Table | 全ユーザーを表形式で表示。検索・フィルタ可能 |
| ユーザー詳細 | Detail | 選択ユーザーの全項目表示。編集・削除アクションボタンを配置 |
| ユーザー追加フォーム | Form | 新規ユーザー入力フォーム。送信時にA-10を呼び出す |
| ユーザー編集フォーム | Form | 既存ユーザー編集フォーム。送信時にA-11を呼び出す |

**ユーザー一覧 表示カラム**：

| 表示順 | カラム | 備考 |
|--------|--------|------|
| 1 | `user_id` | ユーザーID |
| 2 | `employee_number` | 社員番号 |
| 3 | `family_name` + `given_name` | 氏名（結合表示） |
| 4 | `email` | メールアドレス |
| 5 | `company` | 会社名 |
| 6 | `job_title` | 役職 |
| 7 | `status` | ステータス（色付き） |
| 8 | `updated_at` | 更新日時 |

**フィルタ条件**：
- デフォルト：`status = "active"` のみ表示
- フィルタ切替：ステータス全件表示可能

**検索対象カラム**：`email`、`family_name`、`given_name`、`employee_number`

**ユーザー詳細 表示内容**：
- 基本情報（姓・名・よみ・会社名）
- 連絡先（メール・電話・内線・携帯）
- 組織情報（主務組織・兼務組織1〜10：各組織名・メールアドレス・役職）
- システム情報（ステータス・更新日時）
- アクションボタン：「ユーザーを編集」（A-11）、「ユーザーを削除」（A-12）

**ユーザー追加・編集フォーム 入力項目**：

| セクション | 入力項目 | 必須 |
|-----------|---------|------|
| 基本情報 | メールアドレス・姓・名・姓よみ・名よみ | メールアドレス・姓・名は必須 |
| 所属情報 | 会社名・社員番号・役職 | 任意 |
| 連絡先 | 会社電話番号・内線番号・携帯電話番号 | 任意 |
| 組織 | 主務組織名・主務組織メールアドレス・兼務組織1〜10 | 任意 |
| rakumoライセンス | カレンダー有効〜勤怠有効（各フラグ） | 任意 |
| その他 | 備考 | 任意 |

> 編集フォームは対象レコードの現在値をプリセットして表示する。メールアドレスは変更不可（表示のみ）。

---

#### グループ管理

**ビュー構成**：

| ビュー名 | 種別 | 説明 |
|---------|------|------|
| グループ一覧 | Table | グループ種別フィルタ付き一覧 |
| グループ詳細 | Detail | グループ情報＋メンバー一覧（Inline）。編集・削除・メンバー追加アクションボタンを配置 |
| グループ追加フォーム | Form | 新規グループ入力フォーム。送信時にA-13を呼び出す |
| グループ編集フォーム | Form | 既存グループ編集フォーム。送信時にA-14を呼び出す |

**グループ一覧 表示カラム**：

| 表示順 | カラム | 備考 |
|--------|--------|------|
| 1 | `group_id` | グループID |
| 2 | `group_name` | グループ名 |
| 3 | `email` | グループメールアドレス |
| 4 | `group_type` | 種別（色付き） |
| 5 | `status` | ステータス |
| 6 | `updated_at` | 更新日時 |

**グループ種別フィルタ**：
- すべて / Googleドライブ用（drive）/ rakumoサービス用（rakumo）/ メーリングリスト用（mailing）/ その他（other）
  - 初期の更新対象グループはGoogleドライブ用（drive）とrakumoサービス用（rakumo）の2種別

**グループ詳細 表示内容**：
- グループ名・メールアドレス・説明・種別・ステータス・更新日時
- アクションボタン：「グループを編集」（A-14）、「グループを削除」（A-15）、「メンバーを追加」（A-16）
- Inline View（メンバー一覧）：フィルタ `group_email = [_THISROW].[email]` かつ `status = "active"`
  - 表示カラム：`member_email`
  - 各行にアクションボタン：「メンバーを削除」（A-17）

**グループ追加・編集フォーム 入力項目**：

| 入力項目 | AppSheet型 | 必須 | 備考 |
|---------|-----------|------|------|
| グループメールアドレス | Email | ✓ | 編集時は変更不可（表示のみ） |
| グループ名 | Text | ✓ | |
| 説明 | Text | | |
| グループ種別 | Enum | ✓ | drive / mailing / rakumo / other |

---

#### CSV連携

**ビュー構成**：

| ビュー名 | 種別 | 説明 |
|---------|------|------|
| CSV連携パネル | Dashboard | 各CSVアップロード・ダウンロードのUI |
| CSVアップロードフォーム | Form | ファイル選択・種別選択 |

**CSV連携パネル 構成**：

```
┌─────────────────────────────────────┐
│  CSVインポート                        │
│  [ユーザーCSVアップロード]            │
│  [グループCSVアップロード]            │
│  [グループメンバーCSVアップロード]    │
├─────────────────────────────────────┤
│  CSVエクスポート                      │
│  [ユーザーCSVダウンロード]            │
│  [グループCSVダウンロード]            │
│  [他システム連携CSVダウンロード]      │
├─────────────────────────────────────┤
│  Google同期・rakumo更新               │
│  [Google同期実行]                     │
│  [rakumoコンタクト更新]               │
└─────────────────────────────────────┘
```

**CSVアップロードフォーム 項目**：

| 項目 | AppSheet型 | 内容 |
|------|-----------|------|
| ファイル | File | CSVファイル選択（Google Driveに保存） |
| アップロード種別 | Enum | user / group / member |
| アップロード日時 | DateTime | NOW()（自動） |
| 実行ユーザー | Email | USEREMAIL()（自動） |

---

#### スケジュール設定

**ビュー種別**：Form

Google同期および rakumoコンタクト更新の定期実行時刻を設定する画面。

**入力項目：**

| 項目 | AppSheet型 | 内容 |
|------|-----------|------|
| 実行時刻 | Enum | 0〜23時を1時間単位で選択（例：6→06:00実行） |

**アクション：**

| ボタン | 動作 |
|-------|------|
| 設定を保存 | A-09「スケジュール更新」を呼び出し、Cloud Runへ設定値を送信。Cloud RunがCloud Scheduler APIを更新する |

**表示内容：**
- 現在設定されているGoogle同期の実行時刻
- rakumoコンタクト更新はGoogle同期の30分後に自動実行される旨の説明

**ログ保存期間設定（要件定義書 13.2節）：**

同一画面内にログ保存期間の設定セクションを設ける。

| 項目 | AppSheet型 | 内容 | デフォルト値 |
|------|-----------|------|------------|
| 成功ログ保存期間（日） | Number | 正常終了した操作ログ・同期ログの保存日数（0で無期限） | 90 |
| 失敗ログ保存期間（日） | Number | エラー終了したログの保存日数（0で無期限） | 365 |
| CSVファイル保持期間（日） | Number | Cloud Storage上のCSVファイル保持日数 | 30 |

> 設定値はCloud SQLの `settings` テーブルに格納される。保存ボタン押下でWebhook経由でCloud Runに送信し、settingsテーブルを更新する。ローテーションは毎日03:00 JSTにCloud Schedulerジョブで自動実行される。

---

#### ログ

**ビュー構成**：

| ビュー名 | 種別 | 対象テーブル | デフォルト並び |
|---------|------|------------|------------|
| 更新ログ | Table | OperationLogs | executed_at 降順 |
| Google同期ログ | Table | SyncLogs（sync_type='google_sync'でフィルタ） | started_at 降順 |
| rakumoコンタクトログ | Table | SyncLogs（sync_type='rakumo_contact'でフィルタ） | started_at 降順 |
| CSVダウンロードログ | Table | CsvDownloadLogs | executed_at 降順 |

**ステータス色分け設定**（全ログ共通）：

| status値 | 表示色 |
|---------|-------|
| success | 緑 |
| running | 青 |
| error | 赤 |

---

## 4. アクション設計

### 4.1 アクション一覧

| # | アクション名 | 対象テーブル | 種別 | 表示場所 |
|---|------------|------------|------|---------|
| **CSV・同期系** | | | | |
| A-01 | ユーザーCSVインポート実行 | CsvUploads | Webhook | CSV連携パネル |
| A-02 | グループCSVインポート実行 | CsvUploads | Webhook | CSV連携パネル |
| A-03 | グループメンバーCSVインポート実行 | CsvUploads | Webhook | CSV連携パネル |
| A-04 | ユーザーCSVエクスポート | Users | Webhook | CSV連携パネル |
| A-05 | グループCSVエクスポート | Groups | Webhook | CSV連携パネル |
| A-06 | 他システム連携CSVダウンロード | （システム） | Webhook | CSV連携パネル |
| A-07 | Google同期実行 | （システム） | Webhook | ホーム、CSV連携パネル |
| A-08 | rakumoコンタクト更新 | （システム） | Webhook | ホーム、CSV連携パネル |
| A-09 | スケジュール更新 | （システム） | Webhook | スケジュール設定画面 |
| **ユーザー個別操作** | | | | |
| A-10 | ユーザー追加 | Users | Webhook | ユーザー追加フォーム |
| A-11 | ユーザー更新 | Users | Webhook | ユーザー詳細・編集フォーム |
| A-12 | ユーザー削除 | Users | Webhook | ユーザー詳細 |
| **グループ個別操作** | | | | |
| A-13 | グループ追加 | Groups | Webhook | グループ追加フォーム |
| A-14 | グループ更新 | Groups | Webhook | グループ詳細・編集フォーム |
| A-15 | グループ削除 | Groups | Webhook | グループ詳細 |
| A-16 | グループメンバー追加 | GroupMembers | Webhook | グループ詳細 |
| A-17 | グループメンバー削除 | GroupMembers | Webhook | グループ詳細（メンバー一覧行） |

### 4.2 アクション詳細

#### A-01〜03：CSVインポート実行

CSVアップロードフォームからファイルを保存後、Webhookで Cloud Run に通知する。

| 項目 | 内容 |
|------|------|
| トリガー | CsvUploads テーブルへのレコード追加 |
| アクション種別 | Call a webhook（Automationから呼び出し） |
| Cloud Run エンドポイント | A-01：`POST /api/users/import` |
| | A-02：`POST /api/groups/import` |
| | A-03：`POST /api/groups/members/import` |
| リクエストBody | `{"file_path": "[file]", "upload_type": "[upload_type]", "executed_by": "[uploaded_by]"}` |
| 確認ダイアログ | 「CSVをインポートします。よろしいですか？」 |

#### A-04〜06：CSVエクスポート・ダウンロード

| 項目 | 内容 |
|------|------|
| アクション種別 | Call a webhook |
| Cloud Run エンドポイント | A-04：`POST /api/users/export` |
| | A-05：`POST /api/groups/export` |
| | A-06：`POST /api/csv/download` |
| リクエストBody | `{"executed_by": "<<USEREMAIL()>>"}` |
| レスポンス処理 | Cloud Runが返す署名付きURL（`download_url`）をポップアップで表示 |
| 確認ダイアログ | 「CSVを生成します。よろしいですか？」 |

#### A-07：Google同期実行

| 項目 | 内容 |
|------|------|
| アクション種別 | Call a webhook |
| Cloud Run エンドポイント | `POST /api/google-sync` |
| リクエストBody | `{"executed_by": "<<USEREMAIL()>>"}` |
| 確認ダイアログ | 「Google同期を実行します。処理に数分かかる場合があります。よろしいですか？」 |
| 実行後メッセージ | 「Google同期を開始しました。ログ画面で進捗を確認してください。」 |
| 注意事項 | 同期処理は非同期。完了はGoogle同期ログで確認する |

#### A-08：rakumoコンタクト更新

| 項目 | 内容 |
|------|------|
| アクション種別 | Call a webhook |
| Cloud Run エンドポイント | `POST /api/rakumo/contacts/update` |
| リクエストBody | `{"executed_by": "<<USEREMAIL()>>"}` |
| 確認ダイアログ | 「rakumoコンタクトを更新します。よろしいですか？」 |
| 実行後メッセージ | 「rakumoコンタクト更新を開始しました。ログ画面で進捗を確認してください。」 |
| 注意事項 | 処理は非同期。完了はrakumoコンタクトログで確認する |

#### A-09：スケジュール更新

| 項目 | 内容 |
|------|------|
| アクション種別 | Call a webhook |
| Cloud Run エンドポイント | `PUT /api/scheduler/google-sync` |
| リクエストBody | `{"hour": "<<[実行時刻]>>", "updated_by": "<<USEREMAIL()>>"}` |
| 確認ダイアログ | 「定期実行スケジュールを更新します。よろしいですか？」 |
| 実行後メッセージ | 「スケジュールを更新しました。次回からは指定の時刻に実行されます。」 |
| 注意事項 | Google同期とrakumoコンタクト更新の両ジョブが同時に更新される |

#### A-10：ユーザー追加

| 項目 | 内容 |
|------|------|
| アクション種別 | Call a webhook |
| Cloud Run エンドポイント | `POST /api/users` |
| リクエストBody | ユーザー追加フォームの全入力値をJSONで送信 |
| 確認ダイアログ | 「ユーザーを追加します。よろしいですか？」 |
| 実行後メッセージ | 「ユーザーを追加しました。Google Workspaceへの反映が完了しました。」 |
| 注意事項 | 既存メールアドレスの場合はUPSERT（変更）として処理される |

#### A-11：ユーザー更新

| 項目 | 内容 |
|------|------|
| アクション種別 | Call a webhook |
| Cloud Run エンドポイント | `PATCH /api/users/<<[email]>>` |
| リクエストBody | ユーザー編集フォームの変更値をJSONで送信 |
| 確認ダイアログ | 「ユーザー情報を更新します。よろしいですか？」 |
| 実行後メッセージ | 「ユーザー情報を更新しました。」 |

#### A-12：ユーザー削除

| 項目 | 内容 |
|------|------|
| アクション種別 | Call a webhook |
| Cloud Run エンドポイント | `DELETE /api/users/<<[email]>>` |
| リクエストBody | `{"executed_by": "<<USEREMAIL()>>"}` |
| 確認ダイアログ | 「ユーザーを削除（アカウント停止）します。よろしいですか？」 |
| 実行後メッセージ | 「ユーザーを削除（停止）しました。」 |
| 注意事項 | **論理削除（status=deleted）とし、Google Workspace側は物理削除せず「停止(suspended=True)」に変更する** |

#### A-13：グループ追加

| 項目 | 内容 |
|------|------|
| アクション種別 | Call a webhook |
| Cloud Run エンドポイント | `POST /api/groups` |
| リクエストBody | グループ追加フォームの全入力値をJSONで送信 |
| 確認ダイアログ | 「グループを追加します。よろしいですか？」 |
| 実行後メッセージ | 「グループを追加しました。Google Workspaceへの反映が完了しました。」 |
| 注意事項 | group_typeに応じたデフォルト設定（GWS_GROUP_DEFAULTS）が自動適用される |

#### A-14：グループ更新

| 項目 | 内容 |
|------|------|
| アクション種別 | Call a webhook |
| Cloud Run エンドポイント | `PATCH /api/groups/<<[email]>>` |
| リクエストBody | グループ編集フォームの変更値をJSONで送信 |
| 確認ダイアログ | 「グループ情報を更新します。よろしいですか？」 |
| 実行後メッセージ | 「グループ情報を更新しました。」 |

#### A-15：グループ削除

| 項目 | 内容 |
|------|------|
| アクション種別 | Call a webhook |
| Cloud Run エンドポイント | `DELETE /api/groups/<<[email]>>` |
| リクエストBody | `{"executed_by": "<<USEREMAIL()>>"}` |
| 確認ダイアログ | 「グループを削除します。Google Workspaceからも削除されます。よろしいですか？」 |
| 実行後メッセージ | 「グループを削除しました。」 |
| 注意事項 | グループメンバーも同時に論理削除される |

#### A-16：グループメンバー追加

| 項目 | 内容 |
|------|------|
| アクション種別 | Call a webhook |
| Cloud Run エンドポイント | `POST /api/groups/<<[group_email]>>/members` |
| リクエストBody | `{"member_email": "<<入力値>>", "executed_by": "<<USEREMAIL()>>"}` |
| 確認ダイアログ | 「メンバーを追加します。よろしいですか？」 |
| 実行後メッセージ | 「メンバーを追加しました。」 |

#### A-17：グループメンバー削除

| 項目 | 内容 |
|------|------|
| アクション種別 | Call a webhook |
| Cloud Run エンドポイント | `DELETE /api/groups/<<[group_email]>>/members/<<[member_email]>>` |
| リクエストBody | `{"executed_by": "<<USEREMAIL()>>"}` |
| 確認ダイアログ | 「メンバーを削除します。よろしいですか？」 |
| 実行後メッセージ | 「メンバーを削除しました。」 |

---

## 5. オートメーション設計

### 5.1 オートメーション一覧

| # | オートメーション名 | トリガー | 処理 |
|---|----------------|---------|------|
| AT-01 | CSV Upload Trigger | CsvUploadsへのAdd | Cloud Run Webhookを呼び出す |

### 5.2 AT-01：CSV Upload Trigger

```
Event（イベント）
  テーブル：CsvUploads
  条件：レコードが追加されたとき（Adds only）

Process（処理）
  Step 1: Call a webhook
    URL: <<Cloud RunベースURL>>/api/<<[upload_type]>>s/import
    HTTP Method: POST
    Content-Type: application/json
    Body:
      {
        "file_path": "<<[file]>>",
        "upload_type": "<<[upload_type]>>",
        "executed_by": "<<[uploaded_by]>>"
      }
    認証: OIDC（Cloud Run Invoker サービスアカウント）
```

### 5.3 Cloud RunへのWebhook認証

AppSheetのAutomation Webhookに対して、Cloud RunはOIDC認証で保護されている。

| 項目 | 設定 |
|------|------|
| 認証方式 | Google OIDCトークン |
| サービスアカウント | `appsheet-sa@{PROJECT_ID}.iam.gserviceaccount.com` |
| 設定箇所 | AppSheet > Automation > Call a webhook > Authentication |

---

## 6. セキュリティ設計

### 6.1 アクセス制御

| 項目 | 設定 |
|------|------|
| 認証プロバイダ | Google（Google Workspaceアカウント） |
| ドメイン制限 | 東邦ホールディングスのGoogle Workspaceドメインのみ許可 |
| アクセス権管理 | **Googleグループで管理する（確定）。アクセス用グループはユーザーマスタ機能で作成・管理する** |
| ビュー表示制御 | データレベルのアクセス制限なし。アクセス可能なユーザーはすべての機能を利用可能 |

### 6.2 PIIカラム設定

個人情報に該当するカラムはAppSheet上でPIIとしてマークし、ログへの出力を抑制する。

| テーブル | PIIカラム |
|---------|----------|
| Users | `family_name`、`given_name`、`family_name_yomi`、`given_name_yomi`、`email`、`mobile_phone`、`business_phone` |
| GroupMembers | `member_email` |
| OperationLogs | `target_email`、`executed_by` |

### 6.3 テーブルアクセス権限まとめ

| テーブル | 追加 | 編集 | 削除 | 読取 |
|---------|------|------|------|------|
| Users | ✗ | ✗ | ✗ | ✓ |
| Groups | ✗ | ✗ | ✗ | ✓ |
| GroupMembers | ✗ | ✗ | ✗ | ✓ |
| OperationLogs | ✗ | ✗ | ✗ | ✓ |
| SyncLogs | ✗ | ✗ | ✗ | ✓ |
| CsvDownloadLogs | ✗ | ✗ | ✗ | ✓ |
| CsvUploads | ✓ | ✗ | ✗ | ✓ |

---

## 7. AppSheet-Cloud Run連携フロー

### 7.1 CSVインポートフロー

```
1. ユーザーがCSV連携パネルでアップロードボタンを押下
      │
      ▼
2. AppSheet：CSVアップロードフォームを表示
      │
      ▼
3. ユーザーがCSVファイルを選択・送信
      │
      ▼
4. AppSheet：CsvUploadsにレコードを追加
         → ファイルはGoogle Driveに自動保存
         → Google DriveファイルパスがCsvUploads.fileに記録される
      │
      ▼
5. AppSheet Automation（AT-01）が起動
      │ Webhook POST
      ▼
6. Cloud Run /api/{type}s/import
      ├── Google DriveからCSVを取得
      ├── バリデーション実行
      ├── Cloud SQL更新（トランザクション）
      ├── Google Workspace API呼び出し
      ├── OperationLogsスプレッドシート更新
      └── Users/Groups/GroupMembersスプレッドシート更新
      │
      ▼
7. AppSheetのデータが自動更新（スプレッドシート変更を検知）
```

### 7.2 Google同期実行フロー

```
1. ユーザーがA-07「Google同期実行」ボタンを押下
      │
      ▼
2. AppSheetが確認ダイアログを表示
      │ OK
      ▼
3. AppSheet Webhook POST → Cloud Run /api/google-sync
      │
      ▼
4. Cloud Run
      ├── GoogleSyncJob GETCURRENT で status確認
      │     └── running/locked → 409エラー返却 → AppSheetにエラーメッセージ表示
      ├── GoogleSyncJob CREATE で同期開始（202 Accepted）
      ├── selfLink をポーリングして完了まで監視
      ├── GoogleSyncJob GETLASTRESULT で結果取得
      └── SyncLogsスプレッドシート（sync_type='google_sync'）を更新
      │
      ▼
5. AppSheet：「開始しました」メッセージを表示
      │
      ▼
6. ユーザーがログ画面で完了を確認
```

### 7.3 rakumoコンタクト更新フロー

```
1. ユーザーがA-08「rakumoコンタクト更新」ボタンを押下
      │
      ▼
2. AppSheetが確認ダイアログを表示
      │ OK
      ▼
3. AppSheet Webhook POST → Cloud Run /api/rakumo/contacts/update
      │
      ▼
4. Cloud Run
      ├── Cloud SQLからプロファイルデータ取得
      ├── プロファイルCSV生成 → Cloud Storageに保存
      ├── CSV IMPORT LOCK確認
      ├── CSV CREATE URL で upload_url取得（有効期限10分）
      ├── CSV UPLOAD でrakumoにアップロード（非同期202 Accepted）
      └── SyncLogsスプレッドシート（sync_type='rakumo_contact'）を更新
      │
      ▼
5. AppSheet：「開始しました」メッセージを表示
      │
      ▼
6. ユーザーがログ画面で完了を確認
```

### 7.4 CSVエクスポート・ダウンロードフロー

```
1. ユーザーがエクスポート/ダウンロードボタンを押下
      │
      ▼
2. AppSheet Webhook POST → Cloud Run /api/csv/download 等
      │
      ▼
3. Cloud Run
      ├── Cloud SQLからデータ取得
      ├── CSV生成
      ├── Cloud Storageに保存
      ├── 署名付きURL（有効期限15分）を生成
      └── CsvDownloadLogsスプレッドシートを更新
      │
      ▼
4. AppSheet：署名付きURLをポップアップで表示
      │
      ▼
5. ユーザーがリンクをクリックしてCSVをダウンロード
```

### 7.5 ユーザー個別操作フロー（追加・更新・削除共通）

```
1. ユーザーが追加フォーム入力 / 編集フォーム入力 / 削除ボタン押下
      │
      ▼
2. AppSheetが確認ダイアログを表示
      │ OK
      ▼
3. AppSheet Action（A-10 / A-11 / A-12）が直接 Webhook POST
      │ （Automationを経由しない）
      ▼
4. Cloud Run
      ├── POST /api/users  （追加）
      │     ├── Pydanticバリデーション
      │     ├── Cloud SQL UPSERT
      │     ├── GWS users.insert（GWS_USER_DEFAULTS適用）
      │     └── rakumoコンタクト更新
      │
      ├── PATCH /api/users/{email}  （更新）
      │     ├── Pydanticバリデーション
      │     ├── Cloud SQL UPDATE
      │     ├── GWS users.update
      │     └── rakumoコンタクト更新
      │
      └── DELETE /api/users/{email}  （削除）
            ├── Cloud SQL 論理削除（status=deleted）
            ├── GWS users.patch(suspended=True)
            └── rakumoコンタクト更新
      │
      ▼
5. Cloud Run：OperationLogs・Usersスプレッドシートを更新
      │
      ▼
6. AppSheet：完了メッセージを表示 → 一覧表示が自動更新
```

### 7.6 グループ・グループメンバー個別操作フロー

```
1. ユーザーがグループ追加/編集/削除 またはメンバー追加/削除を操作
      │
      ▼
2. AppSheetが確認ダイアログを表示
      │ OK
      ▼
3. AppSheet Action（A-13〜A-17）が直接 Webhook POST
      │
      ▼
4. Cloud Run
      ├── POST /api/groups  （グループ追加）
      │     ├── Cloud SQL INSERT
      │     ├── GWS groups.insert
      │     └── Groups Settings API（GWS_GROUP_DEFAULTS適用）
      │
      ├── PATCH /api/groups/{email}  （グループ更新）
      │     ├── Cloud SQL UPDATE
      │     └── GWS groups.update
      │
      ├── DELETE /api/groups/{email}  （グループ削除）
      │     ├── Cloud SQL 論理削除（グループメンバーも同時削除）
      │     └── GWS groups.delete
      │
      ├── POST /api/groups/{email}/members  （メンバー追加）
      │     ├── Cloud SQL INSERT
      │     └── GWS members.insert
      │
      └── DELETE /api/groups/{email}/members/{member_email}  （メンバー削除）
            ├── Cloud SQL 論理削除
            └── GWS members.delete
      │
      ▼
5. Cloud Run：OperationLogs・Groups/GroupMembersスプレッドシートを更新
      │
      ▼
6. AppSheet：完了メッセージを表示 → 一覧表示が自動更新
```

> **注意：** グループ操作は人事異動時の作業順序（グループ → グループメンバー → ユーザー）を守ること（要件定義書 8.2節）。

---

*以上*
