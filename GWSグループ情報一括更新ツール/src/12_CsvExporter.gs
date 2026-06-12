/* global SHEET_NAMES, SHEET_DEFS, FUNCS, getConfigString_, getRequiredSheet_,
          getSpreadsheet_, cellStr_ */

// 12_CsvExporter.gs
// CSV output (FR-08, design 2/2, section 8): UTF-8 with BOM (Excel-safe),
// comma-separated, header row included, RFC-style quoting.

var EXPORTABLE_SHEETS = [
  SHEET_NAMES.INV_GROUPS,
  SHEET_NAMES.INV_MEMBERS,
  SHEET_NAMES.INV_SETTINGS,
  SHEET_NAMES.GROUP_OPS,
  SHEET_NAMES.MEMBER_OPS,
  SHEET_NAMES.SETTINGS_OPS,
];

// Exports a sheet as '<fileBase>.csv' into the CSV_FOLDER_ID folder.
function exportSheetCsv_(sheetName, fileBase) {
  var folderId = getConfigString_("CSV_FOLDER_ID");
  if (!folderId) {
    throw new Error(
      "設定シートの CSV_FOLDER_ID が未設定です。出力先フォルダIDを設定してください。",
    );
  }
  var folder = DriveApp.getFolderById(folderId);
  var sheet = getRequiredSheet_(sheetName);
  var values = sheet.getDataRange().getDisplayValues();
  var csv =
    "\ufeff" +
    values
      .map(function (row) {
        return row.map(csvEscape_).join(",");
      })
      .join("\r\n");
  var blob = Utilities.newBlob(
    "",
    "text/csv",
    fileBase + ".csv",
  ).setDataFromString(csv, "UTF-8");
  return folder.createFile(blob);
}

function csvEscape_(value) {
  var s = String(value === null || value === undefined ? "" : value);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// Auto-export after an inventory job completes (D-2). Returns the created file
// or null when CSV_FOLDER_ID is not configured (auto-export is best-effort).
function autoExportInventoryCsv_(func) {
  if (!getConfigString_("CSV_FOLDER_ID")) return null;
  var sheetName = FUNC_INVENTORY_SHEETS_()[func];
  return exportSheetCsv_(sheetName, sheetName + "_" + timestampSuffix_());
}

function FUNC_INVENTORY_SHEETS_() {
  var map = {};
  map[FUNCS.INV_GROUPS] = SHEET_NAMES.INV_GROUPS;
  map[FUNCS.INV_MEMBERS] = SHEET_NAMES.INV_MEMBERS;
  map[FUNCS.INV_SETTINGS] = SHEET_NAMES.INV_SETTINGS;
  return map;
}

function timestampSuffix_() {
  return Utilities.formatDate(
    new Date(),
    getSpreadsheet_().getSpreadsheetTimeZone(),
    "yyyyMMdd-HHmmss",
  );
}

// Manual export of the active sheet (menu 棚卸し > CSVへ出力). Instruction
// sheets are named 実行結果_<sheet>_<latest execution ID> per the design.
function exportActiveSheetCsv_() {
  var sheet = getSpreadsheet_().getActiveSheet();
  var name = sheet.getName();
  if (EXPORTABLE_SHEETS.indexOf(name) === -1) {
    throw new Error(
      "出力したいシートを開いた状態で実行してください。\n対象: " +
        EXPORTABLE_SHEETS.join(" / "),
    );
  }
  var fileBase;
  if (SHEET_DEFS[name] && SHEET_DEFS[name].resultCol) {
    fileBase =
      "実行結果_" +
      name +
      "_" +
      (latestJobIdInSheet_(sheet, SHEET_DEFS[name].resultCol) ||
        timestampSuffix_());
  } else {
    fileBase = name + "_" + timestampSuffix_();
  }
  return exportSheetCsv_(name, fileBase);
}

// Latest execution ID in an instruction sheet ('J' + timestamp sorts
// lexicographically, so the max string is the newest).
function latestJobIdInSheet_(sheet, resultCol) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return "";
  var values = sheet.getRange(2, resultCol + 3, lastRow - 1, 1).getValues();
  var latest = "";
  values.forEach(function (row) {
    var id = cellStr_(row[0]);
    if (id > latest) latest = id;
  });
  return latest;
}
