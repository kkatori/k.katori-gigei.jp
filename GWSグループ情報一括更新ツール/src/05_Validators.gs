/* global OP_VALUES, MEMBER_ROLES, DELETE_CONFIRM_VALUE, cellStr_ */

// 05_Validators.gs
// Pre-execution validation (FR-09, design 2/2, section 6). Format-level checks
// run in both real and dry runs; existence checks via read APIs run in the
// per-operation dry-run paths (06-08).

var EMAIL_RE = /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

function isValidEmail_(value) {
  return EMAIL_RE.test(value);
}

// Returns an error message ('' when valid) for a 指示_グループ row.
function validateGroupOpRow_(op, email, name, confirm) {
  if (OP_VALUES.GROUP.indexOf(op) === -1)
    return "操作が不正です(作成/削除のいずれか)";
  if (!isValidEmail_(email)) return "グループメールの形式が不正です";
  if (op === "作成" && !name) return "作成にはグループ名が必須です";
  if (op === "削除" && confirm !== DELETE_CONFIRM_VALUE) {
    return "削除確認が「" + DELETE_CONFIRM_VALUE + "」になっていません";
  }
  return "";
}

// Returns an error message ('' when valid) for a 指示_メンバー row.
function validateMemberOpRow_(op, groupEmail, memberEmail, role) {
  if (OP_VALUES.MEMBER.indexOf(op) === -1)
    return "操作が不正です(追加/削除のいずれか)";
  if (!isValidEmail_(groupEmail)) return "グループメールの形式が不正です";
  if (!isValidEmail_(memberEmail)) return "メンバーメールの形式が不正です";
  if (role && MEMBER_ROLES.indexOf(role) === -1)
    return "ロールが不正です(MEMBER/MANAGER/OWNER)";
  return "";
}

// Normalizes one settings cell for the API body. Returns undefined and pushes
// a message to errors when the value is invalid. Booleans are converted to the
// string form the Groups Settings API expects.
function normalizeSettingValue_(field, rawValue, errors) {
  var value =
    typeof rawValue === "boolean"
      ? rawValue
        ? "TRUE"
        : "FALSE"
      : cellStr_(rawValue);
  switch (field.type) {
    case "string":
      return value;
    case "email":
      if (!isValidEmail_(value)) {
        errors.push(field.key + ": メール形式が不正です");
        return undefined;
      }
      return value;
    case "bool": {
      var upper = value.toUpperCase();
      if (upper !== "TRUE" && upper !== "FALSE") {
        errors.push(field.key + ": TRUE/FALSE で指定してください");
        return undefined;
      }
      return upper === "TRUE" ? "true" : "false";
    }
    case "enum": {
      var enumValue = value.toUpperCase();
      if (field.values.indexOf(enumValue) === -1) {
        errors.push(field.key + ": 選択値が不正です");
        return undefined;
      }
      return enumValue;
    }
    default:
      return value;
  }
}
