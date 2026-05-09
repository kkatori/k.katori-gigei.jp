/* global CONFIG_KEYS, getConfig, getToolMode, isFeatureEnabled, getBatchState, setConfig,
          loadConfigFromSheet,
          exportUsersToSheet, exportGroupsToSheet,
          runGwsWorkflow, runRakumoWorkflow, runIntegratedWorkflow,
          resumeBatch, cancelBatch */

function buildToolMenu() {
  var ui = SpreadsheetApp.getUi();
  var mode = getToolMode();
  var menu = ui.createMenu("ユーザー管理ツール");

  menu.addItem("初期設定...", "showSetupDialog");
  menu.addSeparator();

  if (isFeatureEnabled("gws")) {
    var gwsUserMenu = ui
      .createMenu("GWS ユーザー")
      .addItem("GWSからインポート", "menuGwsImportUsers")
      .addItem("ユーザー一括登録", "menuGwsCreateUsers")
      .addItem("ユーザー一括更新", "menuGwsUpdateUsers")
      .addItem("ユーザー一括削除", "menuGwsDeleteUsers");
    menu.addSubMenu(gwsUserMenu);

    var gwsGroupMenu = ui
      .createMenu("GWS グループ")
      .addItem("グループ一覧取得", "menuGwsListGroups")
      .addItem("グループ作成", "menuGwsCreateGroup")
      .addItem("メンバー同期", "menuGwsSyncGroupMembers")
      .addItem("グループ削除", "menuGwsDeleteGroup");
    menu.addSubMenu(gwsGroupMenu);
  }

  if (isFeatureEnabled("rakumo")) {
    var rakumoMenu = ui
      .createMenu("rakumo")
      .addItem("rakumoからCSVダウンロード", "menuRakumoDownloadCsv")
      .addItem("プロファイルCSVアップロード", "menuRakumoUploadProfileCsv")
      .addItem("ライセンスCSVアップロード", "menuRakumoUploadLicenseCsv")
      .addItem("部門CSVアップロード", "menuRakumoUploadDepartmentCsv")
      .addItem("Google同期実行", "menuRakumoGoogleSync");
    menu.addSubMenu(rakumoMenu);
  }

  if (mode === "integrated") {
    var integratedMenu = ui
      .createMenu("統合フロー")
      .addItem("一括登録（GWS→同期→rakumo）", "menuIntegratedCreate")
      .addItem("一括更新（GWS→同期→rakumo）", "menuIntegratedUpdate")
      .addItem("一括削除", "menuIntegratedDelete");
    menu.addSubMenu(integratedMenu);
  }

  menu.addSeparator();
  menu
    .addItem("バッチ状態確認", "menuShowBatchStatus")
    .addItem("バッチ再開", "menuResumeBatch")
    .addItem("バッチキャンセル", "menuCancelBatch");
  menu.addSeparator();
  menu.addItem("ログ確認", "menuShowLog");

  menu.addToUi();
}

