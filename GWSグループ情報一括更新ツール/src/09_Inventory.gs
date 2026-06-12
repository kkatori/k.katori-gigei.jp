/* global SHEET_NAMES, SETTINGS_FIELDS, GROUP_TYPES, getRequiredSheet_,
          clearDataRows_, cellStr_, nowString_, callApi_, isRetryableError_,
          saveJobStateMergeCancel_, listGroupTypesPage_, classifyGroup_ */

// 09_Inventory.gs
// Inventory jobs (FR-07): group list, member list, and settings list. Sheets
// are cleared and overwritten with the latest snapshot (D-2); history is kept
// via CSV auto-export on completion. Page tokens / group positions are held in
// JOB_STATE for continuation (design 2/2, section 4.3).

// Group inventory: phase 'list' pages Directory Groups.list into the sheet,
// then phase 'types' pages Cloud Identity groups.list and fills the 種別
// column by matching on group email.
function runGroupInventory_(state, deadlineMs) {
  var sheet = getRequiredSheet_(SHEET_NAMES.INV_GROUPS);
  if (!state.phase) {
    clearDataRows_(sheet);
    state.phase = "list";
    state.pageToken = "";
    state.writeRow = 2;
  }

  if (state.phase === "list") {
    while (true) {
      var resp = callApi_("Groups.list", function () {
        return AdminDirectory.Groups.list({
          customer: "my_customer",
          maxResults: 200,
          pageToken: state.pageToken || undefined,
        });
      });
      var now = nowString_();
      var rows = (resp.groups || []).map(function (g) {
        return [
          g.email || "",
          g.name || "",
          g.description || "",
          Number(g.directMembersCount || 0),
          "",
          (g.aliases || []).join(","),
          g.adminCreated === true,
          now,
        ];
      });
      if (rows.length > 0) {
        sheet.getRange(state.writeRow, 1, rows.length, 8).setValues(rows);
        state.writeRow += rows.length;
        state.counts.success += rows.length;
      }
      state.pageToken = resp.nextPageToken || "";
      if (!state.pageToken) {
        state.phase = "types";
        saveJobStateMergeCancel_(state);
        break;
      }
      saveJobStateMergeCancel_(state);
      if (state.cancel) return "cancelled";
      if (Date.now() > deadlineMs) return "timeout";
    }
  }

  if (state.phase === "types") {
    return fillGroupTypes_(state, deadlineMs, sheet);
  }
  return "done";
}

// Fills the 種別 column. The whole type column is re-read from the sheet each
// run and flushed per Cloud Identity page, so continuation is restart-safe.
function fillGroupTypes_(state, deadlineMs, sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return "done";
  var numRows = lastRow - 1;
  var emails = sheet.getRange(2, 1, numRows, 1).getValues();
  var typeRange = sheet.getRange(2, 5, numRows, 1);
  var types = typeRange.getValues();
  var rowByEmail = {};
  emails.forEach(function (row, i) {
    rowByEmail[String(row[0]).toLowerCase()] = i;
  });

  while (true) {
    var resp = listGroupTypesPage_(state.pageToken);
    (resp.groups || []).forEach(function (group) {
      var email =
        group.groupKey && group.groupKey.id
          ? String(group.groupKey.id).toLowerCase()
          : "";
      var index = rowByEmail[email];
      if (index !== undefined) types[index][0] = classifyGroup_(group);
    });
    typeRange.setValues(types);
    state.pageToken = resp.nextPageToken || "";
    saveJobStateMergeCancel_(state);
    if (!state.pageToken) break;
    if (state.cancel) return "cancelled";
    if (Date.now() > deadlineMs) return "timeout";
  }

  // Groups absent from Cloud Identity default to 通常.
  var filled = false;
  types.forEach(function (row) {
    if (cellStr_(row[0]) === "") {
      row[0] = GROUP_TYPES.NORMAL;
      filled = true;
    }
  });
  if (filled) typeRange.setValues(types);
  return "done";
}

