# Google Workspace API レート制限対応策

| 項目 | 内容 |
|------|------|
| 作成日 | 2026年3月8日 |
| 作成者 | rakumo株式会社 |
| 対象 | 東邦ホールディングス株式会社 |
| 関連文書 | プログラム設計書_ユーザー管理機能_c.md |

---

## 前提：Google Workspace Admin SDK のレート制限

| 制限項目 | 上限値 |
|---------|-------|
| リクエスト数（プロジェクト全体） | 2,400 件 / 100秒 |
| リクエスト数（ユーザーごと） | 2,400 件 / 100秒 |
| バッチリクエスト上限 | 1,000 サブリクエスト / 1バッチ |
| 429 Too Many Requests 発生時 | 指数バックオフ必須 |

10,000件を1件ずつ処理すると、理論値で最低**7分以上**かかり、制限到達リスクが高い。

---

## 対応策 1：Google API バッチリクエスト

### 概要
複数のAPIコールを1つのHTTPリクエストにまとめて送信する。Google APIが公式サポートするバッチ処理機能。

```
通常処理：  1件 × 1,000回 = 1,000 HTTPリクエスト
バッチ処理：1,000件 × 1回 =    1 HTTPリクエスト（最大1,000件/バッチ）
```

### 実装イメージ
```python
from googleapiclient.http import BatchHttpRequest

def execute_batch_user_updates(service, users: list[dict]) -> dict:
    results = {"success": [], "error": []}

    def callback(request_id, response, exception):
        if exception:
            results["error"].append({"id": request_id, "error": str(exception)})
        else:
            results["success"].append(response)

    # 1,000件単位でバッチ分割
    for chunk in chunked(users, 1000):
        batch = service.new_batch_http_request(callback=callback)
        for user in chunk:
            batch.add(
                service.users().update(userKey=user["email"], body=user),
                request_id=user["email"],
            )
        batch.execute()  # 1バッチ = 1 HTTPリクエスト

    return results
```

### メリット / デメリット

| 観点 | 内容 |
|------|------|
| **効果** | HTTPオーバーヘッドを大幅削減。1,000件が1リクエストに集約 |
| **注意** | バッチ内でも各サブリクエストはクォータを1件として消費される |
| **注意** | バッチ全体の429エラーと、サブリクエスト単位のエラーの両方をハンドリングが必要 |
| **適用場面** | 大量の一括登録・更新・削除（CSVインポート時） |

---

## 対応策 2：差分更新（変更検知）

### 概要
全件をAPIで更新するのではなく、**前回同期時からの変更分のみ**を抽出してAPI呼び出しを最小化する。

```
全件更新：   10,000件 → 毎回10,000 APIコール
差分更新：   10,000件中 変更50件 → 毎回 50 APIコール（99.5%削減）
```

### 実装イメージ
```python
import hashlib, json

def compute_user_hash(user: dict) -> str:
    """同期対象フィールドのみでハッシュを計算"""
    sync_fields = {
        "family_name": user.get("family_name"),
        "given_name": user.get("given_name"),
        "job_title": user.get("job_title"),
        "primary_org_email": user.get("primary_org_email"),
        # ... 同期対象フィールド
    }
    return hashlib.md5(json.dumps(sync_fields, sort_keys=True).encode()).hexdigest()

async def get_changed_users(db_users: list[User]) -> list[User]:
    """前回同期ハッシュと比較して変更があったユーザーのみ返す"""
    changed = []
    for user in db_users:
        current_hash = compute_user_hash(user.__dict__)
        if user.last_sync_hash != current_hash:  # usersテーブルに追加するカラム
            changed.append(user)
    return changed

async def sync_users_to_gws(db: AsyncSession):
    all_users = await user_repository.get_all_active(db)
    changed_users = await get_changed_users(all_users)

    if not changed_users:
        logger.info("変更ユーザーなし。GWS APIコールをスキップ")
        return

    # 変更分のみ GWS API で更新
    await workspace_client.batch_update_users(changed_users)

    # 同期完了後にハッシュを更新
    for user in changed_users:
        user.last_sync_hash = compute_user_hash(user.__dict__)
    await db.commit()
```

### usersテーブルへの追加カラム
```sql
ALTER TABLE users
  ADD COLUMN last_sync_hash    VARCHAR(32)  COMMENT '前回GWS同期時のフィールドハッシュ',
  ADD COLUMN last_synced_at    DATETIME     COMMENT '前回GWS同期日時';
```

### メリット / デメリット

| 観点 | 内容 |
|------|------|
| **効果** | 平常運用時のAPIコールを劇的に削減（人事異動期以外はほぼゼロ） |
| **効果** | 処理時間が変更件数に比例するため予測・管理が容易 |
| **注意** | Cloud SQLが「単一の真実（Single Source of Truth）」である前提が必要 |
| **注意** | GWS側で手動変更があった場合に差分が検知されない（定期フル同期を月1回等で補完） |
| **適用場面** | 定期バッチ（Cloud Scheduler）による夜間・早朝の定期同期 |

