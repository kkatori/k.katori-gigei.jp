# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Google Apps Script (GAS) ツールの開発計画・仕様策定ワークスペース。rakumo および Google Workspace 向けの業務ツール群（全11ツール）を企画・開発する。

対象顧客: 中小企業（50〜300ユーザー規模）

## 仕様ドキュメント

- `開発対象/API利用ツールについて.pptx` — ツール概要・構成図・フロー図
- `開発対象/販売ツール検討.xlsx` — ツール一覧・工数・価格・API要件マトリクス

## 言語規約

- ドキュメント・仕様書: 日本語
- コード（変数名・関数名・コメント）: 英語

## ツール構成

各ツールは独立したサブディレクトリで管理する:

```
<tool-name>/
  .clasp.json        # clasp デプロイ設定
  appsscript.json    # GAS プロジェクト設定
  src/               # ソースコード
```

## コマンド

- `npm run lint` — ESLint 実行（GAS グローバル変数定義済み）
- `npm run format` — Prettier でフォーマット
- `clasp push` — GAS プロジェクトへデプロイ（各ツールディレクトリ内で実行）
- `clasp pull` — GAS プロジェクトからソース取得

## 技術スタック

- Google Apps Script (V8 ランタイム)
- clasp (ローカル開発・デプロイ)
- Google Workspace Admin SDK / Directory API
- rakumo API（認証: HMAC-SHA1、詳細は `~/.claude/skills/rakumo-api/` 参照）
- Google Drive API / Sheets API

## 開発対象ツール一覧

1. rakumo ユーザー管理ツール
2. Google Workspace ユーザー管理ツール
3. GWS + rakumo 統合ユーザー管理ツール
4. カスタムフィールド設定ツール
5. Google Drive アクセス一覧エクスポート
6. 投稿コメントツール（rakumo ボード）
7. 承認申請者特定ツール
8. ボードファイル添付移行ツール
9. ワークフローファイル添付移行ツール
10. 健診データ更新ツール
11. リソース予約承認ツール
