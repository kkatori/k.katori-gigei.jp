var RAKUMO_AUTH_ERROR_MISSING_API_KEY =
  "RAKUMO_API_KEY is not configured in Script Properties";
var RAKUMO_AUTH_ERROR_MISSING_SECRET_KEY =
  "RAKUMO_SECRET_KEY is not configured in Script Properties";

function buildRakumoHeaders(method, contentType) {
  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty("RAKUMO_API_KEY");
  var secretKey = props.getProperty("RAKUMO_SECRET_KEY");

  if (!apiKey) throw new Error(RAKUMO_AUTH_ERROR_MISSING_API_KEY);
  if (!secretKey) throw new Error(RAKUMO_AUTH_ERROR_MISSING_SECRET_KEY);

  var dateString = getRfc822Date_();
  var signature = buildSignature_(secretKey, method, contentType, dateString);

  return {
    Authorization: "RWS " + apiKey + ":" + signature,
    Date: dateString,
  };
}

function buildSignature_(secretKey, method, contentType, dateString) {
  var message = method + "\n" + contentType + "\n" + dateString;
  var hmacBytes = Utilities.computeHmacSignature(
    Utilities.MacAlgorithm.HMAC_SHA_1,
    message,
    secretKey,
    Utilities.Charset.UTF_8,
  );
  return Utilities.base64Encode(hmacBytes);
}

function getRfc822Date_() {
  return new Date().toUTCString();
}
