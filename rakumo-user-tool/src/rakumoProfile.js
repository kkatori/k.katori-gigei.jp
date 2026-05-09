/* global rakumoRequest, httpRequest,
          parseCsv,
          logInfo, logError, logDebug, logWarn */

function downloadProfileCsv() {
  var response = rakumoRequest("/api/profiles/v1/csv", { method: "get" });
  var parsed = parseCsv(response.body);
  return { headers: parsed.headers, rows: parsed.rows, rawCsv: response.body };
}

function uploadProfileCsv(csvContent) {
  try {
    lockCsvImport_();
    var uploadUrl = getUploadUrl_();
    uploadCsvToUrl_(uploadUrl, csvContent);
    logInfo("rakumoProfile", "uploadProfileCsv", "CSV アップロード完了");
    return { success: true, message: "CSV アップロード完了" };
  } catch (e) {
    logError(
      "rakumoProfile",
      "uploadProfileCsv",
      "CSV アップロード失敗: " + e.message,
    );
    return { success: false, message: e.message };
  } finally {
    unlockCsvImport_();
  }
}

function diffProfileData(currentRakumoData, sheetData) {
  var rakumoMap = {};
  for (var i = 0; i < currentRakumoData.length; i++) {
    rakumoMap[currentRakumoData[i]["User ID"]] = currentRakumoData[i];
  }

  var sheetMap = {};
  for (var j = 0; j < sheetData.length; j++) {
    sheetMap[sheetData[j]["User ID"]] = sheetData[j];
  }

  var toAdd = [];
  var toUpdate = [];
  var toDelete = [];
  var unchanged = [];

  for (var userId in sheetMap) {
    if (!rakumoMap[userId]) {
      toAdd.push(sheetMap[userId]);
    } else {
      var sheetRow = sheetMap[userId];
      var rakumoRow = rakumoMap[userId];
      var different = false;
      var keys = Object.keys(sheetRow);
      for (var k = 0; k < keys.length; k++) {
        if (sheetRow[keys[k]] !== rakumoRow[keys[k]]) {
          different = true;
          break;
        }
      }
      if (different) {
        toUpdate.push(sheetRow);
      } else {
        unchanged.push(sheetRow);
      }
    }
  }

  for (var rakumoId in rakumoMap) {
    if (!sheetMap[rakumoId]) {
      toDelete.push(rakumoMap[rakumoId]);
    }
  }

  return {
    toAdd: toAdd,
    toUpdate: toUpdate,
    toDelete: toDelete,
    unchanged: unchanged,
  };
}

function lockCsvImport_() {
  rakumoRequest("/api/profiles/v1/csv/lock", { method: "post" });
  logDebug("rakumoProfile", "lockCsvImport", "CSV import locked");
}

function unlockCsvImport_() {
  try {
    rakumoRequest("/api/profiles/v1/csv/unlock", { method: "post" });
  } catch (e) {
    logWarn("rakumoProfile", "unlockCsvImport", "Unlock failed: " + e.message);
  }
}

function getUploadUrl_() {
  var response = rakumoRequest("/api/profiles/v1/csv/url", { method: "post" });
  return response.json().url;
}

function uploadCsvToUrl_(uploadUrl, csvContent) {
  httpRequest(uploadUrl, {
    method: "put",
    payload: csvContent,
    contentType: "text/csv",
  });
}
