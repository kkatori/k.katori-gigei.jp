/* global SHEET_NAMES, SHEET_DEFS, CONFIG_ITEMS, SETTINGS_FIELDS, OP_VALUES,
          MEMBER_ROLES, DELETE_CONFIRM_VALUE, appConfigCache_:writable,
          getSpreadsheet_, getRequiredSheet_, clearDataRows_ */

// 03_Setup.gs
// Initial setup: generates all sheets, headers, default config values, the
// マスタ_選択肢 sheet, and data validations (design 1/2, section 2). Idempotent:
// existing user data is preserved; headers/validations/master are rewritten.

// Japanese descriptions for enum values, used to populate マスタ_選択肢.
var ENUM_DESCRIPTIONS = {
  whoCanJoin: {
    ANYONE_CAN_JOIN: "誰でも参加できる(外部含む)",
    ALL_IN_DOMAIN_CAN_JOIN: "ドメイン内の全員が参加できる",
    INVITED_CAN_JOIN: "招待されたユーザーのみ参加できる",
    CAN_REQUEST_TO_JOIN: "参加リクエストを承認制にする",
  },
  whoCanViewMembership: {
    ALL_IN_DOMAIN_CAN_VIEW: "ドメイン内の全員が閲覧可",
    ALL_MEMBERS_CAN_VIEW: "メンバーが閲覧可",
    ALL_MANAGERS_CAN_VIEW: "マネージャー以上が閲覧可",
    ALL_OWNERS_CAN_VIEW: "オーナーのみ閲覧可",
  },
  whoCanViewGroup: {
    ANYONE_CAN_VIEW: "誰でも閲覧可(外部含む)",
    ALL_IN_DOMAIN_CAN_VIEW: "ドメイン内の全員が閲覧可",
    ALL_MEMBERS_CAN_VIEW: "メンバーが閲覧可",
    ALL_MANAGERS_CAN_VIEW: "マネージャー以上が閲覧可",
    ALL_OWNERS_CAN_VIEW: "オーナーのみ閲覧可",
  },
  whoCanPostMessage: {
    NONE_CAN_POST: "投稿不可(アーカイブ専用)",
    ALL_MANAGERS_CAN_POST: "マネージャー以上が投稿可",
    ALL_MEMBERS_CAN_POST: "メンバーが投稿可",
    ALL_OWNERS_CAN_POST: "オーナーのみ投稿可",
    ALL_IN_DOMAIN_CAN_POST: "ドメイン内の全員が投稿可",
    ANYONE_CAN_POST: "誰でも投稿可(外部含む)",
  },
  messageModerationLevel: {
    MODERATE_ALL_MESSAGES: "すべての投稿を承認制にする",
    MODERATE_NON_MEMBERS: "メンバー以外の投稿を承認制にする",
    MODERATE_NEW_MEMBERS: "新規メンバーの投稿を承認制にする",
    MODERATE_NONE: "承認なしで投稿を許可",
  },
  spamModerationLevel: {
    ALLOW: "スパム判定せず投稿を許可",
    MODERATE: "迷惑メールの疑いを承認待ちにし通知する",
    SILENTLY_MODERATE: "承認待ちにする(通知なし)",
    REJECT: "即時に拒否する",
  },
  replyTo: {
    REPLY_TO_CUSTOM: "customReplyTo のアドレスへ返信",
    REPLY_TO_SENDER: "送信者へ返信",
    REPLY_TO_LIST: "グループ全体へ返信",
    REPLY_TO_OWNER: "オーナーへ返信",
    REPLY_TO_IGNORE: "返信先をユーザーが選択",
    REPLY_TO_MANAGERS: "マネージャーへ返信",
  },
  whoCanLeaveGroup: {
    ALL_MANAGERS_CAN_LEAVE: "マネージャー以上が退会可",
    ALL_MEMBERS_CAN_LEAVE: "メンバーが退会可",
    NONE_CAN_LEAVE: "退会不可",
  },
  whoCanContactOwner: {
    ALL_IN_DOMAIN_CAN_CONTACT: "ドメイン内の全員が連絡可",
    ALL_MANAGERS_CAN_CONTACT: "マネージャー以上が連絡可",
    ALL_MEMBERS_CAN_CONTACT: "メンバーが連絡可",
    ANYONE_CAN_CONTACT: "誰でも連絡可(外部含む)",
  },
  whoCanModerateMembers: {
    ALL_MEMBERS: "メンバー全員が管理可",
    OWNERS_AND_MANAGERS: "オーナーとマネージャーが管理可",
    OWNERS_ONLY: "オーナーのみ管理可",
    NONE: "管理不可",
  },
  whoCanModerateContent: {
    ALL_MEMBERS: "メンバー全員が管理可",
    OWNERS_AND_MANAGERS: "オーナーとマネージャーが管理可",
    OWNERS_ONLY: "オーナーのみ管理可",
    NONE: "管理不可",
  },
  whoCanAssistContent: {
    ALL_MEMBERS: "メンバー全員が補助可",
    OWNERS_AND_MANAGERS: "オーナーとマネージャーが補助可",
    MANAGERS_ONLY: "マネージャーのみ補助可",
    OWNERS_ONLY: "オーナーのみ補助可",
    NONE: "補助不可",
  },
  whoCanDiscoverGroup: {
    ANYONE_CAN_DISCOVER: "誰でも検索・発見可",
    ALL_IN_DOMAIN_CAN_DISCOVER: "ドメイン内の全員が発見可",
    ALL_MEMBERS_CAN_DISCOVER: "メンバーのみ発見可",
  },
  defaultSender: {
    DEFAULT_SELF: "送信者自身のアドレスで送信",
    GROUP: "グループのアドレスで送信",
  },
};

