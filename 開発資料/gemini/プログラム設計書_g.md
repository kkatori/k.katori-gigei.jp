# プログラム設計書：バックエンド（Cloud Run）

## 1. 採用技術スタック
- **言語**: Python 3.11+
- **フレームワーク**: FastAPI
- **ORM / DB接続**: SQLAlchemy (Cloud SQL Auth Proxy経由)
- **外部API連携**: `google-api-python-client` (Workspace), `requests` (rakumo)
- **非同期処理**: Cloud Tasks (流量制御用)

## 2. 主要モジュール構成
1.  **API Handler**: AppSheetからのWebhook受付 (`/import`, `/sync`, `/export`)
2.  **Sync Engine**: 
    - `WorkspaceManager`: Admin SDKを用いたユーザー・グループの差分更新
    - `rakumoManager`: プロファイルAPI（HMAC署名、CSV Upload）の実装
3.  **Diff Processor**: DBと入力データのハッシュ比較による差分抽出
4.  **CSV Generator**: Pandasを用いた特定フォーマットのCSV生成
5.  **Task Dispatcher**: Cloud Tasksへのジョブ投入とリトライ管理

## 3. 実装上のポイント
- **冪等性**: `UPSERT`ロジックと差分検知（ハッシュ値比較）により、何度実行しても安全な状態を維持する。
- **リトライ**: `tenacity` ライブラリを用いた指数関数的バックオフの実装。
- **セキュリティ**: APIキーや秘密鍵は Secret Manager から取得する。
