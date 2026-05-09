/* global CONFIG_KEYS, getConfig, getToolMode, getBatchState, saveBatchState,
          readSheetData, readRowsByStatus, writeSheetData, updateRowStatus, ROW_STATUS,
          rowsToObjects, SHEET_TO_CSV_MAP,
          showToast, showProgressDialog,
          logInfo, logError, logWarn,
          downloadProfileCsv, uploadProfileCsv,
          startGoogleSync, waitForSyncCompletion,
          listUsers, batchCreateUsers, batchUpdateUsers,
          listGroups, listMembers, syncGroupMembers,
          confirmOperation, showCompletionSummary,
          generateProfileCsvFromSheet, generateLicenseCsvFromSheet, generateDepartmentCsvFromSheet,
          generateBatchSummary */

var WORKFLOW_STEP = {
  GWS_CREATE: "gws_create",
  GWS_UPDATE: "gws_update",
  WAIT_SYNC: "wait_sync",
  RAKUMO_DOWNLOAD: "rakumo_download",
  RAKUMO_GENERATE: "rakumo_generate",
  RAKUMO_UPLOAD: "rakumo_upload",
  COMPLETE: "complete",
};

var TIME_LIMIT_MS = 300000; // 5 minutes (1 min buffer from 6-min GAS limit)

function runIntegratedWorkflow(operation) {
  if (getToolMode() !== "integrated") {
    showToast("統合モードでのみ使用できます");
    return;
  }

  var sheetName = getConfig(CONFIG_KEYS.SHEET_USERS);
  var result = readRowsByStatus(sheetName, [ROW_STATUS.PENDING]);
  var opColIndex = result.headers.indexOf("操作");

  var rows = result.rows;
  if (opColIndex !== -1) {
    rows = rows.filter(function (row) {
      return row[opColIndex] === operation;
    });
  }

  if (rows.length === 0) {
    showToast("処理対象のデータがありません");
    return;
  }

  if (!confirmOperation("統合フロー: " + operation, rows.length)) {
    return;
  }

  var jobId =
    "job_" +
    Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyyMMdd_HHmmss") +
    "_" +
    Math.random().toString(36).substr(2, 6);

  PropertiesService.getScriptProperties().setProperty("CURRENT_JOB_ID", jobId);

  var firstStep =
    operation === "update"
      ? WORKFLOW_STEP.GWS_UPDATE
      : WORKFLOW_STEP.GWS_CREATE;

  var state = {
    jobId: jobId,
    operation: operation,
    workflowType: "integrated",
    currentStep: firstStep,
    currentIndex: 0,
    totalRows: rows.length,
    status: "running",
    batchSize: parseInt(getConfig(CONFIG_KEYS.BATCH_SIZE, "50"), 10),
    errors: [],
    stepResults: {},
    startedAt: Date.now(),
    lastResumedAt: Date.now(),
    executionCount: 1,
  };

  saveBatchState(state);
  logInfo(
    "workflows",
    "runIntegratedWorkflow",
    "統合ワークフロー開始: " + operation + ", " + rows.length + "件",
    { jobId: jobId },
  );

  executeNextBatch();
}

