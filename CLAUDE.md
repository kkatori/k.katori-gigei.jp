# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Okta（LDAPディレクトリ）からエクスポートされたユーザー・グループデータを、rakumoのプロファイル形式に変換・同期するPowerShellツール。Windowsタスクスケジューラによる定期自動実行を想定。

### Data Flow

1. **Input**: Okta CSVエクスポート（ユーザー属性130+項目、グループ階層データ）
2. **Transform**: Okta形式 → rakumo形式へのマッピング（31カラム）
3. **Output**: rakumoプロファイルAPI経由でアップロード、またはCSVファイル出力

## Tech Stack

- **Language**: PowerShell
- **Target Platform**: Windows (タスクスケジューラ実行)
- **API**: rakumo プロファイルAPI（HMAC-SHA1認証）
- **Data Format**: CSV（入出力とも）

## Key References

- rakumo API仕様: `@C:\work\14.API\` 配下（WFAPI, プロファイルAPI, Google同期API, ボードAPI, キンタイAPI）
- rakumo CSV出力フォーマット: `CSVフォーマット/rakumoフォーマットCSV.xlsx`
- Oktaサンプルデータ: `Oktaから出力されるCSV/`
- rakumo API認証の実装例: `@C:\Users\k.katori\.claude\skills\rakumo-api\references\authentication.md`

## Development Guidelines

### PowerShell Conventions

- UTF-8 with BOM でスクリプトファイルを保存（日本語文字化け防止）
- CSV読み書き時のエンコーディングは必ず明示的に指定する
- 認証情報（APIキー等）はスクリプトにハードコードしない — 環境変数または外部設定ファイルで管理し、.gitignoreに含める
- エラー発生時はログファイルに記録し、タスクスケジューラからの実行結果を追跡可能にする

### CSV Mapping

- Oktaのユーザー属性（130+項目）からrakumoの31カラムへの対応関係は `CSVフォーマット/rakumoフォーマットCSV.xlsx` を正とする
- 日本語フィールド（氏名漢字・カナ・ローマ字、部署名等）のエンコーディングに注意
- グループ階層データ（親子関係、ロール割当）は `Oktaから出力されるCSV/all-group-data_sample.xlsx` を参照

## Project Structure

```
rakumo-ldap連携ツール/
├── CSVフォーマット/              # rakumo出力フォーマット定義
├── Oktaから出力されるCSV/         # Oktaサンプルデータ
├── .claude/skills/              # Claude Code スキル
└── rakumoAPIの仕様.md           # API仕様への参照
```
