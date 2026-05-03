# AppSheet用スプレッドシート設計書

## 概要

AppSheetのデータソースとして使用するGoogleスプレッドシートのシート構成を定義する。
Cloud Runが各処理完了後にスプレッドシートを更新し、AppSheetに最新データを反映する。

---

## 1. シート一覧

| # | シート名 | AppSheetテーブル名 | 更新タイミング |
|---|---------|-----------------|-------------|
| 1 | ユーザー情報一覧 | Users | ユーザーCSVインポート後 / AppSheetからのユーザー個別操作後 |
| 2 | グループ情報一覧 | Groups | グループCSVインポート後 / AppSheetからのグループ個別操作後 |
| 3 | グループメンバー一覧 | GroupMembers | グループメンバーCSVインポート後 / AppSheetからのグループメンバー個別操作後 |
| 4 | アカウント・グループ・グループメンバー更新ログ | OperationLogs | 各インポート処理後 / AppSheetからの個別操作後 |
| 5 | 同期実行ログ | SyncLogs | Google同期実行後 / rakumoコンタクト更新後 |
| 6 | CSVダウンロード実行ログ | CsvDownloadLogs | CSVダウンロード後 |

---

## 2. シート定義

### 2.1 `Users`（ユーザー情報一覧）

ユーザーマスタ68項目をすべて格納する。Cloud RunがCloud SQLの `users` テーブルから全件読み込んで書き出す。