function runGwsWorkflow(operation) {
  var isGroupOp =
    operation === "create_group" ||
    operation === "sync_members" ||
    operation === "delete_group";
  var sheetKey = isGroupOp ? CONFIG_KEYS.SHEET_GROUPS : CONFIG_KEYS.SHEET_USERS;
  var sheetName = getConfig(sheetKey);

  var result = readRowsByStatus(sheetName, [ROW_STATUS.PENDING]);
  var opColIndex = result.headers.indexOf("操作");

  var rows = result.rows;
  if (opColIndex !== -1) {
    rows = rows.filter(function (row) {
      return row[opColIndex] === operation;
    });
  }

  if (rows.length === 0) {
    showToast("処理対象のデータがありません");
    return;
  }

  if (!confirmOperation("GWS フロー: " + operation, rows.length)) {
    return;
  }

  var jobId =
    "job_" +
    Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyyMMdd_HHmmss") +
    "_" +
    Math.random().toString(36).substr(2, 6);

  PropertiesService.getScriptProperties().setProperty("CURRENT_JOB_ID", jobId);

  var firstStep =
    operation === "update"
      ? WORKFLOW_STEP.GWS_UPDATE
      : WORKFLOW_STEP.GWS_CREATE;

  var state = {
    jobId: jobId,
    operation: operation,
    workflowType: "gws",
    currentStep: firstStep,
    currentIndex: 0,
    totalRows: rows.length,
    status: "running",
    batchSize: parseInt(getConfig(CONFIG_KEYS.BATCH_SIZE, "50"), 10),
    errors: [],
    stepResults: {},
    startedAt: Date.now(),
    lastResumedAt: Date.now(),
    executionCount: 1,
  };

  saveBatchState(state);
  logInfo(
    "workflows",
    "runGwsWorkflow",
    "GWS ワークフロー開始: " + operation + ", " + rows.length + "件",
    { jobId: jobId },
  );

  executeNextBatch();
}

function runRakumoWorkflow(csvType) {
  if (csvType === "download") {
    try {
      var downloaded = downloadProfileCsv();
      var sheetName = getConfig(CONFIG_KEYS.SHEET_USERS);
      if (downloaded.rows.length > 0) {
        writeSheetData(sheetName, downloaded.headers, downloaded.rows);
      }
      logInfo(
        "workflows",
        "runRakumoWorkflow",
        "CSV ダウンロード完了: " + downloaded.rows.length + "件",
      );
      showToast("CSV ダウンロード完了: " + downloaded.rows.length + "件");
    } catch (e) {
      logError(
        "workflows",
        "runRakumoWorkflow",
        "CSV ダウンロード失敗: " + e.message,
      );
      showToast("CSV ダウンロード失敗: " + e.message);
    }
    return;
  }

  if (csvType === "sync") {
    try {
      var syncResult = startGoogleSync();
      logInfo("workflows", "runRakumoWorkflow", syncResult.message);
      showToast(syncResult.message);
    } catch (e) {
      logError(
        "workflows",
        "runRakumoWorkflow",
        "Google同期失敗: " + e.message,
      );
      showToast("Google同期失敗: " + e.message);
    }
    return;
  }

  try {
    var csv;
    if (csvType === "profile") {
      csv = generateProfileCsvFromSheet();
      var uploadResult = uploadProfileCsv(csv);
      logInfo(
        "workflows",
        "runRakumoWorkflow",
        "プロファイル CSV アップロード: " + uploadResult.message,
      );
      showToast(uploadResult.message);
    } else if (csvType === "license") {
      csv = generateLicenseCsvFromSheet();
      var licenseResult = uploadProfileCsv(csv);
      logInfo(
        "workflows",
        "runRakumoWorkflow",
        "ライセンス CSV アップロード: " + licenseResult.message,
      );
      showToast(licenseResult.message);
    } else if (csvType === "department") {
      csv = generateDepartmentCsvFromSheet();
      var deptResult = uploadProfileCsv(csv);
      logInfo(
        "workflows",
        "runRakumoWorkflow",
        "部門 CSV アップロード: " + deptResult.message,
      );
      showToast(deptResult.message);
    } else {
      showToast("不明な CSV タイプ: " + csvType);
    }
  } catch (e) {
    logError(
      "workflows",
      "runRakumoWorkflow",
      "CSV アップロード失敗: " + e.message,
    );
    showToast("CSV アップロード失敗: " + e.message);
  }
}

