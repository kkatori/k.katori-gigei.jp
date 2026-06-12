// 01_Config.gs
// Sheet names, column definitions, the 27 group-settings fields, status
// constants, and runtime configuration loaded from the 設定 sheet.
// Sheet names and headers are Japanese by design (D-3); internal keys are English.

var SHEET_NAMES = {
  CONFIG: "設定",
  GROUP_OPS: "指示_グループ",
  MEMBER_OPS: "指示_メンバー",
  SETTINGS_OPS: "指示_設定変更",
  INV_GROUPS: "棚卸_グループ",
  INV_MEMBERS: "棚卸_メンバー",
  INV_SETTINGS: "棚卸_設定",
  LOG: "ログ",
  MASTER: "マスタ_選択肢",
};

// Result statuses written to instruction sheets (design 1/2, section 3.2).
var STATUS = {
  PENDING: "",
  VALID_OK: "検証OK",
  VALID_NG: "検証NG",
  FAILED: "失敗",
  SUCCESS: "成功",
  SKIPPED: "スキップ",
  EXCLUDED: "対象外",
};

// Rows whose result column holds one of these are (re)processed.
var TARGET_STATUSES = [
  STATUS.PENDING,
  STATUS.VALID_OK,
  STATUS.VALID_NG,
  STATUS.FAILED,
];

var MODES = {
  MANUAL: "手動",
  DRY_RUN: "ドライラン",
  RESERVE: "予約",
  SCHEDULED: "定期",
  CONTINUE: "継続",
};

var GROUP_TYPES = {
  NORMAL: "通常",
  DYNAMIC: "動的",
  SECURITY: "セキュリティ",
};

// Job function identifiers (internal keys).
var FUNCS = {
  GROUP_OPS: "GROUP_OPS",
  MEMBER_OPS: "MEMBER_OPS",
  SETTINGS_OPS: "SETTINGS_OPS",
  INV_GROUPS: "INV_GROUPS",
  INV_MEMBERS: "INV_MEMBERS",
  INV_SETTINGS: "INV_SETTINGS",
};

// Labels recorded in the log sheet 機能 column.
var FUNC_LABELS = {
  GROUP_OPS: "グループ指示",
  MEMBER_OPS: "メンバー指示",
  SETTINGS_OPS: "設定変更",
  INV_GROUPS: "棚卸し(グループ)",
  INV_MEMBERS: "棚卸し(メンバー)",
  INV_SETTINGS: "棚卸し(設定)",
};

var OP_VALUES = {
  GROUP: ["作成", "削除"],
  MEMBER: ["追加", "削除"],
};
var MEMBER_ROLES = ["MEMBER", "MANAGER", "OWNER"];
var DELETE_CONFIRM_VALUE = "削除する";

var RESULT_HEADERS = ["結果", "メッセージ", "実行日時", "実行ID"];

