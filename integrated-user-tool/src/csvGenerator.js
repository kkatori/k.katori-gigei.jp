/* global CONFIG_KEYS, getConfig,
          readSheetData,
          generateProfileCsv, generateLicenseCsv, generateDepartmentCsv,
          rowsToObjects, SHEET_TO_CSV_MAP,
          showProgressDialog,
          logInfo, logError */

function generateProfileCsvFromSheet(users) {
  var objects;
  if (users) {
    objects = users;
  } else {
    var result = readSheetData(getConfig(CONFIG_KEYS.SHEET_USERS));
    objects = rowsToObjects(result.headers, result.rows);
  }

  var mapped = objects.map(function (obj) {
    var csvRow = {};
    var keys = Object.keys(SHEET_TO_CSV_MAP);
    for (var i = 0; i < keys.length; i++) {
      var sheetCol = keys[i];
      var csvCol = SHEET_TO_CSV_MAP[sheetCol];
      csvRow[csvCol] = obj[sheetCol] !== undefined ? obj[sheetCol] : "";
    }
    return csvRow;
  });

  return generateProfileCsv(mapped);
}

function generateLicenseCsvFromSheet(users) {
  var objects;
  if (users) {
    objects = users;
  } else {
    var result = readSheetData(getConfig(CONFIG_KEYS.SHEET_USERS));
    objects = rowsToObjects(result.headers, result.rows);
  }

  var assignments = objects.map(function (row) {
    return {
      userId: row["メールアドレス"],
      calendarEnabled: row["Calendar"],
      contactsEnabled: row["Contacts"],
      workflowEnabled: row["Workflow"],
      boardEnabled: row["Board"],
      expenseEnabled: row["Expense"],
      attendanceEnabled: row["Attendance"],
    };
  });

  return generateLicenseCsv(assignments);
}

function generateDepartmentCsvFromSheet(departments) {
  var objects;
  if (departments) {
    objects = departments;
  } else {
    var result = readSheetData(getConfig(CONFIG_KEYS.SHEET_USERS));
    objects = rowsToObjects(result.headers, result.rows);
  }

  var seen = {};
  var unique = [];
  for (var i = 0; i < objects.length; i++) {
    var email = objects[i]["部門メール"];
    if (email && !seen[email]) {
      seen[email] = true;
      unique.push({
        departmentEmail: email,
        departmentName: objects[i]["部門名"] || "",
        parentDepartment: "",
      });
    }
  }

  return generateDepartmentCsv(unique);
}

function previewCsv(csvType) {
  var csv;
  try {
    if (csvType === "profile") {
      csv = generateProfileCsvFromSheet();
    } else if (csvType === "license") {
      csv = generateLicenseCsvFromSheet();
    } else if (csvType === "department") {
      csv = generateDepartmentCsvFromSheet();
    } else {
      throw new Error("不明な csvType: " + csvType);
    }
  } catch (e) {
    logError("csvGenerator", "previewCsv", "CSV 生成失敗: " + e.message);
    throw e;
  }

  var lines = csv.split("\n");
  var preview = lines.slice(0, 20);

  var headers = preview[0] ? preview[0].split(",") : [];
  var headerCells = headers
    .map(function (h) {
      return "<th>" + escapeHtml_(h) + "</th>";
    })
    .join("");

  var bodyRows = "";
  for (var i = 1; i < preview.length; i++) {
    var cells = preview[i].split(",");
    var tds = cells
      .map(function (c) {
        return "<td>" + escapeHtml_(c) + "</td>";
      })
      .join("");
    bodyRows += "<tr>" + tds + "</tr>";
  }

  var remaining = lines.length - preview.length;
  var footer =
    remaining > 0
      ? "<p style='color:#888;font-size:12px'>他 " + remaining + " 行</p>"
      : "";

  var html =
    "<!DOCTYPE html><html><head><style>" +
    "body{font-family:Arial,sans-serif;font-size:12px;padding:12px;overflow:auto;}" +
    "table{border-collapse:collapse;white-space:nowrap;}" +
    "th,td{border:1px solid #ccc;padding:4px 8px;}" +
    "th{background:#f3f3f3;}" +
    "</style></head><body>" +
    "<table><thead><tr>" +
    headerCells +
    "</tr></thead><tbody>" +
    bodyRows +
    "</tbody></table>" +
    footer +
    "</body></html>";

  logInfo("csvGenerator", "previewCsv", "CSV プレビュー表示: " + csvType);
  showProgressDialog("CSV プレビュー (" + csvType + ")", html);
}

function escapeHtml_(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
