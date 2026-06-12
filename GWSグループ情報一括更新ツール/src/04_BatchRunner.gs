/* global SHEET_NAMES, SHEET_DEFS, STATUS, TARGET_STATUSES, FUNCS, FUNC_LABELS,
          getConfigNumber_, getRequiredSheet_, cellStr_, isRowEmpty_, nowString_,
          newJobId_, logJobStart_, logJobProgress_, extractErrorMessage_,
          processGroupRow_, processMemberRow_, processSettingsRow_,
          runGroupInventory_, runMemberInventory_, runSettingsInventory_,
          autoExportInventoryCsv_, createContinuationTrigger_,
          deleteContinuationTrigger_ */

// 04_BatchRunner.gs
// Job execution engine (design 2/2, section 4): JOB_STATE persistence, chunked
// processing with result write-back, time monitoring, continuation triggers,
// job chaining (queue), and cancellation.

var JOB_STATE_KEY = "JOB_STATE";

function loadJobState_() {
  var json = PropertiesService.getScriptProperties().getProperty(JOB_STATE_KEY);
  return json ? JSON.parse(json) : null;
}

function saveJobState_(state) {
  PropertiesService.getScriptProperties().setProperty(
    JOB_STATE_KEY,
    JSON.stringify(state),
  );
}

function clearJobState_() {
  PropertiesService.getScriptProperties().deleteProperty(JOB_STATE_KEY);
}

// Saves state, first merging in a cancel flag possibly set from the menu
// (the menu mutates the stored JSON while a run is in flight).
function saveJobStateMergeCancel_(state) {
  var stored = loadJobState_();
  if (stored && stored.cancel) state.cancel = true;
  state.updatedAt = nowString_();
  saveJobState_(state);
}

function createJobState_(func, queue, mode, dryRun) {
  return {
    jobId: newJobId_(),
    func: func,
    queue: queue || [],
    mode: mode,
    dryRun: !!dryRun,
    logRow: 0,
    rowPointer: 2,
    phase: "",
    pageToken: "",
    groupIndex: 0,
    writeRow: 0,
    counts: { success: 0, fail: 0, skip: 0 },
    lastError: "",
    cancel: false,
    updatedAt: nowString_(),
  };
}

// Entry point for menu / trigger handlers. funcs: array of FUNCS values
// executed sequentially. Returns {status, state}.
function startJobs_(funcs, mode, dryRun) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10 * 1000)) {
    throw new Error(
      "別の実行が進行中です。しばらく待ってから再実行してください。",
    );
  }
  try {
    if (loadJobState_()) {
      throw new Error(
        "実行中(または異常終了した)ジョブが存在します。「実行中ジョブの状態確認」で確認するか、" +
          "「中断」でジョブを停止してから再実行してください。",
      );
    }
    var state = createJobState_(funcs[0], funcs.slice(1), mode, dryRun);
    logJobStart_(state);
    saveJobState_(state);
    return runJobLoop_(state);
  } finally {
    lock.releaseLock();
  }
}

// Continuation-trigger handler (one-time trigger created on timeout).
function continueJobHandler() {
  deleteContinuationTrigger_();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30 * 1000)) {
    // Previous run still flushing; try again in another minute.
    createContinuationTrigger_();
    return;
  }
  try {
    var state = loadJobState_();
    if (!state) return;
    runJobLoop_(state);
  } finally {
    lock.releaseLock();
  }
}

// Runs the current job (and queued jobs) until done, timeout, or cancel.
function runJobLoop_(state) {
  var deadlineMs = Date.now() + getConfigNumber_("TIME_LIMIT_SEC", 300) * 1000;
  while (true) {
    var outcome;
    if (state.cancel) {
      outcome = "cancelled";
    } else {
      try {
        outcome = executeJob_(state, deadlineMs);
      } catch (e) {
        // Unexpected exception: keep JOB_STATE so the run can be resumed or
        // explicitly cancelled (design 2/2, section 7).
        saveJobStateMergeCancel_(state);
        logJobProgress_(state, "エラー", extractErrorMessage_(e));
        throw e;
      }
    }
    if (outcome === "cancelled") {
      logJobProgress_(state, "中断", "中断要求により停止(処理済み行は有効)");
      clearJobState_();
      deleteContinuationTrigger_();
      return { status: "中断", state: state };
    }
    if (outcome === "timeout") {
      saveJobStateMergeCancel_(state);
      if (state.cancel) continue; // cancel raced with timeout: loop re-enters and stops
      createContinuationTrigger_();
      logJobProgress_(
        state,
        "継続中",
        "実行時間上限により分割(約1分後に自動再開)",
      );
      return { status: "継続中", state: state };
    }
    // Job done. Inventory jobs auto-export CSV on completion (D-2).
    var note = "";
    if (isInventoryFunc_(state.func) && !state.dryRun) {
      try {
        var file = autoExportInventoryCsv_(state.func);
        note = file
          ? "CSV出力: " + file.getName()
          : "CSV出力スキップ(CSV_FOLDER_ID未設定)";
      } catch (e2) {
        note = "CSV自動出力に失敗: " + extractErrorMessage_(e2);
      }
    }
    if (state.lastError && state.counts.fail > 0) {
      note += (note ? " / " : "") + "失敗あり(直近: " + state.lastError + ")";
    }
    logJobProgress_(state, "完了", note);
    if (state.queue.length > 0) {
      var next = createJobState_(
        state.queue[0],
        state.queue.slice(1),
        state.mode,
        state.dryRun,
      );
      logJobStart_(next);
      state = next;
      saveJobStateMergeCancel_(state);
      continue;
    }
    clearJobState_();
    deleteContinuationTrigger_();
    return { status: "完了", state: state };
  }
}