// The 27 settings fields, in the column order of 指示_設定変更 (columns B..AB)
// and 棚卸_設定. email/name/description go to Directory Groups.patch; the rest
// go to Groups Settings Groups.patch. Enum values follow the Groups Settings
// API reference.
var SETTINGS_FIELDS = [
  { key: "email", api: "directory", type: "email" },
  { key: "name", api: "directory", type: "string" },
  { key: "description", api: "directory", type: "string" },
  {
    key: "whoCanJoin",
    api: "settings",
    type: "enum",
    values: [
      "ANYONE_CAN_JOIN",
      "ALL_IN_DOMAIN_CAN_JOIN",
      "INVITED_CAN_JOIN",
      "CAN_REQUEST_TO_JOIN",
    ],
  },
  {
    key: "whoCanViewMembership",
    api: "settings",
    type: "enum",
    values: [
      "ALL_IN_DOMAIN_CAN_VIEW",
      "ALL_MEMBERS_CAN_VIEW",
      "ALL_MANAGERS_CAN_VIEW",
      "ALL_OWNERS_CAN_VIEW",
    ],
  },
  {
    key: "whoCanViewGroup",
    api: "settings",
    type: "enum",
    values: [
      "ANYONE_CAN_VIEW",
      "ALL_IN_DOMAIN_CAN_VIEW",
      "ALL_MEMBERS_CAN_VIEW",
      "ALL_MANAGERS_CAN_VIEW",
      "ALL_OWNERS_CAN_VIEW",
    ],
  },
  { key: "allowExternalMembers", api: "settings", type: "bool" },
  {
    key: "whoCanPostMessage",
    api: "settings",
    type: "enum",
    values: [
      "NONE_CAN_POST",
      "ALL_MANAGERS_CAN_POST",
      "ALL_MEMBERS_CAN_POST",
      "ALL_OWNERS_CAN_POST",
      "ALL_IN_DOMAIN_CAN_POST",
      "ANYONE_CAN_POST",
    ],
  },
  { key: "allowWebPosting", api: "settings", type: "bool" },
  {
    key: "messageModerationLevel",
    api: "settings",
    type: "enum",
    values: [
      "MODERATE_ALL_MESSAGES",
      "MODERATE_NON_MEMBERS",
      "MODERATE_NEW_MEMBERS",
      "MODERATE_NONE",
    ],
  },
  {
    key: "spamModerationLevel",
    api: "settings",
    type: "enum",
    values: ["ALLOW", "MODERATE", "SILENTLY_MODERATE", "REJECT"],
  },
  {
    key: "replyTo",
    api: "settings",
    type: "enum",
    values: [
      "REPLY_TO_CUSTOM",
      "REPLY_TO_SENDER",
      "REPLY_TO_LIST",
      "REPLY_TO_OWNER",
      "REPLY_TO_IGNORE",
      "REPLY_TO_MANAGERS",
    ],
  },
  { key: "customReplyTo", api: "settings", type: "email" },
  { key: "includeCustomFooter", api: "settings", type: "bool" },
  { key: "customFooterText", api: "settings", type: "string" },
  { key: "sendMessageDenyNotification", api: "settings", type: "bool" },
  {
    key: "defaultMessageDenyNotificationText",
    api: "settings",
    type: "string",
  },
  { key: "membersCanPostAsTheGroup", api: "settings", type: "bool" },
  { key: "includeInGlobalAddressList", api: "settings", type: "bool" },
  {
    key: "whoCanLeaveGroup",
    api: "settings",
    type: "enum",
    values: [
      "ALL_MANAGERS_CAN_LEAVE",
      "ALL_MEMBERS_CAN_LEAVE",
      "NONE_CAN_LEAVE",
    ],
  },
  {
    key: "whoCanContactOwner",
    api: "settings",
    type: "enum",
    values: [
      "ALL_IN_DOMAIN_CAN_CONTACT",
      "ALL_MANAGERS_CAN_CONTACT",
      "ALL_MEMBERS_CAN_CONTACT",
      "ANYONE_CAN_CONTACT",
    ],
  },
  {
    key: "whoCanModerateMembers",
    api: "settings",
    type: "enum",
    values: ["ALL_MEMBERS", "OWNERS_AND_MANAGERS", "OWNERS_ONLY", "NONE"],
  },
  {
    key: "whoCanModerateContent",
    api: "settings",
    type: "enum",
    values: ["ALL_MEMBERS", "OWNERS_AND_MANAGERS", "OWNERS_ONLY", "NONE"],
  },
  {
    key: "whoCanAssistContent",
    api: "settings",
    type: "enum",
    values: [
      "ALL_MEMBERS",
      "OWNERS_AND_MANAGERS",
      "MANAGERS_ONLY",
      "OWNERS_ONLY",
      "NONE",
    ],
  },
  { key: "enableCollaborativeInbox", api: "settings", type: "bool" },
  {
    key: "whoCanDiscoverGroup",
    api: "settings",
    type: "enum",
    values: [
      "ANYONE_CAN_DISCOVER",
      "ALL_IN_DOMAIN_CAN_DISCOVER",
      "ALL_MEMBERS_CAN_DISCOVER",
    ],
  },
  {
    key: "defaultSender",
    api: "settings",
    type: "enum",
    values: ["DEFAULT_SELF", "GROUP"],
  },
];

function settingsFieldKeys_() {
  return SETTINGS_FIELDS.map(function (f) {
    return f.key;
  });
}

// Per-sheet header rows and (for instruction sheets) the 1-based column where
// the 4 result columns start.
var SHEET_DEFS = {};
SHEET_DEFS[SHEET_NAMES.CONFIG] = {
  headers: ["キー", "値", "説明"],
};
SHEET_DEFS[SHEET_NAMES.GROUP_OPS] = {
  headers: ["操作", "グループメール", "グループ名", "説明", "削除確認"].concat(
    RESULT_HEADERS,
  ),
  resultCol: 6,
};
SHEET_DEFS[SHEET_NAMES.MEMBER_OPS] = {
  headers: ["操作", "グループメール", "メンバーメール", "ロール"].concat(
    RESULT_HEADERS,
  ),
  resultCol: 5,
};
SHEET_DEFS[SHEET_NAMES.SETTINGS_OPS] = {
  headers: ["グループメール"]
    .concat(settingsFieldKeys_())
    .concat(RESULT_HEADERS),
  resultCol: 29,
};
SHEET_DEFS[SHEET_NAMES.INV_GROUPS] = {
  headers: [
    "グループメール",
    "グループ名",
    "説明",
    "直接メンバー数",
    "種別",
    "エイリアス",
    "管理者作成",
    "取得日時",
  ],
};
SHEET_DEFS[SHEET_NAMES.INV_MEMBERS] = {
  headers: [
    "グループメール",
    "メンバーメール",
    "ロール",
    "種別",
    "ステータス",
    "取得日時",
  ],
};
SHEET_DEFS[SHEET_NAMES.INV_SETTINGS] = {
  headers: ["グループメール"].concat(settingsFieldKeys_()).concat(["取得日時"]),
};
SHEET_DEFS[SHEET_NAMES.LOG] = {
  headers: [
    "実行ID",
    "機能",
    "モード",
    "開始日時",
    "終了日時",
    "実行者",
    "対象件数",
    "成功",
    "失敗",
    "スキップ",
    "状態",
    "備考",
  ],
};
SHEET_DEFS[SHEET_NAMES.MASTER] = {
  headers: ["フィールド名", "選択値", "説明"],
};

