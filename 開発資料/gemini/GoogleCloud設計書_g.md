# Google Cloud 設計書：ユーザー管理機能

## 1. システム概要
本システムは、Google Workspaceおよびrakumoのユーザー・グループ情報を一元管理するためのユーザーマスタ基盤です。AppSheetをUIとし、バックエンド処理をGoogle Cloud上のサーバーレスコンポーネントで構築します。

## 2. システムアーキテクチャ
### 2.1 全体構成図（論理構成）
- **UI層**: AppSheet
- **オーケストレーション層**: Cloud Run (APIハンドラー、同期ロジック)
- **非同期・リトライ管理層**: **Cloud Tasks** (流量制御、リトライ、ジョブ分散)
- **データ層**: Cloud SQL (MySQL 8.0/PostgreSQL 15), Cloud Storage (CSV一時保管)
- **外部連携**: Google Workspace (Admin SDK), rakumo (プロファイルAPI)

### 2.2 主要コンポーネント選定理由
| コンポーネント | 選定理由 |
| :--- | :--- |
| **AppSheet** | 管理用UIを迅速に構築可能。Google Workspace認証との親和性が高い。 |
| **Cloud Run** | コンテナベースの実行環境。同期リクエストの受付と、Cloud Tasksからのジョブ実行を担当。 |
| **Cloud Tasks** | **Google Workspace APIのレート制限（クォータ）を回避するための流量制御と、失敗時の自動リトライを実現。** |
| **Cloud SQL** | 社員情報の「正（マスター）」を保持。トランザクション管理により整合性を担保。 |
| **Cloud Storage** | 大容量CSVの保管と、AppSheetへの「署名付きURL」によるセキュアなダウンロード提供。 |

---

## 3. リソース詳細設計

### 3.1 データベース設計 (Cloud SQL) - 整合性と冪等性の担保
- **主要テーブル案**:
    - `users`: 
        - `user_id` (PK), `employee_number`, `name`, `email`, `department`, `job_title`
        - `hash_value`: **差分検知用（全項目のハッシュ）。前回同期時から変更があるか判定。**
        - `sync_status`: **同期状態（`PENDING`, `SYNCING`, `COMPLETED`, `ERROR`）。**
        - `last_synced_at`: 最終同期完了日時。
    - `groups`: `group_email` (PK), `group_name`, `category`, `hash_value`, `sync_status`
    - `execution_logs`: `log_id` (PK), `action_type`, `status`, `message`, `timestamp`

### 3.2 サーバーレス処理ロジック (Cloud Run + Cloud Tasks)
- **差分同期（Differential Sync）フロー**:
    1. 入力データ（CSV等）を読み込み、DB内の既存データと比較。
    2. `hash_value` が異なるレコード、または新規レコードのみを抽出。
    3. 抽出したレコードを100件単位等のチャンクに分割し、Cloud Tasksへ投入。
- **冪等性の確保**:
    - DB更新時は `INSERT ... ON DUPLICATE KEY UPDATE` (Upsert) を使用。
    - API連携時は「対象が存在するか」を確認してから更新、またはAPI側の重複エラーを適切にハンドリング。

---

## 4. 外部システム連携設計

### 4.1 Google Workspace 連携 (Admin SDK)
- **流量制御**: Cloud Tasksのディスパッチレートを調整し、100秒あたりのリクエスト上限を超えないように制御。
- **バッチ処理**: 1リクエストで最大100件の更新をまとめるバッチ機能を活用。

### 4.2 rakumo 連携 (プロファイルAPI)
- **認証**: **Secret Manager** から取得したAPIキーと秘密鍵を用いて、リクエストごとに HMAC-SHA1 署名を生成。
- **排他制御**: `CSV IMPORT LOCK` APIにより、並列実行によるデータ破損を防止。
- **データ転送**: Cloud Storage上に生成した一時CSVを、`CSV UPLOAD` APIを用いてセキュアに送信。

---

## 5. セキュリティとネットワーク

### 5.1 認証・認可
- **Identity-Aware Proxy (IAP)**: (必要に応じて) AppSheet以外からの不正アクセスを遮断。
- **Secret Manager**: rakumo APIキー、Googleサービスアカウントキー、DBパスワードの集中管理。
- **IAM**: 最小権限の原則に基づき、各コンポーネントに専用のサービスアカウントを割り当て。

### 5.2 CSVダウンロード（他システム連携用）
- **署名付きURL (Signed URL)**: 
    - Cloud Storage上のファイルに、AppSheetのユーザーのみがアクセスできる「有効期限付きURL」を発行。
    - これにより、GCP外のファイルサーバーへの「直接保存」が困難な環境でも、セキュアな手動ダウンロードを可能にする。

---

## 6. 運用監視設計

### 6.1 ロギング・通知
- **Cloud Logging**: 構造化ログを出力し、特定の社員番号でのエラー等を迅速に検索可能にする。
- **Cloud Error Reporting**: アプリケーション例外を自動検知。
- **モニタリング**: Cloud Tasksのキューの滞留状況を監視し、同期遅延を検知。

### 6.2 バックアップとリカバリ
- **Cloud SQL 毎日自動バックアップ**: 誤操作や不整合発生時に、特定の時点の状態へリストア可能。
- **Cloud Storage ライフサイクル管理**: 30日以上経過したCSVは自動削除。