| # | カラム名 | データ型 | Key | 説明 |
|---|---------|---------|-----|------|
| 1 | `user_id` | Text | | ユーザーID（A100000形式。システム自動採番） |
| 2 | `email` | Email | ✓ | Google Workspaceメールアドレス（主キー） |
| 3 | `family_name` | Text | | 姓（苗字）※GWS Last Name に対応 |
| 4 | `given_name` | Text | | 名（名前）※GWS First Name に対応 |
| 5 | `family_name_yomi` | Text | | 姓よみ |
| 6 | `given_name_yomi` | Text | | 名よみ |
| 7 | `company` | Text | | 会社名 |
| 8 | `company_yomi` | Text | | 会社名よみ |
| 9 | `employee_number` | Text | | 社員番号 |
| 10 | `job_title` | Text | | 役職 |
| 11 | `business_phone` | Phone | | 会社電話番号 |
| 12 | `extension` | Text | | 内線番号 |
| 13 | `mobile_phone` | Phone | | 携帯電話番号 |
| 14 | `fax` | Text | | FAX番号 |
| 15 | `business_address` | Text | | 会社住所 |
| 16 | `birthday` | Date | | 生年月日 |
| 17 | `email2` | Email | | メールアドレス2 |
| 18 | `email3` | Email | | メールアドレス3 |
| 19 | `primary_flag` | Number | | プライマリフラグ（1：優先） |
| 20 | `display_flag` | Number | | 表示フラグ（1：表示） |
| 21 | `calendar_enabled` | Number | | rakumoカレンダー有効（1：有効）。デフォルト：1（割り当て） |
| 22 | `contacts_enabled` | Number | | rakumoコンタクト有効（1：有効）。デフォルト：1（割り当て） |
| 23 | `workflow_enabled` | Number | | rakumoワークフロー有効（1：有効）。デフォルト：1（割り当て） |
| 24 | `board_enabled` | Number | | rakumoボード有効（1：有効）。デフォルト：1（割り当て） |
| 25 | `expense_enabled` | Number | | rakumo経費有効（1：有効）。デフォルト：1（割り当て） |
| 26 | `attendance_enabled` | Number | | rakumo勤怠有効（1：有効）。デフォルト：1（割り当て） |
| 27 | `notes` | Text | | 備考（カスタム項目） |
| 28 | `password` | Text | | パスワード（8〜100文字ASCII）※GWSアカウント作成時のみ使用 |
| 29 | `suspended` | Number | | ユーザー一時停止フラグ（1：停止） |
| 30 | `change_password_at_next_login` | Number | | 次回ログイン時パスワード変更フラグ。デフォルト：1（TRUE） |
| 31 | `include_in_global_address_list` | Number | | GAL表示フラグ（1：表示）。デフォルト：1（TRUE） |
| 32 | `org_unit_path` | Text | | 所属組織パス（例：/営業部） |
| 33 | `recovery_email` | Email | | アカウント再設定用メールアドレス |
| 34 | `recovery_phone` | Text | | アカウント復元用電話番号（E.164形式） |
| 35 | `primary_org_name` | Text | | 主務組織名 |
| 36 | `primary_org_email` | Email | | 主務組織メールアドレス |
| 37 | `concurrent_org1_name` | Text | | 兼務組織名1 |
| 38 | `concurrent_org1_email` | Email | | 兼務組織メールアドレス1 |
| 39 | `concurrent_org1_job_title` | Text | | 兼務組織役職1 |
| 40 | `concurrent_org2_name` | Text | | 兼務組織名2 |
| 41 | `concurrent_org2_email` | Email | | 兼務組織メールアドレス2 |
| 42 | `concurrent_org2_job_title` | Text | | 兼務組織役職2 |
| 43 | `concurrent_org3_name` | Text | | 兼務組織名3 |
| 44 | `concurrent_org3_email` | Email | | 兼務組織メールアドレス3 |
| 45 | `concurrent_org3_job_title` | Text | | 兼務組織役職3 |
| 46 | `concurrent_org4_name` | Text | | 兼務組織名4 |
| 47 | `concurrent_org4_email` | Email | | 兼務組織メールアドレス4 |
| 48 | `concurrent_org4_job_title` | Text | | 兼務組織役職4 |
| 49 | `concurrent_org5_name` | Text | | 兼務組織名5 |
| 50 | `concurrent_org5_email` | Email | | 兼務組織メールアドレス5 |
| 51 | `concurrent_org5_job_title` | Text | | 兼務組織役職5 |
| 52 | `concurrent_org6_name` | Text | | 兼務組織名6 |
| 53 | `concurrent_org6_email` | Email | | 兼務組織メールアドレス6 |
| 54 | `concurrent_org6_job_title` | Text | | 兼務組織役職6 |
| 55 | `concurrent_org7_name` | Text | | 兼務組織名7 |
| 56 | `concurrent_org7_email` | Email | | 兼務組織メールアドレス7 |
| 57 | `concurrent_org7_job_title` | Text | | 兼務組織役職7 |
| 58 | `concurrent_org8_name` | Text | | 兼務組織名8 |
| 59 | `concurrent_org8_email` | Email | | 兼務組織メールアドレス8 |
| 60 | `concurrent_org8_job_title` | Text | | 兼務組織役職8 |
| 61 | `concurrent_org9_name` | Text | | 兼務組織名9 |
| 62 | `concurrent_org9_email` | Email | | 兼務組織メールアドレス9 |
| 63 | `concurrent_org9_job_title` | Text | | 兼務組織役職9 |
| 64 | `concurrent_org10_name` | Text | | 兼務組織名10 |
| 65 | `concurrent_org10_email` | Email | | 兼務組織メールアドレス10 |
| 66 | `concurrent_org10_job_title` | Text | | 兼務組織役職10 |
| 67 | `status` | Enum | | ステータス（active / inactive / deleted） |
| 68 | `updated_at` | DateTime | | 最終更新日時 |

- **テーブル権限**：Read Only
- **PII設定**：`family_name`、`given_name`、`family_name_yomi`、`given_name_yomi`、`email`、`mobile_phone`、`business_phone`

---

### 2.2 `Groups`（グループ情報一覧）

| # | カラム名 | データ型 | Key | 説明 |
|---|---------|---------|-----|------|
| 1 | `group_id` | Text | | グループID（G100000形式。システム自動採番） |
| 2 | `email` | Email | ✓ | グループメールアドレス（主キー） |
| 3 | `group_name` | Text | | グループ表示名 |
| 4 | `description` | Text | | グループの説明（Googleグループ情報出力項目 確定3/26） |
| 5 | `group_type` | Enum | | グループ種別（drive / mailing / rakumo / other） |
| 6 | `status` | Enum | | ステータス（active / deleted） |
| 7 | `updated_at` | DateTime | | 最終更新日時 |

- **テーブル権限**：Read Only
- **備考**：初期の更新対象はGoogleドライブ用（drive）とrakumoサービス用（rakumo）の2種別
- **GWS設定項目**（whoCanJoin / whoCanPostMessage / includeInGlobalAddressList 等）はAppSheet画面には表示しない。グループCSVエクスポート時にgroup_typeから導出して出力する

