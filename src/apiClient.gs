/* global getConfig, CONFIG_KEYS, logDebug */

// Admin Directory API（Advanced Service）呼び出しのラッパー。
// リトライ（指数バックオフ）、プロアクティブなレート制限、エラー分類を担う。

var ERROR_CLASS = {
  RETRYABLE: "retryable",
  FATAL: "fatal",
  QUOTA: "quota",
};

function ApiError(message, statusCode, errorClass) {
  this.name = "ApiError";
  this.message = message;
  this.statusCode = statusCode;
  this.errorClass = errorClass;
}
ApiError.prototype = Object.create(Error.prototype);
ApiError.prototype.constructor = ApiError;

// apiCall: AdminDirectory を呼ぶ無引数のコールバック。
// operationName: ログ用の操作名。
function gwsRequest(apiCall, operationName) {
  var maxRetries = parseInt(getConfig(CONFIG_KEYS.MAX_RETRIES, "5"), 10);
  var baseDelayMs = parseInt(
    getConfig(CONFIG_KEYS.RETRY_BASE_DELAY_MS, "1000"),
    10,
  );
  var attempt = 0;

  while (attempt <= maxRetries) {
    enforceRateLimit_();
    try {
      return apiCall();
    } catch (e) {
      var classified = classifyAdminError_(e);
      logDebug(
        "apiClient",
        "gwsRequest",
        operationName + " 失敗(" + classified.statusCode + ")",
        e.message,
      );

      if (
        classified.errorClass === ERROR_CLASS.FATAL ||
        attempt >= maxRetries
      ) {
        throw new ApiError(
          e.message,
          classified.statusCode,
          classified.errorClass,
        );
      }

      var delay =
        classified.errorClass === ERROR_CLASS.QUOTA
          ? calculateBackoff_(attempt, 10000)
          : calculateBackoff_(attempt, baseDelayMs);
      Utilities.sleep(delay);
    }
    attempt++;
  }

  throw new ApiError(
    operationName + ": リトライ上限に達しました",
    0,
    ERROR_CLASS.FATAL,
  );
}

// Advanced Service の例外はメッセージ文字列でしか判別できないことが多いため、
// HTTP コードとメッセージ本文の双方から分類する。
function classifyAdminError_(e) {
  var msg = (e && e.message ? e.message : "").toLowerCase();
  var statusCode = extractStatusCode_(msg);

  // クォータ / レート制限
  if (
    statusCode === 429 ||
    msg.indexOf("rate limit") !== -1 ||
    msg.indexOf("ratelimit") !== -1 ||
    msg.indexOf("quota") !== -1 ||
    msg.indexOf("user rate") !== -1 ||
    msg.indexOf("too many requests") !== -1
  ) {
    return { errorClass: ERROR_CLASS.QUOTA, statusCode: statusCode || 429 };
  }

  // 一時的なサーバ側エラー
  if (
    statusCode === 500 ||
    statusCode === 502 ||
    statusCode === 503 ||
    statusCode === 504 ||
    statusCode === 408 ||
    msg.indexOf("backend error") !== -1 ||
    msg.indexOf("internal error") !== -1 ||
    msg.indexOf("service unavailable") !== -1 ||
    msg.indexOf("try again") !== -1 ||
    msg.indexOf("timed out") !== -1 ||
    msg.indexOf("timeout") !== -1
  ) {
    return { errorClass: ERROR_CLASS.RETRYABLE, statusCode: statusCode || 0 };
  }

  return { errorClass: ERROR_CLASS.FATAL, statusCode: statusCode || 0 };
}

function calculateBackoff_(attempt, baseDelayMs) {
  var delay =
    baseDelayMs * Math.pow(2, attempt) + Math.floor(Math.random() * 500);
  return Math.min(delay, 30000);
}

// Admin SDK のクォータ（約 2400 req/min）に対する控えめなプロアクティブ制御。
function enforceRateLimit_() {
  var cache = CacheService.getScriptCache();
  var windowKey = "admin_api_req_" + Math.floor(Date.now() / 60000);
  var raw = cache.get(windowKey);
  var count = raw ? parseInt(raw, 10) : 0;

  if (count >= 2400) {
    var msUntilNextWindow = 60000 - (Date.now() % 60000);
    Utilities.sleep(Math.min(msUntilNextWindow, 5000));
  }

  cache.put(windowKey, String(count + 1), 120);
}

function extractStatusCode_(msg) {
  var match = msg.match(/\b(\d{3})\b/);
  return match ? parseInt(match[1], 10) : 0;
}
