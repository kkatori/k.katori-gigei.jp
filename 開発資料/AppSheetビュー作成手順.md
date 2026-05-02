# AppSheet ビュー作成手順書

## 1. 概要
本書は、東邦ホールディングス様向け「ユーザー管理システム」において、AppSheet を用いてユーザー・グループ情報や実行ログを効果的に表示・管理するためのビュー（画面）作成手順を定義する。

---

## 2. ステップ1：ナビゲーションと基本構成

1. **UX > Views** を開く。
2. **Primary Navigation**（ボトムメニュー）に以下の主要ビューを配置する。
   - ホーム（Dashboard）
   - ユーザー管理（Table）
   - グループ管理（Table）
   - CSV 連携（Dashboard）
   - ログ（Menu/Table）

---

## 3. ステップ2：ユーザー一覧・詳細ビューの作成

### 3.1 ユーザー一覧（Table View）
1. **View type**: `table`
2. **For this data**: `Users`
3. **Column order**:
   - `employee_number`（社員番号）
   - `family_name` + `given_name`（Virtual Column で氏名を作成し表示）
   - `email`（メールアドレス）
   - `job_title`（役職）
   - `status`（ステータス）
4. **Sort by**: `family_name_yomi` (Ascending)
5. **Group by**: `company` または `job_title`（任意）

### 3.2 ユーザー詳細（Detail View）
1. **View type**: `detail`
2. **Column order**:
   - 基本情報、連絡先、組織（兼務含む）をセクションごとに整理。
3. **Actions**:
   - ヘッダー付近に「編集（A-11）」「削除（A-12）」ボタンを配置。

---

## 4. ステップ3：グループ管理ビュー（Inline 連携）

### 4.1 グループ一覧（Table View）
1. **View type**: `table`
2. **For this data**: `Groups`
3. **Group aggregate**: `COUNT`（種別ごとの件数表示）

### 4.2 グループ詳細（Detail View）
1. **Inline View の設定**:
   - `GroupMembers` テーブルとの Ref 関係を利用し、グループ詳細画面の下部に「所属メンバー一覧」をインラインで表示する。
2. **メンバー削除アクション**:
   - インライン表示されるメンバー一覧の各行に「削除（A-17）」アクション（ゴミ箱アイコン）を配置する。

---

## 5. ステップ4：ダッシュボード（Home / CSV 連携）

### 5.1 ホーム画面（Home Dashboard）
1. **構成セクション**:
   - **同期状況**: `GoogleSyncLogs` の最新1件（Detail View）
   - **更新状況**: `RakumoContactLogs` の最新1件（Detail View）
   - **KPI**: ユーザー数・グループ数の集計（Chart View）
2. **Interactive mode**: `ON`（セクションをクリックすると詳細へ遷移可能にする）

### 5.2 CSV 連携パネル
1. **構成**:
   - **インポートボタン群**: ユーザー/グループ/メンバーの各アップロードアクション。
   - **エクスポートボタン群**: 各種 CSV ダウンロードアクション。
2. **Display**: `Side-by-side` を活用し、PC画面で左右にボタンを配置。

---

## 6. ステップ5：ログ閲覧ビューの設定

1. **共通設定**:
   - **View type**: `table`
   - **Sort by**: `executed_at` または `started_at` (Descending) ※最新を上に。
2. **ステータスの色分け（Format Rules）**:
   - `UX` > `Format Rules` で、`status = "success"` は **緑色**、`status = "error"` は **赤色** のアイコンまたはテキストを表示する設定を行う。

---

## 7. ステップ6：ブランドとローカライズ

1. **UX > Brand**:
   - 東邦ホールディングス様のコーポレートカラー（またはシステムカラー）にテーマを設定。
   - **App logo**: システム概要図から抽出したアイコン等を設定。
2. **UX > Localize**:
   - 既定のボタン（Save, Cancel, Edit, Delete）を「保存」「キャンセル」「編集」「削除」などの日本語に書き換える。

---

## 8. 実装上の Tips

1. **検索（Search）の最適化**:
   - `Data` > `Tables` > `Search` で、検索対象にするカラム（メールアドレス、氏名、社員番号等）を明示的に選択する。
2. **フィルタ（Slice）の活用**:
   - 「退職者を除いたアクティブユーザーのみの一覧」などを `Slice` で作成し、ビューのデータソースに指定することで、情報のノイズを減らす。

---
*以上*
