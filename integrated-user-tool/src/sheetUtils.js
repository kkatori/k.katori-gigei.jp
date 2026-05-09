var DEFAULT_SHEET_NAMES = {
  USERS: "ユーザー一覧",
  GROUPS: "グループ一覧",
  SETTINGS: "設定",
  LOG: "ログ",
};

var ROW_STATUS = {
  PENDING: "⏳ 待機中",
  PROCESSING: "🔄 処理中",
  SUCCESS: "✅ 成功",
  FAILED: "❌ 失敗",
  SKIPPED: "⏭️ スキップ",
  PARTIAL: "⚠️ 一部成功",
};

var STATUS_COL_INDEX = 1;
var MESSAGE_COL_INDEX = 2;

function getOrCreateSheet(sheetName, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (sheet) return sheet;

  sheet = ss.insertSheet(sheetName);
  if (headers && headers.length > 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function readSheetData(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { headers: [], rows: [], sheet: null };

  var lastRow = sheet.getLastRow();
  if (lastRow < 1) return { headers: [], rows: [], sheet: sheet };

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var rows = lastRow > 1 ? data.slice(1) : [];
  return { headers: headers, rows: rows, sheet: sheet };
}

function readRowsByStatus(sheetName, statuses) {
  var result = readSheetData(sheetName);
  var headers = result.headers;
  var allRows = result.rows;
  var sheet = result.sheet;

  var filteredRows = [];
  var rowIndices = [];

  for (var i = 0; i < allRows.length; i++) {
    var cellStatus = allRows[i][STATUS_COL_INDEX - 1];
    for (var j = 0; j < statuses.length; j++) {
      if (cellStatus === statuses[j]) {
        filteredRows.push(allRows[i]);
        rowIndices.push(i + 2); // +1 for header row, +1 for 1-based
        break;
      }
    }
  }

  return {
    headers: headers,
    rows: filteredRows,
    rowIndices: rowIndices,
    sheet: sheet,
  };
}

function writeSheetData(sheetName, headers, rows) {
  var sheet = getOrCreateSheet(sheetName);
  var frozenRows = sheet.getFrozenRows();
  var lastRow = sheet.getLastRow();
  if (lastRow > frozenRows) {
    sheet
      .getRange(frozenRows + 1, 1, lastRow - frozenRows, sheet.getLastColumn())
      .clearContent();
  }

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function appendRows(sheetName, rows) {
  if (!rows || rows.length === 0) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;

  var lastRow = sheet.getLastRow();
  var startRow = lastRow + 1;
  var numCols = rows[0].length;
  sheet.getRange(startRow, 1, rows.length, numCols).setValues(rows);
}

function updateRowStatus(sheet, rowIndex, status, message) {
  sheet.getRange(rowIndex, STATUS_COL_INDEX).setValue(status);
  if (message !== undefined && message !== null) {
    sheet.getRange(rowIndex, MESSAGE_COL_INDEX).setValue(message);
  }
}

function updateRowStatusBatch(sheet, updates) {
  if (!updates || updates.length === 0) return;

  var i, offset;
  var rowIndices = updates.map(function (u) {
    return u.rowIndex;
  });
  var minRow = Math.min.apply(null, rowIndices);
  var maxRow = Math.max.apply(null, rowIndices);
  var rangeHeight = maxRow - minRow + 1;

  var statusValues = [];
  var messageValues = [];
  for (i = 0; i < rangeHeight; i++) {
    statusValues.push([null]);
    messageValues.push([null]);
  }

  var canUseBatch = true;
  for (i = 0; i < updates.length; i++) {
    offset = updates[i].rowIndex - minRow;
    if (statusValues[offset][0] !== null) {
      canUseBatch = false;
      break;
    }
    statusValues[offset][0] = updates[i].status;
    messageValues[offset][0] =
      updates[i].message !== undefined ? updates[i].message : "";
  }

  if (canUseBatch) {
    sheet
      .getRange(minRow, STATUS_COL_INDEX, rangeHeight, 1)
      .setValues(statusValues);
    sheet
      .getRange(minRow, MESSAGE_COL_INDEX, rangeHeight, 1)
      .setValues(messageValues);
  } else {
    for (i = 0; i < updates.length; i++) {
      updateRowStatus(
        sheet,
        updates[i].rowIndex,
        updates[i].status,
        updates[i].message,
      );
    }
  }
}

function showToast(message, title, timeoutSeconds) {
  SpreadsheetApp.getActiveSpreadsheet().toast(
    message,
    title,
    timeoutSeconds || 5,
  );
}

function showProgressDialog(title, htmlContent) {
  var html = HtmlService.createHtmlOutput(htmlContent)
    .setWidth(400)
    .setHeight(300);
  SpreadsheetApp.getUi().showModalDialog(html, title);
}
