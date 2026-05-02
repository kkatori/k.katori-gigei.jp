# データベース設計書 ユーザー管理機能

| 項目 | 内容 |
|------|------|
| 作成日 | 2026年4月6日 |
| 作成者 | rakumo株式会社 |
| バージョン | 1.0 |
| 対象 | 東邦ホールディングス株式会社 |
| 関連文書 | 要件定義書 v2.1（5章・13.2節）、Google Cloud設計書（5章） |

---

## 目次

1. [概要](#1-概要)
2. [データベース基盤](#2-データベース基盤)
3. [論理データモデル](#3-論理データモデル)
4. [テーブル定義](#4-テーブル定義)
5. [インデックス設計](#5-インデックス設計)
6. [デ���タライフサイクル](#6-データライフサイクル)
7. [マイグレーション](#7-マイグレーション)
8. [データ量見積もり](#8-データ量見積もり)

---

## 1. 概要

### 1.1 目的

本書は、ユーザー管理機能のCloud SQL（MySQL 8.0）上に構築するデータベースの設計を定義する。Google Workspace のユーザー・グループ情報と rakumo プロファイル情報を統合管理し、AppSheet から操作可能なユーザーマスタを実現する。

### 1.2 設計方針

| 方針 | 内容 |
|------|------|
| 正規化 | マスタ系は第3正規形を基本とする。ただし兼務組織は組織数が最大10と有限のため、usersテーブル内にフラット展開する |
| 論理削除 | マスタ系テーブル（users, groups, group_members）は `status` + `deleted_at` による論理削除を採用。物理削除は行わない |
| 物理削除 | ログ系テーブル（operation_logs, sync_logs, csv_download_logs）はローテーションジョブによる物理削除を採用 |
| 文字コード | `utf8mb4`（日本語・絵文字対応） |
| タイムゾーン | DATETIME型でUTC保存。アプリケーション層でJST変換 |
| 監査カラム | 全テーブルに `created_at` / `updated_at` を付与 |
| ID体系 | ユーザーID（A100000形式）・グループID（G100000形式）はシステム自動採番。変更不可 |

---

## 2. データベース基盤

### 2.1 Cloud SQLインスタンス

| 項目 | 設定値 |
|------|--------|
| データベースエンジン | MySQL 8.0 |
| インスタンスタイプ | `db-n1-standard-2`（vCPU:2 / RAM:7.5GB） |
| ストレージ種別 | SSD |
| ストレージ���量 | 50 GB（自動増量有効） |
| バックアップ | 自動バックアップ有効（保持期間：7日） |
| リージョン | `asia-northeast1`（東京） |
| 可用性 | シングルゾーン |
| メンテナンスウィンドウ | 日曜 深夜帯 |

### 2.2 接続設定

| 項目 | 設定値 |
|------|--------|
| 接続方式 | Cloud SQL Auth Proxy（プライベートIP） |
| 最大接続数 | 100 |
| 文字コード | `utf8mb4` |
| 照合順序 | `utf8mb4_unicode_ci` |

### 2.3 データベース構成

| データベース名 | 用途 |
|-------------|------|
| `user_mgmt` | 本番用 |
| `user_mgmt_dev` | 検証用（同インスタンス内） |

---

## 3. 論理データモデル

### 3.1 テーブル一覧

| # | テーブル名 | 区分 | 概要 | 想定件数 |
|---|----------|------|------|---------|
| 1 | `users` | マスタ | ユーザー情報（GWSアカウント＋rakumoプロファイル＋会社情報を統合） | ~10,000 |
| 2 | `groups` | マスタ | グループ設定情報 | ~1,000 |
| 3 | `group_members` | マスタ | グループとメンバーの関連（多対多） | ~50,000 |
| 4 | `operation_logs` | ログ | アカウント・グループ操作の履歴 | 増加（ローテーション対象） |
| 5 | `sync_logs` | ログ | Google同期・rakumoコンタクト更新の履歴 | 増加（ローテーション対象） |
| 6 | `csv_download_logs` | ログ | CSVダウンロード操作の履歴 | 増加（ローテーション対象） |
| 7 | `settings` | 設定 | システム設定（ログ保存期間等） | ~10 |

### 3.2 ER図

```
                          ┌─────────────┐
                          │   settings   │
                          │─────────────│
                          │ setting_key  │PK
                          │ setting_value│
                          │ description  │
                          │ updated_at   │
                          └─────────────┘

┌──────────────────────────────────────────────────────────────┐
│                        users                                  │
│──────────────────────────────────────────────────────────────│
│ id                    │PK AUTO_INCREMENT                      │
│ user_id               │UQ (A100000形式)                       │
│ email                 │UQ (primaryEmail)                      │
│ family_name, given_name, ...(個人情報)                         │
│ job_title             │役職（主務組織）                         │
│ primary_flag, display_flag, ...(rakumoフラグ)                 │
│ primary_org_name, primary_org_email                           │
│ concurrent_org1-10_name, _email, _title                      │
│ status                │active / inactive / deleted             │
│ created_at, updated_at, deleted_at                            │
└────────────────┬─────────────────────────────────────────────┘
                 │ member_email
                 │
┌────────────────┴────────────────────────────────────────────┐
│                    group_members                              │
│─────────────────────────────────────────────────────────────│
│ id                    │PK AUTO_INCREMENT                      │
│ group_email           │FK → groups.email                      │
│ member_email          │FK → users.email                       │
│ status                │active / deleted                        │
│ created_at, updated_at│                                       │
│ UQ(group_email, member_email)                                 │
└────────────────┬────────────────────────────────────────────┘
                 │ group_email
                 │
┌────────────────┴────────────────────────────────────────────┐
│                       groups                                  │
│─────────────────────────────────────────────────────────────│
│ id                    │PK AUTO_INCREMENT                      │
│ group_id              │UQ (G100000形式)                       │
│ email                 │UQ (グループメールアドレス)               │
│ group_name            │グループ表示名                           │
│ description           │最大4,096文字                           │
│ group_type            │drive / mailing / rakumo / other        │
│ status                │active / deleted                        │
│ created_at, updated_at, deleted_at                            │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│  operation_logs   │  │    sync_logs      │  │  csv_download_logs    │
│──────────────────│  │──────────────────│  │──────────────────────│
│ id           PK  │  │ id           PK  │  │ id               PK  │
│ operation_type   │  │ sync_type        │  │ download_type        │
│ change_type      │  │ status           │  │ file_name            │
│ target_email     │  │ started_by       │  │ record_count         │
│ status           │  │ started_at       │  │ executed_by          │
│ error_message    │  │ finished_at      │  │ executed_at          │
│ executed_by      │  │ error_message    │  └──────────────────────┘
│ executed_at      │  └──────────────────┘
└──────────────────┘
```

### 3.3 テーブル間リレーション

| 参照元 | 参照先 | 結合キー | 関係 | 備考 |
|--------|--------|---------|------|------|
| `group_members` | `groups` | `group_email` = `groups.email` | N:1 | 1グループに複数メンバー |
| `group_members` | `users` | `member_email` = `users.email` | N:1 | 1ユーザーが複数グループに所属 |

> 外部キー制約はアプリケーション層で制御する（Cloud SQLの外部キー制約はバッチ処理のパフォーマンスに影響するため使用しない）。整合性はCloud Run側のトランザクション内で保証する。

---

## 4. テーブル定義

### 4.1 usersテーブル（ユーザーマスタ）

ユーザー情報を一元管理する。要件定義書の5テーブル（Googleアカウント、rakumoプロファイル、会社・個人情報）を物理的には1テーブルに統合し、AppSheet画面のセクション分割で論理的に分離表示する。

**カラム数：** 61（兼務組織10箇所×3フィールド＝30カラム含む）

```sql
CREATE TABLE users (
    -- システム管理
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    user_id         CHAR(7)         NOT NULL COMMENT 'ユーザーID（A100000形式。システム自動採番）',

    -- Googleアカウント情報（画面B セクション1）
    email           VARCHAR(255)    NOT NULL COMMENT 'Google Workspaceメールアドレス（主キー相当）',
    family_name     VARCHAR(100)    NOT NULL COMMENT '姓',
    given_name      VARCHAR(100)    NOT NULL COMMENT '名',

    -- 会社・個人情報（画面B セクション3）
    family_name_yomi VARCHAR(100)   COMMENT '姓よみ',
    given_name_yomi  VARCHAR(100)   COMMENT '名よみ',
    company         VARCHAR(255)    COMMENT '会社名',
    company_yomi    VARCHAR(255)    COMMENT '会社名よみ',
    employee_number VARCHAR(50)     COMMENT '社員番号',
    job_title       VARCHAR(100)    COMMENT '役職（主務組織）',
    business_phone  VARCHAR(50)     COMMENT '会社電話番号',
    extension       VARCHAR(50)     COMMENT '内線番号',
    mobile_phone    VARCHAR(50)     COMMENT '携帯電話番号',
    fax             VARCHAR(50)     COMMENT 'FAX番号',
    business_address VARCHAR(500)   COMMENT '会社住所',
    birthday        DATE            COMMENT '生年月日',
    email2          VARCHAR(255)    COMMENT 'メールアドレス2',
    email3          VARCHAR(255)    COMMENT 'メールアドレス3',

    -- rakumoプロファイル情報（画面B セクション2）
    primary_flag    TINYINT(1)      NOT NULL DEFAULT 0 COMMENT 'プライマリフラグ（1：優先）',
    display_flag    TINYINT(1)      NOT NULL DEFAULT 1 COMMENT '表示フラグ（1：表示）',
    calendar_enabled   TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'rakumo Calendar有効（1：有効）',
    contacts_enabled   TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'rakumo Contacts有効（1：有効）',
    workflow_enabled   TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'rakumo Workflow有効（1：有効）',
    board_enabled      TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'rakumo Board有効（1：有効）',
    expense_enabled    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'rakumo Expense有効（1：有効）',
    attendance_enabled TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'rakumo Attendance有効（1：有効）',
    notes           VARCHAR(256)    COMMENT '備考（rakumoカスタム項目）',

    -- 組織情報：主務組織
    primary_org_name      VARCHAR(255) COMMENT '主務組織名',
    primary_org_email     VARCHAR(255) COMMENT '主務組織メールアドレス',

    -- 組織情報：兼務組織（最大10箇所）
    concurrent_org1_name   VARCHAR(255) COMMENT '兼務組織名1',
    concurrent_org1_email  VARCHAR(255) COMMENT '兼務組織メールアドレス1',
    concurrent_org1_job_title VARCHAR(255) COMMENT '兼務組織役職1',
    concurrent_org2_name   VARCHAR(255) COMMENT '兼務組織名2',
    concurrent_org2_email  VARCHAR(255) COMMENT '兼務組織メールアドレス2',
    concurrent_org2_job_title VARCHAR(255) COMMENT '兼務組織役職2',
    concurrent_org3_name   VARCHAR(255) COMMENT '兼務組織名3',
    concurrent_org3_email  VARCHAR(255) COMMENT '兼務組織メールアドレス3',
    concurrent_org3_job_title VARCHAR(255) COMMENT '兼務組織役職3',
    concurrent_org4_name   VARCHAR(255) COMMENT '兼務組織名4',
    concurrent_org4_email  VARCHAR(255) COMMENT '兼務組織メールアドレス4',
    concurrent_org4_job_title VARCHAR(255) COMMENT '兼務組織役職4',
    concurrent_org5_name   VARCHAR(255) COMMENT '兼務組織名5',
    concurrent_org5_email  VARCHAR(255) COMMENT '兼務組織メールアドレス5',
    concurrent_org5_job_title VARCHAR(255) COMMENT '兼務組織役職5',
    concurrent_org6_name   VARCHAR(255) COMMENT '兼務組織名6',
    concurrent_org6_email  VARCHAR(255) COMMENT '兼務組織メールアドレス6',
    concurrent_org6_job_title VARCHAR(255) COMMENT '兼務組織役職6',
    concurrent_org7_name   VARCHAR(255) COMMENT '兼務組織名7',
    concurrent_org7_email  VARCHAR(255) COMMENT '兼務組織メールアドレス7',
    concurrent_org7_job_title VARCHAR(255) COMMENT '兼務組織役職7',
    concurrent_org8_name   VARCHAR(255) COMMENT '兼務組織名8',
    concurrent_org8_email  VARCHAR(255) COMMENT '兼務組織メールアドレス8',
    concurrent_org8_job_title VARCHAR(255) COMMENT '兼務組織役職8',
    concurrent_org9_name   VARCHAR(255) COMMENT '兼務組織名9',
    concurrent_org9_email  VARCHAR(255) COMMENT '兼務組織メールアドレス9',
    concurrent_org9_job_title VARCHAR(255) COMMENT '兼務組織役職9',
    concurrent_org10_name  VARCHAR(255) COMMENT '兼務組織名10',
    concurrent_org10_email VARCHAR(255) COMMENT '兼務組織メールアドレス10',
    concurrent_org10_job_title VARCHAR(255) COMMENT '兼務組織役職10',

    -- ステータス・監査
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

**カラム論理グループとAppSheet画面の対応：**

| 論理グループ | カラム | AppSheet画面 | 外部連携 |
|------------|--------|-------------|---------|
| システム管理 | id, user_id | 画面A（読取専用） | ― |
| Googleアカウント | email, family_name, given_name | 画面B セクション1 | GWS Admin SDK |
| 会社・個人情報 | family_name_yomi 〜 email3 | 画面B セクション3 | rakumo CSV出力 |
| rakumoプロファイル | primary_flag 〜 notes | 画面B セクション2 | rakumo CSV出力 |
| 主務組織 | primary_org_name, primary_org_email | 画面B セクション2 | rakumo CSV（1行目） |
| 兼務組織1〜10 | concurrent_org1-10_name/_email/_title | 画面B セクション2 | rakumo CSV（2〜11行目） |
| ステータス・監査 | status, created_at, updated_at, deleted_at | 画面A | ― |

> **設計判断：論理5テーブル→物理1テーブル**
> 要件定義書では5テーブル分離を定義しているが、物理的には `users` テーブル1つに統合する。理由は以下のとおり：
> - 全カラムが1ユーザーに対して1:1であり、結合コストを回避できる
> - AppSheet → Cloud Run → Cloud SQL の更新パスが1テーブルで完結し、トランザクション管理が容易
> - AppSheet画面のセクション分割で論理的な分離は実現される

---

### 4.2 groupsテーブル（グループマスタ）

Google Workspace グループの基本情報を管理する。グループ設定項目（whoCanJoin等の19属性）はグループ種別（`group_type`）から導出し、アプリケーション層で GWS Groups Settings API に設定するため、DBには格納しない。

```sql
CREATE TABLE groups (
    id          BIGINT          NOT NULL AUTO_INCREMENT,
    group_id    CHAR(7)         NOT NULL COMMENT 'グループID（G100000形式。システム自動採番）',
    group_name  VARCHAR(255)    NOT NULL COMMENT 'グループ表示名',
    email       VARCHAR(255)    NOT NULL COMMENT 'グループメールアドレス',
    description VARCHAR(4096)   COMMENT 'グループの説明（最大4,096文字）',
    group_type  ENUM('drive','mailing','rakumo','other') NOT NULL DEFAULT 'other'
                COMMENT 'グループ種別',
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

**グループ種別とGWS設定値の対応：**

| group_type | whoCanPostMessage | includeInGlobalAddressList | 用途 |
|------------|------------------|---------------------------|------|
| `rakumo` | NONE_CAN_POST | FALSE | rakumo組織階層表示用 |
| `drive` | ALL_IN_DOMAIN_CAN_POST | TRUE | Googleドライブ権限管理用 |
| `mailing` | ALL_IN_DOMAIN_CAN_POST | TRUE | メーリングリスト用 |
| `other` | ALL_IN_DOMAIN_CAN_POST | TRUE | その他 |

> 上記の設定値はプログラム設計書 6.2節でアプリケーション定数として管理する。

---

### 4.3 group_membersテーブル（グループメンバー）

グループとメンバー（ユーザー）の多対多の関連を管理する。

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

---

### 4.4 operation_logsテーブル（操作ログ）

ユーザー・グループ・グループメンバーの追加・変更・削除操作を記録する。

```sql
CREATE TABLE operation_logs (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    operation_type VARCHAR(50)  NOT NULL COMMENT '操作種別',
    change_type    ENUM('add','update','delete') NOT NULL COMMENT '変更種別',
    target_email   VARCHAR(255) COMMENT '対象メールアドレス',
    status         ENUM('success','error') NOT NULL,
    error_message  TEXT         COMMENT 'エラーメッセージ',
    executed_by    VARCHAR(255) COMMENT '実行ユーザー',
    executed_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_operation_type (operation_type),
    KEY idx_executed_at (executed_at),
    KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作ログ';
```

**operation_type の取りうる値：**

| operation_type | 説明 | 入力元 |
|---------------|------|--------|
| `user_import` | ユーザーCSV一括登録 | CSV |
| `user_create` | ユーザー個別作成 | AppSheet |
| `user_update` | ユーザー個別更新 | AppSheet |
| `user_delete` | ユーザー個別削除 | AppSheet |
| `group_import` | グループCSV一括登録 | CSV |
| `group_create` | グループ個別作成 | AppSheet |
| `group_update` | グループ個別更新 | AppSheet |
| `group_delete` | グループ個別削除 | AppSheet |
| `member_import` | グループメンバーCSV一括登録 | CSV |
| `member_add` | グループメンバー個別追加 | AppSheet |
| `member_remove` | グループメンバー個別削除 | AppSheet |

---

### 4.5 sync_logsテーブル（同期実行ログ）

Google同期およびrakumoコンタクト更新の実行履歴を記録する。

```sql
CREATE TABLE sync_logs (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    sync_type     ENUM('google_sync','rakumo_contact','log_rotation') NOT NULL COMMENT '同期種別',
    status        ENUM('running','success','error') NOT NULL,
    started_by    VARCHAR(255) COMMENT '実行ユーザー（スケジューラの場合はsystem）',
    started_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at   DATETIME     COMMENT '完了日時',
    error_message TEXT         COMMENT 'エラーメッセージ',

    PRIMARY KEY (id),
    KEY idx_sync_type (sync_type),
    KEY idx_started_at (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='同期実行ログ';
```

**sync_type の取りうる値：**

| sync_type | 説明 | トリガー |
|-----------|------|---------|
| `google_sync` | rakumo Google同期実行 | AppSheet手動 / Cloud Scheduler |
| `rakumo_contact` | rakumoコンタクト更新 | AppSheet手動 / Cloud Scheduler |
| `log_rotation` | ログローテーション実行 | Cloud Scheduler（毎日03:00 JST） |

---

### 4.6 csv_download_logsテーブル（CSVダウンロードログ）

CSVエクスポート・ダウンロード操作を記録する。

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

---

### 4.7 settingsテーブル（システム設定）

管理者がAppSheet画面から変更可能なシステム設定を格納する。コードの変更なしに設定変更が反映される。

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

```sql
INSERT INTO settings (setting_key, setting_value, description) VALUES
('success_log_retention_days', '90',  '成功ログの保存日数（0で無期限）'),
('failure_log_retention_days', '365', '失敗ログの保存日数（0で無期限）'),
('csv_file_retention_days',    '30',  'CSVファイルの保持日数');
```

---

## 5. インデックス設計

### 5.1 インデックス一覧

| テーブル | インデックス名 | 種類 | カラム | 用途 |
|---------|--------------|------|--------|------|
| `users` | `PRIMARY` | PK | `id` | サロゲートキー |
| `users` | `uq_user_id` | UNIQUE | `user_id` | ユーザーID検索 |
| `users` | `uq_email` | UNIQUE | `email` | メールアドレス検索・結合キー |
| `users` | `idx_status` | KEY | `status` | ステータスフィルタ |
| `users` | `idx_employee_number` | KEY | `employee_number` | 社員番号検索 |
| `groups` | `PRIMARY` | PK | `id` | サロゲートキー |
| `groups` | `uq_group_id` | UNIQUE | `group_id` | グループID検索 |
| `groups` | `uq_email` | UNIQUE | `email` | グループメールアドレス検索・結合キー |
| `groups` | `idx_group_type` | KEY | `group_type` | 種別フィルタ |
| `groups` | `idx_status` | KEY | `status` | ステータスフィルタ |
| `group_members` | `PRIMARY` | PK | `id` | サロゲートキー |
| `group_members` | `uq_group_member` | UNIQUE | `group_email, member_email` | 重複防止 |
| `group_members` | `idx_group_email` | KEY | `group_email` | グループ単位でのメンバー取得 |
| `group_members` | `idx_member_email` | KEY | `member_email` | ユーザー単位での所属グループ取得 |
| `operation_logs` | `idx_operation_type` | KEY | `operation_type` | 操作種別フィルタ |
| `operation_logs` | `idx_executed_at` | KEY | `executed_at` | 期間検索・ローテーション |
| `operation_logs` | `idx_status` | KEY | `status` | 成功/失敗フィルタ・ローテーション |
| `sync_logs` | `idx_sync_type` | KEY | `sync_type` | 同期種別フィルタ |
| `sync_logs` | `idx_started_at` | KEY | `started_at` | 期間検索・ローテーション |
| `csv_download_logs` | `idx_executed_at` | KEY | `executed_at` | 期間検索・ローテーション |

### 5.2 インデックス設計方針

- メールアドレスカラムには `UNIQUE KEY` または `KEY` を設定（検索・結合の高速化）
- ログテーブルの日時カラムには `KEY` を設定（期間検索・ローテーション削除に対応）
- ログテーブルの `status` カラムにインデックスを追加（成功/失敗ログを別々の保存期間でローテーションするため）
- 数万件規模を想定し、主要な検索カラムにインデックスを付与
- カーディナリティの低いENUM型カラム（status等）のインデックスは、ログローテーション時のWHERE句高速化のために設定

---

## 6. データライフサイクル

### 6.1 マスタデータ

| テーブル | 削除方式 | 保持期間 | 備考 |
|---------|---------|---------|------|
| `users` | 論理削除（status='deleted', deleted_at設定） | 無期限 | **GWS側は物理削除せず「停止（Suspended）」に変更する** |
| `groups` | 論理削除（status='deleted', deleted_at設定） | 無期限 | GWS groups.delete と連動 |
| `group_members` | 論理削除（status='deleted'） | 無期限 | GWS members.delete と連動 |

### 6.2 ログデータ（ローテーション対象）

settingsテーブルの保存期間に基づき、Cloud Schedulerジョブ（毎日03:00 JST）が自動削除する。

| テーブル | 成功ログ保存期間 | 失敗ログ保存期間 | 削除方式 |
|---------|:---:|:---:|------|
| `operation_logs` | 90日（デフォルト） | 365日（デフォルト） | 物理DELETE |
| `sync_logs` | 90日（デフォルト） | 365日（デフォルト） | 物理DELETE |
| `csv_download_logs` | 90日（デフォルト） | 365日（デフォルト） | 物理DELETE |

**ローテーション実行SQL（参考）：**

```sql
-- 成功ログ削除（success_log_retention_days = 90の場合）
DELETE FROM operation_logs
WHERE status = 'success'
  AND executed_at < DATE_SUB(NOW(), INTERVAL 90 DAY);

-- 失敗ログ削除（failure_log_retention_days = 365の場合）
DELETE FROM operation_logs
WHERE status = 'error'
  AND executed_at < DATE_SUB(NOW(), INTERVAL 365 DAY);

-- sync_logs, csv_download_logs も同様
```

> 保存期間が0の場合は無期限保存（削除しない）。管理者がAppSheet画面からいつでも変更可能。

### 6.3 関連ファイル（Cloud Storage）

| バケット | 保持期間 | 備考 |
|---------|---------|------|
| `{PROJECT_ID}-csv-input` | settingsのcsv_file_retention_days（デフォルト30日） | インポートCSV |
| `{PROJECT_ID}-csv-output` | settingsのcsv_file_retention_days（デフォルト30日） | エクスポートCSV |
| `{PROJECT_ID}-rakumo-profiles` | settingsのcsv_file_retention_days（デフォルト30日） | rakumoプロファイルCSV |

---

## 7. マイグレーション

### 7.1 マイグレーション方針

- Alembic（SQLAlchemy Migration Tool）を使用
- Cloud Run Jobs でマイグレーションスクリプトを実行
- 本番・検証環境それぞれに個別適用

### 7.2 初期マイグレーション

```
alembic/versions/
  001_create_users.py
  002_create_groups.py
  003_create_group_members.py
  004_create_operation_logs.py
  005_create_sync_logs.py
  006_create_csv_download_logs.py
  007_create_settings.py
  008_insert_default_settings.py
```

### 7.3 マイグレーション実行手順

```bash
# 検証環境
gcloud run jobs execute user-mgmt-migration \
  --region asia-northeast1 \
  --set-env-vars DB_NAME=user_mgmt_dev

# 本番環境
gcloud run jobs execute user-mgmt-migration \
  --region asia-northeast1 \
  --set-env-vars DB_NAME=user_mgmt
```

---

## 8. データ量見積もり

### 8.1 初期データ量

| テーブル | 想定件数 | 1レコードサイズ（概算） | テーブルサイズ（概算） |
|---------|---------|---------------------|---------------------|
| `users` | 10,000件 | ~4 KB | ~40 MB |
| `groups` | 1,000件 | ~5 KB | ~5 MB |
| `group_members` | 50,000件 | ~0.5 KB | ~25 MB |
| `settings` | 3件 | ~0.5 KB | ~1 KB |
| **合計（マスタ）** | | | **~70 MB** |

### 8.2 ログデータ増加量（年間）

| テーブル | 1日あたり想定 | 年間想定 | 1レコードサイズ | 年間サイズ |
|---------|------------|---------|--------------|----------|
| `operation_logs` | ~200件 | ~73,000件 | ~0.5 KB | ~36 MB |
| `sync_logs` | ~5件 | ~1,825件 | ~0.5 KB | ~1 MB |
| `csv_download_logs` | ~10件 | ~3,650件 | ~0.5 KB | ~2 MB |
| **合計（ログ/年）** | | | | **~39 MB** |

> ログローテーションにより、実際のテーブルサイズはデフォルト設定（成功90日 / 失敗365日）の場合、ログ合計は常時 ~40 MB 以下に収まる見込み。ストレージ容量50GBに対して十分な余裕がある。

---

*以上*
