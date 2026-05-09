/* global getConfig, CONFIG_KEYS, buildRakumoHeaders, logDebug */

var ERROR_CLASS = {
  RETRYABLE: "retryable",
  FATAL: "fatal",
  QUOTA: "quota",
};

function ApiError(message, statusCode, errorClass, responseBody) {
  this.name = "ApiError";
  this.message = message;
  this.statusCode = statusCode;
  this.errorClass = errorClass;
  this.responseBody = responseBody;
}
ApiError.prototype = Object.create(Error.prototype);
ApiError.prototype.constructor = ApiError;

function httpRequest(url, options) {
  var opts = options || {};
  var method = opts.method || "get";
  var contentType = opts.contentType || "application/json";
  var maxRetries =
    opts.maxRetries !== undefined
      ? opts.maxRetries
      : parseInt(getConfig(CONFIG_KEYS.MAX_RETRIES, "3"), 10);
  var baseDelayMs =
    opts.baseDelayMs !== undefined
      ? opts.baseDelayMs
      : parseInt(getConfig(CONFIG_KEYS.RETRY_BASE_DELAY_MS, "1000"), 10);

  var fetchOptions = {
    method: method,
    headers: opts.headers || {},
    contentType: contentType,
    muteHttpExceptions: true,
  };

  if (opts.payload !== undefined && opts.payload !== null) {
    fetchOptions.payload =
      typeof opts.payload === "object"
        ? JSON.stringify(opts.payload)
        : opts.payload;
  }

  var attempt = 0;
  var lastError;

  while (attempt <= maxRetries) {
    try {
      var response = UrlFetchApp.fetch(url, fetchOptions);
      var statusCode = response.getResponseCode();
      var body = response.getContentText();

      if (statusCode >= 200 && statusCode < 300) {
        return {
          statusCode: statusCode,
          body: body,
          headers: response.getHeaders(),
          json: function () {
            return JSON.parse(body);
          },
        };
      }

      var errClass = classifyError_(statusCode);

      if (errClass === ERROR_CLASS.FATAL || attempt >= maxRetries) {
        throw new ApiError(
          "HTTP " + statusCode + ": " + body,
          statusCode,
          errClass,
          body,
        );
      }

      var delay =
        errClass === ERROR_CLASS.QUOTA
          ? calculateBackoff_(attempt, 10000)
          : calculateBackoff_(attempt, baseDelayMs);
      Utilities.sleep(delay);
    } catch (e) {
      if (e.name === "ApiError") throw e;
      lastError = e;
      if (attempt >= maxRetries) break;
      Utilities.sleep(calculateBackoff_(attempt, baseDelayMs));
    }

    attempt++;
  }

  throw (
    lastError ||
    new ApiError("Request failed after max retries", 0, ERROR_CLASS.FATAL, "")
  );
}

function rakumoRequest(path, options) {
  var opts = options || {};
  var method = (opts.method || "get").toUpperCase();
  var contentType = opts.contentType || "application/json";
  var baseUrl = getConfig(
    CONFIG_KEYS.RAKUMO_BASE_URL,
    "https://a-rakumo.appspot.com",
  );
  var url = baseUrl + path;

  var authHeaders = buildRakumoHeaders(method, contentType);
  var mergedHeaders = {};
  var k;
  for (k in authHeaders) {
    mergedHeaders[k] = authHeaders[k];
  }
  if (opts.headers) {
    for (k in opts.headers) {
      mergedHeaders[k] = opts.headers[k];
    }
  }

  var mergedOpts = {};
  for (k in opts) {
    mergedOpts[k] = opts[k];
  }
  mergedOpts.headers = mergedHeaders;
  mergedOpts.method = method.toLowerCase();
  mergedOpts.contentType = contentType;

  logDebug("apiClient", "rakumoRequest", method + " " + path);

  return httpRequest(url, mergedOpts);
}

function gwsRequest(apiCall, operationName) {
  var maxRetries = parseInt(getConfig(CONFIG_KEYS.MAX_RETRIES, "3"), 10);
  var baseDelayMs = parseInt(
    getConfig(CONFIG_KEYS.RETRY_BASE_DELAY_MS, "1000"),
    10,
  );
  var attempt = 0;

  while (attempt <= maxRetries) {
    enforceRateLimit_();
    try {
      var result = apiCall();
      logDebug("apiClient", "gwsRequest", operationName + " ok");
      return result;
    } catch (e) {
      var statusCode = extractStatusCode_(e);
      var errClass = classifyError_(statusCode);

      logDebug(
        "apiClient",
        "gwsRequest",
        operationName + " err " + statusCode,
        e.message,
      );

      if (errClass === ERROR_CLASS.FATAL || attempt >= maxRetries) {
        throw new ApiError(e.message, statusCode, errClass, "");
      }

      var delay =
        errClass === ERROR_CLASS.QUOTA
          ? calculateBackoff_(attempt, 10000)
          : calculateBackoff_(attempt, baseDelayMs);
      Utilities.sleep(delay);
    }
    attempt++;
  }
}

function classifyError_(statusCode) {
  if (statusCode === 429) return ERROR_CLASS.QUOTA;
  if (
    statusCode === 500 ||
    statusCode === 502 ||
    statusCode === 503 ||
    statusCode === 504 ||
    statusCode === 408
  ) {
    return ERROR_CLASS.RETRYABLE;
  }
  return ERROR_CLASS.FATAL;
}

function calculateBackoff_(attempt, baseDelayMs) {
  var delay =
    baseDelayMs * Math.pow(2, attempt) + Math.floor(Math.random() * 500);
  return Math.min(delay, 30000);
}

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

function extractStatusCode_(e) {
  var msg = e.message || "";
  var match = msg.match(/\b(\d{3})\b/);
  return match ? parseInt(match[1], 10) : 0;
}
