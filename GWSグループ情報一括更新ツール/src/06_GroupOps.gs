/* global STATUS, GROUP_TYPES, cellStr_, validateGroupOpRow_, callApi_,
          resolveGroupType_ */

// 06_GroupOps.gs
// Group create / delete row processing (FR-02, FR-03). Returns
// {status, message} per row; idempotency: 409 on create and 404 on delete are
// recorded as スキップ (NFR-04).

function processGroupRow_(row, state) {
  var op = cellStr_(row[0]);
  var email = cellStr_(row[1]).toLowerCase();
  var name = cellStr_(row[2]);
  var description = cellStr_(row[3]);
  var confirm = cellStr_(row[4]);

  var ngMessage = validateGroupOpRow_(op, email, name, confirm);
  if (ngMessage) return { status: STATUS.VALID_NG, message: ngMessage };

  if (op === "作成") {
    return state.dryRun
      ? dryRunGroupCreate_(email)
      : execGroupCreate_(email, name, description);
  }
  return state.dryRun ? dryRunGroupDelete_(email) : execGroupDelete_(email);
}

function execGroupCreate_(email, name, description) {
  try {
    callApi_("Groups.insert", function () {
      return AdminDirectory.Groups.insert({
        email: email,
        name: name,
        description: description,
      });
    });
    return { status: STATUS.SUCCESS, message: "グループを作成しました" };
  } catch (e) {
    if (e.code === 409)
      return {
        status: STATUS.SKIPPED,
        message: "既存のグループのためスキップしました",
      };
    return { status: STATUS.FAILED, message: e.message };
  }
}

function execGroupDelete_(email) {
  var typeResult = resolveTypeOrFail_(email);
  if (typeResult) return typeResult;
  try {
    callApi_("Groups.remove", function () {
      AdminDirectory.Groups.remove(email);
    });
    return { status: STATUS.SUCCESS, message: "グループを削除しました" };
  } catch (e) {
    if (e.code === 404)
      return {
        status: STATUS.SKIPPED,
        message: "対象が存在しないためスキップしました",
      };
    return { status: STATUS.FAILED, message: e.message };
  }
}

function dryRunGroupCreate_(email) {
  try {
    callApi_("Groups.get", function () {
      return AdminDirectory.Groups.get(email);
    });
    return {
      status: STATUS.VALID_OK,
      message: "既存のグループのため実行時はスキップされます",
    };
  } catch (e) {
    if (e.code === 404) return { status: STATUS.VALID_OK, message: "" };
    return { status: STATUS.VALID_NG, message: e.message };
  }
}

function dryRunGroupDelete_(email) {
  try {
    callApi_("Groups.get", function () {
      return AdminDirectory.Groups.get(email);
    });
  } catch (e) {
    if (e.code === 404) {
      return {
        status: STATUS.VALID_OK,
        message: "対象が存在しないため実行時はスキップされます",
      };
    }
    return { status: STATUS.VALID_NG, message: e.message };
  }
  var typeResult = resolveTypeOrFail_(email);
  if (typeResult) return typeResult;
  return { status: STATUS.VALID_OK, message: "" };
}

// Shared guard for destructive/modifying operations: returns a result object
// when the row must not proceed (動的/セキュリティ -> 対象外, resolver error ->
// 失敗), or null when the group is a normal group.
function resolveTypeOrFail_(email) {
  var type;
  try {
    type = resolveGroupType_(email);
  } catch (e) {
    return {
      status: STATUS.FAILED,
      message: "グループ種別の判別に失敗しました: " + e.message,
    };
  }
  if (type !== GROUP_TYPES.NORMAL) {
    return {
      status: STATUS.EXCLUDED,
      message: type + "グループのため対象外です",
    };
  }
  return null;
}
