/* global STATUS, cellStr_, validateMemberOpRow_, callApi_, resolveTypeOrFail_ */

// 07_MemberOps.gs
// Member add / remove row processing (FR-04, FR-05). Idempotency: already a
// member (409 on insert) and not a member (404 on remove) become スキップ.

function processMemberRow_(row, state) {
  var op = cellStr_(row[0]);
  var groupEmail = cellStr_(row[1]).toLowerCase();
  var memberEmail = cellStr_(row[2]).toLowerCase();
  var role = cellStr_(row[3]).toUpperCase() || "MEMBER";

  var ngMessage = validateMemberOpRow_(op, groupEmail, memberEmail, role);
  if (ngMessage) return { status: STATUS.VALID_NG, message: ngMessage };

  var typeResult = resolveTypeOrFail_(groupEmail);
  if (typeResult) return typeResult;

  if (state.dryRun) return dryRunMemberOp_(op, groupEmail, memberEmail);
  return op === "追加"
    ? execMemberAdd_(groupEmail, memberEmail, role)
    : execMemberRemove_(groupEmail, memberEmail);
}

function execMemberAdd_(groupEmail, memberEmail, role) {
  try {
    callApi_("Members.insert", function () {
      return AdminDirectory.Members.insert(
        { email: memberEmail, role: role },
        groupEmail,
      );
    });
    return {
      status: STATUS.SUCCESS,
      message: "メンバーを追加しました(" + role + ")",
    };
  } catch (e) {
    if (e.code === 409)
      return {
        status: STATUS.SKIPPED,
        message: "追加済みのためスキップしました",
      };
    if (e.code === 404)
      return {
        status: STATUS.VALID_NG,
        message: "対象が存在しません: " + e.message,
      };
    return { status: STATUS.FAILED, message: e.message };
  }
}

function execMemberRemove_(groupEmail, memberEmail) {
  try {
    callApi_("Members.remove", function () {
      AdminDirectory.Members.remove(groupEmail, memberEmail);
    });
    return { status: STATUS.SUCCESS, message: "メンバーを削除しました" };
  } catch (e) {
    if (e.code === 404) {
      // 404 covers both "group missing" and "not a member"; group missing is a
      // validation error (design 2/2, section 6), not-a-member is idempotent.
      if (/group/i.test(e.message) && !/member/i.test(e.message)) {
        return {
          status: STATUS.VALID_NG,
          message: "対象グループが存在しません",
        };
      }
      return {
        status: STATUS.SKIPPED,
        message: "未所属のためスキップしました",
      };
    }
    return { status: STATUS.FAILED, message: e.message };
  }
}

// Dry run: read-only existence checks (group via Groups.get, membership via
// Members.get; 404 = not a member).
function dryRunMemberOp_(op, groupEmail, memberEmail) {
  try {
    callApi_("Groups.get", function () {
      return AdminDirectory.Groups.get(groupEmail);
    });
  } catch (e) {
    if (e.code === 404)
      return { status: STATUS.VALID_NG, message: "対象グループが存在しません" };
    return { status: STATUS.VALID_NG, message: e.message };
  }
  var isMember;
  try {
    callApi_("Members.get", function () {
      return AdminDirectory.Members.get(groupEmail, memberEmail);
    });
    isMember = true;
  } catch (e2) {
    if (e2.code === 404) {
      isMember = false;
    } else {
      return { status: STATUS.VALID_NG, message: e2.message };
    }
  }
  if (op === "追加" && isMember) {
    return {
      status: STATUS.VALID_OK,
      message: "追加済みのため実行時はスキップされます",
    };
  }
  if (op === "削除" && !isMember) {
    return {
      status: STATUS.VALID_OK,
      message: "未所属のため実行時はスキップされます",
    };
  }
  return { status: STATUS.VALID_OK, message: "" };
}
