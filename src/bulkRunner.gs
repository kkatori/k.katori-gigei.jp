/* global CONFIG_KEYS, getConfig, getBatchState, saveBatchState, loadConfigFromSheet,
          readSheetData, updateRowStatusBatch, ROW_STATUS, showToast,
          OPERATIONS, isValidOperation, str_,
          parseRow_, toCreateResource, toUpdateResource, needsCurrentForUpdate,
          insertUser, patchUser, getUser, setSuspended, removeUser, syncAliases,
          isAlreadyExistsError_,
          logInfo, logError,
          confirmBulk_, showSummary_ */

// 1 シート上で 作成/更新/削除/停止/再開 を混合し一括処理する中核。
// 冪等な「待機中スキャン」方式 + 実行時間制限（GWS 30 分）対応のトリガー連鎖。

// 待機中・有効操作の行を集計する。
function countByOp_(headers, rows) {
  var targets = findTargets_(headers, rows);
  var counts = {
    作成: 0,
    更新: 0,
    削除: 0,
    停止: 0,
    再開: 0,
    total: targets.length,
  };
  for (var i = 0; i < targets.length; i++) {
    counts[targets[i].op]++;
  }
  return counts;
}

// 操作が有効で、ステータスが {空, 待機中, 失敗} の行を対象とする。
function findTargets_(headers, rows) {
  var opIdx = headers.indexOf("操作");
  var stIdx = headers.indexOf("ステータス");
  var targets = [];
  for (var i = 0; i < rows.length; i++) {
    var op = str_(rows[i][opIdx]);
    if (!isValidOperation(op)) continue;
    var st = str_(rows[i][stIdx]);
    if (st === "" || st === ROW_STATUS.PENDING || st === ROW_STATUS.FAILED) {
      targets.push({ rowIndex: i + 2, op: op });
    }
  }
  return targets;
}

// メニュー「一括実行」のエントリ。
function runBulk() {
  loadConfigFromSheet();

  if (!getConfig(CONFIG_KEYS.GWS_DOMAIN)) {
    showToast("先に『初期設定』で GWS ドメインを設定してください。");
    return;
  }

  var existing = getBatchState();
  if (existing && existing.status === "running") {
    showToast("実行中のジョブがあります。完了またはキャンセルしてください。");
    return;
  }

  var sheetName = getConfig(CONFIG_KEYS.SHEET_USERS);
  var data = readSheetData(sheetName);
  if (!data.sheet) {
    showToast(
      "ユーザー一覧シートがありません。『シート初期化』を実行してください。",
    );
    return;
  }

  var counts = countByOp_(data.headers, data.rows);
  if (counts.total === 0) {
    showToast("処理対象の行がありません（操作列を設定してください）。");
    return;
  }

  if (!confirmBulk_(counts)) return;

  // 対象行を待機中にする（1 回のバッチ書き込み）。
  var targets = findTargets_(data.headers, data.rows);
  var pendingUpdates = targets.map(function (t) {
    return { rowIndex: t.rowIndex, status: ROW_STATUS.PENDING, message: "" };
  });
  updateRowStatusBatch(data.sheet, pendingUpdates);

  var jobId =
    "job_" + Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyyMMdd_HHmmss");
  PropertiesService.getScriptProperties().setProperty("CURRENT_JOB_ID", jobId);

  var state = {
    jobId: jobId,
    status: "running",
    total: counts.total,
    created: 0,
    updated: 0,
    deleted: 0,
    suspended: 0,
    restored: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    startedAt: Date.now(),
    executionCount: 1,
  };
  saveBatchState(state);

  logInfo(
    "bulkRunner",
    "runBulk",
    "一括処理開始: 合計" +
      counts.total +
      "件 (作成" +
      counts.作成 +
      "/更新" +
      counts.更新 +
      "/削除" +
      counts.削除 +
      "/停止" +
      counts.停止 +
      "/再開" +
      counts.再開 +
      ")",
  );

  executeBulk();
}

