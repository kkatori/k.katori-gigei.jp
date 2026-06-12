/* global FUNCS, MODES, SHEET_DEFS, appConfigCache_:writable, getSpreadsheet_,
          startJobs_, requestJobCancel_, describeJobState_,
          exportActiveSheetCsv_, registerReserveTrigger_, cancelReserveTrigger_,
          registerInventoryTrigger_, cancelInventoryTrigger_,
          describeTriggerStatus_, runInitialSetup_ */

// 02_Menu.gs
// Custom menu (design 1/2, section 5) and UI handlers. Menu handlers wrap
// errors into alerts; trigger handlers never use UI.

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("グループ一括管理")
    .addSubMenu(
      ui
        .createMenu("ドライラン")
        .addItem("グループ作成・削除", "menuDryRunGroupOps")
        .addItem("メンバー追加・削除", "menuDryRunMemberOps")
        .addItem("設定変更", "menuDryRunSettingsOps"),
    )
    .addSubMenu(
      ui
        .createMenu("本実行")
        .addItem("グループ作成・削除", "menuRunGroupOps")
        .addItem("メンバー追加・削除", "menuRunMemberOps")
        .addItem("設定変更", "menuRunSettingsOps")
        .addItem("すべての指示を実行", "menuRunAllOps"),
    )
    .addSubMenu(
      ui
        .createMenu("棚卸し")
        .addItem("グループ一覧を取得", "menuInventoryGroups")
        .addItem("メンバー一覧を取得", "menuInventoryMembers")
        .addItem("設定一覧を取得", "menuInventorySettings")
        .addItem("CSVへ出力", "menuExportCsv"),
    )
    .addSubMenu(
      ui
        .createMenu("予約・定期")
        .addItem("予約実行を登録", "menuRegisterReserve")
        .addItem("予約実行を解除", "menuCancelReserve")
        .addItem("定期棚卸しを登録", "menuRegisterInventorySchedule")
        .addItem("定期棚卸しを解除", "menuCancelInventorySchedule")
        .addItem("登録状況を確認", "menuShowTriggerStatus"),
    )
    .addSubMenu(
      ui
        .createMenu("メンテナンス")
        .addItem("実行中ジョブの状態確認", "menuShowJobStatus")
        .addItem("実行中ジョブの中断", "menuCancelJob")
        .addItem("結果クリア(選択範囲)", "menuClearResults")
        .addItem("初期セットアップ(シート自動生成)", "menuInitialSetup"),
    )
    .addToUi();
}

