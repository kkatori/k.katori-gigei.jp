/* global CONFIG_KEYS, getConfig, setConfig, loadConfigFromSheet, getBatchState */

// カスタムメニュー・各種ダイアログ。bulkRunner から confirmBulk_ / showSummary_ が呼ばれる。

function buildMenu() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("ユーザー一括更新")
    .addItem("初期設定...", "showSetupDialog")
    .addItem("シート初期化", "initializeSheets")
    .addSeparator()
    .addItem("GWSからインポート", "importUsers")
    .addItem("一括実行", "runBulk")
    .addSeparator()
    .addItem("バッチ状態を確認", "showBatchStatusDialog")
    .addItem("バッチを再開", "resumeBatch")
    .addItem("バッチをキャンセル", "cancelBatch")
    .addSeparator()
    .addItem("ログを開く", "openLog")
    .addToUi();
}

// 設定ダイアログ。値は設定シートに書き戻し（真実の所在を一本化）、PropertiesService にも反映。
function showSetupDialog() {
  var domain = escapeHtml_(getConfig(CONFIG_KEYS.GWS_DOMAIN, ""));
  var defaultOu = escapeHtml_(getConfig(CONFIG_KEYS.GWS_DEFAULT_OU, "/"));
  var batchSize = escapeHtml_(getConfig(CONFIG_KEYS.BATCH_SIZE, "100"));
  var timeLimitMin = Math.round(
    parseInt(getConfig(CONFIG_KEYS.TIME_LIMIT_MS, "1620000"), 10) / 60000,
  );
  var customSchema = escapeHtml_(getConfig(CONFIG_KEYS.CUSTOM_SCHEMA_NAME, ""));

  var html =
    "<!DOCTYPE html><html><head><style>" +
    "body{font-family:Arial,sans-serif;font-size:13px;padding:16px;}" +
    "label{display:block;margin-top:12px;font-weight:bold;}" +
    "input{width:100%;box-sizing:border-box;padding:6px;margin-top:4px;border:1px solid #ccc;border-radius:3px;}" +
    "small{color:#666;font-weight:normal;}" +
    "button{margin-top:16px;padding:8px 20px;background:#1a73e8;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;}" +
    "button:hover{background:#1557b0;}" +
    "</style></head><body>" +
    "<label>GWS ドメイン<input id='gwsDomain' type='text' value='" +
    domain +
    "' placeholder='example.com'></label>" +
    "<label>デフォルト組織単位<input id='gwsDefaultOu' type='text' value='" +
    defaultOu +
    "'></label>" +
    "<label>チェックポイント間隔（件）<input id='batchSize' type='number' min='1' max='1000' value='" +
    batchSize +
    "'><small>この件数ごとにシートへ書き込み・状態保存します。</small></label>" +
    "<label>1実行の上限（分）<input id='timeLimitMin' type='number' min='1' max='29' value='" +
    timeLimitMin +
    "'><small>GWS の実行制限は30分。余裕を持って27分程度を推奨。</small></label>" +
    "<label>カスタムスキーマ名（任意）<input id='customSchema' type='text' value='" +
    customSchema +
    "'><small>よみがな・内線をカスタム属性に反映する場合のみ。</small></label>" +
    "<button onclick='save()'>保存</button>" +
    "<script>" +
    "function save(){" +
    "var data={" +
    "gwsDomain:document.getElementById('gwsDomain').value," +
    "gwsDefaultOu:document.getElementById('gwsDefaultOu').value," +
    "batchSize:document.getElementById('batchSize').value," +
    "timeLimitMin:document.getElementById('timeLimitMin').value," +
    "customSchema:document.getElementById('customSchema').value" +
    "};" +
    "google.script.run.withSuccessHandler(function(){google.script.host.close();}).saveSetup(data);" +
    "}" +
    "</script>" +
    "</body></html>";

  var output = HtmlService.createHtmlOutput(html).setWidth(440).setHeight(520);
  SpreadsheetApp.getUi().showModalDialog(output, "初期設定");
}

function saveSetup(formData) {
  if (formData.gwsDomain !== undefined) {
    writeSetting_(CONFIG_KEYS.GWS_DOMAIN, formData.gwsDomain.trim());
  }
  if (formData.gwsDefaultOu !== undefined) {
    writeSetting_(
      CONFIG_KEYS.GWS_DEFAULT_OU,
      formData.gwsDefaultOu.trim() || "/",
    );
  }
  if (formData.batchSize !== undefined) {
    writeSetting_(
      CONFIG_KEYS.BATCH_SIZE,
      String(parseInt(formData.batchSize, 10) || 100),
    );
  }
  if (formData.timeLimitMin !== undefined) {
    var min = parseInt(formData.timeLimitMin, 10) || 27;
    if (min > 29) min = 29;
    if (min < 1) min = 1;
    writeSetting_(CONFIG_KEYS.TIME_LIMIT_MS, String(min * 60000));
  }
  if (formData.customSchema !== undefined) {
    writeSetting_(CONFIG_KEYS.CUSTOM_SCHEMA_NAME, formData.customSchema.trim());
  }
  loadConfigFromSheet();
}