// 1 実行分の処理。時間上限まで待機中の行を処理し、残れば自動再開トリガーを張る。
function executeBulk() {
  var state = getBatchState();
  if (!state || state.status !== "running") {
    cleanupTriggers_();
    return;
  }

  var startTime = Date.now();
  var timeLimit = parseInt(getConfig(CONFIG_KEYS.TIME_LIMIT_MS, "1620000"), 10);
  var chunk = parseInt(getConfig(CONFIG_KEYS.BATCH_SIZE, "100"), 10);
  if (chunk < 1) chunk = 1;

  var sheetName = getConfig(CONFIG_KEYS.SHEET_USERS);
  var data = readSheetData(sheetName);
  var headers = data.headers;
  var rows = data.rows;
  var sheet = data.sheet;
  var opIdx = headers.indexOf("操作");
  var stIdx = headers.indexOf("ステータス");

  // 残り = 待機中かつ有効操作の行（完了行は待機中でなくなるため自然に除外される）。
  var remaining = [];
  for (var i = 0; i < rows.length; i++) {
    var st = str_(rows[i][stIdx]);
    var op = str_(rows[i][opIdx]);
    if (st === ROW_STATUS.PENDING && isValidOperation(op)) {
      remaining.push({ rowIndex: i + 2, op: op, values: rows[i] });
    }
  }

  var updates = [];
  var brokeForTime = false;

  for (var k = 0; k < remaining.length; k++) {
    if (Date.now() - startTime > timeLimit) {
      brokeForTime = true;
      break;
    }
    var t = remaining[k];
    var res = processRow_(headers, t.values, t.op, state);
    updates.push({
      rowIndex: t.rowIndex,
      status: res.status,
      message: res.message,
    });

    if (updates.length >= chunk) {
      updateRowStatusBatch(sheet, updates);
      updates = [];
      saveBatchState(state);
    }
  }

  if (updates.length) updateRowStatusBatch(sheet, updates);
  saveBatchState(state);

  if (brokeForTime) {
    state.executionCount = (state.executionCount || 1) + 1;
    saveBatchState(state);
    chainNextTrigger_();
    showToast("実行時間の上限に近づいたため中断しました。自動で再開します。");
    return;
  }

  // 完了
  state.status = "completed";
  state.finishedAt = Date.now();
  saveBatchState(state);
  cleanupTriggers_();
  PropertiesService.getScriptProperties().deleteProperty("CURRENT_JOB_ID");

  var ok =
    state.created +
    state.updated +
    state.deleted +
    state.suspended +
    state.restored;
  logInfo(
    "bulkRunner",
    "executeBulk",
    "一括処理完了: 成功" +
      ok +
      "/失敗" +
      state.failed +
      "/スキップ" +
      state.skipped,
  );
  showSummary_(state);
}

// 1 行を操作に応じて処理し、結果ステータスとメッセージを返す。
function processRow_(headers, values, op, state) {
  var p = parseRow_(headers, values);
  var email = p.primaryEmail;

  if (!email) {
    state.failed++;
    pushError_(state, "(メール空)", "メールアドレスが空です");
    return { status: ROW_STATUS.FAILED, message: "メールアドレスが空です" };
  }

  try {
    if (op === OPERATIONS.CREATE) {
      if (!p.name.familyName || !p.name.givenName) {
        throw new Error("作成には姓と名が必要です");
      }
      if (!p.password) {
        throw new Error("作成にはパスワードが必要です");
      }
      insertUser(toCreateResource(p));
      if (p.aliases.length) syncAliases(email, p.aliases);
      state.created++;
      return { status: ROW_STATUS.SUCCESS, message: "作成しました" };
    }

    if (op === OPERATIONS.UPDATE) {
      var current = needsCurrentForUpdate(p) ? getUser(email) : null;
      var resource = toUpdateResource(p, current);
      if (Object.keys(resource).length === 0 && !p.aliasesProvided) {
        state.skipped++;
        return { status: ROW_STATUS.SKIPPED, message: "更新項目がありません" };
      }
      if (Object.keys(resource).length > 0) {
        patchUser(email, resource);
      }
      if (p.aliasesProvided) syncAliases(email, p.aliases);
      state.updated++;
      return { status: ROW_STATUS.SUCCESS, message: "更新しました" };
    }

    if (op === OPERATIONS.DELETE) {
      removeUser(email);
      state.deleted++;
      return { status: ROW_STATUS.SUCCESS, message: "削除しました" };
    }

    if (op === OPERATIONS.SUSPEND) {
      setSuspended(email, true);
      state.suspended++;
      return { status: ROW_STATUS.SUCCESS, message: "停止しました" };
    }

    if (op === OPERATIONS.RESTORE) {
      setSuspended(email, false);
      state.restored++;
      return { status: ROW_STATUS.SUCCESS, message: "再開しました" };
    }

    state.failed++;
    return { status: ROW_STATUS.FAILED, message: "不明な操作: " + op };
  } catch (e) {
    if (op === OPERATIONS.CREATE && isAlreadyExistsError_(e)) {
      state.skipped++;
      return {
        status: ROW_STATUS.SKIPPED,
        message: "既存ユーザーのためスキップ",
      };
    }
    state.failed++;
    pushError_(state, email, e.message);
    logError(
      "bulkRunner",
      "processRow",
      op + " 失敗: " + email + " - " + e.message,
      null,
      email,
    );
    return { status: ROW_STATUS.FAILED, message: e.message };
  }
}

function pushError_(state, email, message) {
  if (!state.errors) state.errors = [];
  if (state.errors.length < 50) {
    state.errors.push({ email: email, error: String(message) });
  }
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