// Member inventory: iterates 棚卸_グループ rows; progress = group index +
// Members.list page token. Requires the group inventory to exist first.
function runMemberInventory_(state, deadlineMs) {
  var invSheet = getRequiredSheet_(SHEET_NAMES.INV_MEMBERS);
  var groupSheet = getRequiredSheet_(SHEET_NAMES.INV_GROUPS);
  var lastRow = groupSheet.getLastRow();
  if (lastRow < 2) {
    throw new Error(
      "棚卸_グループが空です。先に「グループ一覧を取得」を実行してください。",
    );
  }
  var groups = groupSheet
    .getRange(2, 1, lastRow - 1, 1)
    .getValues()
    .map(function (row) {
      return String(row[0]).trim();
    })
    .filter(Boolean);

  if (!state.phase) {
    clearDataRows_(invSheet);
    state.phase = "members";
    state.groupIndex = 0;
    state.pageToken = "";
    state.writeRow = 2;
  }

  var buffer = [];
  function flushBuffer() {
    if (buffer.length === 0) return;
    invSheet.getRange(state.writeRow, 1, buffer.length, 6).setValues(buffer);
    state.writeRow += buffer.length;
    buffer = [];
  }

  while (state.groupIndex < groups.length) {
    var groupEmail = groups[state.groupIndex];
    var resp;
    try {
      resp = callApi_("Members.list", function () {
        return AdminDirectory.Members.list(groupEmail, {
          maxResults: 200,
          pageToken: state.pageToken || undefined,
        });
      });
    } catch (e) {
      if (e.code === 404) {
        // Group deleted since the group inventory ran; skip it.
        state.counts.skip++;
        state.groupIndex++;
        state.pageToken = "";
        continue;
      }
      flushBuffer();
      saveJobStateMergeCancel_(state);
      throw e;
    }
    var now = nowString_();
    (resp.members || []).forEach(function (m) {
      buffer.push([
        groupEmail,
        m.email || m.id || "",
        m.role || "",
        m.type || "",
        m.status || "",
        now,
      ]);
    });
    state.counts.success += (resp.members || []).length;
    state.pageToken = resp.nextPageToken || "";
    if (!state.pageToken) state.groupIndex++;

    if (buffer.length >= 500) {
      flushBuffer();
      saveJobStateMergeCancel_(state);
      if (state.cancel) return "cancelled";
    }
    if (Date.now() > deadlineMs) {
      flushBuffer();
      saveJobStateMergeCancel_(state);
      return "timeout";
    }
  }
  flushBuffer();
  saveJobStateMergeCancel_(state);
  return "done";
}

// Settings inventory (D-1, menu-only): one Groups Settings get per group from
// 棚卸_グループ. Column order matches 指示_設定変更 so rows can be copied over.
function runSettingsInventory_(state, deadlineMs) {
  var invSheet = getRequiredSheet_(SHEET_NAMES.INV_SETTINGS);
  var groupSheet = getRequiredSheet_(SHEET_NAMES.INV_GROUPS);
  var lastRow = groupSheet.getLastRow();
  if (lastRow < 2) {
    throw new Error(
      "棚卸_グループが空です。先に「グループ一覧を取得」を実行してください。",
    );
  }
  var groups = groupSheet
    .getRange(2, 1, lastRow - 1, 1)
    .getValues()
    .map(function (row) {
      return String(row[0]).trim();
    })
    .filter(Boolean);

  if (!state.phase) {
    clearDataRows_(invSheet);
    state.phase = "settings";
    state.groupIndex = 0;
    state.writeRow = 2;
  }

  var numCols = SETTINGS_FIELDS.length + 2; // email + 27 fields + 取得日時
  var buffer = [];
  function flushBuffer() {
    if (buffer.length === 0) return;
    invSheet
      .getRange(state.writeRow, 1, buffer.length, numCols)
      .setValues(buffer);
    state.writeRow += buffer.length;
    buffer = [];
  }

  while (state.groupIndex < groups.length) {
    var groupEmail = groups[state.groupIndex];
    try {
      var settings = callApi_("GroupsSettings.get", function () {
        return AdminGroupsSettings.Groups.get(groupEmail);
      });
      var row = [groupEmail];
      SETTINGS_FIELDS.forEach(function (field) {
        row.push(formatSettingValueForSheet_(field, settings[field.key]));
      });
      row.push(nowString_());
      buffer.push(row);
      state.counts.success++;
    } catch (e) {
      if (isRetryableError_(e.code, e)) throw e;
      // The Groups Settings API returns a generic "A system error has
      // occurred" (not 404) for groups that no longer exist. Distinguish
      // stale snapshot rows (deleted since the group inventory ran) from
      // real failures via Directory.
      if (!groupExists_(groupEmail)) {
        state.counts.skip++;
      } else {
        state.counts.fail++;
        state.lastError = groupEmail + ": " + e.message;
      }
    }
    state.groupIndex++;

    if (buffer.length >= 100) {
      flushBuffer();
      saveJobStateMergeCancel_(state);
      if (state.cancel) return "cancelled";
    }
    if (Date.now() > deadlineMs) {
      flushBuffer();
      saveJobStateMergeCancel_(state);
      return "timeout";
    }
  }
  flushBuffer();
  saveJobStateMergeCancel_(state);
  // All groups failed: surface the cause instead of finishing with an empty
  // sheet (a silent header-only CSV is undiagnosable).
  if (state.counts.success === 0 && state.counts.fail > 0) {
    throw new Error(
      "設定の取得にすべて失敗しました(" +
        state.counts.fail +
        "件)。直近のエラー: " +
        state.lastError,
    );
  }
  return "done";
}

// Returns false only when Directory definitively reports 404 (group deleted);
// any other outcome is treated as "exists" so real failures stay visible.
function groupExists_(email) {
  try {
    callApi_("Groups.get", function () {
      return AdminDirectory.Groups.get(email);
    });
    return true;
  } catch (e) {
    return e.code !== 404;
  }
}

// Groups Settings returns booleans as 'true'/'false' strings; show TRUE/FALSE
// on the sheet to match the input convention of 指示_設定変更.
function formatSettingValueForSheet_(field, value) {
  if (value === undefined || value === null) return "";
  if (field.type === "bool")
    return String(value).toLowerCase() === "true" ? "TRUE" : "FALSE";
  return String(value);
}