function runWithUi_(fn) {
  try {
    return fn();
  } catch (e) {
    SpreadsheetApp.getUi().alert(
      "エラー",
      String((e && e.message) || e),
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
  }
}

// ---- Dry run / real run ------------------------------------------------------

function menuDryRunGroupOps() {
  startFromMenu_([FUNCS.GROUP_OPS], true);
}
function menuDryRunMemberOps() {
  startFromMenu_([FUNCS.MEMBER_OPS], true);
}
function menuDryRunSettingsOps() {
  startFromMenu_([FUNCS.SETTINGS_OPS], true);
}
function menuRunGroupOps() {
  startFromMenu_([FUNCS.GROUP_OPS], false);
}
function menuRunMemberOps() {
  startFromMenu_([FUNCS.MEMBER_OPS], false);
}
function menuRunSettingsOps() {
  startFromMenu_([FUNCS.SETTINGS_OPS], false);
}
function menuRunAllOps() {
  startFromMenu_(
    [FUNCS.GROUP_OPS, FUNCS.MEMBER_OPS, FUNCS.SETTINGS_OPS],
    false,
  );
}

function startFromMenu_(funcs, dryRun) {
  runWithUi_(function () {
    var ui = SpreadsheetApp.getUi();
    if (!dryRun) {
      var answer = ui.alert(
        "本実行の確認",
        "指示シートの内容をGoogleグループへ適用します。よろしいですか?\n(事前にドライランでの確認を推奨します)",
        ui.ButtonSet.OK_CANCEL,
      );
      if (answer !== ui.Button.OK) return;
    }
    appConfigCache_ = null;
    var result = startJobs_(
      funcs,
      dryRun ? MODES.DRY_RUN : MODES.MANUAL,
      dryRun,
    );
    showJobResult_(result);
  });
}

function showJobResult_(result) {
  var c = result.state.counts;
  var lines = [
    "状態: " + result.status,
    "成功: " + c.success + " / 失敗: " + c.fail + " / スキップ: " + c.skip,
  ];
  if (result.status === "継続中") {
    lines.push("実行時間上限に達したため、約1分後に自動で続きから再開します。");
    lines.push("進捗はログシートで確認できます。");
  }
  SpreadsheetApp.getUi().alert(
    "実行結果",
    lines.join("\n"),
    SpreadsheetApp.getUi().ButtonSet.OK,
  );
}

// ---- Inventory ----------------------------------------------------------------

function menuInventoryGroups() {
  runWithUi_(function () {
    appConfigCache_ = null;
    showJobResult_(startJobs_([FUNCS.INV_GROUPS], MODES.MANUAL, false));
  });
}
function menuInventoryMembers() {
  runWithUi_(function () {
    appConfigCache_ = null;
    showJobResult_(startJobs_([FUNCS.INV_MEMBERS], MODES.MANUAL, false));
  });
}
function menuInventorySettings() {
  runWithUi_(function () {
    appConfigCache_ = null;
    showJobResult_(startJobs_([FUNCS.INV_SETTINGS], MODES.MANUAL, false));
  });
}

function menuExportCsv() {
  runWithUi_(function () {
    appConfigCache_ = null;
    var file = exportActiveSheetCsv_();
    SpreadsheetApp.getUi().alert(
      "CSV出力",
      "出力しました: " + file.getName() + "\n" + file.getUrl(),
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
  });
}

// ---- Reserved / scheduled ------------------------------------------------------

function menuRegisterReserve() {
  runWithUi_(function () {
    appConfigCache_ = null;
    var info = registerReserveTrigger_();
    SpreadsheetApp.getUi().alert(
      "予約実行",
      "予約を登録しました。\n日時: " +
        info.at +
        "\n対象: " +
        info.target +
        "\n※予約実行は本実行のみです(ドライラン不可)。",
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
  });
}

function menuCancelReserve() {
  runWithUi_(function () {
    cancelReserveTrigger_();
    SpreadsheetApp.getUi().alert(
      "予約実行",
      "予約を解除しました。",
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
  });
}

function menuRegisterInventorySchedule() {
  runWithUi_(function () {
    appConfigCache_ = null;
    var schedule = registerInventoryTrigger_();
    SpreadsheetApp.getUi().alert(
      "定期棚卸し",
      "定期棚卸しを登録しました: " +
        schedule +
        "\n※時間主導型トリガーは指定時刻から前後15分程度ずれることがあります。",
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
  });
}

function menuCancelInventorySchedule() {
  runWithUi_(function () {
    cancelInventoryTrigger_();
    SpreadsheetApp.getUi().alert(
      "定期棚卸し",
      "定期棚卸しを解除しました。",
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
  });
}

function menuShowTriggerStatus() {
  runWithUi_(function () {
    SpreadsheetApp.getUi().alert(
      "登録状況",
      describeTriggerStatus_(),
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
  });
}

// ---- Maintenance ----------------------------------------------------------------

function menuShowJobStatus() {
  runWithUi_(function () {
    SpreadsheetApp.getUi().alert(
      "実行中ジョブ",
      describeJobState_(),
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
  });
}

function menuCancelJob() {
  runWithUi_(function () {
    SpreadsheetApp.getUi().alert(
      "中断",
      requestJobCancel_(),
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
  });
}

// Clears the 4 result columns for the selected rows of the active instruction
// sheet, so those rows become processable again (section 3.1).
function menuClearResults() {
  runWithUi_(function () {
    var ui = SpreadsheetApp.getUi();
    var sheet = getSpreadsheet_().getActiveSheet();
    var def = SHEET_DEFS[sheet.getName()];
    if (!def || !def.resultCol) {
      throw new Error(
        "指示シート(指示_グループ / 指示_メンバー / 指示_設定変更)上で実行してください。",
      );
    }
    var selection = getSpreadsheet_().getSelection().getActiveRange();
    if (!selection) throw new Error("クリアする行を選択してください。");
    var startRow = Math.max(selection.getRow(), 2);
    var endRow = Math.min(selection.getLastRow(), sheet.getLastRow());
    if (endRow < startRow) throw new Error("クリア対象の行がありません。");
    var answer = ui.alert(
      "結果クリア",
      "行 " +
        startRow +
        "〜" +
        endRow +
        " の結果列をクリアします。よろしいですか?\n(クリアした行は次回実行の対象に戻ります)",
      ui.ButtonSet.OK_CANCEL,
    );
    if (answer !== ui.Button.OK) return;
    sheet
      .getRange(startRow, def.resultCol, endRow - startRow + 1, 4)
      .clearContent();
  });
}

function menuInitialSetup() {
  runWithUi_(function () {
    runInitialSetup_();
    SpreadsheetApp.getUi().alert(
      "初期セットアップ",
      "シート・見出し・入力規則・マスタ選択肢を生成しました。\n設定シートの CSV_FOLDER_ID などを入力してから利用を開始してください。",
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
  });
}