function executeNextBatch() {
  var state = getBatchState();
  if (!state || state.status !== "running") return true;

  var startTime = Date.now();
  var sheetName = getConfig(CONFIG_KEYS.SHEET_USERS);

  try {
    if (
      state.currentStep === WORKFLOW_STEP.GWS_CREATE ||
      state.currentStep === WORKFLOW_STEP.GWS_UPDATE
    ) {
      var pending = readRowsByStatus(sheetName, [ROW_STATUS.PENDING]);
      var users = rowsToObjects(pending.headers, pending.rows).map(
        function (obj, idx) {
          return mapSheetRowToUserData_(pending.headers, pending.rows[idx]);
        },
      );

      var batchResult;
      if (state.currentStep === WORKFLOW_STEP.GWS_CREATE) {
        batchResult = batchCreateUsers(
          users,
          state.currentIndex,
          state.batchSize,
        );
      } else {
        var updates = users.map(function (u) {
          return { userKey: u.primaryEmail, fields: u };
        });
        batchResult = batchUpdateUsers(
          updates,
          state.currentIndex,
          state.batchSize,
        );
      }

      // バッチ結果に基づきシート行ステータスを更新
      if (pending.sheet && batchResult.results) {
        for (var r = 0; r < batchResult.results.length; r++) {
          var res = batchResult.results[r];
          var rowIdx = pending.rowIndices[res.index];
          if (rowIdx) {
            var st =
              res.status === "success"
                ? ROW_STATUS.SUCCESS
                : res.status === "failed"
                  ? ROW_STATUS.FAILED
                  : ROW_STATUS.SKIPPED;
            updateRowStatus(pending.sheet, rowIdx, st, res.error || "");
          }
        }
      }

      state.currentIndex += batchResult.processed;
      state.stepResults[state.currentStep] = state.stepResults[
        state.currentStep
      ] || {
        processed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
      };
      var sr = state.stepResults[state.currentStep];
      sr.processed += batchResult.processed;
      sr.succeeded += batchResult.succeeded;
      sr.failed += batchResult.failed;
      sr.skipped += batchResult.skipped;

      if (state.currentIndex >= state.totalRows) {
        if (state.workflowType === "integrated") {
          state.currentStep = WORKFLOW_STEP.WAIT_SYNC;
          state.currentIndex = 0;
        } else {
          state.currentStep = WORKFLOW_STEP.COMPLETE;
        }
      } else if (Date.now() - startTime > TIME_LIMIT_MS) {
        saveBatchState(state);
        chainNextTrigger_();
        return false;
      }

      saveBatchState(state);

      if (state.currentStep !== WORKFLOW_STEP.COMPLETE) {
        return executeNextBatch();
      }
    }

    if (state.currentStep === WORKFLOW_STEP.WAIT_SYNC) {
      var elapsed = Date.now() - startTime;
      var remainingMs = TIME_LIMIT_MS - elapsed;
      var remainingSeconds = Math.max(30, Math.floor(remainingMs / 1000));

      var syncStatus = waitForSyncCompletion(remainingSeconds);

      if (syncStatus.completed) {
        state.stepResults[WORKFLOW_STEP.WAIT_SYNC] = {
          success: syncStatus.success,
          details: syncStatus.details,
        };
        state.currentStep = WORKFLOW_STEP.RAKUMO_DOWNLOAD;
        saveBatchState(state);
        return executeNextBatch();
      } else {
        saveBatchState(state);
        chainNextTrigger_();
        return false;
      }
    }

    if (state.currentStep === WORKFLOW_STEP.RAKUMO_DOWNLOAD) {
      var downloaded = downloadProfileCsv();
      PropertiesService.getScriptProperties().setProperty(
        "RAKUMO_CSV_CACHE",
        JSON.stringify({
          headers: downloaded.headers,
          rowCount: downloaded.rows.length,
        }),
      );
      state.stepResults[WORKFLOW_STEP.RAKUMO_DOWNLOAD] = {
        rowCount: downloaded.rows.length,
      };
      state.currentStep = WORKFLOW_STEP.RAKUMO_GENERATE;
      saveBatchState(state);
      return executeNextBatch();
    }

    if (state.currentStep === WORKFLOW_STEP.RAKUMO_GENERATE) {
      var csvContent = generateProfileCsvFromSheet();
      // CacheService limit is 100KB per entry; fall back to PropertiesService for larger content
      try {
        CacheService.getScriptCache().put("RAKUMO_UPLOAD_CSV", csvContent, 600);
      } catch (_cacheErr) {
        PropertiesService.getScriptProperties().setProperty(
          "RAKUMO_UPLOAD_CSV",
          csvContent,
        );
      }
      state.stepResults[WORKFLOW_STEP.RAKUMO_GENERATE] = { generated: true };
      state.currentStep = WORKFLOW_STEP.RAKUMO_UPLOAD;
      saveBatchState(state);
      return executeNextBatch();
    }

    if (state.currentStep === WORKFLOW_STEP.RAKUMO_UPLOAD) {
      var cachedCsv = CacheService.getScriptCache().get("RAKUMO_UPLOAD_CSV");
      if (!cachedCsv) {
        cachedCsv =
          PropertiesService.getScriptProperties().getProperty(
            "RAKUMO_UPLOAD_CSV",
          ) || "";
      }
      var uploadResult = uploadProfileCsv(cachedCsv);

      try {
        CacheService.getScriptCache().remove("RAKUMO_UPLOAD_CSV");
      } catch (cacheRemoveErr) {
        logWarn(
          "workflows",
          "executeNextBatch",
          "Cache remove failed: " + cacheRemoveErr.message,
        );
      }
      PropertiesService.getScriptProperties().deleteProperty(
        "RAKUMO_UPLOAD_CSV",
      );

      state.stepResults[WORKFLOW_STEP.RAKUMO_UPLOAD] = {
        success: uploadResult.success,
        message: uploadResult.message,
      };
      state.currentStep = WORKFLOW_STEP.COMPLETE;
      saveBatchState(state);
      return executeNextBatch();
    }

    if (state.currentStep === WORKFLOW_STEP.COMPLETE) {
      state.status = "completed";
      saveBatchState(state);
      cleanupTriggers_();
      PropertiesService.getScriptProperties().deleteProperty("CURRENT_JOB_ID");

      var summary = generateBatchSummary(state.jobId);
      showCompletionSummary(summary);
      logInfo(
        "workflows",
        "executeNextBatch",
        "ワークフロー完了: " + state.jobId,
        summary,
      );
      return true;
    }
  } catch (e) {
    logError(
      "workflows",
      "executeNextBatch",
      "バッチ実行エラー: " + e.message,
      { step: state.currentStep, jobId: state.jobId },
    );
    state.status = "failed";
    state.errors.push({ step: state.currentStep, error: e.message });
    saveBatchState(state);
    cleanupTriggers_();
    showToast("バッチ処理でエラーが発生しました: " + e.message);
    return false;
  }

  return true;
}