---

## 対応策 3：非同期キュー処理 + レート制限制御

### 概要
`asyncio.Semaphore` でAPIの同時実行数を制御し、429エラー発生時は**指数バックオフ**で自動リトライする。大量処理を安全かつ確実に完走させる仕組み。

```
従来：  全件を並列実行 → 429 Too Many Requests → 処理失敗
改善：  同時実行数を制御 → 安定したスループットを維持 → 確実に完走
```

### 実装イメージ
```python
import asyncio, random

# 同時実行数を制限するセマフォ（同時10件まで）
GWS_SEMAPHORE = asyncio.Semaphore(10)

# 1秒あたりの最大リクエスト数
# （2,400/100秒 = 24/秒。安全マージンで10/秒に設定）
REQUESTS_PER_SECOND = 10

async def call_gws_api_with_rate_limit(coro, request_id: str):
    """レート制限付きAPIコール（指数バックオフリトライ込み）"""
    async with GWS_SEMAPHORE:
        for attempt in range(5):  # 最大5回リトライ
            try:
                result = await coro
                await asyncio.sleep(1 / REQUESTS_PER_SECOND)  # レート制御
                return result
            except HttpError as e:
                if e.resp.status == 429:
                    # ジッターを加えてリトライの集中を防ぐ
                    wait = (2 ** attempt) + random.uniform(0, 1)  # 1,2,4,8,16秒 + ジッター
                    logger.warning(f"429 Rate Limited. {wait:.1f}秒後にリトライ ({request_id})")
                    await asyncio.sleep(wait)
                elif e.resp.status in (500, 503):
                    wait = 2 ** attempt
                    await asyncio.sleep(wait)
                else:
                    raise  # 4xx（認証エラー等）はリトライしない
        raise RuntimeError(f"最大リトライ回数超過 ({request_id})")


async def batch_update_users_with_rate_limit(users: list[User]):
    """全ユーザーを並列処理（レート制限・リトライ付き）"""
    tasks = [
        call_gws_api_with_rate_limit(
            workspace_client.update_user(u.email, u.to_gws_dict()),
            request_id=u.email,
        )
        for u in users
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # 結果集計
    success = [r for r in results if not isinstance(r, Exception)]
    errors  = [r for r in results if isinstance(r, Exception)]
    return {"success": len(success), "error": len(errors), "errors": errors}
```

### 指数バックオフのウェイト時間

| リトライ回数 | ウェイト時間（秒） |
|------------|----------------|
| 1回目 | 1 ～ 2 秒（1 + ジッター） |
| 2回目 | 2 ～ 3 秒（2 + ジッター） |
| 3回目 | 4 ～ 5 秒（4 + ジッター） |
| 4回目 | 8 ～ 9 秒（8 + ジッター） |
| 5回目（最終） | 16 ～ 17 秒（16 + ジッター） |

### メリット / デメリット

| 観点 | 内容 |
|------|------|
| **効果** | レート超過エラーを自動回復し、処理を確実に完走させる |
| **効果** | `Semaphore` の値を調整するだけでスループットを柔軟に制御できる |
| **注意** | 大量処理は時間がかかる（10件/秒で10,000件 = 約17分）→ Cloud Run timeout 3,600秒以内には収まる |
| **注意** | ジッター（乱数）を加えることでリトライの集中（Thundering herd）を防ぐことが重要 |
| **適用場面** | CSVインポートによる大量一括処理（変更件数が多い人事異動期） |

---

## 3つの対応策の組み合わせ方針

```
【定期バッチ（Cloud Scheduler：平常運用）】
  → 対応策2（差分更新）で変更分のみ抽出
  → 対応策3（レート制限制御）で安全に実行

【CSVインポート（大量一括処理：人事異動期）】
  → 対応策1（バッチリクエスト）でHTTPコストを削減
  → 対応策3（レート制限制御）で429エラーを自動リトライ

【月次フルチェック（GWSとの整合性確認）】
  → 対応策2のハッシュを無視して全件比較 → ズレを検知・修正
```

### 対応策まとめ

| 対応策 | 削減・改善効果 | 実装コスト | 推奨適用タイミング |
|--------|-------------|-----------|----------------|
| 1. バッチリクエスト | HTTPオーバーヘッド削減 | 低 | CSVインポート時 |
| 2. 差分更新 | API呼び出し数 最大99%削減 | 中 | 定期バッチ時 |
| 3. レート制限制御 | 429エラーによる失敗ゼロ | 低 | 常時適用（全処理） |
