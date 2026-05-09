/* global CONFIG_KEYS, DEFAULT_VALUES, getConfig, isFeatureEnabled,
          getBatchState, saveBatchState, clearBatchState, loadConfigFromSheet,
          getOrCreateSheet,
          showToast, logInfo,
          buildToolMenu, executeNextBatch, cleanupTriggers_ */

var USER_SHEET_HEADERS = [
  "ステータス",
  "メッセージ",
  "メールアドレス",
  "姓",
  "名",
  "姓(よみ)",
  "名(よみ)",
  "パスワード",
  "組織単位",
  "会社名",
  "会社名(よみ)",
  "部門メール",
  "部門名",
  "役職",
  "生年月日",
  "住所",
  "電話番号",
  "内線番号",
  "FAX",
  "携帯電話",
  "メール2",
  "メール3",
  "社員番号",
  "プライマリ",
  "表示",
  "Calendar",
  "Contacts",
  "Workflow",
  "Board",
  "Expense",
  "Attendance",
  "操作",
  "次回PW変更",
];

var GROUP_SHEET_HEADERS = [
  "ステータス",
  "メッセージ",
  "グループメール",
  "グループ名",
  "説明",
  "メンバー",
  "マネージャー",
  "オーナー",
  "操作",
];

var SETTINGS_ROWS = [
  ["キー", "バリュー", "説明"],
  [
    CONFIG_KEYS.TOOL_MODE,
    DEFAULT_VALUES.TOOL_MODE,
    "ツールモード: gws / rakumo / integrated",
  ],
  [CONFIG_KEYS.GWS_DOMAIN, "", "Google Workspace ドメイン (例: example.com)"],
  [
    CONFIG_KEYS.GWS_DEFAULT_OU,
    DEFAULT_VALUES.GWS_DEFAULT_OU,
    "デフォルト組織単位パス",
  ],
  [CONFIG_KEYS.RAKUMO_API_KEY, "", "rakumo API キー"],
  [CONFIG_KEYS.RAKUMO_SECRET_KEY, "", "rakumo シークレットキー"],
  [
    CONFIG_KEYS.RAKUMO_BASE_URL,
    DEFAULT_VALUES.RAKUMO_BASE_URL,
    "rakumo API ベース URL",
  ],
  [
    CONFIG_KEYS.BATCH_SIZE,
    DEFAULT_VALUES.BATCH_SIZE,
    "1回の実行で処理する件数",
  ],
  [CONFIG_KEYS.MAX_RETRIES, DEFAULT_VALUES.MAX_RETRIES, "API リトライ上限"],
  [
    CONFIG_KEYS.RETRY_BASE_DELAY_MS,
    DEFAULT_VALUES.RETRY_BASE_DELAY_MS,
    "リトライ間隔 (ミリ秒)",
  ],
  [CONFIG_KEYS.SHEET_USERS, DEFAULT_VALUES.SHEET_USERS, "ユーザーシート名"],
  [CONFIG_KEYS.SHEET_GROUPS, DEFAULT_VALUES.SHEET_GROUPS, "グループシート名"],
  [CONFIG_KEYS.SHEET_SETTINGS, DEFAULT_VALUES.SHEET_SETTINGS, "設定シート名"],
  [CONFIG_KEYS.SHEET_LOG, DEFAULT_VALUES.SHEET_LOG, "ログシート名"],
];

function onOpen() {
  buildToolMenu();
}

function initialize() {
  var usersSheetName = getConfig(CONFIG_KEYS.SHEET_USERS);
  var settingsSheetName = getConfig(CONFIG_KEYS.SHEET_SETTINGS);
  var logSheetName = getConfig(CONFIG_KEYS.SHEET_LOG);

  getOrCreateSheet(usersSheetName, USER_SHEET_HEADERS);
  getOrCreateSheet(logSheetName, []);

  var settingsSheet = getOrCreateSheet(settingsSheetName, []);
  if (settingsSheet.getLastRow() === 0) {
    settingsSheet
      .getRange(1, 1, SETTINGS_ROWS.length, 3)
      .setValues(SETTINGS_ROWS);
    settingsSheet.setFrozenRows(1);
  }

  if (isFeatureEnabled("gws")) {
    var groupsSheetName = getConfig(CONFIG_KEYS.SHEET_GROUPS);
    getOrCreateSheet(groupsSheetName, GROUP_SHEET_HEADERS);
  }

  loadConfigFromSheet();
  showToast("初期化が完了しました");
}

function resumeBatch() {
  var state = getBatchState();
  if (!state || state.status !== "running") {
    cleanupTriggers_();
    return;
  }

  state.executionCount = (state.executionCount || 0) + 1;
  state.lastResumedAt = new Date().toISOString();
  saveBatchState(state);

  PropertiesService.getScriptProperties().setProperty(
    "CURRENT_JOB_ID",
    state.jobId || "",
  );

  executeNextBatch();
}

function cancelBatch() {
  clearBatchState();
  cleanupTriggers_();
  PropertiesService.getScriptProperties().deleteProperty("CURRENT_JOB_ID");
  logInfo("main", "cancelBatch", "バッチ処理をキャンセルしました");
  showToast("バッチ処理をキャンセルしました");
}

// cleanupTriggers_() は workflows.js で定義
