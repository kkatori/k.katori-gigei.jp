/* global CONFIG_KEYS, getConfig, loadConfigFromSheet, getBatchState, clearBatchState,
          getOrCreateSheet, writeSheetData, showToast,
          USER_SHEET_HEADERS, VALID_OPERATIONS, LOG_SHEET_HEADERS,
          listAllUsers, userToRow,
          buildMenu, executeBulk, cleanupTriggers_,
          logInfo, logError */

// エントリポイント。メニュー構築・初期化・インポート・バッチ再開/キャンセル。

var SETTINGS_ROWS = [
  ["キー", "バリュー", "説明"],
  [CONFIG_KEYS.GWS_DOMAIN, "", "Google Workspace ドメイン (例: example.com)"],
  [CONFIG_KEYS.GWS_DEFAULT_OU, "/", "デフォルト組織単位パス"],
  [
    CONFIG_KEYS.BATCH_SIZE,
    "100",
    "チェックポイント間隔(件)。シート書込・状態保存の頻度",
  ],
  [
    CONFIG_KEYS.TIME_LIMIT_MS,
    "1620000",
    "1実行の上限ミリ秒(既定27分/GWS上限30分)",
  ],
  [CONFIG_KEYS.MAX_RETRIES, "5", "APIリトライ上限"],
  [CONFIG_KEYS.RETRY_BASE_DELAY_MS, "1000", "リトライ基準間隔(ミリ秒)"],
  [
    CONFIG_KEYS.CUSTOM_SCHEMA_NAME,
    "",
    "カスタムスキーマ名(よみがな/内線用・任意)",
  ],
  [
    CONFIG_KEYS.CUSTOM_FIELD_LASTNAME_YOMI,
    "",
    "カスタム項目: 姓(よみ)のフィールド名",
  ],
  [
    CONFIG_KEYS.CUSTOM_FIELD_FIRSTNAME_YOMI,
    "",
    "カスタム項目: 名(よみ)のフィールド名",
  ],
  [CONFIG_KEYS.CUSTOM_FIELD_EXTENSION, "", "カスタム項目: 内線のフィールド名"],
  [CONFIG_KEYS.DEBUG_LOGGING, "false", "詳細ログ(true/false)"],
];

function onOpen() {
  buildMenu();
}

// ユーザー一覧 / 設定 / ログ の各シートを作成・整形する。
function initializeSheets() {
  var usersSheet = getOrCreateSheet(
    getConfig(CONFIG_KEYS.SHEET_USERS),
    USER_SHEET_HEADERS,
  );
  usersSheet
    .getRange(1, 1, 1, USER_SHEET_HEADERS.length)
    .setValues([USER_SHEET_HEADERS]);
  applyUserSheetFormatting_(usersSheet);

  getOrCreateSheet(getConfig(CONFIG_KEYS.SHEET_LOG), LOG_SHEET_HEADERS);

  var settings = getOrCreateSheet(getConfig(CONFIG_KEYS.SHEET_SETTINGS), []);
  if (settings.getLastRow() === 0) {
    settings.getRange(1, 1, SETTINGS_ROWS.length, 3).setValues(SETTINGS_ROWS);
    settings.setFrozenRows(1);
    settings
      .getRange(1, 1, 1, 3)
      .setFontWeight("bold")
      .setBackground("#f3f3f3");
    settings.autoResizeColumns(1, 3);
  }

  loadConfigFromSheet();
  showToast("シートを初期化しました");
}

function applyUserSheetFormatting_(sheet) {
  sheet
    .getRange(1, 1, 1, USER_SHEET_HEADERS.length)
    .setFontWeight("bold")
    .setBackground("#f3f3f3");
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(4); // 操作〜メールアドレスを固定

  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(VALID_OPERATIONS, true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange(2, 1, 1000, 1).setDataValidation(rule);
}

// GWS の現在のユーザーを全属性列付きで取り込む（編集の起点）。
function importUsers() {
  loadConfigFromSheet();
  if (!getConfig(CONFIG_KEYS.GWS_DOMAIN)) {
    showToast("先に『初期設定』で GWS ドメインを設定してください。");
    return;
  }
  try {
    var users = listAllUsers();
    var rows = users.map(function (u) {
      return userToRow(u);
    });
    writeSheetData(
      getConfig(CONFIG_KEYS.SHEET_USERS),
      USER_SHEET_HEADERS,
      rows,
    );

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
      getConfig(CONFIG_KEYS.SHEET_USERS),
    );
    if (sheet) applyUserSheetFormatting_(sheet);

    logInfo("main", "importUsers", "インポート完了: " + users.length + "件");
    showToast("GWS から " + users.length + " 件取り込みました");
  } catch (e) {
    logError("main", "importUsers", "インポート失敗: " + e.message);
    showToast("インポート失敗: " + e.message);
  }
}

// 中断したバッチを再開する（時間トリガーから呼ばれる）。
function resumeBatch() {
  var state = getBatchState();
  if (!state || state.status !== "running") {
    cleanupTriggers_();
    return;
  }
  loadConfigFromSheet();
  PropertiesService.getScriptProperties().setProperty(
    "CURRENT_JOB_ID",
    state.jobId || "",
  );
  executeBulk();
}

function cancelBatch() {
  clearBatchState();
  cleanupTriggers_();
  PropertiesService.getScriptProperties().deleteProperty("CURRENT_JOB_ID");
  logInfo("main", "cancelBatch", "一括処理をキャンセルしました");
  showToast("一括処理をキャンセルしました");
}
