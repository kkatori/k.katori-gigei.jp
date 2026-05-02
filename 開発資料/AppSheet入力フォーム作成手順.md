# AppSheet ユーザー入力フォーム作成手順書

## 1. 概要
本書は、東邦ホールディングス様向け「ユーザー管理システム」において、AppSheetを用いてユーザー情報を個別に入力・更新し、Cloud Run（バックエンド）経由で Google Workspace および rakumo と同期するためのフォーム作成手順を定義する。

---

## 2. ステップ1：データソース（Google スプレッドシート）の準備

AppSheet のフォーム構造はスプレッドシートの列定義に依存するため、まず「Users」シートを正しく構成する。

1. **カラムヘッダーの配置**:
   - `email`, `family_name`, `given_name`, `employee_number` など、設計書（スプレッドシート設計書 2.1）にある全50項目を1行目に配置する。
2. **データの初期化**:
   - テスト用に1行データを入れておくと、AppSheet 側での型推論がスムーズになる。

---

## 3. ステップ2：AppSheet へのテーブル取り込みと型設定

1. **テーブルの追加**:
   - AppSheet エディタの `Data` > `Tables` から `Users` シートを追加する。
2. **カラムの型（Type）設定**:
   - `Data` > `Columns` > `Users` を開き、以下の型を正しく設定する。
     - `email`: **Email型**（Keyとして設定）
     - `family_name`, `given_name`: **Name型**
     - `business_phone`, `mobile_phone`: **Phone型**
     - `status`: **Enum型**（"active", "inactive", "deleted" を設定）
     - `updated_at`: **DateTime型**
3. **初期値（Initial Value）の設定**:
   - `status`: `"active"`
   - `updated_at`: `NOW()`
   - `changePasswordAtNextLogin`: `TRUE`（初期パスワード変更の強制）

---

## 4. ステップ3：UI/UX 最適化（動的表示とバリデーション）

入力の利便性を高めるため、AppSheet 固有のプロパティを設定する。

1. **動的な表示制御（Show_If）**:
   - 兼務組織の入力欄に対し、前の項目が入力された場合のみ表示するように設定する。
   - 例：`concurrent_org2_name` の `Show_If` プロパティに `ISNOTBLANK([concurrent_org1_name])` を記述。
2. **入力バリデーション（Valid_If）**:
   - メールの形式チェックや重複チェックを行う。
   - `Valid_If`: `ISBLANK(SELECT(Users[email], [email] = [_THISROW].[email]))`（新規登録時の重複チェック）
3. **必須項目（Required?）**:
   - `email`, `family_name`, `given_name` を `TRUE` に設定。

---

## 5. ステップ4：フォームビュー（Form View）の作成

1. **新規ビューの作成**:
   - `UX` > `Views` > `New View` を作成。
2. **ビュー設定**:
   - **For this data**: `Users`
   - **View type**: `form`
   - **Form format**: `Side-by-side`（PCでの視認性向上）
3. **Column order**:
   - ユーザーが入力しやすいようにセクションを分ける。
   - セクション1：基本情報（姓名・メール・社員番号）
   - セクション2：所属情報（会社名・役職）
   - セクション3：組織（主務・兼務1〜10）
   - セクション4：rakumoライセンス設定

---

## 6. ステップ5：Cloud Run 連携（Webhook アクション）の設定

フォーム保存時にバックエンド API を呼び出すアクションを作成する。

1. **アクションの作成**:
   - `Behavior` > `Actions` > `New Action` を作成。
   - **Do this**: `Call a webhook`
2. **Webhook 詳細設定**:
   - **Url**: `https://[Cloud-Run-Base-URL]/api/users`
   - **HTTP Verb**: `POST`
   - **HTTP Content Type**: `JSON`
   - **Body**: 
     ```json
     {
       "email": "<<[email]>>",
       "family_name": "<<[family_name]>>",
       "given_name": "<<[given_name]>>",
       "employee_number": "<<[employee_number]>>",
       "job_title": "<<[job_title]>>",
       "primary_org_name": "<<[primary_org_name]>>",
       "primary_org_email": "<<[primary_org_email]>>",
       "notes": "<<[notes]>>",
       "executed_by": "<<USEREMAIL()>>"
     }
     ```
3. **認証設定（OIDC）**:
   - `Authentication` で OIDC を選択し、AppSheet 用のサービスアカウントを指定する。

---

## 7. ステップ6：保存時イベントへの紐付け

1. **フォームの動作設定**:
   - `UX` > `Views` > `[作成したフォームビュー]` を開く。
2. **Behavior セクション**:
   - `Event Actions` > `Form Saved` に、ステップ5で作成した Webhook アクションを割り当てる。
3. **自動同期（Auto Sync）**:
   - 保存後に最新データを読み込むため、`Data` > `Tables` > `Users` の `Are updates allowed?` で `Automatic updates` を有効にする検討を行う。

---

## 8. 運用上の注意点

1. **エラー通知の仕組み**:
   - Webhook は非同期であるため、API 側でのエラー（GWS連携失敗等）は `OperationLogs` シートに記録し、AppSheet のダッシュボード等で警告を表示する構成とすること。
2. **同時編集の回避**:
   - 複数人が同時に同じユーザーを編集しないよう、運用ルールを徹底するか、AppSheet の `Edit` 権限を適切に管理すること。

---
*以上*