// Instruction job func -> sheet name.
var FUNC_SHEETS = {};
FUNC_SHEETS[FUNCS.GROUP_OPS] = SHEET_NAMES.GROUP_OPS;
FUNC_SHEETS[FUNCS.MEMBER_OPS] = SHEET_NAMES.MEMBER_OPS;
FUNC_SHEETS[FUNCS.SETTINGS_OPS] = SHEET_NAMES.SETTINGS_OPS;

// Settings-sheet keys, defaults, and descriptions (design 1/2, section 4.1).
var CONFIG_ITEMS = [
  {
    key: "TIME_LIMIT_SEC",
    value: "300",
    desc: "1回の実行を打ち切る秒数(6分上限への安全マージン)",
  },
  { key: "BATCH_ROWS", value: "50", desc: "結果を書き戻すチャンク単位の行数" },
  { key: "RETRY_MAX", value: "5", desc: "レート制限時の最大リトライ回数" },
  {
    key: "RETRY_BASE_MS",
    value: "1000",
    desc: "指数バックオフの初期待機ミリ秒",
  },
  {
    key: "CSV_FOLDER_ID",
    value: "",
    desc: "CSV出力先のGoogleドライブフォルダID",
  },
  {
    key: "RESERVE_DATETIME",
    value: "",
    desc: "予約実行の日時(例: 2026/06/20 09:00)",
  },
  {
    key: "RESERVE_TARGET",
    value: "すべて",
    desc: "予約実行の対象(すべて / グループ / メンバー / 設定変更)",
  },
  {
    key: "INVENTORY_SCHEDULE",
    value: "毎週 月 07:00",
    desc: "定期棚卸しの頻度(毎日 HH:mm / 毎週 曜 HH:mm)",
  },
  {
    key: "INVENTORY_MEMBERS",
    value: "TRUE",
    desc: "定期棚卸しでメンバー一覧も取得するか(TRUE/FALSE)",
  },
  { key: "LOG_RETENTION_DAYS", value: "365", desc: "ログ保持日数" },
];

var appConfigCache_ = null;

// Returns the settings sheet as an object (raw cell values; dates stay Date).
function getAppConfig_() {
  if (appConfigCache_) return appConfigCache_;
  var cfg = {};
  CONFIG_ITEMS.forEach(function (item) {
    cfg[item.key] = item.value;
  });
  var sheet = getSheetOrNull_(SHEET_NAMES.CONFIG);
  if (sheet && sheet.getLastRow() >= 2) {
    var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
    values.forEach(function (row) {
      var key = String(row[0]).trim();
      if (key) cfg[key] = row[1];
    });
  }
  appConfigCache_ = cfg;
  return cfg;
}

function getConfigNumber_(key, fallback) {
  var n = Number(getAppConfig_()[key]);
  return isFinite(n) && n > 0 ? n : fallback;
}

function getConfigString_(key) {
  var v = getAppConfig_()[key];
  return cellStr_(v);
}

// ---- Spreadsheet / value helpers -------------------------------------------

function getSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheetOrNull_(name) {
  return getSpreadsheet_().getSheetByName(name);
}

function getRequiredSheet_(name) {
  var sheet = getSheetOrNull_(name);
  if (!sheet) {
    throw new Error(
      "シート「" +
        name +
        "」がありません。メニューの「初期セットアップ」を実行してください。",
    );
  }
  return sheet;
}

function formatDateTime_(date) {
  return Utilities.formatDate(
    date,
    getSpreadsheet_().getSpreadsheetTimeZone(),
    "yyyy/MM/dd HH:mm:ss",
  );
}

function nowString_() {
  return formatDateTime_(new Date());
}

// Normalizes a cell value to a trimmed string ('' for blank).
function cellStr_(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return formatDateTime_(value);
  return String(value).trim();
}

function isRowEmpty_(rowValues) {
  return rowValues.every(function (v) {
    return cellStr_(v) === "";
  });
}

// Clears data rows (row 2 and below) of a sheet, keeping the header.
function clearDataRows_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getMaxColumns()).clearContent();
  }
}