---

### 2.3 `GroupMembers`（グループメンバー一覧）

| # | カラム名 | データ型 | Key | 説明 |
|---|---------|---------|-----|------|
| 1 | `id` | Number | ✓ | レコードID |
| 2 | `group_email` | Email | | グループメールアドレス |
| 3 | `member_email` | Email | | メンバーメールアドレス |
| 4 | `status` | Enum | | ステータス（active / deleted） |
| 5 | `updated_at` | DateTime | | 最終更新日時 |

- **テーブル権限**：Read Only
- **参照関係**：`group_email` → Groups.`email`

---

### 2.4 `OperationLogs`（アカウント・グループ・グループメンバー更新ログ）

| # | カラム名 | データ型 | Key | 説明 |
|---|---------|---------|-----|------|
| 1 | `id` | Number | ✓ | ログID |
| 2 | `operation_type` | Enum | | 操作種別（user_import / user_create / user_update / user_delete / group_import / group_create / group_update / group_delete / member_import / member_add / member_remove） |
| 3 | `change_type` | Enum | | 変更種別（add / update / delete） |
| 4 | `target_email` | Email | | 対象メールアドレス |
| 5 | `status` | Enum | | 結果（success / error） |
| 6 | `error_message` | LongText | | エラーメッセージ（エラー時のみ） |
| 7 | `executed_by` | Email | | 実行ユーザー |
| 8 | `executed_at` | DateTime | | 実行日時 |

- **テーブル権限**：Read Only
- **デフォルト並び順**：`executed_at` 降順

---

### 2.5 `SyncLogs`（同期実行ログ）

Cloud SQLの `sync_logs` テーブル（`sync_type` で `google_sync` / `rakumo_contact` を区別）から全件読み込んで書き出す。

| # | カラム名 | データ型 | Key | 説明 |
|---|---------|---------|-----|------|
| 1 | `id` | Number | ✓ | ログID |
| 2 | `sync_type` | Enum | | 同期種別（google_sync / rakumo_contact） |
| 3 | `status` | Enum | | ステータス（running / success / error） |
| 4 | `started_by` | Email | | 実行ユーザー |
| 5 | `started_at` | DateTime | | 開始日時 |
| 6 | `finished_at` | DateTime | | 完了日時 |
| 7 | `error_message` | LongText | | エラーメッセージ |

- **テーブル権限**：Read Only
- **デフォルト並び順**：`started_at` 降順
- **備考**：AppSheetのビューで `sync_type` によるフィルタを設定し、Google同期ログ・rakumoコンタクトログを別ビューで表示する

---

### 2.6 `CsvDownloadLogs`（CSVダウンロード実行ログ）

| # | カラム名 | データ型 | Key | 説明 |
|---|---------|---------|-----|------|
| 1 | `id` | Number | ✓ | ログID |
| 2 | `download_type` | Text | | ダウンロード種別 |
| 3 | `file_name` | Text | | ファイル名 |
| 4 | `record_count` | Number | | レコード件数 |
| 5 | `executed_by` | Email | | 実行ユーザー |
| 6 | `executed_at` | DateTime | | 実行日時 |

- **テーブル権限**：Read Only
- **デフォルト並び順**：`executed_at` 降順

---

## 3. 実装上の注意点

- **パフォーマンス**：スプレッドシート側の関数（VLOOKUP等）は使用せず、AppSheetの仮想カラムで対応する。
- **同期方式**：Cloud RunがCloud SQL更新後、スプレッドシートを全件書き直し（`values.clear` → `values.update`）する。差分更新は行わない。
- **文字コード**：スプレッドシートはUTF-8で管理する。
- **アーカイブ**：ログシートは肥大化を防ぐため、1ヶ月分を目安にCloud Run側でクレンジングを行う。
- **Usersシートの列数**：Googleアカウント属性カラム7項目（password / suspended / change_password_at_next_login / include_in_global_address_list / org_unit_path / recovery_email / recovery_phone）の追加により計68列（旧61列＋7項目）。AppSheetでは必要な列のみ表示カラムとして設定する。
- **SyncLogsシートのビュー分割**：`sync_type` カラムでフィルタし、「Google同期ログ」（google_sync）と「rakumoコンタクトログ」（rakumo_contact）を別ビューとして表示する。シート自体は1枚に統合する。

---

*以上*