function exportUsersToSheet(source) {
  var sheetName = getConfig(CONFIG_KEYS.SHEET_USERS);
  var count = 0;

  if (source === "gws" || source === "both") {
    var gwsUsers = listUsers();
    var gwsRows = gwsUsers.map(function (u) {
      var name = u.name || {};
      return [
        ROW_STATUS.SUCCESS,
        "",
        u.primaryEmail || "",
        name.familyName || "",
        name.givenName || "",
        "",
        "",
        "",
        u.orgUnitPath || "/",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ];
    });
    writeSheetData(sheetName, getUserSheetHeaders_(), gwsRows);
    count += gwsUsers.length;
  }

  if (source === "rakumo" || source === "both") {
    var downloaded = downloadProfileCsv();
    if (downloaded.rows.length > 0) {
      writeSheetData(sheetName, downloaded.headers, downloaded.rows);
    }
    count += downloaded.rows.length;
  }

  logInfo(
    "workflows",
    "exportUsersToSheet",
    "ユーザーエクスポート完了: " + count + "件",
    { source: source },
  );
  showToast("ユーザーエクスポート完了: " + count + "件");
}

function exportGroupsToSheet() {
  var sheetName = getConfig(CONFIG_KEYS.SHEET_GROUPS);
  var groups = listGroups();
  var rows = [];

  for (var i = 0; i < groups.length; i++) {
    var group = groups[i];
    var members = listMembers(group.email);

    var memberEmails = members
      .filter(function (m) {
        return m.role === "MEMBER";
      })
      .map(function (m) {
        return m.email;
      })
      .join(",");
    var managerEmails = members
      .filter(function (m) {
        return m.role === "MANAGER";
      })
      .map(function (m) {
        return m.email;
      })
      .join(",");
    var ownerEmails = members
      .filter(function (m) {
        return m.role === "OWNER";
      })
      .map(function (m) {
        return m.email;
      })
      .join(",");

    rows.push([
      ROW_STATUS.SUCCESS,
      "",
      group.email || "",
      group.name || "",
      group.description || "",
      memberEmails,
      managerEmails,
      ownerEmails,
      "",
    ]);
  }

  var headers = [
    "ステータス",
    "メッセージ",
    "グループメール",
    "グループ名",
    "説明",
    "メンバー",
    "マネージャー",
    "オーナー",
    "操作",
  ];
  writeSheetData(sheetName, headers, rows);

  logInfo(
    "workflows",
    "exportGroupsToSheet",
    "グループエクスポート完了: " + groups.length + "件",
  );
  showToast("グループエクスポート完了: " + groups.length + "件");
}