function showSetupDialog() {
  var currentMode = getConfig(CONFIG_KEYS.TOOL_MODE, "integrated");
  var rakumoApiKey = getConfig(CONFIG_KEYS.RAKUMO_API_KEY, "");
  var rakumoSecretKey = getConfig(CONFIG_KEYS.RAKUMO_SECRET_KEY, "");
  var gwsDomain = getConfig(CONFIG_KEYS.GWS_DOMAIN, "");
  var gwsDefaultOu = getConfig(CONFIG_KEYS.GWS_DEFAULT_OU, "/");
  var batchSize = getConfig(CONFIG_KEYS.BATCH_SIZE, "50");

  var html =
    "<!DOCTYPE html><html><head><style>" +
    "body{font-family:Arial,sans-serif;font-size:13px;padding:16px;}" +
    "label{display:block;margin-top:12px;font-weight:bold;}" +
    "input,select{width:100%;box-sizing:border-box;padding:6px;margin-top:4px;border:1px solid #ccc;border-radius:3px;}" +
    "button{margin-top:16px;padding:8px 20px;background:#1a73e8;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;}" +
    "button:hover{background:#1557b0;}" +
    "</style></head><body>" +
    "<label>ツールモード" +
    "<select id='toolMode'>" +
    "<option value='integrated'" +
    (currentMode === "integrated" ? " selected" : "") +
    ">統合 (integrated)</option>" +
    "<option value='gws'" +
    (currentMode === "gws" ? " selected" : "") +
    ">GWS のみ</option>" +
    "<option value='rakumo'" +
    (currentMode === "rakumo" ? " selected" : "") +
    ">rakumo のみ</option>" +
    "</select></label>" +
    "<label>rakumo API キー<input id='rakumoApiKey' type='text' value='" +
    rakumoApiKey +
    "'></label>" +
    "<label>rakumo シークレットキー<input id='rakumoSecretKey' type='password' value='" +
    rakumoSecretKey +
    "'></label>" +
    "<label>GWS ドメイン<input id='gwsDomain' type='text' value='" +
    gwsDomain +
    "'></label>" +
    "<label>デフォルト組織単位<input id='gwsDefaultOu' type='text' value='" +
    gwsDefaultOu +
    "'></label>" +
    "<label>バッチサイズ<input id='batchSize' type='number' min='1' max='500' value='" +
    batchSize +
    "'></label>" +
    "<button onclick='save()'>保存</button>" +
    "<script>" +
    "function save(){" +
    "var data={" +
    "toolMode:document.getElementById('toolMode').value," +
    "rakumoApiKey:document.getElementById('rakumoApiKey').value," +
    "rakumoSecretKey:document.getElementById('rakumoSecretKey').value," +
    "gwsDomain:document.getElementById('gwsDomain').value," +
    "gwsDefaultOu:document.getElementById('gwsDefaultOu').value," +
    "batchSize:document.getElementById('batchSize').value" +
    "};" +
    "google.script.run.withSuccessHandler(function(){google.script.host.close();}).saveSetup(data);" +
    "}" +
    "</script>" +
    "</body></html>";

  var output = HtmlService.createHtmlOutput(html).setWidth(420).setHeight(480);
  SpreadsheetApp.getUi().showModalDialog(output, "初期設定");
}

function saveSetup(formData) {
  if (formData.toolMode) setConfig(CONFIG_KEYS.TOOL_MODE, formData.toolMode);
  if (formData.rakumoApiKey !== undefined)
    setConfig(CONFIG_KEYS.RAKUMO_API_KEY, formData.rakumoApiKey);
  if (formData.rakumoSecretKey !== undefined)
    setConfig(CONFIG_KEYS.RAKUMO_SECRET_KEY, formData.rakumoSecretKey);
  if (formData.gwsDomain !== undefined)
    setConfig(CONFIG_KEYS.GWS_DOMAIN, formData.gwsDomain);
  if (formData.gwsDefaultOu !== undefined)
    setConfig(CONFIG_KEYS.GWS_DEFAULT_OU, formData.gwsDefaultOu);
  if (formData.batchSize !== undefined)
    setConfig(CONFIG_KEYS.BATCH_SIZE, formData.batchSize);
  loadConfigFromSheet();
}

function confirmOperation(operation, affectedRows) {
  var ui = SpreadsheetApp.getUi();
  var response = ui.alert(
    operation + "\n対象: " + affectedRows + "件\n実行しますか？",
    ui.ButtonSet.YES_NO,
  );
  return response === ui.Button.YES;
}

