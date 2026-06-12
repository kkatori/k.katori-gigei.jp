/* global FUNCS, MODES, appConfigCache_:writable, getAppConfig_,
          getConfigString_, formatDateTime_, startJobs_, describeJobState_,
          logSimpleError_, extractErrorMessage_ */

// 11_TriggerManager.gs
// Trigger management (design 2/2, section 5): reserved one-time execution,
// periodic inventory, and continuation triggers. This tool creates at most 3
// triggers; all trigger IDs are tracked in ScriptProperties and removed on
// completion / cancellation.

var TRIGGER_PROPS = {
  RESERVE: "TRIGGER_ID_RESERVE",
  RESERVE_INFO: "TRIGGER_RESERVE_INFO",
  INVENTORY: "TRIGGER_ID_INVENTORY",
  INVENTORY_INFO: "TRIGGER_INVENTORY_INFO",
  CONTINUATION: "TRIGGER_ID_CONTINUATION",
};

var RESERVE_TARGETS = ["すべて", "グループ", "メンバー", "設定変更"];

function deleteTriggerByProp_(propKey) {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(propKey);
  if (!id) return;
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getUniqueId() === id) ScriptApp.deleteTrigger(trigger);
  });
  props.deleteProperty(propKey);
}

// ---- Continuation (design 2/2, section 4.2) ---------------------------------

function createContinuationTrigger_() {
  deleteContinuationTrigger_();
  var trigger = ScriptApp.newTrigger("continueJobHandler")
    .timeBased()
    .after(60 * 1000)
    .create();
  PropertiesService.getScriptProperties().setProperty(
    TRIGGER_PROPS.CONTINUATION,
    trigger.getUniqueId(),
  );
}

function deleteContinuationTrigger_() {
  deleteTriggerByProp_(TRIGGER_PROPS.CONTINUATION);
}

// ---- Reserved execution (FR-14, section 5.1) --------------------------------

function registerReserveTrigger_() {
  var datetime = parseReserveDateTime_(getAppConfig_().RESERVE_DATETIME);
  if (!datetime) {
    throw new Error(
      "設定シートの RESERVE_DATETIME が不正です(例: 2026/06/20 09:00)。",
    );
  }
  if (datetime.getTime() <= Date.now()) {
    throw new Error(
      "予約日時が過去です。設定シートの RESERVE_DATETIME を見直してください。",
    );
  }
  var target = getConfigString_("RESERVE_TARGET") || "すべて";
  if (RESERVE_TARGETS.indexOf(target) === -1) {
    throw new Error(
      "RESERVE_TARGET が不正です(すべて / グループ / メンバー / 設定変更)。",
    );
  }
  deleteTriggerByProp_(TRIGGER_PROPS.RESERVE);
  var trigger = ScriptApp.newTrigger("reserveHandler")
    .timeBased()
    .at(datetime)
    .create();
  var props = PropertiesService.getScriptProperties();
  props.setProperty(TRIGGER_PROPS.RESERVE, trigger.getUniqueId());
  // Snapshot at registration time; later sheet edits do not affect the
  // already-registered reservation.
  props.setProperty(
    TRIGGER_PROPS.RESERVE_INFO,
    JSON.stringify({ at: formatDateTime_(datetime), target: target }),
  );
  return { at: formatDateTime_(datetime), target: target };
}

function cancelReserveTrigger_() {
  deleteTriggerByProp_(TRIGGER_PROPS.RESERVE);
  PropertiesService.getScriptProperties().deleteProperty(
    TRIGGER_PROPS.RESERVE_INFO,
  );
}

// Reserved execution always runs for real (dry run is a manual pre-step).
function reserveHandler() {
  var props = PropertiesService.getScriptProperties();
  var info = JSON.parse(props.getProperty(TRIGGER_PROPS.RESERVE_INFO) || "{}");
  cancelReserveTrigger_();
  try {
    startJobs_(
      reserveTargetToFuncs_(info.target || "すべて"),
      MODES.RESERVE,
      false,
    );
  } catch (e) {
    logSimpleError_("予約実行", MODES.RESERVE, extractErrorMessage_(e));
  }
}

function reserveTargetToFuncs_(target) {
  switch (target) {
    case "グループ":
      return [FUNCS.GROUP_OPS];
    case "メンバー":
      return [FUNCS.MEMBER_OPS];
    case "設定変更":
      return [FUNCS.SETTINGS_OPS];
    default:
      return [FUNCS.GROUP_OPS, FUNCS.MEMBER_OPS, FUNCS.SETTINGS_OPS];
  }
}

