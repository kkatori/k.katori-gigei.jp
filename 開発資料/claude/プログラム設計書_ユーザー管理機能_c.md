# プログラム設計書　ユーザー管理機能

## 目次

1. [言語・フレームワーク選定](#1-言語フレームワーク選定)
2. [使用ライブラリ一覧](#2-使用ライブラリ一覧)
3. [プロジェクト構成](#3-プロジェクト構成)
4. [レイヤーアーキテクチャ](#4-レイヤーアーキテクチャ)
5. [モジュール設計](#5-モジュール設計)
6. [機能別実装方針](#6-機能別実装方針)
7. [エラーハンドリング設計](#7-エラーハンドリング設計)
8. [ロギング設計](#8-ロギング設計)
9. [テスト設計](#9-テスト設計)
10. [ビルド・デプロイ設計](#10-ビルドデプロイ設計)

---

## 1. 言語・フレームワーク選定

### 1.1 プログラミング言語：Python 3.12

**選定理由**

| 観点 | 理由 |
|------|------|
| Google Cloud対応 | Cloud Run / Cloud SQL / Cloud Storage / Secret Manager すべてに公式SDKが提供されている |
| Google Workspace API | Admin SDK の Python クライアントライブラリが公式サポート |
| rakumo API | HMAC-SHA1認証・CSV処理・HTTPクライアントを標準ライブラリ＋軽量ライブラリで実装可能 |
| CSV処理性能 | pandas による数万件の高速処理（読み込み・変換・書き出し）に対応 |
| 非同期処理 | asyncio / async/await により、外部API呼び出しの待機時間を効率化可能 |
| 開発効率 | 型ヒントと Pydantic による厳密な入出力バリデーション |
| コミュニティ | GCP + FastAPI + SQLAlchemy の組み合わせで最も事例が豊富 |

**バージョン指定**
- Python **3.12**（`python:3.12-slim` ベースイメージ）
- 型ヒントの最新構文（`X | Y`、`TypeAlias`）を活用

---

### 1.2 Webフレームワーク：FastAPI 0.115+

**選定理由**

| 観点 | 理由 |
|------|------|
| 非同期対応 | `async def` エンドポイントをネイティブサポート。外部API呼び出しで非同期処理が活きる |
| 自動スキーマ生成 | OpenAPI（Swagger UI）が自動生成される。AppSheetからの呼び出し仕様確認に便利 |
| バリデーション | Pydantic v2 によるリクエスト/レスポンスの型安全な検証 |
| BackgroundTasks | レスポンス返却後にバッチ処理を非同期実行する機能を標準搭載 |
| 依存性注入 | DB接続・認証処理を `Depends()` で宣言的に管理できる |

**Uvicorn（ASGIサーバー）** と組み合わせて使用する。

---

### 1.3 ORMライブラリ：SQLAlchemy 2.0

**選定理由**

| 観点 | 理由 |
|------|------|
| 非同期対応 | `AsyncSession` による async/await 対応 |
| Cloud SQL Auth Proxy との親和性 | Unix ソケット接続を DSN で直接指定可能 |
| マイグレーション | Alembic と組み合わせてスキーマ変更を管理 |
| 型安全 | `Mapped[]` 型注釈でモデル定義が明確 |

**MySQL ドライバ**：`aiomysql`（非同期対応）

---

## 2. 使用ライブラリ一覧

### 2.1 本番依存ライブラリ（requirements.txt）

| カテゴリ | ライブラリ | バージョン | 用途 |
|---------|----------|----------|------|
| **Web Framework** | `fastapi` | `>=0.115` | REST APIフレームワーク |
| **ASGI Server** | `uvicorn[standard]` | `>=0.34` | 本番用ASGIサーバー |
| **ORM** | `sqlalchemy` | `>=2.0` | DBアクセス層 |
| **MySQL Driver** | `aiomysql` | `>=0.2` | 非同期MySQLドライバ |
| **Migration** | `alembic` | `>=1.14` | DBスキーママイグレーション |
| **Validation** | `pydantic` | `>=2.0` | リクエスト/レスポンス定義 |
| **Settings** | `pydantic-settings` | `>=2.0` | 環境変数管理 |
| **CSV Processing** | `pandas` | `>=2.2` | 大量CSVの読み書き・変換 |
| **HTTP Client** | `httpx` | `>=0.28` | rakumo API非同期HTTPクライアント |
| **Google Auth** | `google-auth` | `>=2.0` | サービスアカウント認証 |
| **Google APIs** | `google-api-python-client` | `>=2.0` | Admin SDK（ユーザー/グループ管理） |
| **Cloud Storage** | `google-cloud-storage` | `>=2.0` | CSVファイルのアップロード/ダウンロード |
| **Secret Manager** | `google-cloud-secret-manager` | `>=2.0` | APIキー・DB接続情報の取得 |
| **Google Auth Transport** | `google-auth-httpx` | `>=0.2` | httpxとGoogle認証の統合 |
| **OIDC検証** | `google-auth` (token verify) | ―― | AppSheetからのリクエスト認証 |

### 2.2 開発・テスト用ライブラリ

| ライブラリ | 用途 |
|----------|------|
| `pytest` | テストフレームワーク |
| `pytest-asyncio` | 非同期テスト対応 |
| `httpx` | FastAPIのテストクライアント（`TestClient`の代替） |
| `ruff` | 高速Linter / Formatter（flake8 + black の代替） |
| `mypy` | 静的型チェック |
| `factory-boy` | テスト用データファクトリ |

### 2.3 標準ライブラリの活用

以下は外部ライブラリ不要で対応できる：

| 用途 | 標準ライブラリ |
|------|-------------|
| HMAC-SHA1認証（rakumo API） | `hmac`, `hashlib`, `base64` |
| UTC/JST時刻処理 | `datetime`, `zoneinfo` |
| CSVの基本読み書き | `csv`, `io` |
| URLエンコード | `urllib.parse` |
| JSON処理 | `json` |

---

## 3. プロジェクト構成

```
user-mgmt-api/
│
├── main.py                     # FastAPIアプリのエントリポイント
├── config.py                   # 設定管理（pydantic-settings）
├── database.py                 # DB接続・セッション管理
│
├── models/                     # SQLAlchemyモデル（テーブル定義）
│   ├── __init__.py
│   ├── user.py                 # usersテーブル
│   ├── group.py                # groupsテーブル
│   ├── group_member.py         # group_membersテーブル
│   ├── operation_log.py        # operation_logsテーブル
│   ├── sync_log.py             # sync_logsテーブル
│   └── csv_download_log.py     # csv_download_logsテーブル
│
├── schemas/                    # Pydanticスキーマ（API入出力）
│   ├── __init__.py
│   ├── user.py                 # ユーザー系リクエスト/レスポンス（UserCreate・UserUpdate含む）
│   ├── group.py                # グループ系リクエスト/レスポンス（GroupCreate・GroupUpdate含む）
│   ├── group_member.py         # グループメンバー系リクエスト/レスポンス（GroupMemberCreate含む）
│   ├── csv.py                  # CSV操作系リクエスト/レスポンス
│   ├── sync.py                 # 同期操作系リクエスト/レスポンス
│   └── common.py               # 共通スキーマ（ページング、エラー等）
│
├── routers/                    # FastAPIルーター（エンドポイント定義）
│   ├── __init__.py
│   ├── users.py                # /api/users/* （CSVインポート・エクスポート・個別CRUD）
│   ├── groups.py               # /api/groups/* （CSVインポート・エクスポート・個別CRUD）
│   ├── group_members.py        # /api/groups/{email}/members/* （個別追加・削除）
│   ├── csv.py                  # /api/csv/* （他システム連携CSVダウンロード）
│   ├── sync.py                 # /api/google-sync/*
│   ├── logs.py                 # /api/logs/*
│   └── health.py               # /health（ヘルスチェック）
│
├── services/                   # ビジネスロジック層
│   ├── __init__.py
│   ├── user_service.py         # ユーザー登録・更新・削除処理
│   ├── group_service.py        # グループ・メンバー管理処理
│   ├── csv_import_service.py   # CSV取り込み処理
│   ├── csv_export_service.py   # CSV生成・エクスポート処理
│   ├── sync_service.py         # Google同期実行処理
│   ├── rakumo_service.py       # rakumoコンタクト更新処理
│   └── spreadsheet_service.py  # Googleスプレッドシート同期処理
│
├── repositories/               # データアクセス層（DB操作）
│   ├── __init__.py
│   ├── user_repository.py
│   ├── group_repository.py
│   ├── group_member_repository.py
│   ├── operation_log_repository.py
│   └── sync_log_repository.py
│
├── clients/                    # 外部API・サービスクライアント
│   ├── __init__.py
│   ├── workspace_client.py     # Google Workspace Admin SDK
│   ├── sheets_client.py        # Google Sheets API
│   ├── gcs_client.py           # Cloud Storage
│   ├── secret_manager_client.py # Secret Manager
│   ├── rakumo_profile_client.py # rakumo Profile API（HMAC-SHA1認証）
│   └── rakumo_sync_client.py   # rakumo Google同期API（HMAC-SHA1認証）
│
├── utils/                      # ユーティリティ
│   ├── __init__.py
│   ├── auth.py                 # OIDC認証検証、HMAC-SHA1署名生成
│   ├── csv_utils.py            # CSV変換ヘルパー
│   └── logging.py              # 構造化ログ設定
│
├── migrations/                 # Alembicマイグレーションファイル
│   ├── env.py
│   ├── versions/
│   └── alembic.ini
│
├── tests/                      # テスト
│   ├── conftest.py
│   ├── unit/
│   │   ├── test_user_service.py
│   │   ├── test_group_service.py
│   │   ├── test_csv_utils.py
│   │   └── test_rakumo_auth.py
│   └── integration/
│       ├── test_users_api.py
│       ├── test_groups_api.py
│       └── test_csv_api.py
│
├── Dockerfile
├── .dockerignore
├── requirements.txt
├── requirements-dev.txt
├── pyproject.toml              # ruff / mypy 設定
└── README.md
```

---

## 4. レイヤーアーキテクチャ

### 4.1 層構造

```
┌─────────────────────────────────────────────────────┐
│  【Router層】 routers/                               │
│  ・FastAPIエンドポイント定義                           │
│  ・リクエスト受付・レスポンス返却                        │
│  ・Pydanticスキーマによる入出力バリデーション             │
│  ・OIDC認証検証（Depends(verify_oidc_token)）          │
└────────────────────┬────────────────────────────────┘
                     │ 呼び出し
┌────────────────────▼────────────────────────────────┐
│  【Service層】 services/                             │
│  ・ビジネスロジックの集約                              │
│  ・トランザクション管理                                │
│  ・複数Repositoryのオーケストレーション                 │
│  ・外部APIクライアントの呼び出し                        │
│  ・ログ記録（operation_logs / sync_logsへの書き込み）    │
└─────────┬──────────────────┬───────────────────────┘
          │ DB操作            │ 外部API呼び出し
┌─────────▼──────┐  ┌────────▼──────────────────────┐
│ 【Repository層】│  │ 【Client層】 clients/          │
│ repositories/  │  │ ・Google Workspace Admin SDK   │
│ ・SQLAlchemy   │  │ ・Google Sheets API            │
│   CRUDクエリ   │  │ ・Cloud Storage                │
│ ・非同期セッション│  │ ・rakumo Profile API           │
│   管理          │  │ ・rakumo Google同期API         │
└─────────┬──────┘  └───────────────────────────────┘
          │
┌─────────▼──────────────────────────────────────────┐
│  【Infrastructure】                                  │
│  Cloud SQL（MySQL）/ Cloud Storage / Secret Manager │
└────────────────────────────────────────────────────┘
```

### 4.2 依存関係の方向

- Router → Service → Repository → DB
- Router → Service → Client → 外部API
- 層を跨いだ逆方向の呼び出しは禁止（Repository から Service を呼ばない）

---

## 5. モジュール設計

### 5.1 config.py（設定管理）

```python
# pydantic-settings で環境変数を型安全に管理
class Settings(BaseSettings):
    env: str = "development"
    db_host: str          # Secret Manager から注入
    db_name: str
    db_user: str          # Secret Manager から注入
    db_password: str      # Secret Manager から注入
    rakumo_api_key: str   # Secret Manager から注入
    rakumo_secret_key: str
    gcs_bucket_input: str
    gcs_bucket_output: str
    gcs_bucket_rakumo: str
    google_project_id: str
    rakumo_domain: str    # rakumo APIのドメイン識別子

    model_config = SettingsConfigDict(env_file=".env")
```

> 運用パラメータはCloud SQLの設定テーブルから取得する。AppSheetから変更可能。
> 設定テーブル（`settings`）からロードするキー：`execution_mode`, `log_output_level`, `log_rotation_time`, `success_log_retention_days`, `error_log_retention_days`, `csv_retention_days`

### 5.2 database.py（DB接続）

```python
# 非同期エンジン（Cloud SQL Auth Proxy Unix ソケット経由）
DATABASE_URL = "mysql+aiomysql://{user}:{password}@/{db_name}?unix_socket=/cloudsql/{connection_name}"

engine = create_async_engine(DATABASE_URL, pool_size=10, max_overflow=20)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

# Depends() で使用するセッションジェネレーター
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
```

### 5.3 utils/auth.py（認証ユーティリティ）

#### OIDC認証検証（AppSheet → Cloud Run）
```python
# Cloud Run はデフォルトで OIDC 検証を実施
# AppSheet アクション（Webhook）では "Authorization: Bearer <OIDC_TOKEN>" を送信
async def verify_oidc_token(authorization: str = Header(...)) -> dict:
    """Cloud Run 内部でサービスアカウントトークンを検証"""
    # google-auth ライブラリで検証
    idinfo = id_token.verify_oauth2_token(token, requests.Request())
    return idinfo
```

#### HMAC-SHA1署名生成（rakumo API）
```python
import hmac, hashlib, base64
from datetime import datetime, timezone

def generate_rakumo_signature(
    method: str,
    path: str,
    date: str,
    content_type: str,
    content_md5: str,
    secret_key: str,
) -> str:
    """
    rakumo API用 HMAC-SHA1 署名生成
    MessageToBeSigned = HTTPメソッド + Content-MD5 + Content-Type + Date + RequestPath
    """
    message = "\n".join([method, content_md5, content_type, date, path])
    signature = hmac.new(
        secret_key.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha1,
    ).digest()
    return base64.b64encode(signature).decode("utf-8")
```

---

## 6. 機能別実装方針

### 6.1 機能1：Googleアカウント登録機能

#### 実装方針
- **入力チャネルは2種類**（CSVアップロード一括 / AppSheet個別操作）あるが、Cloud SQL更新・GWS API呼び出し・スプレッドシート同期の処理は `user_service.py` に集約し共通化する
- Google Workspace Admin SDK で `users.insert` / `users.update` / `users.delete` を呼び出す
- **GWS API レート制限対策**：一括処理時は `asyncio.sleep` でウェイト挿入（推奨：1件/秒以下）
- 処理後、Google Sheets（ユーザー情報一覧）を Cloud Run から更新

#### ID採番ロジック

ユーザー作成時にシステムが `user_id`（A100000形式）を自動発行する。

```python
async def generate_user_id(session: AsyncSession) -> str:
    """
    既存の最大 user_id に +1 した値を発行する。
    初回（レコードなし）は A100000 を返す。
    """
    result = await session.execute(
        text("SELECT MAX(user_id) FROM users")
    )
    max_id: str | None = result.scalar()
    if max_id is None:
        return "A100000"
    next_num = int(max_id[1:]) + 1   # 'A' を除いた数値部分
    return f"A{next_num:06d}"


async def generate_group_id(session: AsyncSession) -> str:
    """グループID（G100000形式）を発行する。"""
    result = await session.execute(
        text("SELECT MAX(group_id) FROM groups")
    )
    max_id: str | None = result.scalar()
    if max_id is None:
        return "G100000"
    next_num = int(max_id[1:]) + 1
    return f"G{next_num:06d}"
```

> 採番は CREATE 処理の DB トランザクション内で実行し、採番と INSERT を不可分にする（競合防止）。

#### GWSへのユーザー登録フロー（CSVアップロード）
```
1. Cloud StorageからCSV読み込み（pandas）
2. バリデーション（必須項目チェック）
   ※ 重複チェックはGWS API呼び出し時に実施（GWSからのエラーレスポンスで検知）
   ※ AppSheet入力時・CSV取込時のバリデーションでは重複チェックを行わない
3. 全件ループ：Cloud SQL UPSERT（トランザクション）
4. GWS Admin SDK Batch APIリクエストで一括反映（エラー時は個別記録）
   ※ Google Workspace Directory API のBatch APIリクエストを使用（バッチサイズ・並列度は設計フェーズで決定）
5. 実行ログをCloud SQL（operation_logs）に記録
6. Google Sheets同期（spreadsheet_service）
7. レスポンス返却（成功件数・エラー件数）
```

#### GWSへのユーザー登録フロー（AppSheet個別操作）
```
1. リクエストJSON受け取り（Pydanticバリデーション）
2. Cloud SQL UPSERT / UPDATE / 論理削除（トランザクション）
3. GWS Admin SDK API呼び出し（create_user / update_user / delete_user）
4. ユーザー変更時：rakumo Profile API でコンタクト更新
5. 実行ログをCloud SQL（operation_logs）に記録
6. Google Sheets同期（spreadsheet_service）
7. レスポンス返却（成功/エラー）
```

#### user_service.py の主要メソッド
```python
class UserService:
    # CSV一括インポート用
    async def import_from_csv(self, csv_bytes: bytes) -> ImportResult: ...

    # AppSheet個別操作用
    async def create_user(self, data: UserCreate) -> User:
        # user_id が未指定の場合はシステムが自動採番（generate_user_id()）
        ...
    async def update_user(self, email: str, data: UserUpdate) -> User: ...
    async def delete_user(self, email: str) -> None:
        """物理削除ではなく、suspended=True による停止処理を行う"""
        body = {"suspended": True}
        return self.service.users().patch(userKey=email, body=body).execute()
```

#### clients/workspace_client.py の主要メソッド
```python
class WorkspaceClient:
    def __init__(self, service_account_credentials): ...

    async def create_user(self, user_data: dict) -> dict: ...
    async def update_user(self, email: str, user_data: dict) -> dict: ...
    async def delete_user(self, email: str) -> None:
        """物理削除ではなく、suspended=True による停止処理を行う"""
        body = {"suspended": True}
        return self.service.users().patch(userKey=email, body=body).execute()
    async def create_group(self, group_data: dict) -> dict: ...
    async def add_group_member(self, group_email: str, member_email: str) -> dict: ...
    async def remove_group_member(self, group_email: str, member_email: str) -> None: ...
```

#### Googleアカウント作成時のデフォルト設定（確定 3/26）

`users.insert` 呼び出し時に以下のフィールドを固定値として設定する。

```python
GWS_USER_DEFAULTS = {
    "changePasswordAtNextLogin": True,   # 初回ログイン時にパスワード変更を強制
    "includeInGlobalAddressList": True,  # グローバルアドレス一覧（GAL）に表示
}
```

> CSVに上記フィールドが含まれない場合はデフォルト値を適用する。CSVに明示的な値がある場合はその値を優先する。

#### rakumoライセンスフラグのデフォルト設定

新規ユーザー作成時、rakumoライセンスフラグはすべて **有効（1）** をデフォルトとする。

```python
RAKUMO_LICENSE_DEFAULTS = {
    "calendar_enabled":   1,   # rakumoカレンダー有効
    "contacts_enabled":   1,   # rakumoコンタクト有効
    "workflow_enabled":   1,   # rakumoワークフロー有効
    "board_enabled":      1,   # rakumoボード有効
    "expense_enabled":    1,   # rakumo経費有効
    "attendance_enabled": 1,   # rakumo勤怠有効
}
```

> CSVにライセンスフラグが含まれない場合はすべて `1`（有効）を適用する。CSVに明示的な値がある場合はその値を優先する。

#### Googleアカウント情報エクスポート（確定 3/26）

`/api/users/export` では以下20フィールドをCSV出力する。
DB管理フィールドはCloud SQLから、出力専用フィールドはGWS Admin SDK `users.get` から取得する。

| 分類 | フィールド |
|------|----------|
| DB管理 | primaryEmail / password / First Name（givenName・名） / Last Name（familyName・姓） / orgUnitPath / recoveryEmail / recoveryPhone / changePasswordAtNextLogin / includeInGlobalAddressList |
| GWS出力専用 | UserID / isAdmin / suspended / aliases[] / isMailboxSetup / suspensionReason / creationTime / deletionTime / isEnrolledIn2Sv / isEnforcedIn2Sv |

> **フィールドマッピング（Google Workspace API 仕様）**：
> - First Name = `givenName` = 名（名前）
> - Last Name = `familyName` = 姓（苗字）

---

### 6.2 機能2：Googleグループ登録機能

#### 実装方針
- **入力チャネルは2種類**（CSVアップロード一括 / AppSheet個別操作）あるが、GWS API呼び出し・スプレッドシート同期の処理は `group_service.py` に集約し共通化する
- グループメールアドレスのプレフィックスからグループ種別を自動判定
  - `dr-*` → drive / `ml-*` → mailing / `rk-*` → rakumo
- GWS API でグループ作成後、Groups Settings API でアクセス権設定を適用し、メンバーを登録

#### GWSへのグループ登録フロー（CSVアップロード）
```
1. グループCSV読み込み → グループをCloud SQL UPSERT → GWS groups.insert
2. Groups Settings APIでデフォルト設定適用（GWS_GROUP_DEFAULTS）
3. グループメンバーCSV読み込み → メンバーをCloud SQL UPSERT → GWS members.insert
4. 実行ログをCloud SQL（operation_logs）に記録 → Google Sheets同期
```

#### GWSへのグループ・メンバー登録フロー（AppSheet個別操作）
```
1. リクエストJSON受け取り（Pydanticバリデーション）
2. Cloud SQL UPSERT / UPDATE / 論理削除
3. GWS groups.insert / groups.update / groups.delete
   または GWS members.insert / members.delete
4. グループ作成時：Groups Settings APIでデフォルト設定適用
5. 実行ログをCloud SQL（operation_logs）に記録 → Google Sheets同期
6. レスポンス返却（成功/エラー）
```

#### group_service.py の主要メソッド
```python
class GroupService:
    # CSV一括インポート用
    async def import_groups_from_csv(self, csv_bytes: bytes) -> ImportResult: ...
    async def import_members_from_csv(self, csv_bytes: bytes) -> ImportResult: ...

    # AppSheet個別操作用
    async def create_group(self, data: GroupCreate) -> Group:
        # group_id が未指定の場合はシステムが自動採番（generate_group_id()）
        ...
    async def update_group(self, email: str, data: GroupUpdate) -> Group: ...
    async def delete_group(self, email: str) -> None: ...
    async def add_member(self, group_email: str, member_email: str) -> GroupMember: ...
    async def remove_member(self, group_email: str, member_email: str) -> None: ...
```

#### Googleグループ作成時のデフォルト設定（確定 3/26）

グループ種別（`group_type`）に応じて、Groups Settings API に以下の設定を適用する。

```python
GWS_GROUP_DEFAULTS = {
    "drive": {
        "whoCanJoin":                "INVITED_CAN_JOIN",
        "whoCanViewMembership":      "ALL_MEMBERS_CAN_VIEW",
        "whoCanViewGroup":           "ALL_MEMBERS_CAN_VIEW",
        "whoCanPostMessage":         "ALL_IN_DOMAIN_CAN_POST",
        "allowWebPosting":           "false",
        "isArchived":                "true",
        "membersCanPostAsTheGroup":  "true",
        "includeInGlobalAddressList":"true",
        "whoCanLeaveGroup":          "NONE_CAN_LEAVE",
        "whoCanModerateMembers":     "NONE",
        "whoCanModerateContent":     "NONE",
        "whoCanAssistContent":       "NONE",
        "enableCollaborativeInbox":  "false",
        "whoCanDiscoverGroup":       "ALL_MEMBERS_CAN_DISCOVER",
        "defaultSender":             "",
    },
    "rakumo": {
        "whoCanJoin":                "INVITED_CAN_JOIN",
        "whoCanViewMembership":      "ALL_MEMBERS_CAN_VIEW",
        "whoCanViewGroup":           "ALL_MEMBERS_CAN_VIEW",
        "whoCanPostMessage":         "NONE_CAN_POST",   # rakumo用はメール送信不可
        "allowWebPosting":           "false",
        "isArchived":                "true",
        "membersCanPostAsTheGroup":  "true",
        "includeInGlobalAddressList":"false",            # rakumo用はGAL非表示
        "whoCanLeaveGroup":          "NONE_CAN_LEAVE",
        "whoCanModerateMembers":     "NONE",
        "whoCanModerateContent":     "NONE",
        "whoCanAssistContent":       "NONE",
        "enableCollaborativeInbox":  "false",
        "whoCanDiscoverGroup":       "ALL_MEMBERS_CAN_DISCOVER",
        "defaultSender":             "",
    },
    "mailing": {
        "whoCanJoin":                "INVITED_CAN_JOIN",
        "whoCanViewMembership":      "ALL_MEMBERS_CAN_VIEW",
        "whoCanViewGroup":           "ALL_MEMBERS_CAN_VIEW",
        "whoCanPostMessage":         "ALL_IN_DOMAIN_CAN_POST",
        "allowWebPosting":           "FALSE",
        "isArchived":                "TRUE",
        "membersCanPostAsTheGroup":  "TRUE",
        "includeInGlobalAddressList":"TRUE",
        "whoCanLeaveGroup":          "NONE_CAN_LEAVE",
        "whoCanModerateMembers":     "NONE",
        "whoCanModerateContent":     "NONE",
        "whoCanAssistContent":       "NONE",
        "enableCollaborativeInbox":  "FALSE",
        "whoCanDiscoverGroup":       "ALL_MEMBERS_CAN_DISCOVER",
        "defaultSender":             "",
    },
}
```

#### Googleグループ情報エクスポート（確定 3/26）

`/api/groups/export` では以下19フィールドをCSV出力する。
GroupID・email・name・description はCloud SQLから取得し、GWS設定項目は `GWS_GROUP_DEFAULTS` から `group_type` に応じて導出する。

---

### 6.3 機能3：Google同期実行機能

#### rakumo Google同期API の呼び出し手順
```
1. POST /sync/jobs  → ジョブID取得（非同期ジョブ開始）
2. GET /sync/current → 処理状態ポーリング（完了まで最大30秒ごとに確認）
3. GET /sync/last_result → 最終結果確認
4. 実行ログをCloud SQL（sync_logs、sync_type='google_sync'）に記録
```

#### ポーリング実装
```python
async def wait_for_sync_completion(job_id: str, timeout_sec: int = 600) -> dict:
    """Google同期完了まで最大10分ポーリング"""
    start = datetime.now(timezone.utc)
    while True:
        status = await get_current_sync_status()
        if status["state"] in ("COMPLETED", "ERROR"):
            return status
        if (datetime.now(timezone.utc) - start).seconds > timeout_sec:
            raise TimeoutError("Google同期がタイムアウトしました")
        await asyncio.sleep(30)
```

---

### 6.4 機能4：rakumoコンタクト更新機能

#### rakumo Profile API の4ステップ実装
```
Step1: GET /profiles/import/lock → IMPORT LOCK確認（locked時は409返却）
Step2: POST /profiles/upload_url → CSV UPLOAD用署名付きURL取得（有効期限10分）
Step3: PUT <署名付きURL>（CSVを直接アップロード、Google認証不要）
Step4: rakumo IMPORT LOCK が解除されるまでポーリング → 完了確認（IMPORT LOCK解除をもって完了）
Step5: 実行ログをCloud SQL（sync_logs、sync_type='rakumo_contact'）に記録
```

#### CSV生成（29カラム出力 / プロファイルCSV全仕様32カラム準拠）

プロファイルCSV全仕様は32カラムだが、以下は除外する：
- `Protected`（#29）: システムでのCSV生成時は含めない
- `その他カスタム項目`（#31）: 備考以外のカスタム項目は当システムでは使用しない
- `Job Title Code`（#32）: 初期CSVには存在しない

**兼務組織対応：1行1組織で出力する（要件定義書 5.1節・11.5.1節）**

兼務組織がある場合、同一ユーザーの行を組織数分（主務1行＋兼務N行、最大11行）生成する。
`Department Email`・`Department`・`Job Title` を行ごとに変え、その他の共通フィールドは全行に同一値を出力する。

```python
RAKUMO_PROFILE_COLUMNS = [
    "User ID", "Family Name", "Given Name",
    "Family Name Yomi", "Given Name Yomi",
    "Company", "Company Yomi",
    "Department Email", "Department", "Job Title",
    "Birthday", "Business Address",
    "Business Phone", "Business Phone Extension", "Business Fax",
    "Mobile Phone", "E-mail Address", "E-mail 2 Address", "E-mail 3 Address",
    "Employee Number", "Primary", "Display",
    "Calendar Enabled", "Contacts Enabled", "Workflow Enabled",
    "Board Enabled", "Expense Enabled", "Attendance Enabled",
    "備考",  # カスタム項目（要件定義書 5.1節・11.5節）
]

# 兼務組織フィールドの定義（主務組織を含む最大11組織）
# タプル: (email_field, name_field, title_field)
ORG_FIELDS = [
    ("primary_org_email",       "primary_org_name",       "job_title"),              # 主務（役職カラムを使用）
    ("concurrent_org1_email",   "concurrent_org1_name",   "concurrent_org1_job_title"),  # 兼務1
    ("concurrent_org2_email",   "concurrent_org2_name",   "concurrent_org2_job_title"),
    ("concurrent_org3_email",   "concurrent_org3_name",   "concurrent_org3_job_title"),
    ("concurrent_org4_email",   "concurrent_org4_name",   "concurrent_org4_job_title"),
    ("concurrent_org5_email",   "concurrent_org5_name",   "concurrent_org5_job_title"),
    ("concurrent_org6_email",   "concurrent_org6_name",   "concurrent_org6_job_title"),
    ("concurrent_org7_email",   "concurrent_org7_name",   "concurrent_org7_job_title"),
    ("concurrent_org8_email",   "concurrent_org8_name",   "concurrent_org8_job_title"),
    ("concurrent_org9_email",   "concurrent_org9_name",   "concurrent_org9_job_title"),
    ("concurrent_org10_email",  "concurrent_org10_name",  "concurrent_org10_job_title"), # 兼務10
]

def user_to_rakumo_rows(user: User) -> list[dict]:
    """
    ユーザー1件から1行以上のCSV行を生成する。
    兼務組織がある場合は組織数分の行を生成する（1行1組織、最大11行）。
    Department Email が空の組織はスキップする。
    """
    base = user_to_rakumo_base(user)  # Department Email / Department / Job Title 以外の共通フィールド

    rows = []
    for email_field, name_field, title_field in ORG_FIELDS:
        org_email = getattr(user, email_field, None)
        if not org_email:
            continue  # メールアドレス未設定の組織はスキップ
        org_name = getattr(user, name_field, "") or ""
        org_title = getattr(user, title_field, "") or ""
        rows.append({**base, "Department Email": org_email, "Department": org_name, "Job Title": org_title})

    return rows

def build_rakumo_csv(users: list[User]) -> bytes:
    rows = []
    for user in users:
        rows.extend(user_to_rakumo_rows(user))
    df = pd.DataFrame(rows)
    # UTF-8 BOM付き（rakumo側の文字コード維持のため）
    return df[RAKUMO_PROFILE_COLUMNS].to_csv(index=False).encode("utf-8-sig")
```

---

### 6.5 機能5：Appsheet表示用スプレッドシート作成機能

#### 実装方針
- Cloud Run が各処理完了後に Google Sheets API で7シートを更新
- 全件書き込み（`values.clear` → `values.update`）
- pandas DataFrame → リスト形式変換 → Sheets API `batchUpdate`
- **対象7シート**:
  1. ユーザー情報一覧
  2. グループ情報一覧
  3. グループメンバー一覧
  4. アカウント・グループ・グループメンバー更新ログ
  5. Google同期実行ログ
  6. rakumoコンタクトアップロードログ
  7. CSVダウンロード実行ログ

---

### 6.6 機能6：他システム連携用CSVダウンロード機能

#### 実装方針
- Cloud SQL から全ユーザーデータを取得し、pandas でCSV生成
- Cloud Storage（csv-output バケット）に保存
- **署名付きURL**（有効期限1時間）を発行 → AppSheetのダウンロードリンクに表示
- ファイルサーバーへの格納は担当者がダウンロード後に手動実施

```python
async def generate_signed_url(bucket_name: str, blob_name: str) -> str:
    """Cloud Storageの署名付きURL（1時間有効）を生成"""
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_name)
    url = blob.generate_signed_url(
        expiration=timedelta(hours=1),
        method="GET",
        version="v4",
    )
    return url
```

---

### 6.7 機能7：ログローテーション機能（要件定義書 13.2節）

#### 実装方針
- Cloud Scheduler から毎日 **01:00 JST（AM 1:00）** に `POST /api/batch/log-rotation` を呼び出し
  ※ 実行時刻は Cloud SQL `settings` テーブルの `log_rotation_time` キーから取得する
- settingsテーブルから保存期間（日数）を取得し、期限超過データを一括削除
- ログレコード削除とCSVファイル削除を1トランザクションで処理

#### 処理フロー

```
Cloud Scheduler（毎日 01:00 JST）
    │ HTTP POST（OIDC認証）
    ▼
Cloud Run /api/batch/log-rotation
    │
    ├── 1. settingsテーブルから保存期間を取得
    │     ├── success_log_retention_days（デフォルト90）
    │     ├── failure_log_retention_days（デフォルト365）
    │     └── csv_file_retention_days（デフォルト30）
    │
    ├── 2. Cloud SQLログ削除
    │     ├── operation_logs: status='success' かつ executed_at < 基準日 → DELETE
    │     ├── operation_logs: status='error' かつ executed_at < 基準日 → DELETE
    │     ├── sync_logs: 同様にstatus別で削除
    │     └── csv_download_logs: 同様にstatus別で削除
    │
    ├── 3. Cloud Storageファイル削除
    │     ├── csv-input バケット: 保持期間超過ファイルを削除
    │     ├── csv-output バケット: 保持期間超過ファイルを削除
    │     └── rakumo-profiles バケット: 保持期間超過ファイルを削除
    │
    └── 4. 実行結果をsync_logsに記録（sync_type='log_rotation'）
```

```python
async def rotate_logs(db: AsyncSession, storage_client: storage.Client):
    """保存期間を超過したログレコードとCSVファイルを削除する"""
    settings = await get_settings(db)
    now = datetime.utcnow()

    # 成功ログ削除
    success_days = int(settings.get("success_log_retention_days", 90))
    if success_days > 0:
        cutoff = now - timedelta(days=success_days)
        await db.execute(
            delete(OperationLog).where(
                OperationLog.status == "success",
                OperationLog.executed_at < cutoff,
            )
        )

    # 失敗ログ削除
    failure_days = int(settings.get("failure_log_retention_days", 365))
    if failure_days > 0:
        cutoff = now - timedelta(days=failure_days)
        await db.execute(
            delete(OperationLog).where(
                OperationLog.status == "error",
                OperationLog.executed_at < cutoff,
            )
        )

    # CSVファイル削除
    csv_days = int(settings.get("csv_file_retention_days", 30))
    if csv_days > 0:
        cutoff = now - timedelta(days=csv_days)
        for bucket_name in [CSV_INPUT_BUCKET, CSV_OUTPUT_BUCKET, RAKUMO_PROFILES_BUCKET]:
            delete_expired_blobs(storage_client, bucket_name, cutoff)
```

> 保存期間が0の場合は無期限保存（削除しない）。sync_logsおよびcsv_download_logsも同様のロジックで削除する。

---

## 7. エラーハンドリング設計

### 7.1 エラーカテゴリと対処方針

| カテゴリ | 具体例 | 対処 |
|---------|-------|------|
| バリデーションエラー | CSVの必須項目不足、メール形式不正 | HTTP 400、エラー行リストをレスポンスに含める |
| 認証エラー | OIDCトークン期限切れ | HTTP 401 |
| DB接続エラー | Cloud SQL Auth Proxy 障害 | HTTP 503、ロールバック |
| DB更新エラー | UNIQUE制約違反等 | HTTP 409、トランザクションロールバック |
| GWS APIエラー | レート制限（429）、一時的障害（5xx） | リトライ（最大3回、指数バックオフ）後に記録 |
| rakumo APIエラー | 認証失敗（401）、時刻ズレ | HTTP 500、タイムスタンプ再生成してリトライ |
| 大量処理の部分失敗 | 1000件中5件がGWS API失敗 | 成功件数・失敗件数・失敗行リストをログに記録、処理は継続 |

### 7.2 リトライ設計

```python
import asyncio

async def with_retry(coro, max_retries: int = 3, base_delay: float = 1.0):
    """指数バックオフによるリトライ"""
    for attempt in range(max_retries):
        try:
            return await coro
        except TransientError as e:
            if attempt == max_retries - 1:
                raise
            await asyncio.sleep(base_delay * (2 ** attempt))
```

### 7.3 部分処理結果の記録

- CSVバッチ処理では行単位でエラーを捕捉し、全体処理を止めない
- 失敗行は `operation_logs.error_message`（TEXT型）に記録
- AppSheetのログ画面で失敗詳細を確認可能にする

---

## 8. ロギング設計

### 8.1 ログ形式

Cloud Logging で解析しやすい**構造化JSON形式**を使用する。

```python
import structlog

logger = structlog.get_logger()

# 出力例
logger.info(
    "user_created",
    email="taro.yamada@example.com",
    employee_number="A100001234",
    operation="gws_create_user",
    execution_id="exec-20260308-001",
)
```

### 8.2 ログレベル

| レベル | 用途 |
|--------|------|
| `INFO` | 処理開始・完了、件数サマリ |
| `WARNING` | GWS APIリトライ発生、CSV行スキップ |
| `ERROR` | 処理失敗、例外発生 |
| `DEBUG` | 開発環境のみ有効。詳細パラメータ（本番では無効） |

### 8.3 PII（個人情報）のマスキング

ログ出力時にPIIをマスクするフィルターを実装する。

```python
PII_FIELDS = {"email", "family_name", "given_name", "mobile_phone", "business_phone"}

def mask_pii(event_dict: dict) -> dict:
    for key in PII_FIELDS:
        if key in event_dict:
            event_dict[key] = "****"
    return event_dict
```

### 8.4 ログ出力レベル設定

ログの出力粒度は Cloud SQL の `settings` テーブルで管理し、AppSheetの設定画面から変更可能とする。

| 項目 | 詳細 |
|------|------|
| 設定キー | `log_output_level` |
| 格納場所 | Cloud SQL `settings` テーブル |
| 値 | `summary`（サマリ：処理件数・成否のみ） / `detail`（詳細：全操作レコード） |
| デフォルト | `summary` |
| 変更方法 | AppSheet 設定画面から更新 |

```python
# 起動時または処理開始時にDBから設定を読み込む
async def get_log_output_level(db: AsyncSession) -> str:
    """settingsテーブルから log_output_level を取得する（デフォルト: summary）"""
    result = await db.execute(
        text("SELECT value FROM settings WHERE key = 'log_output_level'")
    )
    row = result.scalar()
    return row if row in ("summary", "detail") else "summary"
```

> `summary` モードでは処理全体の件数サマリのみをログに記録する。`detail` モードでは全レコードの操作ログを記録する。

---

## 9. テスト設計

### 9.1 テスト方針

| テスト種別 | 対象 | ツール | カバレッジ目標 |
|----------|------|--------|-------------|
| ユニットテスト | Service層・utils/ | pytest + pytest-asyncio | 80%以上 |
| 統合テスト | Router層（APIエンドポイント） | httpx + FastAPI TestClient | 主要エンドポイント全件 |
| 外部APIモック | GWS API / rakumo API | `unittest.mock` / `pytest-httpx` | モックで全ケース検証 |

### 9.2 主要テストケース

#### HMAC-SHA1署名テスト
```python
def test_generate_rakumo_signature():
    """rakumo APIのサンプル値でHMAC-SHA1署名を検証"""
    sig = generate_rakumo_signature(
        method="POST",
        path="/api/v1/profiles/upload_url",
        date="Sun, 08 Mar 2026 06:00:00 GMT",
        content_type="application/json",
        content_md5="d41d8cd98f00b204e9800998ecf8427e",
        secret_key="test_secret_key",
    )
    assert len(sig) == 28  # Base64 SHA1 の長さ
```

#### CSV変換テスト
```python
def test_build_rakumo_csv_single_org():
    """主務組織のみのユーザーは1行出力されること"""
    users = [create_test_user()]  # concurrent_org*_email はすべて None
    csv_bytes = build_rakumo_csv(users)
    df = pd.read_csv(io.BytesIO(csv_bytes))
    assert list(df.columns) == RAKUMO_PROFILE_COLUMNS
    assert len(df) == 1


def test_build_rakumo_csv_with_concurrent_orgs():
    """兼務組織がある場合は 主務1行 + 兼務N行 = 合計N+1行 出力されること（1行1組織）"""
    user = create_test_user(
        primary_org_email="primary@example.com",
        primary_org_name="営業部",
        concurrent_org1_email="concurrent1@example.com",
        concurrent_org1_name="企画部",
        concurrent_org2_email="concurrent2@example.com",
        concurrent_org2_name="総務部",
    )
    csv_bytes = build_rakumo_csv([user])
    df = pd.read_csv(io.BytesIO(csv_bytes))

    # 主務1件 + 兼務2件 = 3行
    assert len(df) == 3

    # User ID は全行同一
    assert (df["User ID"] == user.email).all()

    # Department Email は行ごとに異なる組織のメールアドレス
    assert df.iloc[0]["Department Email"] == "primary@example.com"
    assert df.iloc[1]["Department Email"] == "concurrent1@example.com"
    assert df.iloc[2]["Department Email"] == "concurrent2@example.com"


def test_build_rakumo_csv_skips_empty_concurrent_org():
    """兼務組織メールアドレスが空の場合はその行をスキップすること"""
    user = create_test_user(
        primary_org_email="primary@example.com",
        concurrent_org1_email="concurrent1@example.com",
        concurrent_org2_email=None,   # ← スキップ対象
        concurrent_org3_email="concurrent3@example.com",
    )
    csv_bytes = build_rakumo_csv([user])
    df = pd.read_csv(io.BytesIO(csv_bytes))

    # 主務1 + 兼務1(#1) + 兼務1(#3) = 3行（#2はスキップ）
    assert len(df) == 3
```

#### APIエンドポイントテスト（モック使用）
```python
@pytest.mark.asyncio
async def test_post_users_import(client, mock_workspace_client):
    """CSVインポートAPIのE2Eフロー（DBとGWS APIをモック）"""
    mock_workspace_client.create_user.return_value = {"id": "123"}
    response = await client.post(
        "/api/users/import",
        json={"gcs_path": "gs://csv-input/test.csv", "operation": "add"},
    )
    assert response.status_code == 200
    assert response.json()["success_count"] == 1


@pytest.mark.asyncio
async def test_post_user_individual_create(client, mock_workspace_client):
    """AppSheet個別操作：ユーザー作成APIのE2Eフロー"""
    mock_workspace_client.create_user.return_value = {"id": "456"}
    response = await client.post(
        "/api/users",
        json={
            "email": "taro.yamada@example.com",
            "family_name": "山田",
            "given_name": "太郎",
        },
    )
    assert response.status_code == 200
    # GWS defaultsが適用されていること
    call_args = mock_workspace_client.create_user.call_args[0][0]
    assert call_args["changePasswordAtNextLogin"] is True
    assert call_args["includeInGlobalAddressList"] is True


@pytest.mark.asyncio
async def test_patch_user_individual_update(client, mock_workspace_client):
    """AppSheet個別操作：ユーザー更新APIのE2Eフロー"""
    mock_workspace_client.update_user.return_value = {}
    response = await client.patch(
        "/api/users/taro.yamada@example.com",
        json={"job_title": "部長"},
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_delete_user_individual(client, mock_workspace_client):
    """AppSheet個別操作：ユーザー削除APIのE2Eフロー"""
    response = await client.delete("/api/users/taro.yamada@example.com")
    assert response.status_code == 200
    mock_workspace_client.delete_user.assert_called_once_with("taro.yamada@example.com")


@pytest.mark.asyncio
async def test_post_group_member_add(client, mock_workspace_client):
    """AppSheet個別操作：グループメンバー追加APIのE2Eフロー"""
    mock_workspace_client.add_group_member.return_value = {}
    response = await client.post(
        "/api/groups/drive-group@example.com/members",
        json={"member_email": "taro.yamada@example.com"},
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_delete_group_member(client, mock_workspace_client):
    """AppSheet個別操作：グループメンバー削除APIのE2Eフロー"""
    response = await client.delete(
        "/api/groups/drive-group@example.com/members/taro.yamada@example.com"
    )
    assert response.status_code == 200
    mock_workspace_client.remove_group_member.assert_called_once()
```

---

## 10. ビルド・デプロイ設計

### 10.1 Dockerfile

```dockerfile
# ── ビルドステージ ──────────────────────────────────────
FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── 本番ステージ ────────────────────────────────────────
FROM python:3.12-slim
WORKDIR /app

# Cloud SQL Auth Proxy サイドカー利用のためインストール不要
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY . .

# 非rootユーザーで実行（セキュリティ要件）
RUN useradd --no-create-home --uid 1000 appuser
USER appuser

EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
```

### 10.2 Cloud Run デプロイコマンド

```bash
# 1. コンテナビルド & プッシュ
IMAGE="asia-northeast1-docker.pkg.dev/${PROJECT_ID}/user-mgmt/user-mgmt-api:${GIT_HASH}"
docker build -t ${IMAGE} .
docker push ${IMAGE}

# 2. Cloud Run デプロイ
gcloud run deploy user-mgmt-api \
  --image ${IMAGE} \
  --region asia-northeast1 \
  --platform managed \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --concurrency 10 \
  --max-instances 5 \
  --no-allow-unauthenticated \
  --set-secrets="DB_HOST=db-host:latest,DB_USER=db-user:latest,DB_PASSWORD=db-password:latest,RAKUMO_API_KEY=rakumo-api-key:latest,RAKUMO_SECRET_KEY=rakumo-secret-key:latest" \
  --set-env-vars="ENV=production,DB_NAME=user_mgmt,..."
```

### 10.3 マイグレーション実施方法

```bash
# Cloud Run Job でマイグレーションを実行（Cloud SQL Auth Proxy 使用）
gcloud run jobs execute user-mgmt-migration \
  --region asia-northeast1
```

マイグレーション用ジョブはデプロイパイプラインに組み込み、アプリデプロイ前に自動実行する。

### 10.4 CI/CD パイプライン概要（Cloud Build 想定）

```
git push → Cloud Build trigger
  1. ruff によるLintチェック
  2. mypy による型チェック
  3. pytest ユニットテスト実行
  4. docker build
  5. docker push（Artifact Registry）
  6. Cloud Run migration job 実行
  7. Cloud Run サービスデプロイ
```

---

## 付録：APIエンドポイント一覧（Cloud Run）

| メソッド | パス | 機能 | 呼び出し元 |
|---------|------|------|-----------|
| GET | `/health` | ヘルスチェック | Cloud Run |
| POST | `/api/v1/users/import` | ユーザーCSV取り込み | オートメーション（Bot） |
| PUT | `/api/v1/users/{id}` | ユーザー1件更新 | アクション（Webhook） |
| DELETE | `/api/v1/users/{id}` | ユーザー1件削除 | アクション（Webhook） |
| POST | `/api/v1/groups/import` | グループCSV取り込み | オートメーション（Bot） |
| PUT | `/api/v1/groups/{id}` | グループ1件更新 | アクション（Webhook） |
| POST | `/api/v1/sync/google` | Google同期実行 | アクション（Webhook） / Cloud Scheduler |
| POST | `/api/v1/sync/rakumo` | rakumoコンタクト更新 | アクション（Webhook） / Cloud Scheduler |
| POST | `/api/v1/csv/export` | 他システム連携CSV生成 | アクション（Webhook） |
| GET | `/api/v1/csv/download-url` | 署名付きURL発行 | AppSheet Virtual Column |
| GET | `/api/v1/logs` | 実行ログ一覧取得 | AppSheet（Sheets同期後）|
