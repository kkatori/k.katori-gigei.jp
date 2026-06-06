/* global getConfig, CONFIG_KEYS */

// ログシートへの記録。一括処理の高速化のため、ホットパス（成功 1 件ごと）では
// 呼び出さない。記録はジョブ開始/完了と失敗行のみ。DEBUG は設定で有効化したときだけ。

var LOG_LEVEL = {
  DEBUG: "DEBUG",
  INFO: "INFO",
  WARN: "WARN",
  ERROR: "ERROR",
};

var LOG_SHEET_HEADERS = [
  "タイムスタンプ",
  "レベル",
  "モジュール",
  "操作",
  "メッセージ",
  "詳細",
  "行参照",
  "ジョブID",
];

function log(level, module, operation, message, details, rowRef) {
  var sheetName = getConfig(CONFIG_KEYS.SHEET_LOG, "ログ");
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(LOG_SHEET_HEADERS);
    sheet
      .getRange(1, 1, 1, LOG_SHEET_HEADERS.length)
      .setBackground("#f3f3f3")
      .setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

  var detailStr = "";
  if (details !== undefined && details !== null) {
    detailStr =
      typeof details === "object" ? JSON.stringify(details) : String(details);
  }

  var jobId =
    PropertiesService.getScriptProperties().getProperty("CURRENT_JOB_ID") || "";

  sheet.appendRow([
    new Date(),
    level,
    module || "",
    operation || "",
    message || "",
    detailStr,
    rowRef !== undefined && rowRef !== null ? String(rowRef) : "",
    jobId,
  ]);
}

function logInfo(module, operation, message, details, rowRef) {
  log(LOG_LEVEL.INFO, module, operation, message, details, rowRef);
}

function logWarn(module, operation, message, details, rowRef) {
  log(LOG_LEVEL.WARN, module, operation, message, details, rowRef);
}

function logError(module, operation, message, details, rowRef) {
  log(LOG_LEVEL.ERROR, module, operation, message, details, rowRef);
}

function logDebug(module, operation, message, details, rowRef) {
  if (getConfig(CONFIG_KEYS.DEBUG_LOGGING, "false") !== "true") return;
  log(LOG_LEVEL.DEBUG, module, operation, message, details, rowRef);
}
