# Google Cloud設計書　ユーザー管理機能

## 目次

1. [概要](#1-概要)
2. [プロジェクト構成](#2-プロジェクト構成)
3. [システムアーキテクチャ](#3-システムアーキテクチャ)
4. [Cloud Run設計](#4-cloud-run設計)
5. [Cloud SQL設計](#5-cloud-sql設計)
6. [Cloud Storage設計](#6-cloud-storage設計)
7. [ログ基盤設計](#7-ログ基盤設計)
8. [セキュリティ設計](#8-セキュリティ設計)
9. [スケジューラ設計](#9-スケジューラ設計)
10. [API設計](#10-api設計)
11. [環境設計](#11-環境設計)

---

## 1. 概要

本書は、ユーザー管理機能開発における Google Cloud の詳細設計を定義する。
要件定義書 v1.7 に基づき、Cloud Run・Cloud SQL・Cloud Storage を中心としたバックエンド基盤の構成・設定・データ構造を規定する。

### 1.1 設計方針

- バックエンドは **Cloud Run** に統一（スケールアウトによる数万件処理に対応）
- データベースは **Cloud SQL（MySQL）** に統一（マスタデータの整合性確保）
- 認証情報は **Secret Manager** で一元管理（APIキー漏洩リスクの低減）
- ログは **Cloud Logging → Cloud Pub/Sub → BigQuery** パイプラインで蓄積・分析
- 本番環境・検証環境を **別プロジェクト** として分離

---

## 2. プロジェクト構成

### 2.1 GCPプロジェクト

| 環境 | プロジェクト名（案） | 用途 |
|------|-------------------|------|
| 本番環境 | `toho-hd-user-mgmt-prod` | 本番運用 |
| 検証環境 | `toho-hd-user-mgmt-dev` | 開発・検証 |

> プロジェクトIDはお客様のGCP組織ポリシーに従い確定すること。

### 2.2 利用するGCPサービス一覧

| サービス | 用途 | 本番 | 検証 |
|---------|------|------|------|
| Cloud Run | バックエンドAPI・バッチ処理 | ○ | ○ |
| Cloud SQL (MySQL) | 人事情報マスタDB | ○ | ○ |
| Cloud Storage | CSVファイル保管 | ○ | ○ |
| Cloud Logging | ログ収集・監視・アラート | ○ | ○ |
| Cloud Pub/Sub | ログのストリーミング転送 | ○ | ○ |
| BigQuery | ログ蓄積・分析 | ○ | ○ |
| Cloud Scheduler | 定期実行・予約実行 | ○ | ○ |
| Secret Manager | APIキー・DB接続情報の管理 | ○ | ○ |
| Artifact Registry | コンテナイメージ管理 | ○ | ○ |

### 2.3 リージョン

| 項目 | 設定値 | 理由 |
|------|--------|------|
| 主リージョン | `asia-northeast1`（東京） | 国内データ保管・低レイテンシ |
| BigQuery ロケーション | `asia-northeast1` | 同一リージョン統一 |

---

## 3. システムアーキテクチャ

### 3.1 全体構成図

```
【フロントエンド】
  Appsheet（Google Workspace）
       │  HTTPS
       ▼
【バックエンド】
  Cloud Run（user-mgmt-api）
       │
       ├─── Cloud SQL（MySQL）    ← 人事情報マスタ
       │         users / groups / group_members / logs
       │
       ├─── Cloud Storage        ← CSVファイル保管
       │         /csv-input / /csv-output / /rakumo-profiles
       │
       ├─── Secret Manager       ← APIキー・DB接続情報
       │
       ├─── Cloud Logging        ← 全ログ収集
       │         │
       │         └─ Cloud Pub/Sub ─→ BigQuery（ログ蓄積）
       │
       ├──▶ Google Workspace Admin SDK API
       │         ユーザー・グループの追加・変更・削除
       │
       ├──▶ rakumo Profile API   ← プロファイルCSVアップロード
       │
       └──▶ rakumo Google同期API ← Google同期トリガー

【スケジューラ】
  Cloud Scheduler ──▶ Cloud Run（定期バッチ）

【ローカル環境】
  ファイルサーバー ← 他システム連携CSV（Cloud Storage経由でダウンロード）
```

### 3.2 データフロー

#### ユーザー・グループ登録フロー（CSVアップロード：一括処理）
```
AppSheet（CSVアップロードUI）
    │ Webhook POST（CSVファイル）
    ▼
Cloud Run（/api/users/import・/api/groups/import・/api/groups/members/import）
    → Cloud SQL（DB更新）
    → Google Workspace API（GWS反映）
    → rakumo Profile API（コンタクト更新、ユーザーインポート時）
    → Cloud Storage（CSVファイル保管）
    → Cloud Logging（ログ記録）
```

#### ユーザー・グループ登録フロー（AppSheet個別操作：都度処理）
```
AppSheet フォーム操作（追加・変更・削除）
    │ AppSheet Automation（Webhook POST with JSON）
    ▼
Cloud Run（/api/users・/api/groups・/api/groups/{email}/members）
    → Cloud SQL（DB更新）
    → Google Workspace API（GWS反映）
    → rakumo Profile API（コンタクト更新、ユーザー変更時）
    → Cloud Logging（ログ記録）
```

> CSVアップロードとAppSheet個別操作はどちらも同じCloud SQLおよびGWS反映処理を経由する。個別操作時はCSVファイルの保管は行わない。

#### 他システム連携CSVフロー
```
Cloud Run → Cloud SQL（データ取得）
          → Cloud Storage（CSV生成・保管）
          → ローカルクライアント（CSVダウンロード）
          → ファイルサーバー（格納）
```

---

## 4. Cloud Run設計

### 4.1 サービス構成

| サービス名 | 用途 |
|----------|------|
| `user-mgmt-api` | 全機能を提供するAPIサービス |

> バッチ処理・API処理を1サービスに集約。処理ごとにエンドポイントを分けて管理する。

### 4.2 リソース設定

| 項目 | 設定値 | 理由 |
|------|--------|------|
| リージョン | `asia-northeast1` | 東京リージョン |
| CPU | 2 vCPU | 数万件バッチ処理に対応 |
| メモリ | 2 GiB | 大量CSVのメモリ展開に対応 |
| タイムアウト | 3,600 秒（最大） | 数万件一括処理の完走に対応 |
| 最大同時リクエスト数（concurrency） | 10 | DB接続数・外部API制限を考慮 |
| 最小インスタンス数 | 0（コールドスタート許容） |  |
| 最大インスタンス数 | 5 | 同時実行制御・コスト管理 |
| 認証 | 要認証（Invoke権限を制限） | 外部からの直接アクセスを禁止 |

### 4.3 環境変数・設定

実行時環境変数は以下の方針で管理する。

| 変数名 | 管理方法 | 内容 |
|--------|---------|------|
| `DB_HOST` | Secret Manager | Cloud SQL 接続ホスト |
| `DB_NAME` | 環境変数 | データベース名 |
| `DB_USER` | Secret Manager | DBユーザー名 |
| `DB_PASSWORD` | Secret Manager | DBパスワード |
| `RAKUMO_API_KEY` | Secret Manager | rakumo APIキー |
| `RAKUMO_SECRET_KEY` | Secret Manager | rakumo 秘密鍵 |
| `GCS_BUCKET_INPUT` | 環境変数 | 入力CSVバケット名 |
| `GCS_BUCKET_OUTPUT` | 環境変数 | 出力CSVバケット名 |
| `GCS_BUCKET_RAKUMO` | 環境変数 | rakumoプロファイルバケット名 |
| `ENV` | 環境変数 | `production` / `development` |

### 4.4 Cloud SQL接続方式

Cloud Run から Cloud SQL への接続は **Cloud SQL Auth Proxy（サイドカー方式）** を使用する。

```
Cloud Run コンテナ
  ├── アプリコンテナ（user-mgmt-api）
  └── Cloud SQL Auth Proxy サイドカー
           │ Unix ソケット / TCP 127.0.0.1:3306
           ▼
       Cloud SQL（MySQL）
```

- 接続名：`{PROJECT_ID}:asia-northeast1:{INSTANCE_NAME}`
- 接続方式：Unix ドメインソケット（推奨）

### 4.5 コンテナ設計

| 項目 | 内容 |
|------|------|
| ベースイメージ | `python:3.12-slim` |
| フレームワーク | FastAPI |
| ASGIサーバー | Uvicorn |
| コンテナレジストリ | Artifact Registry（`asia-northeast1-docker.pkg.dev`） |
| イメージタグ | `{環境}-{GitCommitHash}` |

---

## 5. Cloud SQL設計

### 5.1 インスタンス設定

| 項目 | 設定値 |
|------|--------|
| データベースエンジン | MySQL 8.0 |
| インスタンスタイプ | `db-n1-standard-2`（vCPU:2 / RAM:7.5GB） |
| ストレージ種別 | SSD |
| ストレージ容量 | 50 GB（自動増量有効） |
| バックアップ | 自動バックアップ有効（保持期間：7日） |
| リージョン | `asia-northeast1` |
| 可用性 | シングルゾーン（冗長構成なしの要件に従う） |
| メンテナンスウィンドウ | 日曜 深夜帯 |

### 5.2 接続設定

| 項目 | 設定値 |
|------|--------|
| 接続方式 | Cloud SQL Auth Proxy（プライベートIP） |
| 最大接続数 | 100（Cloud Run max-instances × concurrency を考慮） |
| 文字コード | `utf8mb4` |
| 照合順序 | `utf8mb4_unicode_ci` |

### 5.3 データベース構成

| データベース名 | 用途 |
|-------------|------|
| `user_mgmt` | 本番用 |
| `user_mgmt_dev` | 検証用（同インスタンス内） |

### 5.4 テーブル設計

#### 5.4.1 usersテーブル（ユーザーマスタ）

```sql
CREATE TABLE users (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    user_id         CHAR(7)         NOT NULL COMMENT 'ユーザーID（A100000形式。システム自動採番）',
    email           VARCHAR(255)    NOT NULL COMMENT 'Google Workspaceメールアドレス（主キー相当）',
    family_name     VARCHAR(100)    NOT NULL COMMENT '姓',
    given_name      VARCHAR(100)    NOT NULL COMMENT '名',
    family_name_yomi VARCHAR(100)   COMMENT '姓よみ',
    given_name_yomi  VARCHAR(100)   COMMENT '名よみ',
    company         VARCHAR(255)    COMMENT '会社名',
    company_yomi    VARCHAR(255)    COMMENT '会社名よみ',
    employee_number VARCHAR(50)     COMMENT '社員番号',
    job_title       VARCHAR(100)    COMMENT '役職',
    business_phone  VARCHAR(50)     COMMENT '会社電話番号',
    extension       VARCHAR(50)     COMMENT '内線番号',
    mobile_phone    VARCHAR(50)     COMMENT '携帯電話番号',
    fax             VARCHAR(50)     COMMENT 'FAX番号',
    business_address VARCHAR(500)   COMMENT '会社住所',
    birthday        DATE            COMMENT '生年月日',
    email2          VARCHAR(255)    COMMENT 'メールアドレス2',
    email3          VARCHAR(255)    COMMENT 'メールアドレス3',
    primary_flag    TINYINT(1)      NOT NULL DEFAULT 0 COMMENT 'プライマリフラグ（1：優先）',
    display_flag    TINYINT(1)      NOT NULL DEFAULT 1 COMMENT '表示フラグ（1：表示）',
    calendar_enabled   TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'カレンダー有効（1：有効）',
    contacts_enabled   TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'コンタクト有効（1：有効）',
    workflow_enabled   TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'ワークフロー有効（1：有効）',
    board_enabled      TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'ボード有効（1：有効）',
    expense_enabled    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '経費有効（1：有効）',
    attendance_enabled TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '勤怠有効（1：有効）',
    notes           VARCHAR(256)    COMMENT '備考（カスタム項目）',
    primary_org_name      VARCHAR(255) COMMENT '主務組織名',
    primary_org_email     VARCHAR(255) COMMENT '主務組織メールアドレス',
    concurrent_org1_name  VARCHAR(255) COMMENT '兼務組織名1',
    concurrent_org1_email VARCHAR(255) COMMENT '兼務組織メールアドレス1',
    concurrent_org1_job_title VARCHAR(255) COMMENT '兼務組織役職1',
    concurrent_org2_name  VARCHAR(255) COMMENT '兼務組織名2',
    concurrent_org2_email VARCHAR(255) COMMENT '兼務組織メールアドレス2',
    concurrent_org2_job_title VARCHAR(255) COMMENT '兼務組織役職2',
    concurrent_org3_name  VARCHAR(255) COMMENT '兼務組織名3',
    concurrent_org3_email VARCHAR(255) COMMENT '兼務組織メールアドレス3',
    concurrent_org3_job_title VARCHAR(255) COMMENT '兼務組織役職3',
    concurrent_org4_name  VARCHAR(255) COMMENT '兼務組織名4',
    concurrent_org4_email VARCHAR(255) COMMENT '兼務組織メールアドレス4',
    concurrent_org4_job_title VARCHAR(255) COMMENT '兼務組織役職4',
    concurrent_org5_name  VARCHAR(255) COMMENT '兼務組織名5',
    concurrent_org5_email VARCHAR(255) COMMENT '兼務組織メールアドレス5',
    concurrent_org5_job_title VARCHAR(255) COMMENT '兼務組織役職5',
    concurrent_org6_name  VARCHAR(255) COMMENT '兼務組織名6',
    concurrent_org6_email VARCHAR(255) COMMENT '兼務組織メールアドレス6',
    concurrent_org6_job_title VARCHAR(255) COMMENT '兼務組織役職6',
    concurrent_org7_name  VARCHAR(255) COMMENT '兼務組織名7',
    concurrent_org7_email VARCHAR(255) COMMENT '兼務組織メールアドレス7',
    concurrent_org7_job_title VARCHAR(255) COMMENT '兼務組織役職7',
    concurrent_org8_name  VARCHAR(255) COMMENT '兼務組織名8',
    concurrent_org8_email VARCHAR(255) COMMENT '兼務組織メールアドレス8',
    concurrent_org8_job_title VARCHAR(255) COMMENT '兼務組織役職8',
    concurrent_org9_name  VARCHAR(255) COMMENT '兼務組織名9',
    concurrent_org9_email VARCHAR(255) COMMENT '兼務組織メールアドレス9',
    concurrent_org9_job_title VARCHAR(255) COMMENT '兼務組織役職9',
    concurrent_org10_name  VARCHAR(255) COMMENT '兼務組織名10',
    concurrent_org10_email VARCHAR(255) COMMENT '兼務組織メールアドレス10',
    concurrent_org10_job_title VARCHAR(255) COMMENT '兼務組織役職10',
    status          ENUM('active','inactive','deleted') NOT NULL DEFAULT 'active',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at      DATETIME        COMMENT '論理削除日時',
    PRIMARY KEY (id),
    UNIQUE KEY uq_user_id (user_id),
    UNIQUE KEY uq_email (email),
    KEY idx_status (status),
    KEY idx_employee_number (employee_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='ユーザーマスタ';
```

#### 5.4.2 groupsテーブル（グループマスタ）

```sql
CREATE TABLE groups (
    id          BIGINT          NOT NULL AUTO_INCREMENT,
    group_id    CHAR(7)         NOT NULL COMMENT 'グループID（G100000形式。システム自動採番）',
    group_name  VARCHAR(255)    NOT NULL COMMENT 'グループ表示名',
    email       VARCHAR(255)    NOT NULL COMMENT 'グループメールアドレス',
    description VARCHAR(4096)   COMMENT 'グループの説明（GWSアカウント情報出力項目 確定3/26）',
    group_type  ENUM('drive','mailing','rakumo','other') NOT NULL DEFAULT 'other'
                COMMENT 'グループ種別（プレフィックスから判定）。初期更新対象はdrive・rakumoの2種別。mailingは例示扱い',
    status      ENUM('active','deleted') NOT NULL DEFAULT 'active',
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at  DATETIME        COMMENT '論理削除日時',
    PRIMARY KEY (id),
    UNIQUE KEY uq_group_id (group_id),
    UNIQUE KEY uq_email (email),
    KEY idx_group_type (group_type),
    KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='グループマスタ';
```

> **Googleグループ設定項目（whoCanJoin / whoCanPostMessage / includeInGlobalAddressList 等）** はグループ種別（`group_type`）に応じたデフォルト値をアプリケーション層で固定保持する。DBへの個別格納は行わず、グループ作成・変更時に `group_type` から導出して GWS Groups Settings API に設定する。詳細はプログラム設計書 6.2節を参照。

#### 5.4.3 group_membersテーブル（グループメンバー）

```sql
CREATE TABLE group_members (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    group_email  VARCHAR(255) NOT NULL COMMENT 'グループメールアドレス',
    member_email VARCHAR(255) NOT NULL COMMENT 'メンバーメールアドレス',
    status       ENUM('active','deleted') NOT NULL DEFAULT 'active',
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_group_member (group_email, member_email),
    KEY idx_group_email (group_email),
    KEY idx_member_email (member_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='グループメンバー';
```

#### 5.4.4 operation_logsテーブル（操作ログ）

```sql
CREATE TABLE operation_logs (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    operation_type VARCHAR(50)  NOT NULL COMMENT '操作種別（user_import / user_create / user_update / user_delete / group_import / group_create / group_update / group_delete / member_import / member_add / member_remove）',
    change_type    ENUM('add','update','delete') NOT NULL COMMENT '変更種別',
    target_email   VARCHAR(255) COMMENT '対象メールアドレス',
    status         ENUM('success','error') NOT NULL,
    error_message  TEXT         COMMENT 'エラーメッセージ',
    executed_by    VARCHAR(255) COMMENT '実行ユーザー',
    executed_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_operation_type (operation_type),
    KEY idx_executed_at (executed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作ログ';
```

#### 5.4.5 sync_logsテーブル（同期実行ログ）

```sql
CREATE TABLE sync_logs (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    sync_type     ENUM('google_sync','rakumo_contact') NOT NULL COMMENT '同期種別',
    status        ENUM('running','success','error') NOT NULL,
    started_by    VARCHAR(255) COMMENT '実行ユーザー',
    started_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at   DATETIME     COMMENT '完了日時',
    error_message TEXT         COMMENT 'エラーメッセージ',
    PRIMARY KEY (id),
    KEY idx_sync_type (sync_type),
    KEY idx_started_at (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='同期実行ログ';
```

#### 5.4.6 csv_download_logsテーブル（CSVダウンロードログ）

```sql
CREATE TABLE csv_download_logs (
    id            BIGINT        NOT NULL AUTO_INCREMENT,
    download_type VARCHAR(50)   NOT NULL COMMENT 'ダウンロード種別',
    file_name     VARCHAR(255)  NOT NULL COMMENT 'ファイル名',
    record_count  INT           COMMENT 'レコード件数',
    executed_by   VARCHAR(255)  COMMENT '実行ユーザー',
    executed_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_executed_at (executed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='CSVダウンロードログ';
```

#### 5.4.7 settingsテーブル（システム設定）

```sql
CREATE TABLE settings (
    setting_key   VARCHAR(100)  NOT NULL COMMENT '設定キー',
    setting_value VARCHAR(255)  NOT NULL COMMENT '設定値',
    description   VARCHAR(500)  COMMENT '設定の説明',
    updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='システム設定';
```

**初期データ：**

| setting_key | setting_value | description |
|-------------|---------------|-------------|
| `success_log_retention_days` | `90` | 成功ログの保存日数（0で無期限） |
| `failure_log_retention_days` | `365` | 失敗ログの保存日数（0で無期限） |
| `csv_file_retention_days` | `30` | CSVファイルの保持日数 |

> AppSheet画面から管理者が保存期間を変更できる。コードの変更なしに設定変更が反映される（要件定義書 13.2節）。

### 5.5 インデックス設計方針

- メールアドレスカラムには `UNIQUE KEY` または `KEY` を設定（検索・結合の高速化）
- ログテーブルの `executed_at` / `started_at` には `KEY` を設定（期間検索に対応）
- 数万件規模を想定し、主要な検索カラムにインデックスを付与

---

## 6. Cloud Storage設計

### 6.1 バケット構成

| バケット名（案） | 用途 | アクセス主体 |
|--------------|------|------------|
| `{PROJECT_ID}-csv-input` | ユーザー・グループCSVのアップロード受け取り | Cloud Run |
| `{PROJECT_ID}-csv-output` | 他システム連携CSV・ダウンロード用CSV | Cloud Run、ローカルクライアント |
| `{PROJECT_ID}-rakumo-profiles` | rakumoプロファイルCSV（アップロード前の一時保管） | Cloud Run |

### 6.2 バケット設定

| 項目 | 設定値 |
|------|--------|
| ロケーション | `asia-northeast1` |
| ストレージクラス | Standard |
| 公開アクセス | 禁止（Uniform bucket-level access） |
| バージョニング | 無効 |
| ライフサイクル | settingsテーブルのCSVファイル保持期間に従い、Cloud Runローテーションジョブで削除（デフォルト30日） |

### 6.3 ファイル命名規則

| バケット | ファイルパス例 | 説明 |
|---------|--------------|------|
| csv-input | `users/{YYYYMMDD_HHMMSS}_users.csv` | ユーザーインポートCSV |
| csv-input | `groups/{YYYYMMDD_HHMMSS}_groups.csv` | グループインポートCSV |
| csv-input | `members/{YYYYMMDD_HHMMSS}_members.csv` | グループメンバーCSV |
| csv-output | `export/{YYYYMMDD_HHMMSS}_other_system.csv` | 他システム連携CSV |
| rakumo-profiles | `profiles/{YYYYMMDD_HHMMSS}_profiles.csv` | rakumoプロファイルCSV |

---

## 7. ログ基盤設計

### 7.1 ログパイプライン

```
Cloud Run（アプリログ出力）
      │
      ▼
Cloud Logging（収集・保管・アラート）
      │  Log Sink
      ▼
Cloud Pub/Sub（トピック: user-mgmt-logs）
      │  サブスクリプション
      ▼
BigQuery（データセット: user_mgmt_logs）
      └── テーブル: app_logs（日付パーティション）
```

### 7.2 Cloud Logging設定

| 項目 | 設定値 |
|------|--------|
| ログ保持期間 | 30日（デフォルト） |
| アラートポリシー | ERRORログ発生時にメール通知 |
| 通知先 | お客様指定のメールアドレス |

**アラート条件：**

| アラート名 | 条件 |
|----------|------|
| DB接続エラー | `severity=ERROR` かつ `DB connection` を含む |
| Google Workspace APIエラー | `severity=ERROR` かつ `GWS API` を含む |
| rakumo APIエラー | `severity=ERROR` かつ `rakumo API` を含む |
| バッチ処理失敗 | `severity=CRITICAL` |

### 7.3 BigQueryテーブル設計

**データセット：** `user_mgmt_logs`

```sql
-- app_logsテーブル（日付パーティション）
timestamp     TIMESTAMP  -- ログ発生日時
severity      STRING     -- DEBUG / INFO / WARNING / ERROR / CRITICAL
service       STRING     -- Cloud Runサービス名
message       STRING     -- ログメッセージ
operation     STRING     -- 操作種別
user_email    STRING     -- 実行ユーザー
target_email  STRING     -- 対象リソース
status        STRING     -- success / error
error_detail  STRING     -- エラー詳細
```

- パーティション：`timestamp`（日別）
- 保持期間：365日

---

## 8. セキュリティ設計

### 8.1 サービスアカウント

| サービスアカウント名 | 用途 | 付与するロール |
|------------------|------|-------------|
| `user-mgmt-run-sa` | Cloud Runサービス実行用 | Cloud SQL Client、Storage Object Admin、Secret Manager Secret Accessor、Logging Log Writer、Pub/Sub Publisher |
| `user-mgmt-scheduler-sa` | Cloud Scheduler実行用 | Cloud Run Invoker |
| `appsheet-sa` | Appsheet → Cloud Run呼び出し用 | Cloud Run Invoker |

### 8.2 Secret Manager管理項目

| シークレット名 | 内容 | ローテーション |
|-------------|------|-------------|
| `rakumo-api-key` | rakumo APIキー | 手動（変更時） |
| `rakumo-secret-key` | rakumo API秘密鍵 | 手動（変更時） |
| `db-password` | Cloud SQL DBパスワード | 手動（定期変更推奨） |
| `db-user` | Cloud SQL DBユーザー名 | 手動 |

### 8.3 ネットワーク設計

| 項目 | 設定 |
|------|------|
| Cloud Run の外部アクセス | 要認証（Authenticated のみ）|
| Cloud SQL | プライベートIPのみ（パブリックIP無効化推奨） |
| Cloud SQL への接続 | Cloud SQL Auth Proxy 経由 |
| Cloud Storage | パブリックアクセス禁止、バケットレベルアクセス制御 |

### 8.4 Google Workspace Admin SDK 権限

Cloud Run サービスアカウントに以下のドメイン全体の委任（Domain-wide Delegation）を付与する。

| スコープ | 用途 |
|---------|------|
| `https://www.googleapis.com/auth/admin.directory.user` | ユーザー管理 |
| `https://www.googleapis.com/auth/admin.directory.group` | グループ管理 |
| `https://www.googleapis.com/auth/admin.directory.group.member` | グループメンバー管理 |

> ドメイン全体の委任設定はお客様のGoogle Workspace管理者が実施する。

---

## 9. スケジューラ設計

### 9.1 Cloud Schedulerジョブ

要件定義書 4.8「定期実行・予約実行機能」に対応する。

| ジョブ名 | スケジュール（cron） | 実行内容 | タイムゾーン |
|---------|-------------------|---------|------------|
| `google-sync-daily` | `0 {H} * * *`（毎日指定時刻） | Google同期の自動実行 | Asia/Tokyo |
| `rakumo-contact-daily` | `30 {H} * * *`（Google同期の30分後） | rakumoコンタクト更新 | Asia/Tokyo |
| `log-rotation-daily` | `0 3 * * *`（毎日03:00 JST） | ログローテーション（settingsテーブルの保存期間に基づき、期限超過したログレコードおよびCSVファイルを削除） | Asia/Tokyo |

> 実行時刻（`{H}`）はAppSheetのスケジュール設定画面から1時間単位で変更可能。変更時はCloud Run経由でCloud Scheduler APIのcronを更新する（`PUT /api/scheduler/google-sync` 参照）。

**スケジュール動的変更の仕組み：**

```
ユーザーが AppSheet スケジュール設定画面で時刻を入力
      │ Webhook POST
      ▼
Cloud Run /api/scheduler/google-sync
      │ Cloud Scheduler API 呼び出し
      ▼
Cloud Scheduler ジョブのcron更新（google-sync-daily / rakumo-contact-daily）
```

### 9.2 スケジューラからCloud Runへの呼び出し

```
Cloud Scheduler
    │ HTTP POST（OIDC認証トークン付き）
    ▼
Cloud Run /api/batch/google-sync
Cloud Run /api/batch/rakumo-contact
```

- 認証方式：OIDC（`user-mgmt-scheduler-sa` のサービスアカウントトークン）
- タイムアウト：最大3,600秒（Cloud Schedulerのデフォルトは3分のため要設定）

---

## 10. API設計

### 10.1 エンドポイント一覧

Cloud Run（`user-mgmt-api`）が提供するHTTPエンドポイント。
全エンドポイントはGoogle IAM認証（OIDC）によるアクセス制御を行う。

| メソッド | パス | 機能 | 入力元 | 対応要件 |
|---------|------|------|--------|---------|
| **ユーザー管理** | | | | |
| POST | `/api/users/import` | ユーザーCSVインポート（GWS反映・DB更新） | CSV一括 | 4.2 |
| GET | `/api/users/export` | ユーザーCSVエクスポート（Cloud Storage保存） | - | 4.2 |
| POST | `/api/users` | ユーザー個別作成（AppSheet入力→GWS即時反映） | AppSheet | 4.2 |
| PATCH | `/api/users/{email}` | ユーザー個別更新（AppSheet入力→GWS即時反映） | AppSheet | 4.2 |
| DELETE | `/api/users/{email}` | ユーザー個別削除（AppSheet操作→GWS即時反映） | AppSheet | 4.2 |
| **グループ管理** | | | | |
| POST | `/api/groups/import` | グループCSVインポート | CSV一括 | 4.3 |
| GET | `/api/groups/export` | グループCSVエクスポート | - | 4.3 |
| POST | `/api/groups` | グループ個別作成（AppSheet入力→GWS即時反映） | AppSheet | 4.3 |
| PATCH | `/api/groups/{email}` | グループ個別更新（AppSheet入力→GWS即時反映） | AppSheet | 4.3 |
| DELETE | `/api/groups/{email}` | グループ個別削除（AppSheet操作→GWS即時反映） | AppSheet | 4.3 |
| **グループメンバー管理** | | | | |
| POST | `/api/groups/members/import` | グループメンバーCSVインポート | CSV一括 | 4.3 |
| GET | `/api/groups/members/export` | グループメンバーCSVエクスポート | - | 4.3 |
| POST | `/api/groups/{email}/members` | グループメンバー個別追加（AppSheet操作→GWS即時反映） | AppSheet | 4.3 |
| DELETE | `/api/groups/{email}/members/{member_email}` | グループメンバー個別削除（AppSheet操作→GWS即時反映） | AppSheet | 4.3 |
| **その他** | | | | |
| POST | `/api/google-sync` | Google同期実行（rakumo Google同期API呼び出し） | AppSheet | 4.4 |
| GET | `/api/google-sync/status` | Google同期実行状況確認 | - | 4.4 |
| POST | `/api/rakumo/contacts/update` | rakumoコンタクト更新（Profile APIアップロード） | AppSheet | 4.5 |
| GET | `/api/csv/download` | 他システム連携CSVダウンロード | - | 4.7 |
| GET | `/api/logs` | 操作ログ・同期ログ取得 | - | 4.1 |
| POST | `/api/batch/google-sync` | Google同期バッチ（Scheduler用） | Scheduler | 9.1 |
| POST | `/api/batch/rakumo-contact` | rakumoコンタクト更新バッチ（Scheduler用） | Scheduler | 9.1 |
| POST | `/api/batch/log-rotation` | ログローテーション実行（settingsに基づきログ・CSVファイル削除） | Scheduler | 13.2 |
| PUT | `/api/scheduler/google-sync` | Google同期定期実行スケジュールの時刻更新 | AppSheet | 9.1 |
| GET | `/health` | ヘルスチェック | - | - |

### 10.2 共通レスポンス形式

```json
// 成功時
{
  "status": "success",
  "data": { ... },
  "message": ""
}

// エラー時
{
  "status": "error",
  "data": null,
  "message": "エラーメッセージ",
  "error_code": "ERROR_CODE"
}
```

### 10.3 主要エンドポイント詳細

#### POST `/api/users/import`

| 項目 | 内容 |
|------|------|
| 処理概要 | ユーザーCSVを受け取り、Cloud SQLとGoogle Workspaceに反映する |
| リクエスト | `multipart/form-data`、`file`：CSVファイル |
| 処理順序 | ①CSVバリデーション → ②Cloud SQL更新（トランザクション） → ③GWS Admin SDK呼び出し → ④ログ記録 |
| GWSエラー時 | Cloud SQL更新はロールバックせず、エラーログを記録して再実行可能とする |
| DB更新エラー時 | トランザクションロールバック |
| レスポンス | 処理件数（成功/エラー件数） |

#### GET `/api/users/export`

| 項目 | 内容 |
|------|------|
| 処理概要 | Googleアカウント情報出力項目（確定 3/26）に基づくCSVを生成してCloud Storageに保存する |
| 出力フィールド（計20項目） | UserID / primaryEmail / password / isAdmin / suspended / changePasswordAtNextLogin / First Name / Last Name / name / aliases[] / isMailboxSetup / suspensionReason / creationTime / includeInGlobalAddressList / deletionTime / isEnrolledIn2Sv / isEnforcedIn2Sv / orgUnitPath / recoveryEmail / recoveryPhone |
| フィールド取得元 | DB管理項目（email・family_name等）はCloud SQLから取得。出力専用項目（isAdmin・isMailboxSetup・suspensionReason・creationTime・deletionTime・isEnrolledIn2Sv・isEnforcedIn2Sv）はGWS Admin SDK `users.get` で取得 |
| 処理順序 | ①Cloud SQLから全ユーザー取得 → ②GWS Admin SDKで出力専用フィールドを一括取得 → ③CSVマージ生成 → ④Cloud Storageに保存 → ⑤署名付きURL発行 |

#### GET `/api/groups/export`

| 項目 | 内容 |
|------|------|
| 処理概要 | Googleグループ情報出力項目（確定 3/26）に基づくCSVを生成してCloud Storageに保存する |
| 出力フィールド（計19項目） | GroupID / email / name / description / whoCanJoin / whoCanViewMembership / whoCanViewGroup / whoCanPostMessage / allowWebPosting / isArchived / membersCanPostAsTheGroup / includeInGlobalAddressList / whoCanLeaveGroup / whoCanModerateMembers / whoCanModerateContent / whoCanAssistContent / enableCollaborativeInbox / whoCanDiscoverGroup / defaultSender |
| フィールド取得元 | GroupID・email・name・descriptionはCloud SQLから取得。GWS設定項目（whoCanJoin等）はgroup_typeに応じたデフォルト値を適用（プログラム設計書 6.2節参照） |
| 処理順序 | ①Cloud SQLから全グループ取得 → ②group_typeからGWS設定値を導出 → ③CSV生成 → ④Cloud Storageに保存 → ⑤署名付きURL発行 |

#### POST `/api/users`（個別ユーザー作成）

| 項目 | 内容 |
|------|------|
| 処理概要 | AppSheetフォームからのユーザー個別作成。Cloud SQLへ登録しGWSアカウントを即時作成する |
| リクエスト | `application/json`。ユーザーマスタ全項目（email・family_name等）をJSONで受け取る |
| 処理順序 | ①Pydanticバリデーション → ②Cloud SQL INSERT（トランザクション） → ③GWS `users.insert` → ④rakumoコンタクト更新 → ⑤スプレッドシート同期 → ⑥ログ記録 |
| GWSデフォルト | `changePasswordAtNextLogin: True`・`includeInGlobalAddressList: True` を適用（プログラム設計書 6.1節） |
| 冪等性 | 既存メールアドレスの場合はUPSERTとして処理（エラーにしない） |
| レスポンス | 作成したユーザー情報（email等） |

#### PATCH `/api/users/{email}`（個別ユーザー更新）

| 項目 | 内容 |
|------|------|
| 処理概要 | AppSheetフォームからのユーザー個別更新。差分フィールドのみCloud SQLを更新しGWSへ反映する |
| リクエスト | `application/json`。更新するフィールドのみを含むJSON（部分更新） |
| 処理順序 | ①Pydanticバリデーション → ②Cloud SQL UPDATE → ③GWS `users.update` → ④rakumoコンタクト更新 → ⑤スプレッドシート同期 → ⑥ログ記録 |
| エラー時 | 対象メールアドレスが存在しない場合は404を返す |
| レスポンス | 更新後のユーザー情報 |

#### DELETE `/api/users/{email}`（個別ユーザー削除）

| 項目 | 内容 |
|------|------|
| 処理概要 | AppSheetからのユーザー個別削除。Cloud SQLを論理削除しGWSアカウントを「停止」に変更する |
| リクエスト | パスパラメータ `{email}` のみ |
| 処理順序 | ①Cloud SQL 論理削除（status=deleted） → ②GWS `users.patch(suspended=True)` → ③rakumoコンタクト更新 → ④スプレッドシート同期 → ⑤ログ記録 |
| 冪等性 | 対象が存在しない場合は成功（スキップ）として処理 |
| 注意 | **物理削除（users.delete）は行わない。アカウントを停止状態にする** |
| レスポンス | 削除件数 |

#### POST `/api/groups`（個別グループ作成）

| 項目 | 内容 |
|------|------|
| 処理概要 | AppSheetフォームからのグループ個別作成。Cloud SQLへ登録しGWSグループを即時作成する |
| リクエスト | `application/json`。email・group_name・description・group_typeをJSONで受け取る |
| 処理順序 | ①Pydanticバリデーション → ②Cloud SQL INSERT → ③GWS `groups.insert` → ④Groups Settings API（group_typeに応じたデフォルト設定適用） → ⑤スプレッドシート同期 → ⑥ログ記録 |
| GWSデフォルト | group_typeに応じた `GWS_GROUP_DEFAULTS` を適用（プログラム設計書 6.2節） |
| 冪等性 | 既存メールアドレスの場合はUPSERTとして処理 |
| レスポンス | 作成したグループ情報 |

#### PATCH `/api/groups/{email}`（個別グループ更新）

| 項目 | 内容 |
|------|------|
| 処理概要 | AppSheetフォームからのグループ個別更新 |
| リクエスト | `application/json`。更新するフィールドのみを含むJSON（部分更新） |
| 処理順序 | ①Pydanticバリデーション → ②Cloud SQL UPDATE → ③GWS `groups.update` → ④スプレッドシート同期 → ⑤ログ記録 |
| レスポンス | 更新後のグループ情報 |

#### DELETE `/api/groups/{email}`（個別グループ削除）

| 項目 | 内容 |
|------|------|
| 処理概要 | AppSheetからのグループ個別削除。Cloud SQLを論理削除しGWSグループを削除する |
| 処理順序 | ①Cloud SQL 論理削除 → ②GWS `groups.delete` → ③スプレッドシート同期 → ④ログ記録 |
| 注意 | グループ削除前にグループメンバーも論理削除する |
| 冪等性 | 対象が存在しない場合は成功（スキップ）として処理 |

#### POST `/api/groups/{email}/members`（グループメンバー個別追加）

| 項目 | 内容 |
|------|------|
| 処理概要 | AppSheetからのグループメンバー個別追加 |
| リクエスト | `application/json`。`member_email` をJSONで受け取る |
| 処理順序 | ①Cloud SQL INSERT（group_members） → ②GWS `members.insert` → ③スプレッドシート同期 → ④ログ記録 |
| 冪等性 | 既存メンバーの場合はUPSERTとして処理 |

#### DELETE `/api/groups/{email}/members/{member_email}`（グループメンバー個別削除）

| 項目 | 内容 |
|------|------|
| 処理概要 | AppSheetからのグループメンバー個別削除 |
| 処理順序 | ①Cloud SQL 論理削除 → ②GWS `members.delete` → ③スプレッドシート同期 → ④ログ記録 |
| 冪等性 | 対象が存在しない場合は成功（スキップ）として処理 |

---

#### POST `/api/google-sync`

| 項目 | 内容 |
|------|------|
| 処理概要 | rakumo Google同期APIを呼び出してGoogle同期を実行する |
| 処理順序 | ①GETCURRENT で status 確認 → ②`waiting` であれば CREATE 実行 → ③selfLink でポーリング → ④GETLASTRESULT で結果取得 → ⑤sync_logsに記録 |
| `running`/`locked` 時 | 409エラーを返却（AppSheet側でリトライ） |
| タイムアウト | 最大3,600秒（Google同期の完了まで待機） |

#### POST `/api/rakumo/contacts/update`

| 項目 | 内容 |
|------|------|
| 処理概要 | Cloud SQLのデータからプロファイルCSVを生成してrakumo Profile APIにアップロードする |
| CSV生成仕様 | **1行1組織形式**。兼務組織がある場合は同一ユーザーの行を組織数分（主務1行＋兼務N行）生成する。`Department Email` / `Department` は行ごとに組織の値を設定し、その他の共通フィールドは全行に同一値を出力する（要件定義書 11.5.1節） |
| 処理順序 | ①Cloud SQLからデータ取得 → ②プロファイルCSV生成（1行1組織） → ③Cloud Storageに保存 → ④IMPORT LOCK確認 → ⑤CREATE URL → ⑥UPLOAD → ⑦sync_logsに記録 |
| ロック時 | 409エラーを返却 |

---

## 11. 環境設計

### 11.1 環境一覧

| 項目 | 本番環境 | 検証環境 |
|------|---------|---------|
| GCPプロジェクト | `toho-hd-user-mgmt-prod` | `toho-hd-user-mgmt-dev` |
| Cloud Run サービス名 | `user-mgmt-api` | `user-mgmt-api` |
| Cloud SQL インスタンス | `user-mgmt-prod` | `user-mgmt-dev` |
| DB名 | `user_mgmt` | `user_mgmt_dev` |
| Cloud Storage | `{prod-project}-csv-*` | `{dev-project}-csv-*` |
| Google Workspace連携 | 本番ドメイン | テスト用ドメイン（または本番の非本番OU） |
| rakumo連携 | 本番テナント | 検証テナント |

### 11.2 デプロイ方式

| 項目 | 内容 |
|------|------|
| コンテナビルド | Dockerfile によりビルド |
| コンテナ保管 | Artifact Registry |
| デプロイコマンド | `gcloud run deploy` |
| デプロイ方式 | ブルーグリーンデプロイ（Cloud Run の自動トラフィック切替） |

### 11.3 開発・検証の進め方

1. **検証環境**でのAPI動作確認・Google Workspace連携テスト
2. **rakumo APIのテスト実行**：CSV IMPORT UNLOCK API を活用してロック解除しながら検証
3. **数万件負荷テスト**：Cloud Run のタイムアウト・メモリ設定の検証
4. **本番環境**へのデプロイ（お客様確認後）

---

*以上*
