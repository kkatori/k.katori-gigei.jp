/* global getConfig, CONFIG_KEYS */

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
  log(LOG_LEVEL.DEBUG, module, operation, message, details, rowRef);
}

function getRecentLogs(count, level) {
  var sheetName = getConfig(CONFIG_KEYS.SHEET_LOG, "ログ");
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet || sheet.getLastRow() <= 1) {
    return [];
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var rows = data.slice(1);

  if (level) {
    rows = rows.filter(function (row) {
      return row[1] === level;
    });
  }

  var recent = rows.slice(-count);

  return recent.map(function (row) {
    var obj = {};
    headers.forEach(function (header, i) {
      obj[header] = row[i];
    });
    return obj;
  });
}

function pruneOldLogs(daysToKeep) {
  var days = daysToKeep !== undefined ? daysToKeep : 30;
  var sheetName = getConfig(CONFIG_KEYS.SHEET_LOG, "ログ");
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet || sheet.getLastRow() <= 1) {
    return;
  }

  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  var data = sheet.getDataRange().getValues();
  // Find last row index (1-based) that is older than cutoff, scanning from row 2
  var lastOldRow = 0;
  for (var i = 1; i < data.length; i++) {
    var ts = data[i][0];
    if (ts instanceof Date && ts < cutoff) {
      lastOldRow = i + 1; // convert to 1-based sheet row
    } else {
      break;
    }
  }

  if (lastOldRow >= 2) {
    sheet.deleteRows(2, lastOldRow - 1);
  }
}

function generateBatchSummary(jobId) {
  var sheetName = getConfig(CONFIG_KEYS.SHEET_LOG, "ログ");
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);

  var result = { total: 0, success: 0, failed: 0, skipped: 0, errors: [] };

  if (!sheet || sheet.getLastRow() <= 1) {
    return result;
  }

  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rowJobId = String(row[7]);
    if (rowJobId !== String(jobId)) {
      continue;
    }

    result.total++;
    var msg = String(row[4]).toLowerCase();
    var rowRef = row[6];

    if (msg.indexOf("success") !== -1 || msg.indexOf("成功") !== -1) {
      result.success++;
    } else if (msg.indexOf("skip") !== -1 || msg.indexOf("スキップ") !== -1) {
      result.skipped++;
    } else if (
      row[1] === LOG_LEVEL.ERROR ||
      msg.indexOf("fail") !== -1 ||
      msg.indexOf("失敗") !== -1 ||
      msg.indexOf("error") !== -1
    ) {
      result.failed++;
      result.errors.push({ row: rowRef, error: String(row[4]) });
    }
  }

  return result;
}