// ---- Periodic inventory (FR-15, section 5.2) --------------------------------

var WEEKDAY_MAP = {
  日: "SUNDAY",
  月: "MONDAY",
  火: "TUESDAY",
  水: "WEDNESDAY",
  木: "THURSDAY",
  金: "FRIDAY",
  土: "SATURDAY",
};

function registerInventoryTrigger_() {
  var scheduleText = getConfigString_("INVENTORY_SCHEDULE");
  var schedule = parseSchedule_(scheduleText);
  if (!schedule) {
    throw new Error(
      "INVENTORY_SCHEDULE が不正です(例: 毎日 07:00 / 毎週 月 07:00)。",
    );
  }
  deleteTriggerByProp_(TRIGGER_PROPS.INVENTORY);
  var builder = ScriptApp.newTrigger("scheduledInventoryHandler").timeBased();
  if (schedule.type === "weekly") {
    builder = builder.onWeekDay(ScriptApp.WeekDay[schedule.weekday]);
  } else {
    builder = builder.everyDays(1);
  }
  var trigger = builder
    .atHour(schedule.hour)
    .nearMinute(Math.max(schedule.minute, 1))
    .create();
  var props = PropertiesService.getScriptProperties();
  props.setProperty(TRIGGER_PROPS.INVENTORY, trigger.getUniqueId());
  props.setProperty(TRIGGER_PROPS.INVENTORY_INFO, scheduleText);
  return scheduleText;
}

function cancelInventoryTrigger_() {
  deleteTriggerByProp_(TRIGGER_PROPS.INVENTORY);
  PropertiesService.getScriptProperties().deleteProperty(
    TRIGGER_PROPS.INVENTORY_INFO,
  );
}

function scheduledInventoryHandler() {
  appConfigCache_ = null; // re-read the settings sheet on each scheduled run
  var funcs = [FUNCS.INV_GROUPS];
  if (getConfigString_("INVENTORY_MEMBERS").toUpperCase() === "TRUE") {
    funcs.push(FUNCS.INV_MEMBERS);
  }
  try {
    startJobs_(funcs, MODES.SCHEDULED, false);
  } catch (e) {
    logSimpleError_("定期棚卸し", MODES.SCHEDULED, extractErrorMessage_(e));
  }
}

// ---- Status display ----------------------------------------------------------

function describeTriggerStatus_() {
  var props = PropertiesService.getScriptProperties();
  var lines = [];
  var reserveInfo = props.getProperty(TRIGGER_PROPS.RESERVE_INFO);
  if (props.getProperty(TRIGGER_PROPS.RESERVE) && reserveInfo) {
    var info = JSON.parse(reserveInfo);
    lines.push("予約実行: " + info.at + "(対象: " + info.target + ")");
  } else {
    lines.push("予約実行: 未登録");
  }
  var inventoryInfo = props.getProperty(TRIGGER_PROPS.INVENTORY_INFO);
  lines.push(
    props.getProperty(TRIGGER_PROPS.INVENTORY) && inventoryInfo
      ? "定期棚卸し: " +
          inventoryInfo +
          "(メンバー取得: " +
          getConfigString_("INVENTORY_MEMBERS") +
          ")"
      : "定期棚卸し: 未登録",
  );
  lines.push(
    props.getProperty(TRIGGER_PROPS.CONTINUATION)
      ? "継続トリガー: あり(分割実行中)"
      : "継続トリガー: なし",
  );
  lines.push("");
  lines.push("【実行中ジョブ】");
  lines.push(describeJobState_());
  return lines.join("\n");
}

// ---- Parsers -----------------------------------------------------------------

// Accepts a Date (sheet date cell) or 'yyyy/MM/dd HH:mm' text.
function parseReserveDateTime_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  var m = String(value || "").match(
    /^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})$/,
  );
  if (!m) return null;
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
  );
}

// '毎日 HH:mm' or '毎週 曜 HH:mm' -> {type, weekday, hour, minute}.
function parseSchedule_(text) {
  var daily = String(text || "").match(/^毎日\s+(\d{1,2}):(\d{2})$/);
  if (daily) {
    return { type: "daily", hour: Number(daily[1]), minute: Number(daily[2]) };
  }
  var weekly = String(text || "").match(
    /^毎週\s*([日月火水木金土])\s+(\d{1,2}):(\d{2})$/,
  );
  if (weekly) {
    return {
      type: "weekly",
      weekday: WEEKDAY_MAP[weekly[1]],
      hour: Number(weekly[2]),
      minute: Number(weekly[3]),
    };
  }
  return null;
}