// 設定シートの該当キー行を更新（無ければ追記）し、PropertiesService にも反映する。
function writeSetting_(key, value) {
  setConfig(key, value);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(getConfig(CONFIG_KEYS.SHEET_SETTINGS));
  if (!sheet) return;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value, ""]);
}

// 一括実行前の確認。削除を含む場合は二段階確認。
function confirmBulk_(counts) {
  var ui = SpreadsheetApp.getUi();
  var msg =
    "以下の内容で一括処理を実行します。\n\n" +
    "作成: " +
    counts.作成 +
    " 件\n更新: " +
    counts.更新 +
    " 件\n削除: " +
    counts.削除 +
    " 件\n停止: " +
    counts.停止 +
    " 件\n再開: " +
    counts.再開 +
    " 件\n合計: " +
    counts.total +
    " 件\n";
  if (counts.削除 > 0) {
    msg +=
      "\n⚠️ 削除 " +
      counts.削除 +
      " 件が含まれます。削除したユーザーの復元期間は約20日間のみです。\n";
  }
  msg += "\n実行しますか？";

  var resp = ui.alert("一括処理の確認", msg, ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return false;

  if (counts.削除 > 0) {
    var resp2 = ui.alert(
      "削除の最終確認",
      counts.削除 + " 件のユーザーを削除します。本当によろしいですか？",
      ui.ButtonSet.YES_NO,
    );
    if (resp2 !== ui.Button.YES) return false;
  }
  return true;
}

function showSummary_(state) {
  var ok =
    state.created +
    state.updated +
    state.deleted +
    state.suspended +
    state.restored;
  var errorRows = "";
  if (state.errors && state.errors.length > 0) {
    errorRows =
      "<tr><th colspan='2' style='background:#fee'>エラー一覧（先頭50件）</th></tr>";
    for (var i = 0; i < state.errors.length; i++) {
      errorRows +=
        "<tr><td>" +
        escapeHtml_(state.errors[i].email) +
        "</td><td>" +
        escapeHtml_(state.errors[i].error) +
        "</td></tr>";
    }
  }

  var html =
    "<!DOCTYPE html><html><head><style>" +
    "body{font-family:Arial,sans-serif;font-size:13px;padding:16px;}" +
    "table{border-collapse:collapse;width:100%;}" +
    "th,td{border:1px solid #ddd;padding:6px 10px;text-align:left;}" +
    "th{background:#f3f3f3;}" +
    "</style></head><body><table>" +
    "<tr><th>合計対象</th><td>" +
    state.total +
    " 件</td></tr>" +
    "<tr><th>成功</th><td>" +
    ok +
    " 件（作成" +
    state.created +
    "/更新" +
    state.updated +
    "/削除" +
    state.deleted +
    "/停止" +
    state.suspended +
    "/再開" +
    state.restored +
    "）</td></tr>" +
    "<tr><th>スキップ</th><td>" +
    state.skipped +
    " 件</td></tr>" +
    "<tr><th>失敗</th><td>" +
    state.failed +
    " 件</td></tr>" +
    errorRows +
    "</table></body></html>";

  var output = HtmlService.createHtmlOutput(html).setWidth(480).setHeight(360);
  SpreadsheetApp.getUi().showModalDialog(output, "一括処理の結果");
}

function showBatchStatusDialog() {
  var state = getBatchState();
  var rows;
  if (!state) {
    rows =
      "<tr><td colspan='2'>実行中・完了済みのジョブはありません。</td></tr>";
  } else {
    var fields = [
      ["ジョブID", state.jobId],
      ["ステータス", state.status],
      ["合計対象", state.total],
      ["作成", state.created],
      ["更新", state.updated],
      ["削除", state.deleted],
      ["停止", state.suspended],
      ["再開", state.restored],
      ["スキップ", state.skipped],
      ["失敗", state.failed],
      ["実行回数", state.executionCount],
    ];
    rows = "";
    for (var i = 0; i < fields.length; i++) {
      var v = fields[i][1];
      rows +=
        "<tr><th>" +
        fields[i][0] +
        "</th><td>" +
        escapeHtml_(v === undefined || v === null ? "-" : String(v)) +
        "</td></tr>";
    }
  }

  var html =
    "<!DOCTYPE html><html><head><style>" +
    "body{font-family:Arial,sans-serif;font-size:13px;padding:16px;}" +
    "table{border-collapse:collapse;width:100%;}" +
    "th,td{border:1px solid #ddd;padding:6px 10px;text-align:left;}" +
    "th{background:#f3f3f3;width:40%;}" +
    "</style></head><body><table>" +
    rows +
    "</table></body></html>";

  var output = HtmlService.createHtmlOutput(html).setWidth(420).setHeight(380);
  SpreadsheetApp.getUi().showModalDialog(output, "バッチ状態");
}

function openLog() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
    getConfig(CONFIG_KEYS.SHEET_LOG, "ログ"),
  );
  if (sheet) {
    sheet.activate();
  } else {
    SpreadsheetApp.getActiveSpreadsheet().toast("ログシートはまだありません。");
  }
}

function escapeHtml_(str) {
  return String(str === undefined || str === null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