function executeJob_(state, deadlineMs) {
  switch (state.func) {
    case FUNCS.GROUP_OPS:
      return runInstructionJob_(
        state,
        deadlineMs,
        SHEET_NAMES.GROUP_OPS,
        processGroupRow_,
      );
    case FUNCS.MEMBER_OPS:
      return runInstructionJob_(
        state,
        deadlineMs,
        SHEET_NAMES.MEMBER_OPS,
        processMemberRow_,
      );
    case FUNCS.SETTINGS_OPS:
      return runInstructionJob_(
        state,
        deadlineMs,
        SHEET_NAMES.SETTINGS_OPS,
        processSettingsRow_,
      );
    case FUNCS.INV_GROUPS:
      return runGroupInventory_(state, deadlineMs);
    case FUNCS.INV_MEMBERS:
      return runMemberInventory_(state, deadlineMs);
    case FUNCS.INV_SETTINGS:
      return runSettingsInventory_(state, deadlineMs);
    default:
      throw new Error("不明な機能です: " + state.func);
  }
}

function isInventoryFunc_(func) {
  return (
    func === FUNCS.INV_GROUPS ||
    func === FUNCS.INV_MEMBERS ||
    func === FUNCS.INV_SETTINGS
  );
}

// Generic instruction-sheet runner. processRow(rowValues, state) returns
// {status, message}. Rows are processed top-down from state.rowPointer; only
// rows whose result is 空欄/検証OK/検証NG/失敗 are targets (section 3.2).
function runInstructionJob_(state, deadlineMs, sheetName, processRow) {
  var def = SHEET_DEFS[sheetName];
  var sheet = getRequiredSheet_(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return "done";
  var numRows = lastRow - 1;
  var inputValues = sheet
    .getRange(2, 1, numRows, def.resultCol - 1)
    .getValues();
  var resultRange = sheet.getRange(2, def.resultCol, numRows, 4);
  var resultValues = resultRange.getValues();
  var batchRows = getConfigNumber_("BATCH_ROWS", 50);
  var dirty = 0;

  function flush() {
    if (dirty === 0) return;
    resultRange.setValues(resultValues);
    dirty = 0;
    saveJobStateMergeCancel_(state);
  }

  for (var i = Math.max(state.rowPointer - 2, 0); i < numRows; i++) {
    state.rowPointer = i + 2;
    var status = cellStr_(resultValues[i][0]);
    if (TARGET_STATUSES.indexOf(status) === -1) continue;
    if (isRowEmpty_(inputValues[i])) continue;

    var res = processRow(inputValues[i], state);
    var message = res.message || "";
    if (state.dryRun)
      message = message ? "[ドライラン] " + message : "[ドライラン]";
    resultValues[i] = [res.status, message, nowString_(), state.jobId];
    tallyCount_(state, res.status);
    dirty++;

    if (dirty >= batchRows) flush();
    if (state.cancel) {
      flush();
      return "cancelled";
    }
    if (Date.now() > deadlineMs) {
      state.rowPointer = i + 3; // resume from the next row
      flush();
      return "timeout";
    }
  }
  state.rowPointer = numRows + 2;
  flush();
  return "done";
}

function tallyCount_(state, status) {
  if (status === STATUS.SUCCESS || status === STATUS.VALID_OK) {
    state.counts.success++;
  } else if (status === STATUS.FAILED || status === STATUS.VALID_NG) {
    state.counts.fail++;
  } else {
    state.counts.skip++; // スキップ・対象外
  }
}

// ---- Cancellation ------------------------------------------------------------

// Sets the cancel flag on the stored state. If called again for a stalled job
// (flag set and no state update for 10+ minutes), force-clears the state so a
// new run can start after an abnormal termination.
function requestJobCancel_() {
  var state = loadJobState_();
  if (!state) return "実行中のジョブはありません。";
  if (state.cancel) {
    var updatedAt = new Date(String(state.updatedAt));
    var isStale =
      isNaN(updatedAt.getTime()) ||
      Date.now() - updatedAt.getTime() > 10 * 60 * 1000;
    if (!isStale) {
      return "中断要求済みです。次のチャンク境界での停止を待っています。";
    }
    logJobProgress_(state, "中断", "強制クリア(異常終了したジョブ)");
    clearJobState_();
    deleteContinuationTrigger_();
    return "応答のないジョブ状態を強制クリアしました。再実行できます。";
  }
  state.cancel = true;
  saveJobState_(state);
  return (
    "中断を要求しました。次のチャンク境界で停止します。\n" +
    "ジョブが応答しない場合(異常終了後など)は、もう一度「中断」を実行すると状態を強制クリアします。"
  );
}

function describeJobState_() {
  var state = loadJobState_();
  if (!state) return "実行中のジョブはありません。";
  var c = state.counts;
  return [
    "実行ID: " + state.jobId,
    "機能: " + (FUNC_LABELS[state.func] || state.func),
    "モード: " + state.mode + (state.dryRun ? "(ドライラン)" : ""),
    "進捗: 成功 " + c.success + " / 失敗 " + c.fail + " / スキップ " + c.skip,
    "残りジョブ: " +
      (state.queue.length > 0
        ? state.queue
            .map(function (f) {
              return FUNC_LABELS[f] || f;
            })
            .join(", ")
        : "なし"),
    "最終更新: " + state.updatedAt,
    "中断要求: " + (state.cancel ? "あり" : "なし"),
  ].join("\n");
}
