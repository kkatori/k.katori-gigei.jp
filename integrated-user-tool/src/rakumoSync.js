/* global rakumoRequest,
          logInfo, logDebug, logWarn */

function startGoogleSync() {
  var status = getCurrentSyncStatus();
  if (status.running) {
    return { jobStarted: false, message: "同期が既に実行中です" };
  }
  rakumoRequest("/api/gsync/v1/jobs", { method: "post" });
  logInfo("rakumoSync", "startGoogleSync", "Google同期を開始しました");
  return { jobStarted: true, message: "Google同期を開始しました" };
}

function getCurrentSyncStatus() {
  try {
    var response = rakumoRequest("/api/gsync/v1/jobs/current", {
      method: "get",
    });
    var body = response.body;
    if (response.statusCode === 200 && body && body.trim() !== "") {
      return { running: true, jobDetails: response.json() };
    }
    return { running: false, jobDetails: null };
  } catch (_e) {
    return { running: false, jobDetails: null };
  }
}

function getLastSyncResult() {
  var response = rakumoRequest("/api/gsync/v1/jobs/lastresult", {
    method: "get",
  });
  var data = response.json();
  var succeeded =
    data && (data.status === "SUCCESS" || data.result === "SUCCESS");
  return { success: succeeded, details: data };
}

function waitForSyncCompletion(maxWaitSeconds) {
  if (maxWaitSeconds === undefined) {
    maxWaitSeconds = 240;
  }
  var startTime = Date.now();
  var maxWaitMs = maxWaitSeconds * 1000;

  while (Date.now() - startTime < maxWaitMs) {
    Utilities.sleep(15000);
    var elapsed = Math.round((Date.now() - startTime) / 1000);
    logDebug(
      "rakumoSync",
      "waitForSyncCompletion",
      "同期待機中: " + elapsed + "秒経過",
    );

    var status = getCurrentSyncStatus();
    if (!status.running) {
      var result = getLastSyncResult();
      logInfo(
        "rakumoSync",
        "waitForSyncCompletion",
        "同期完了: success=" + result.success,
      );
      return {
        completed: true,
        success: result.success,
        details: result.details,
      };
    }
  }

  logWarn(
    "rakumoSync",
    "waitForSyncCompletion",
    "同期タイムアウト: " + maxWaitSeconds + "秒を超過",
  );
  return { completed: false, success: false, details: null };
}
