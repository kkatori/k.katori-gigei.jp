# AppSheet 設計書：ユーザー管理機能

## 1. アプリケーション概要
本アプリケーションは、Google Cloud上のデータベース (Cloud SQL) をマスターデータとして参照・更新し、各種バッチ処理のトリガーとなる管理用インターフェースです。

- **アプリ名**: User Management Admin (仮)
- **ユーザー**: システム管理者、人事担当者 (数名を想定)
- **認証**: Google Workspace アカウントによるSSO

## 2. データ構造 (Data)

### 2.1 テーブル定義
AppSheetで読み込む主要なテーブルと設定です。データソースは原則として **Cloud SQL** を使用します。

| テーブル名 | ソース | 権限 | 備考 |
| :--- | :--- | :--- | :--- |
| **Users** | Cloud SQL | Updates_Allowed (Add, Edit, Delete) | 社員情報のマスターテーブル。 |
| **Groups** | Cloud SQL | Updates_Allowed (Add, Edit, Delete) | グループ情報のマスターテーブル。 |
| **GroupMembers** | Cloud SQL | Updates_Allowed (Add, Edit, Delete) | グループとユーザーの中間テーブル。 |
| **ExecutionLogs** | Cloud SQL | Read_Only | バッチ処理の実行ログ。作成日時の降順で表示。 |
| **CSVImports** | Cloud Storage | Adds_Only | CSVアップロード用テーブル（実態はフォルダ）。 |

### 2.2 カラム定義 (主要抜粋)

#### Users テーブル
- `user_id` (Text, Key): 社員番号またはメールアドレス
- `name` (Text): 氏名
- `email` (Email): メールアドレス
- `department` (Text): 所属部署
- `job_title` (Text): 役職
- `rakumo_sync_status` (Enum): rakumo同期状態 (Synced, Pending, Error)

#### CSVImports テーブル
- `upload_id` (Text, Key): UNIQUEID()
- `file` (File): CSVファイルの実体
- `upload_type` (Enum): アップロード種別 (User_Add, User_Update, Group_Sync, etc.)
- `uploaded_at` (DateTime): NOW()
- `uploaded_by` (Email): USEREMAIL()

## 3. 画面設計 (UX)

### 3.1 ビュー (Views)

#### メインメニュー (Dashboard)
- **概要**: システムの状態を一目で確認できるダッシュボード。
- **構成**:
    - 最新のエラーログ (Deck View)
    - ユーザー数・グループ数の集計 (Chart View)
    - ショートカットアクション (CSVアップロード、同期実行)

#### ユーザー管理 (Users)
- **List View**: 検索可能なユーザー一覧。顔写真、氏名、部署を表示。
- **Detail View**: ユーザー詳細情報と、所属グループの一覧（Inline View）を表示。
- **Form View**: 新規登録・編集画面。入力規則（メールアドレス形式など）を適用。

#### グループ管理 (Groups)
- **List View**: グループ一覧。用途（ドライブ用、ML用）でフィルタリング可能にする。
- **Detail View**: グループ詳細とメンバー一覧。

#### CSV連携 (CSV Center)
- **Form View (Upload)**: `CSVImports` への登録画面。「ファイル選択」と「処理種別選択」を行う。
- **Detail View (Download)**: Cloud Runが生成したCSVのダウンロードリンクを表示する専用ビュー（Virtual ColumnでURLを表示）。

#### ログ確認 (Logs)
- **Table View**: `ExecutionLogs` の一覧。ステータス（Success/Error）で色分け表示。

## 4. アクションと自動化 (Actions & Automation)

### 4.1 アクション (Actions)
画面上に配置するボタンの定義です。

| アクション名 | 対象テーブル | 動作 | 表示場所 |
| :--- | :--- | :--- | :--- |
| **Sync to Workspace** | System (Users) | Cloud RunのWebhookを呼び出す | メインメニュー、ユーザー一覧 |
| **Sync to rakumo** | System (Users) | Cloud RunのWebhookを呼び出す (rakumo同期) | メインメニュー |
| **Generate CSV** | System (Users) | Cloud RunのWebhookを呼び出す (CSV作成) | メインメニュー |
| **Download File** | CSVExports | 外部URLを開く (署名付きURL) | CSVダウンロード画面 |

### 4.2 オートメーション (Automation)
ユーザーの操作をトリガーにバックエンド処理を実行する設定です。

1.  **On CSV Uploaded**
    - **Event**: `CSVImports` テーブルへの `Add`
    - **Process**: Call Webhook
    - **URL**: Cloud Runのエンドポイント (`/api/v1/import_csv`)
    - **Body**: アップロードされたファイルパス、種別、実行ユーザー情報をJSONで送信。

2.  **On Sync Requested**
    - **Event**: アクションボタン押下時 (データ変更なし)
    - **Process**: Call Webhook
    - **URL**: Cloud Runのエンドポイント (`/api/v1/sync/rakumo` 等)

## 5. セキュリティ設定

### 5.1 アクセス制御
- **Authentication Provider**: Google
- **Domain Restriction**: 指定されたドメインのユーザーのみログイン可能に設定。
- **Security Filters**: 一般ユーザーには「自分の所属部署のみ」等のフィルタを適用可能（要件による、今回は管理者用のため全件表示を基本とする）。

### 5.2 データ保護
- **PII (Personal Identifiable Information)**: 氏名、メールアドレス等のカラムはAppSheet上で「PII」としてマークし、ログ出力時にマスクされるよう設定。