function showCompletionSummary(summary) {
  var errorRows = "";
  if (summary.errors && summary.errors.length > 0) {
    errorRows = "<tr><th>エラー一覧</th><td></td></tr>";
    for (var i = 0; i < summary.errors.length; i++) {
      var e = summary.errors[i];
      errorRows += "<tr><td>行 " + e.row + "</td><td>" + e.error + "</td></tr>";
    }
  }

  var html =
    "<!DOCTYPE html><html><head><style>" +
    "body{font-family:Arial,sans-serif;font-size:13px;padding:16px;}" +
    "table{border-collapse:collapse;width:100%;}" +
    "th,td{border:1px solid #ddd;padding:6px 10px;}" +
    "th{background:#f3f3f3;text-align:left;}" +
    "</style></head><body>" +
    "<table>" +
    "<tr><th>合計</th><td>" +
    (summary.total || 0) +
    " 件</td></tr>" +
    "<tr><th>成功</th><td>" +
    (summary.success || 0) +
    " 件</td></tr>" +
    "<tr><th>失敗</th><td>" +
    (summary.failed || 0) +
    " 件</td></tr>" +
    "<tr><th>スキップ</th><td>" +
    (summary.skipped || 0) +
    " 件</td></tr>" +
    errorRows +
    "</table></body></html>";

  var output = HtmlService.createHtmlOutput(html).setWidth(400).setHeight(300);
  SpreadsheetApp.getUi().showModalDialog(output, "処理結果");
}

function showBatchStatusDialog() {
  var state = getBatchState();
  var rows = "";

  if (!state) {
    rows = "<tr><td colspan='2'>実行中のバッチはありません</td></tr>";
  } else {
    var fields = [
      ["ジョブID", state.jobId],
      ["ステータス", state.status],
      ["ワークフロー", state.workflow],
      ["操作", state.operation],
      ["処理済み", state.processedCount],
      ["成功", state.successCount],
      ["失敗", state.failedCount],
      ["スキップ", state.skippedCount],
      ["実行回数", state.executionCount],
      ["開始日時", state.startedAt],
      ["最終再開", state.lastResumedAt],
    ];
    for (var i = 0; i < fields.length; i++) {
      var val =
        fields[i][1] !== undefined && fields[i][1] !== null
          ? fields[i][1]
          : "-";
      rows += "<tr><th>" + fields[i][0] + "</th><td>" + val + "</td></tr>";
    }
  }

  var html =
    "<!DOCTYPE html><html><head><style>" +
    "body{font-family:Arial,sans-serif;font-size:13px;padding:16px;}" +
    "table{border-collapse:collapse;width:100%;}" +
    "th,td{border:1px solid #ddd;padding:6px 10px;}" +
    "th{background:#f3f3f3;text-align:left;width:40%;}" +
    "</style></head><body>" +
    "<table>" +
    rows +
    "</table>" +
    "</body></html>";

  var output = HtmlService.createHtmlOutput(html).setWidth(400).setHeight(360);
  SpreadsheetApp.getUi().showModalDialog(output, "バッチ状態");
}

function menuGwsImportUsers() {
  exportUsersToSheet("gws");
}

function menuGwsCreateUsers() {
  runGwsWorkflow("create");
}

function menuGwsUpdateUsers() {
  runGwsWorkflow("update");
}

function menuGwsDeleteUsers() {
  runGwsWorkflow("delete");
}

function menuGwsListGroups() {
  exportGroupsToSheet();
}

function menuGwsCreateGroup() {
  runGwsWorkflow("create_group");
}

function menuGwsSyncGroupMembers() {
  runGwsWorkflow("sync_members");
}

function menuGwsDeleteGroup() {
  runGwsWorkflow("delete_group");
}

function menuRakumoDownloadCsv() {
  runRakumoWorkflow("download");
}

function menuRakumoUploadProfileCsv() {
  runRakumoWorkflow("profile");
}

function menuRakumoUploadLicenseCsv() {
  runRakumoWorkflow("license");
}

function menuRakumoUploadDepartmentCsv() {
  runRakumoWorkflow("department");
}

function menuRakumoGoogleSync() {
  runRakumoWorkflow("sync");
}

function menuIntegratedCreate() {
  runIntegratedWorkflow("create");
}

function menuIntegratedUpdate() {
  runIntegratedWorkflow("update");
}

function menuIntegratedDelete() {
  runIntegratedWorkflow("delete");
}

function menuShowBatchStatus() {
  showBatchStatusDialog();
}

function menuResumeBatch() {
  resumeBatch();
}

function menuCancelBatch() {
  cancelBatch();
}

function menuShowLog() {
  SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(getConfig(CONFIG_KEYS.SHEET_LOG, "ログ"))
    .activate();
}
