/* global getConfigNumber_ */

// 14_ApiClient.gs
// Common API wrapper: exponential backoff with jitter for rate limits and
// transient errors (design 2/2, section 7), error-code extraction, and the
// Cloud Identity REST helper (no GAS advanced service exists for it, so it is
// called via UrlFetchApp with the script's OAuth token).

// Runs fn with retries. Throws an Error whose .code is the HTTP-like status.
function callApi_(label, fn) {
  var retryMax = getConfigNumber_("RETRY_MAX", 5);
  var baseMs = getConfigNumber_("RETRY_BASE_MS", 1000);
  for (var attempt = 0; ; attempt++) {
    try {
      return fn();
    } catch (e) {
      var code = extractErrorCode_(e);
      if (attempt < retryMax && isRetryableError_(code, e)) {
        Utilities.sleep(
          baseMs * Math.pow(2, attempt) + Math.floor(Math.random() * 500),
        );
        continue;
      }
      var wrapped = new Error(label + ": " + extractErrorMessage_(e));
      wrapped.code = code;
      throw wrapped;
    }
  }
}

function extractErrorCode_(e) {
  if (e && typeof e.code === "number") return e.code;
  // Advanced services throw GoogleJsonResponseException with .details.code.
  if (e && e.details && typeof e.details.code === "number")
    return e.details.code;
  var msg = String((e && e.message) || e);
  var m = msg.match(/returned code (\d{3})/);
  if (m) return Number(m[1]);
  if (/not\s*found|notFound/i.test(msg)) return 404;
  if (/duplicate|already exists|conflict/i.test(msg)) return 409;
  if (/rate\s*limit|quota/i.test(msg)) return 429;
  return 0;
}

function isRetryableError_(code, e) {
  if (code === 429 || (code >= 500 && code < 600)) return true;
  var msg = String((e && e.message) || e);
  return /rateLimitExceeded|userRateLimitExceeded|quotaExceeded|backendError|internal error|service unavailable/i.test(
    msg,
  );
}

function extractErrorMessage_(e) {
  if (e && e.details && e.details.message) return String(e.details.message);
  return String((e && e.message) || e);
}

// GET against the Cloud Identity API. pathAndQuery example:
//   'groups:lookup?groupKey.id=foo%40example.com'
function cloudIdentityGet_(pathAndQuery) {
  return callApi_("CloudIdentity", function () {
    var res = UrlFetchApp.fetch(
      "https://cloudidentity.googleapis.com/v1/" + pathAndQuery,
      {
        headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
        muteHttpExceptions: true,
      },
    );
    var code = res.getResponseCode();
    var body = res.getContentText();
    if (code >= 400) {
      var err = new Error("HTTP " + code + ": " + body.slice(0, 300));
      err.code = code;
      throw err;
    }
    return body ? JSON.parse(body) : {};
  });
}
