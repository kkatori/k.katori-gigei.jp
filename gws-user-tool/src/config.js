var CONFIG_KEYS = {
  TOOL_MODE: "TOOL_MODE",
  RAKUMO_API_KEY: "RAKUMO_API_KEY",
  RAKUMO_SECRET_KEY: "RAKUMO_SECRET_KEY",
  RAKUMO_BASE_URL: "RAKUMO_BASE_URL",
  GWS_DOMAIN: "GWS_DOMAIN",
  GWS_DEFAULT_OU: "GWS_DEFAULT_OU",
  BATCH_SIZE: "BATCH_SIZE",
  BATCH_STATE: "BATCH_STATE",
  SHEET_USERS: "SHEET_USERS",
  SHEET_GROUPS: "SHEET_GROUPS",
  SHEET_SETTINGS: "SHEET_SETTINGS",
  SHEET_LOG: "SHEET_LOG",
  MAX_RETRIES: "MAX_RETRIES",
  RETRY_BASE_DELAY_MS: "RETRY_BASE_DELAY_MS",
};

var DEFAULT_VALUES = {
  RAKUMO_BASE_URL: "https://a-rakumo.appspot.com",
  TOOL_MODE: "gws",
  BATCH_SIZE: "50",
  SHEET_USERS: "ユーザー一覧",
  SHEET_GROUPS: "グループ一覧",
  SHEET_SETTINGS: "設定",
  SHEET_LOG: "ログ",
  MAX_RETRIES: "3",
  RETRY_BASE_DELAY_MS: "1000",
  GWS_DEFAULT_OU: "/",
};

function getConfig(key, defaultValue) {
  var value = PropertiesService.getScriptProperties().getProperty(key);
  if (value !== null) return value;
  if (defaultValue !== undefined) return defaultValue;
  return DEFAULT_VALUES[key] !== undefined ? DEFAULT_VALUES[key] : null;
}

function setConfig(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, value);
}

function getToolMode() {
  return getConfig(CONFIG_KEYS.TOOL_MODE);
}

function isFeatureEnabled(feature) {
  var mode = getToolMode();
  if (mode === "integrated") return true;
  return mode === feature;
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
    if (key) {
      props.setProperty(String(key), String(value));
    }
  }
}
