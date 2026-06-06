// 設定キーと既定値（PropertiesService ベース）。設定シートの値を真実とし、
// loadConfigFromSheet() で PropertiesService に取り込む。

var CONFIG_KEYS = {
  GWS_DOMAIN: "GWS_DOMAIN",
  GWS_DEFAULT_OU: "GWS_DEFAULT_OU",
  BATCH_SIZE: "BATCH_SIZE",
  TIME_LIMIT_MS: "TIME_LIMIT_MS",
  BATCH_STATE: "BATCH_STATE",
  SHEET_USERS: "SHEET_USERS",
  SHEET_SETTINGS: "SHEET_SETTINGS",
  SHEET_LOG: "SHEET_LOG",
  MAX_RETRIES: "MAX_RETRIES",
  RETRY_BASE_DELAY_MS: "RETRY_BASE_DELAY_MS",
  CUSTOM_SCHEMA_NAME: "CUSTOM_SCHEMA_NAME",
  CUSTOM_FIELD_LASTNAME_YOMI: "CUSTOM_FIELD_LASTNAME_YOMI",
  CUSTOM_FIELD_FIRSTNAME_YOMI: "CUSTOM_FIELD_FIRSTNAME_YOMI",
  CUSTOM_FIELD_EXTENSION: "CUSTOM_FIELD_EXTENSION",
  DEBUG_LOGGING: "DEBUG_LOGGING",
};

var DEFAULT_VALUES = {
  GWS_DEFAULT_OU: "/",
  // チェックポイント間隔（件）。この件数ごとにシート書き込みと状態保存を行う。
  BATCH_SIZE: "100",
  // 1 実行の上限。GWS は 30 分制限のため、約 3 分のバッファを取り 27 分。
  TIME_LIMIT_MS: "1620000",
  SHEET_USERS: "ユーザー一覧",
  SHEET_SETTINGS: "設定",
  SHEET_LOG: "ログ",
  MAX_RETRIES: "5",
  RETRY_BASE_DELAY_MS: "1000",
  DEBUG_LOGGING: "false",
};

function getConfig(key, defaultValue) {
  var value = PropertiesService.getScriptProperties().getProperty(key);
  if (value !== null) return value;
  if (defaultValue !== undefined) return defaultValue;
  return DEFAULT_VALUES[key] !== undefined ? DEFAULT_VALUES[key] : null;
}

function setConfig(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, String(value));
}

function getBatchState() {
  var raw = PropertiesService.getScriptProperties().getProperty(
    CONFIG_KEYS.BATCH_STATE,
  );
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_e) {
    return null;
  }
}

function saveBatchState(state) {
  PropertiesService.getScriptProperties().setProperty(
    CONFIG_KEYS.BATCH_STATE,
    JSON.stringify(state),
  );
}

function clearBatchState() {
  PropertiesService.getScriptProperties().deleteProperty(
    CONFIG_KEYS.BATCH_STATE,
  );
}

// 設定シート（キー / バリュー / 説明）の内容を PropertiesService に取り込む。
function loadConfigFromSheet() {
  var sheetName = getConfig(CONFIG_KEYS.SHEET_SETTINGS);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;

  var props = PropertiesService.getScriptProperties();
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    var key = rows[i][0];
    var value = rows[i][1];
    if (key !== "" && key !== null && key !== undefined) {
      props.setProperty(String(key), value === null ? "" : String(value));
    }
  }
}