// Sheet creation order matches the design document table.
var SETUP_SHEET_ORDER = [
  SHEET_NAMES.CONFIG,
  SHEET_NAMES.GROUP_OPS,
  SHEET_NAMES.MEMBER_OPS,
  SHEET_NAMES.SETTINGS_OPS,
  SHEET_NAMES.INV_GROUPS,
  SHEET_NAMES.INV_MEMBERS,
  SHEET_NAMES.INV_SETTINGS,
  SHEET_NAMES.LOG,
  SHEET_NAMES.MASTER,
];

function runInitialSetup_() {
  var ss = getSpreadsheet_();
  SETUP_SHEET_ORDER.forEach(function (name, index) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name, index);
    writeHeaders_(sheet, SHEET_DEFS[name].headers);
  });
  setupConfigSheet_();
  setupMasterSheet_();
  setupValidations_();
  appConfigCache_ = null;
}

function writeHeaders_(sheet, headers) {
  sheet
    .getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight("bold")
    .setBackground("#efefef");
  sheet.setFrozenRows(1);
}

// Adds missing config keys with defaults; existing values are kept.
function setupConfigSheet_() {
  var sheet = getRequiredSheet_(SHEET_NAMES.CONFIG);
  var existing = {};
  if (sheet.getLastRow() >= 2) {
    sheet
      .getRange(2, 1, sheet.getLastRow() - 1, 1)
      .getValues()
      .forEach(function (row) {
        var key = String(row[0]).trim();
        if (key) existing[key] = true;
      });
  }
  var rows = [];
  CONFIG_ITEMS.forEach(function (item) {
    if (!existing[item.key]) rows.push([item.key, item.value, item.desc]);
  });
  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 3).setValues(rows);
  }
}

// Rewrites マスタ_選択肢 entirely (it is reference data owned by the script).
function setupMasterSheet_() {
  var sheet = getRequiredSheet_(SHEET_NAMES.MASTER);
  clearDataRows_(sheet);
  var rows = [];
  rows.push(["操作(グループ)", "作成", "グループを新規作成する"]);
  rows.push([
    "操作(グループ)",
    "削除",
    "グループを削除する(削除確認の入力が必要)",
  ]);
  rows.push(["操作(メンバー)", "追加", "メンバーをグループに追加する"]);
  rows.push(["操作(メンバー)", "削除", "メンバーをグループから削除する"]);
  rows.push(["ロール", "MEMBER", "一般メンバー(既定)"]);
  rows.push(["ロール", "MANAGER", "マネージャー"]);
  rows.push(["ロール", "OWNER", "オーナー"]);
  rows.push([
    "削除確認",
    DELETE_CONFIRM_VALUE,
    "削除を実行する行にのみ設定する",
  ]);
  SETTINGS_FIELDS.forEach(function (field) {
    if (field.type === "enum") {
      var descs = ENUM_DESCRIPTIONS[field.key] || {};
      field.values.forEach(function (value) {
        rows.push([field.key, value, descs[value] || ""]);
      });
    } else if (field.type === "bool") {
      rows.push([field.key, "TRUE", "有効にする"]);
      rows.push([field.key, "FALSE", "無効にする"]);
    }
  });
  sheet.getRange(2, 1, rows.length, 3).setValues(rows);
}

// Sets dropdown validations on instruction sheets. setAllowInvalid(true) shows
// a warning instead of blocking, so CSV paste still works; the script
// re-validates the same value sets before execution (FR-09 double check).
function setupValidations_() {
  setColumnValidation_(SHEET_NAMES.GROUP_OPS, 1, OP_VALUES.GROUP);
  setColumnValidation_(SHEET_NAMES.GROUP_OPS, 5, [DELETE_CONFIRM_VALUE]);
  setColumnValidation_(SHEET_NAMES.MEMBER_OPS, 1, OP_VALUES.MEMBER);
  setColumnValidation_(SHEET_NAMES.MEMBER_OPS, 4, MEMBER_ROLES);
  SETTINGS_FIELDS.forEach(function (field, index) {
    var col = index + 2; // fields start at column B
    if (field.type === "enum") {
      setColumnValidation_(SHEET_NAMES.SETTINGS_OPS, col, field.values);
    } else if (field.type === "bool") {
      setColumnValidation_(SHEET_NAMES.SETTINGS_OPS, col, ["TRUE", "FALSE"]);
    }
  });
}

function setColumnValidation_(sheetName, col, values) {
  var sheet = getRequiredSheet_(sheetName);
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange(2, col, sheet.getMaxRows() - 1, 1).setDataValidation(rule);
}
