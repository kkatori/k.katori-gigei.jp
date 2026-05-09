var PROFILE_CSV_COLUMNS = [
  "User ID",
  "Family Name",
  "Given Name",
  "Family Name Yomi",
  "Given Name Yomi",
  "Company",
  "Company Yomi",
  "Department Email",
  "Department",
  "Job Title",
  "Birthday",
  "Business Address",
  "Business Phone",
  "Business Phone Extension",
  "Business Fax",
  "Mobile Phone",
  "E-mail Address",
  "E-mail 2 Address",
  "E-mail 3 Address",
  "Employee Number",
  "Primary",
  "Display",
  "Calendar Enabled",
  "Contacts Enabled",
  "Workflow Enabled",
  "Board Enabled",
  "Expense Enabled",
  "Attendance Enabled",
];

var SHEET_TO_CSV_MAP = {
  メールアドレス: "User ID",
  姓: "Family Name",
  名: "Given Name",
  "姓(よみ)": "Family Name Yomi",
  "名(よみ)": "Given Name Yomi",
  会社名: "Company",
  "会社名(よみ)": "Company Yomi",
  部門メール: "Department Email",
  部門名: "Department",
  役職: "Job Title",
  生年月日: "Birthday",
  住所: "Business Address",
  電話番号: "Business Phone",
  内線番号: "Business Phone Extension",
  FAX: "Business Fax",
  携帯電話: "Mobile Phone",
  メール2: "E-mail 2 Address",
  メール3: "E-mail 3 Address",
  社員番号: "Employee Number",
  プライマリ: "Primary",
  表示: "Display",
  Calendar: "Calendar Enabled",
  Contacts: "Contacts Enabled",
  Workflow: "Workflow Enabled",
  Board: "Board Enabled",
  Expense: "Expense Enabled",
  Attendance: "Attendance Enabled",
};

function parseCsv(csvString, options) {
  var opts = options || {};
  var hasHeader = opts.hasHeader !== false;

  if (!csvString || csvString.trim() === "") {
    return { headers: [], rows: [] };
  }

  var raw = Utilities.parseCsv(csvString.trim());

  if (!raw || raw.length === 0) {
    return { headers: [], rows: [] };
  }

  var headers = [];
  var rows = raw;

  if (hasHeader) {
    headers = raw[0].map(function (h) {
      return h.trim();
    });
    rows = raw.slice(1);
  }

  return { headers: headers, rows: rows };
}

function generateProfileCsv(users) {
  var lines = [toCsvRow_(PROFILE_CSV_COLUMNS)];
  users.forEach(function (user) {
    var values = PROFILE_CSV_COLUMNS.map(function (col) {
      return user[col] !== undefined ? user[col] : "";
    });
    lines.push(toCsvRow_(values));
  });
  return lines.join("\n");
}

function generateLicenseCsv(assignments) {
  var headers = [
    "User ID",
    "Calendar Enabled",
    "Contacts Enabled",
    "Workflow Enabled",
    "Board Enabled",
    "Expense Enabled",
    "Attendance Enabled",
  ];
  var lines = [toCsvRow_(headers)];
  assignments.forEach(function (a) {
    var values = [
      a.userId,
      a.calendarEnabled,
      a.contactsEnabled,
      a.workflowEnabled,
      a.boardEnabled,
      a.expenseEnabled,
      a.attendanceEnabled,
    ];
    lines.push(toCsvRow_(values));
  });
  return lines.join("\n");
}

function generateDepartmentCsv(departments) {
  var headers = ["Department Email", "Department Name", "Parent Department"];
  var lines = [toCsvRow_(headers)];
  departments.forEach(function (d) {
    var values = [d.departmentEmail, d.departmentName, d.parentDepartment];
    lines.push(toCsvRow_(values));
  });
  return lines.join("\n");
}

function rowsToObjects(headers, rows) {
  return rows.map(function (row) {
    var obj = {};
    headers.forEach(function (header, i) {
      obj[header] = row[i] !== undefined ? row[i] : "";
    });
    return obj;
  });
}

function validateCsvColumns(expectedColumns, actualColumns) {
  var missing = expectedColumns.filter(function (col) {
    return actualColumns.indexOf(col) === -1;
  });
  var extra = actualColumns.filter(function (col) {
    return expectedColumns.indexOf(col) === -1;
  });
  return {
    valid: missing.length === 0,
    missing: missing,
    extra: extra,
  };
}

function toCsvRow_(values) {
  return values
    .map(function (v) {
      return escapeCsvValue_(v);
    })
    .join(",");
}

function escapeCsvValue_(value) {
  var str = value === null || value === undefined ? "" : String(value);
  if (
    str.indexOf(",") !== -1 ||
    str.indexOf('"') !== -1 ||
    str.indexOf("\n") !== -1
  ) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}
