# AppSheet ホーム画面（ダッシュボード）作成手順書

## 1. 概要
本書は、東邦ホールディングス様向け「ユーザー管理システム」において、システムの稼働状況や主要な KPI を一元的に表示し、迅速な意思決定と操作を可能にするための「ホーム画面」の作成手順を定義する。

---

## 2. ホーム画面の構成要素

ホーム画面は、複数のビューを組み合わせた **Dashboard View** として構成する。以下の4つのセクションを含める。

1. **同期状況サマリ**: Google同期の最新成功・失敗状況を表示。
2. **rakumo更新状況サマリ**: rakumoコンタクト更新の最新状況を表示。
3. **統計情報 (KPI)**: アクティブユーザー数、グループ数を視覚的に表示。
4. **クイックアクション**: Google同期実行、rakumoコンタクト更新のショートカット。

---

## 3. ステップ1：各セクション用の子ビュー（Sub-view）の作成

ダッシュボードに組み込むための個別のビューを作成する。

### 3.1 Google同期状況サマリ (Detail View)
1. `UX` > `Views` > `New View`
2. **View name**: `GoogleSyncStatus`
3. **For this data**: `GoogleSyncLogs`
4. **View type**: `detail`
5. **Layout**: `Centering`
6. **Column order**: `status`, `started_at`, `finished_at`, `error_message`
7. **Filter (Slice)**: 最新1件のみを表示するように設定。
   - `Slice` 条件: `[id] = MAXROW("GoogleSyncLogs", "started_at")`

### 3.2 rakumo更新状況サマリ (Detail View)
1. **View name**: `RakumoContactStatus`
2. **For this data**: `RakumoContactLogs`
3. **View type**: `detail`
   - 同様に `Slice` で最新1件のみを抽出して表示する。

### 3.3 統計情報 (KPI Chart View)
1. **View name**: `SystemStats`
2. **View type**: `chart`
3. **Chart type**: `Gauge` または `Number`
4. **Data series**: ユーザー数 (`Users` テーブルで `status="active"` のカウント)

---

## 4. ステップ2：アクションボタン（Quick Action）の設定

ホーム画面から直接処理を実行するためのボタンを配置する。

1. **Behavior > Actions** を開く。
2. **Google同期実行 (A-07)**:
   - 表示設定: `Display Prominently`
   - アイコン: `Sync`
3. **rakumoコンタクト更新 (A-08)**:
   - 表示設定: `Display Prominently`
   - アイコン: `People`

---

## 5. ステップ3：ダッシュボードビュー（Dashboard View）の統合

1. `UX` > `Views` > `New View`
2. **View name**: `Home`
3. **For this data**: 特定のテーブルは指定不要
4. **View type**: `dashboard`
5. **View entries**:
   - `SystemStats` (統計情報)
   - `GoogleSyncStatus` (同期状況)
   - `RakumoContactStatus` (更新状況)
6. **Dashboard options**:
   - **Interactive mode**: `ON` (クリックして詳細へ遷移可能にする)
   - **View selector**: `OFF` (画面を固定する)

---

## 6. ステップ4：ビジュアル（Format Rules）の設定

視認性を高めるためのデコレーション設定を行う。

1. **UX > Format Rules**
2. **Status Colors**:
   - 条件: `[status] = "success"` → **緑色の丸アイコン**を表示。
   - 条件: `[status] = "error"` → **赤色の×アイコン**を表示。
   - 条件: `[status] = "running"` → **青色のアニメーションアイコン**（利用可能な場合）を設定。

---

## 7. ステップ5：ナビゲーションの設定

1. **UX > Views > Home**
2. **Position**: `leftmost` (ボトムメニューの左端) に配置し、アプリ起動時の初期画面に設定する。

---

## 8. 実装上のポイント

1. **リフレッシュ頻度**:
   - 保存後にバックエンド (Cloud Run) での処理が終わるまで数秒かかるため、ホーム画面には「更新（Sync）」を促すメッセージやボタンを配置することを推奨する。
2. **レスポンシブ対応**:
   - ダッシュボードのレイアウトが PC ブラウザで崩れないよう、各セクションの幅（Width）を適切に調整する。

---
*以上*
