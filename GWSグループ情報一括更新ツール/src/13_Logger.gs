/* global SHEET_NAMES, FUNC_LABELS, getSpreadsheet_, getSheetOrNull_,
          getRequiredSheet_, getConfigNumber_, nowString_ */

// 13_Logger.gs
// Execution-ID issuing, log-sheet recording (design 1/2, section 4.8), and
// retention cleanup (NFR-06).

function newJobId_() {
  return (
    "J" +
    Utilities.formatDate(
      new Date(),
      getSpreadsheet_().getSpreadsheetTimeZone(),
      "yyyyMMdd-HHmmss",
    )
  );
}

function executorEmail_() {
  var email = Session.getActiveUser().getEmail();
  return email || Session.getEffectiveUser().getEmail();
}

// Appends the start row for a job and remembers its row number in the state.
function logJobStart_(state) {
  cleanupOldLogs_();
  var sheet = getRequiredSheet_(SHEET_NAMES.LOG);
  sheet.appendRow([
    state.jobId,
    FUNC_LABELS[state.func] || state.func,
    state.mode,
    nowString_(),
    "",
    executorEmail_(),
    0,
    0,
    0,
    0,
    "継続中",
    "",
  ]);
  state.logRow = sheet.getLastRow();
}

// Updates counts and state of the job's log row. jobStatus: 完了/継続中/中断/エラー.
function logJobProgress_(state, jobStatus, note) {
  var sheet = getRequiredSheet_(SHEET_NAMES.LOG);
  if (!state.logRow || state.logRow > sheet.getLastRow()) return;
  var c = state.counts || { success: 0, fail: 0, skip: 0 };
  var total = c.success + c.fail + c.skip;
  if (jobStatus !== "継続中") {
    sheet.getRange(state.logRow, 5).setValue(nowString_());
  }
  sheet
    .getRange(state.logRow, 7, 1, 6)
    .setValues([[total, c.success, c.fail, c.skip, jobStatus, note || ""]]);
}

// Appends a standalone error row (used by trigger handlers that cannot show UI).
function logSimpleError_(funcLabel, mode, message) {
  var sheet = getSheetOrNull_(SHEET_NAMES.LOG);
  if (!sheet) return;
  var now = nowString_();
  sheet.appendRow([
    newJobId_(),
    funcLabel,
    mode,
    now,
    now,
    executorEmail_(),
    0,
    0,
    0,
    0,
    "エラー",
    message,
  ]);
}

// Deletes leading log rows older than LOG_RETENTION_DAYS (logs are append-only,
// so old rows are contiguous at the top). Scans at most 200 rows per call.
function cleanupOldLogs_() {
  var days = getConfigNumber_("LOG_RETENTION_DAYS", 365);
  var sheet = getSheetOrNull_(SHEET_NAMES.LOG);
  if (!sheet || sheet.getLastRow() < 2) return;
  var cutoff = Date.now() - days * 86400000;
  var n = Math.min(sheet.getLastRow() - 1, 200);
  var values = sheet.getRange(2, 4, n, 1).getValues();
  var del = 0;
  for (var i = 0; i < values.length; i++) {
    var v = values[i][0];
    var d = v instanceof Date ? v : new Date(String(v));
    if (!isNaN(d.getTime()) && d.getTime() < cutoff) {
      del++;
    } else {
      break;
    }
  }
  if (del > 0) sheet.deleteRows(2, del);
}