function showWorkflowSummary(jobId) {
  var summary = generateBatchSummary(jobId);

  var errorRows = "";
  if (summary.errors && summary.errors.length > 0) {
    errorRows +=
      "<tr><th colspan='2' style='background:#fee'>エラー一覧</th></tr>";
    for (var i = 0; i < summary.errors.length; i++) {
      var e = summary.errors[i];
      errorRows +=
        "<tr><td>行 " +
        (e.row || "-") +
        "</td><td>" +
        escapeHtmlSummary_(String(e.error)) +
        "</td></tr>";
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
    "<tr><th>ジョブID</th><td>" +
    escapeHtmlSummary_(String(jobId)) +
    "</td></tr>" +
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

  var output = HtmlService.createHtmlOutput(html).setWidth(460).setHeight(360);
  SpreadsheetApp.getUi().showModalDialog(output, "ワークフロー結果: " + jobId);
}

function chainNextTrigger_() {
  cleanupTriggers_();
  ScriptApp.newTrigger("resumeBatch").timeBased().after(1000).create();
}

function cleanupTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "resumeBatch") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

function calculateSafeBatchSize_(avgMsPerOp, elapsedMs) {
  var remaining = TIME_LIMIT_MS - elapsedMs;
  return Math.max(1, Math.floor(remaining / avgMsPerOp));
}

function mapSheetRowToUserData_(headers, row) {
  var obj = {};
  for (var i = 0; i < headers.length; i++) {
    obj[headers[i]] = row[i] !== undefined ? row[i] : "";
  }

  var changeAtLogin = obj["次回PW変更"];
  return {
    primaryEmail: obj["メールアドレス"] || "",
    firstName: obj["名"] || "",
    lastName: obj["姓"] || "",
    password: obj["パスワード"] || "",
    orgUnitPath: obj["組織単位"] || getConfig(CONFIG_KEYS.GWS_DEFAULT_OU, "/"),
    changePasswordAtNextLogin:
      changeAtLogin === true ||
      changeAtLogin === "TRUE" ||
      changeAtLogin === "true",
  };
}

function getUserSheetHeaders_() {
  return [
    "ステータス",
    "メッセージ",
    "メールアドレス",
    "姓",
    "名",
    "姓(よみ)",
    "名(よみ)",
    "パスワード",
    "組織単位",
    "会社名",
    "会社名(よみ)",
    "部門メール",
    "部門名",
    "役職",
    "生年月日",
    "住所",
    "電話番号",
    "内線番号",
    "FAX",
    "携帯電話",
    "メール2",
    "メール3",
    "社員番号",
    "プライマリ",
    "表示",
    "Calendar",
    "Contacts",
    "Workflow",
    "Board",
    "Expense",
    "Attendance",
    "操作",
    "次回PW変更",
  ];
}

function escapeHtmlSummary_(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
