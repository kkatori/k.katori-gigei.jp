/* global STATUS, SETTINGS_FIELDS, cellStr_, isValidEmail_,
          normalizeSettingValue_, resolveTypeOrFail_, callApi_ */

// 08_SettingsOps.gs
// Group settings change row processing (FR-06). Only filled cells are applied
// (item-level diff). email/name/description go to Directory Groups.patch; the
// remaining fields go to Groups Settings Groups.patch, in that order. When the
// email changes, Groups Settings is called with the new address (design 2/2,
// section 2.2).

function processSettingsRow_(row, state) {
  var groupEmail = cellStr_(row[0]).toLowerCase();
  if (!isValidEmail_(groupEmail)) {
    return {
      status: STATUS.VALID_NG,
      message: "グループメールの形式が不正です",
    };
  }

  var directoryBody = {};
  var settingsBody = {};
  var errors = [];
  SETTINGS_FIELDS.forEach(function (field, index) {
    var raw = row[index + 1];
    var isBlank = typeof raw !== "boolean" && cellStr_(raw) === "";
    if (isBlank) return; // blank cell = keep current value
    var value = normalizeSettingValue_(field, raw, errors);
    if (value === undefined) return;
    if (field.api === "directory") {
      directoryBody[field.key] = value;
    } else {
      settingsBody[field.key] = value;
    }
  });
  if (errors.length > 0)
    return { status: STATUS.VALID_NG, message: errors.join(" / ") };

  var directoryCount = Object.keys(directoryBody).length;
  var settingsCount = Object.keys(settingsBody).length;
  if (directoryCount + settingsCount === 0) {
    return {
      status: STATUS.VALID_NG,
      message: "変更する項目が記入されていません",
    };
  }

  var typeResult = resolveTypeOrFail_(groupEmail);
  if (typeResult) return typeResult;

  if (state.dryRun) {
    try {
      callApi_("Groups.get", function () {
        return AdminDirectory.Groups.get(groupEmail);
      });
    } catch (e) {
      if (e.code === 404)
        return {
          status: STATUS.VALID_NG,
          message: "対象グループが存在しません",
        };
      return { status: STATUS.VALID_NG, message: e.message };
    }
    return {
      status: STATUS.VALID_OK,
      message: "適用予定: " + (directoryCount + settingsCount) + "項目",
    };
  }

  var directoryApplied = false;
  try {
    if (directoryCount > 0) {
      callApi_("Groups.patch", function () {
        return AdminDirectory.Groups.patch(directoryBody, groupEmail);
      });
      directoryApplied = true;
    }
    if (settingsCount > 0) {
      var effectiveEmail = directoryBody.email || groupEmail;
      callApi_("GroupsSettings.patch", function () {
        return AdminGroupsSettings.Groups.patch(settingsBody, effectiveEmail);
      });
    }
    return {
      status: STATUS.SUCCESS,
      message:
        "設定を更新しました(" + (directoryCount + settingsCount) + "項目)",
    };
  } catch (e) {
    if (e.code === 404 && !directoryApplied) {
      return { status: STATUS.VALID_NG, message: "対象グループが存在しません" };
    }
    var prefix =
      directoryApplied && settingsCount > 0
        ? "基本情報は更新済み、設定の更新に失敗: "
        : "";
    return { status: STATUS.FAILED, message: prefix + e.message };
  }
}
