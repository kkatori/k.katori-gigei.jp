// シート操作の共通ユーティリティ。
// 列レイアウト: 1=操作 / 2=ステータス / 3=メッセージ / 4=メールアドレス ...

var ROW_STATUS = {
  PENDING: "⏳ 待機中",
  PROCESSING: "🔄 処理中",
  SUCCESS: "✅ 成功",
  FAILED: "❌ 失敗",
  SKIPPED: "⏭️ スキップ",
};

var STATUS_COL_INDEX = 2; // ステータス列（1 始まり）
var MESSAGE_COL_INDEX = 3; // メッセージ列（1 始まり）

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

// ヘッダーを保持しつつ既存データ行を全消去して書き直す。
function writeSheetData(sheetName, headers, rows) {
  var sheet = getOrCreateSheet(sheetName, headers);
  var lastRow = sheet.getLastRow();
  var lastCol = Math.max(sheet.getLastColumn(), headers.length);
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
  }

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function updateRowStatus(sheet, rowIndex, status, message) {
  sheet.getRange(rowIndex, STATUS_COL_INDEX).setValue(status);
  if (message !== undefined && message !== null) {
    sheet.getRange(rowIndex, MESSAGE_COL_INDEX).setValue(message);
  }
}

// 複数行のステータス/メッセージをまとめて書き込む（一括処理の高速化用）。
// 対象行が不連続（飛び地）でも、間の行を消さないよう既存値を読み込んで上書きする。
function updateRowStatusBatch(sheet, updates) {
  if (!updates || updates.length === 0) return;

  // 1 件のみは直接更新（読み取りを省略）。
  if (updates.length === 1) {
    updateRowStatus(
      sheet,
      updates[0].rowIndex,
      updates[0].status,
      updates[0].message,
    );
    return;
  }

  var rowIndices = updates.map(function (u) {
    return u.rowIndex;
  });
  var minRow = Math.min.apply(null, rowIndices);
  var maxRow = Math.max.apply(null, rowIndices);
  var rangeHeight = maxRow - minRow + 1;

  // 既存値を読み込み、対象行のみ上書き（飛び地の行や前回の結果を保持する）。
  var statusRange = sheet.getRange(minRow, STATUS_COL_INDEX, rangeHeight, 1);
  var messageRange = sheet.getRange(minRow, MESSAGE_COL_INDEX, rangeHeight, 1);
  var statusValues = statusRange.getValues();
  var messageValues = messageRange.getValues();

  for (var i = 0; i < updates.length; i++) {
    var offset = updates[i].rowIndex - minRow;
    statusValues[offset][0] = updates[i].status;
    messageValues[offset][0] =
      updates[i].message !== undefined && updates[i].message !== null
        ? updates[i].message
        : "";
  }

  statusRange.setValues(statusValues);
  messageRange.setValues(messageValues);
}

function showToast(message, title, timeoutSeconds) {
  SpreadsheetApp.getActiveSpreadsheet().toast(
    message,
    title || "ユーザー一括更新",
    timeoutSeconds || 5,
  );
}
