/* global getConfig, CONFIG_KEYS */

// 列定義と「シート行 ⇔ Directory API ユーザーリソース」の双方向マッピング。
// USER_SHEET_HEADERS がシート列順の唯一の定義。
// 対応する Directory API ユーザーリソースの更新可能フィールドはほぼ網羅する。
// 既定で除外: posixAccounts / sshPublicKeys / hashFunction（Unix/SSH/事前ハッシュ用途で複雑なため）。

var USER_SHEET_HEADERS = [
  "操作",
  "ステータス",
  "メッセージ",
  "メールアドレス",
  "姓",
  "名",
  "表示名",
  "パスワード",
  "次回PW変更",
  "組織単位",
  "会社",
  "部門",
  "役職",
  "コストセンター",
  "勤務電話",
  "携帯電話",
  "FAX",
  "住所",
  "建物ID",
  "座席",
  "予備メール",
  "社員番号",
  "上長",
  "ウェブサイト",
  "IM",
  "言語",
  "性別",
  "メモ",
  "キーワード",
  "名簿に表示",
  "アーカイブ",
  "IP許可リスト",
  "リカバリメール",
  "リカバリ電話",
  "別名",
  "姓(よみ)",
  "名(よみ)",
  "内線",
];

var OPERATIONS = {
  CREATE: "作成",
  UPDATE: "更新",
  DELETE: "削除",
  SUSPEND: "停止",
  RESTORE: "再開",
};

var VALID_OPERATIONS = ["作成", "更新", "削除", "停止", "再開"];

// 電話の列名 → Directory API phone type
var PHONE_TYPES = [
  { header: "勤務電話", type: "work" },
  { header: "携帯電話", type: "mobile" },
  { header: "FAX", type: "work_fax" },
];

// IM プロトコルの既定セット（これ以外は custom_protocol 扱い）。
var IM_PROTOCOLS = [
  "aim",
  "gtalk",
  "icq",
  "jabber",
  "msn",
  "net_meeting",
  "qq",
  "skype",
  "yahoo",
];

function isValidOperation(op) {
  return VALID_OPERATIONS.indexOf(op) !== -1;
}

function str_(v) {
  return v === undefined || v === null ? "" : String(v).trim();
}

// TRUE/FALSE 系の文字列・真偽値・空欄を解釈する。空欄は「変更しない」を表す null。
function parseBoolOrNull_(v) {
  if (typeof v === "boolean") return v;
  var s = str_(v).toLowerCase();
  if (s === "") return null;
  return s === "true" || s === "yes" || s === "1" || s === "○";
}

function csvToList_(v) {
  var s = str_(v);
  if (!s) return [];
  return s
    .split(",")
    .map(function (x) {
      return x.trim();
    })
    .filter(function (x) {
      return x !== "";
    });
}

function rowToMap_(headers, row) {
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    map[headers[i]] = row[i];
  }
  return map;
}

// ----- 値オブジェクトのビルダー（空欄なら null を返す） -----

function buildGender_(v) {
  var s = str_(v);
  if (!s) return null;
  var lower = s.toLowerCase();
  if (["male", "female", "other", "unknown"].indexOf(lower) !== -1) {
    return { type: lower };
  }
  if (s === "男性" || s === "男") return { type: "male" };
  if (s === "女性" || s === "女") return { type: "female" };
  return { type: "other", customGender: s };
}

function buildNotes_(v) {
  var s = str_(v);
  if (!s) return null;
  return { contentType: "text_plain", value: s };
}

function buildLanguages_(v) {
  var parts = csvToList_(v);
  if (parts.length === 0) return null;
  return parts.map(function (code) {
    if (/^[A-Za-z][A-Za-z0-9-]*$/.test(code)) return { languageCode: code };
    return { customLanguage: code };
  });
}

function buildWebsites_(v) {
  var s = str_(v);
  if (!s) return null;
  return [{ type: "work", value: s, primary: true }];
}

function buildIms_(v) {
  var s = str_(v);
  if (!s) return null;
  var idx = s.indexOf(":");
  var protocol;
  var account;
  if (idx === -1) {
    protocol = "";
    account = s;
  } else {
    protocol = s.substring(0, idx).trim().toLowerCase();
    account = s.substring(idx + 1).trim();
  }
  var entry = { type: "work", im: account, primary: true };
  if (protocol && IM_PROTOCOLS.indexOf(protocol) !== -1) {
    entry.protocol = protocol;
  } else {
    entry.protocol = "custom_protocol";
    entry.customProtocol = protocol || "im";
  }
  return [entry];
}

function buildKeywords_(v) {
  var parts = csvToList_(v);
  if (parts.length === 0) return null;
  return parts.map(function (kw) {
    return { type: "custom", customType: "tag", value: kw };
  });
}

function buildLocations_(buildingId, deskCode) {
  if (!buildingId && !deskCode) return null;
  var loc = { type: "desk" };
  if (buildingId) loc.buildingId = buildingId;
  if (deskCode) loc.deskCode = deskCode;
  return [loc];
}

// シート 1 行を正規化した中間表現に変換する。
// *Touched フラグは「その項目グループにユーザーが値を入れたか」を表す。
function parseRow_(headers, row) {
  var m = rowToMap_(headers, row);
  var p = {
    primaryEmail: str_(m["メールアドレス"]),
    password: str_(m["パスワード"]),
    orgUnitPath: str_(m["組織単位"]),
    changePassword: parseBoolOrNull_(m["次回PW変更"]),
    recoveryEmail: str_(m["リカバリメール"]),
    recoveryPhone: str_(m["リカバリ電話"]),
    includeInGAL: parseBoolOrNull_(m["名簿に表示"]),
    archived: parseBoolOrNull_(m["アーカイブ"]),
    ipWhitelisted: parseBoolOrNull_(m["IP許可リスト"]),
  };

  // 氏名（表示名を含む）
  var family = str_(m["姓"]);
  var given = str_(m["名"]);
  var display = str_(m["表示名"]);
  p.name = {};
  if (family) p.name.familyName = family;
  if (given) p.name.givenName = given;
  if (display) p.name.displayName = display;
  p.nameTouched = !!(family || given || display);

  // 組織情報（会社/部門/役職/コストセンター）
  var org = {};
  var company = str_(m["会社"]);
  var dept = str_(m["部門"]);
  var title = str_(m["役職"]);
  var cost = str_(m["コストセンター"]);
  if (company) org.name = company;
  if (dept) org.department = dept;
  if (title) org.title = title;
  if (cost) org.costCenter = cost;
  p.org = org;
  p.orgTouched = !!(company || dept || title || cost);

  // 電話
  var phones = [];
  var phonesTouched = false;
  for (var i = 0; i < PHONE_TYPES.length; i++) {
    var pv = str_(m[PHONE_TYPES[i].header]);
    if (pv) {
      phones.push({ type: PHONE_TYPES[i].type, value: pv });
      phonesTouched = true;
    }
  }
  p.phones = phones;
  p.phonesTouched = phonesTouched;

  // 住所
  var addr = str_(m["住所"]);
  p.addressTouched = !!addr;
  p.addresses = addr ? [{ type: "work", formatted: addr }] : [];

  // 勤務地（建物/座席）
  p.locations = buildLocations_(str_(m["建物ID"]), str_(m["座席"]));
  p.locationsTouched = !!p.locations;

  // 予備メール
  var alt = str_(m["予備メール"]);
  p.altEmail = alt;
  p.altEmailTouched = !!alt;

  // 社員番号
  var emp = str_(m["社員番号"]);
  p.employeeIdTouched = !!emp;
  p.externalIds = emp ? [{ type: "organization", value: emp }] : [];

  // 上長（管理者）
  var mgr = str_(m["上長"]);
  p.managerTouched = !!mgr;
  p.relations = mgr ? [{ type: "manager", value: mgr }] : [];

  // ウェブサイト / IM / 言語 / 性別 / メモ / キーワード
  p.websites = buildWebsites_(m["ウェブサイト"]);
  p.websitesTouched = !!p.websites;
  p.ims = buildIms_(m["IM"]);
  p.imsTouched = !!p.ims;
  p.languages = buildLanguages_(m["言語"]);
  p.languagesTouched = !!p.languages;
  p.gender = buildGender_(m["性別"]);
  p.genderTouched = !!p.gender;
  p.notes = buildNotes_(m["メモ"]);
  p.notesTouched = !!p.notes;
  p.keywords = buildKeywords_(m["キーワード"]);
  p.keywordsTouched = !!p.keywords;

  // 別名（カンマ区切り）
  var aliasRaw = str_(m["別名"]);
  p.aliasesProvided = aliasRaw !== "";
  p.aliases = csvToList_(aliasRaw);

  // カスタムスキーマ依存（よみがな・内線）
  p.custom = {
    lastNameYomi: str_(m["姓(よみ)"]),
    firstNameYomi: str_(m["名(よみ)"]),
    extension: str_(m["内線"]),
  };

  return p;
}

function orgWithPrimary_(org) {
  var copy = { primary: true };
  if (org.name !== undefined) copy.name = org.name;
  if (org.department !== undefined) copy.department = org.department;
  if (org.title !== undefined) copy.title = org.title;
  if (org.costCenter !== undefined) copy.costCenter = org.costCenter;
  return copy;
}

function buildEmails_(p) {
  return [
    { address: p.primaryEmail, primary: true },
    { address: p.altEmail, type: "work" },
  ];
}

// 設定済みのカスタムスキーマがある場合のみ customSchemas を構築する。
// スキーマ名と各フィールド名は設定シートで指定（未設定なら null = 反映しない）。
function buildCustomSchemas_(p) {
  var schema = str_(getConfig(CONFIG_KEYS.CUSTOM_SCHEMA_NAME, ""));
  if (!schema) return null;

  var fields = {};
  var fLast = str_(getConfig(CONFIG_KEYS.CUSTOM_FIELD_LASTNAME_YOMI, ""));
  var fFirst = str_(getConfig(CONFIG_KEYS.CUSTOM_FIELD_FIRSTNAME_YOMI, ""));
  var fExt = str_(getConfig(CONFIG_KEYS.CUSTOM_FIELD_EXTENSION, ""));

  if (fLast && p.custom.lastNameYomi) fields[fLast] = p.custom.lastNameYomi;
  if (fFirst && p.custom.firstNameYomi) fields[fFirst] = p.custom.firstNameYomi;
  if (fExt && p.custom.extension) fields[fExt] = p.custom.extension;

  if (Object.keys(fields).length === 0) return null;
  var cs = {};
  cs[schema] = fields;
  return cs;
}

// 単純（スカラ・配列・オブジェクト）な更新可能フィールドを resource に載せる。
// 作成・更新で共通。空欄の項目は載せない（= 変更しない）。
function applyCommonFields_(r, p) {
  if (p.password) r.password = p.password;
  if (p.changePassword !== null) {
    r.changePasswordAtNextLogin = p.changePassword;
  }
  if (p.includeInGAL !== null) r.includeInGlobalAddressList = p.includeInGAL;
  if (p.archived !== null) r.archived = p.archived;
  if (p.ipWhitelisted !== null) r.ipWhitelisted = p.ipWhitelisted;
  if (p.recoveryEmail) r.recoveryEmail = p.recoveryEmail;
  if (p.recoveryPhone) r.recoveryPhone = p.recoveryPhone;
  if (p.phonesTouched) r.phones = p.phones;
  if (p.addressTouched) r.addresses = p.addresses;
  if (p.locationsTouched) r.locations = p.locations;
  if (p.altEmailTouched) r.emails = buildEmails_(p);
  if (p.employeeIdTouched) r.externalIds = p.externalIds;
  if (p.managerTouched) r.relations = p.relations;
  if (p.websitesTouched) r.websites = p.websites;
  if (p.imsTouched) r.ims = p.ims;
  if (p.languagesTouched) r.languages = p.languages;
  if (p.genderTouched) r.gender = p.gender;
  if (p.notesTouched) r.notes = p.notes;
  if (p.keywordsTouched) r.keywords = p.keywords;
  var cs = buildCustomSchemas_(p);
  if (cs) r.customSchemas = cs;
  return r;
}

// 作成用リソース。姓名は必須（呼び出し側で検証）、組織単位は既定値で補完。
function toCreateResource(p) {
  var r = { primaryEmail: p.primaryEmail };
  r.name = {
    givenName: p.name.givenName || "",
    familyName: p.name.familyName || "",
  };
  if (p.name.displayName) r.name.displayName = p.name.displayName;
  r.orgUnitPath = p.orgUnitPath || getConfig(CONFIG_KEYS.GWS_DEFAULT_OU, "/");
  if (p.orgTouched) r.organizations = [orgWithPrimary_(p.org)];
  applyCommonFields_(r, p);
  return r;
}

// 更新（patch）用リソース。空欄の項目は含めない（= 変更しない）。
// name / organizations は配列・ネストが丸ごと置換されるため、部分指定では
// current（現在値）から欠けたサブ項目を補ってデータ消失を防ぐ。
function toUpdateResource(p, current) {
  var r = {};
  if (p.orgUnitPath) r.orgUnitPath = p.orgUnitPath;

  if (p.nameTouched) {
    var curName = (current && current.name) || {};
    r.name = {
      givenName: p.name.givenName || curName.givenName || "",
      familyName: p.name.familyName || curName.familyName || "",
    };
    var disp = p.name.displayName || curName.displayName;
    if (disp) r.name.displayName = disp;
  }

  if (p.orgTouched) {
    var curOrg =
      (current && current.organizations && current.organizations[0]) || {};
    var merged = { primary: true };
    merged.name = p.org.name !== undefined ? p.org.name : curOrg.name;
    merged.department =
      p.org.department !== undefined ? p.org.department : curOrg.department;
    merged.title = p.org.title !== undefined ? p.org.title : curOrg.title;
    merged.costCenter =
      p.org.costCenter !== undefined ? p.org.costCenter : curOrg.costCenter;
    r.organizations = [stripUndefined_(merged)];
  }

  applyCommonFields_(r, p);
  return r;
}

function stripUndefined_(obj) {
  var out = {};
  var keys = Object.keys(obj);
  for (var i = 0; i < keys.length; i++) {
    if (obj[keys[i]] !== undefined && obj[keys[i]] !== null) {
      out[keys[i]] = obj[keys[i]];
    }
  }
  return out;
}

// name / organizations を更新する行のみ、現在値を 1 回だけ取得する必要がある。
function needsCurrentForUpdate(p) {
  return p.nameTouched || p.orgTouched;
}

// ----- API ユーザーリソース → セル値（インポート用） -----

function boolToCell_(b) {
  return b === true ? "TRUE" : b === false ? "FALSE" : "";
}

function genderToCell_(g) {
  if (!g) return "";
  if (g.type === "other") return g.customGender || "other";
  return g.type || "";
}

function notesToCell_(n) {
  if (!n) return "";
  return typeof n === "object" ? n.value || "" : String(n);
}

function languagesToCell_(arr) {
  if (!arr || !arr.length) return "";
  return arr
    .map(function (l) {
      return l.languageCode || l.customLanguage || "";
    })
    .filter(function (s) {
      return s !== "";
    })
    .join(",");
}

function imToCell_(arr) {
  if (!arr || !arr.length) return "";
  var im = arr[0];
  var proto =
    im.protocol === "custom_protocol"
      ? im.customProtocol || ""
      : im.protocol || "";
  return (proto ? proto + ":" : "") + (im.im || "");
}

function keywordsToCell_(arr) {
  if (!arr || !arr.length) return "";
  return arr
    .map(function (k) {
      return k.value || "";
    })
    .filter(function (s) {
      return s !== "";
    })
    .join(",");
}

function firstField_(arr, key) {
  if (!arr || !arr.length) return "";
  return arr[0][key] || "";
}

// カスタムスキーマ（よみがな・内線）の現在値をセル文字列として取り出す。
// CUSTOM_SCHEMA_NAME と各フィールド名が設定済みのときのみ値を返す（未設定なら空）。
function readCustomSchemaCells_(user) {
  var result = { lastNameYomi: "", firstNameYomi: "", extension: "" };
  var schema = str_(getConfig(CONFIG_KEYS.CUSTOM_SCHEMA_NAME, ""));
  if (!schema || !user.customSchemas || !user.customSchemas[schema]) {
    return result;
  }
  var fields = user.customSchemas[schema];
  var fLast = str_(getConfig(CONFIG_KEYS.CUSTOM_FIELD_LASTNAME_YOMI, ""));
  var fFirst = str_(getConfig(CONFIG_KEYS.CUSTOM_FIELD_FIRSTNAME_YOMI, ""));
  var fExt = str_(getConfig(CONFIG_KEYS.CUSTOM_FIELD_EXTENSION, ""));
  if (fLast && fields[fLast] !== undefined && fields[fLast] !== null) {
    result.lastNameYomi = String(fields[fLast]);
  }
  if (fFirst && fields[fFirst] !== undefined && fields[fFirst] !== null) {
    result.firstNameYomi = String(fields[fFirst]);
  }
  if (fExt && fields[fExt] !== undefined && fields[fExt] !== null) {
    result.extension = String(fields[fExt]);
  }
  return result;
}

// API ユーザーリソース → シート 1 行（インポート時に使用）。
function userToRow(user) {
  var name = user.name || {};
  var org = (user.organizations && user.organizations[0]) || {};
  var phones = user.phones || [];
  var addresses = user.addresses || [];
  var emails = user.emails || [];
  var extIds = user.externalIds || [];
  var relations = user.relations || [];
  var aliases = user.aliases || [];

  function phoneOf(type) {
    for (var i = 0; i < phones.length; i++) {
      if (phones[i].type === type) return phones[i].value || "";
    }
    return "";
  }
  function extOf(type) {
    for (var i = 0; i < extIds.length; i++) {
      if (extIds[i].type === type) return extIds[i].value || "";
    }
    return "";
  }
  function relOf(type) {
    for (var i = 0; i < relations.length; i++) {
      if (relations[i].type === type) return relations[i].value || "";
    }
    return "";
  }

  var altEmail = "";
  for (var i = 0; i < emails.length; i++) {
    if (
      !emails[i].primary &&
      emails[i].address &&
      emails[i].address !== user.primaryEmail
    ) {
      altEmail = emails[i].address;
      break;
    }
  }

  // カスタムスキーマ（よみがな・内線）が設定されていれば現在値を取り込む。
  var custom = readCustomSchemaCells_(user);

  var values = {
    操作: "",
    ステータス: "",
    メッセージ: "",
    メールアドレス: user.primaryEmail || "",
    姓: name.familyName || "",
    名: name.givenName || "",
    表示名: name.displayName || "",
    パスワード: "",
    次回PW変更: "",
    組織単位: user.orgUnitPath || "",
    会社: org.name || "",
    部門: org.department || "",
    役職: org.title || "",
    コストセンター: org.costCenter || "",
    勤務電話: phoneOf("work"),
    携帯電話: phoneOf("mobile"),
    FAX: phoneOf("work_fax"),
    住所: addresses.length ? addresses[0].formatted || "" : "",
    建物ID: firstField_(user.locations, "buildingId"),
    座席: firstField_(user.locations, "deskCode"),
    予備メール: altEmail,
    社員番号: extOf("organization"),
    上長: relOf("manager"),
    ウェブサイト: firstField_(user.websites, "value"),
    IM: imToCell_(user.ims),
    言語: languagesToCell_(user.languages),
    性別: genderToCell_(user.gender),
    メモ: notesToCell_(user.notes),
    キーワード: keywordsToCell_(user.keywords),
    名簿に表示: boolToCell_(user.includeInGlobalAddressList),
    アーカイブ: boolToCell_(user.archived),
    IP許可リスト: boolToCell_(user.ipWhitelisted),
    リカバリメール: user.recoveryEmail || "",
    リカバリ電話: user.recoveryPhone || "",
    別名: aliases.join(","),
    "姓(よみ)": custom.lastNameYomi,
    "名(よみ)": custom.firstNameYomi,
    内線: custom.extension,
  };

  var row = [];
  for (var c = 0; c < USER_SHEET_HEADERS.length; c++) {
    var v = values[USER_SHEET_HEADERS[c]];
    row.push(v !== undefined ? v : "");
  }
  return row;
}

// GAS エディタから手動実行する往復テスト。
// サンプルリソース → 行 → 中間表現 → 作成リソース を比較し、不一致を返す。
function runFieldMapSelfTest() {
  var sample = {
    primaryEmail: "taro@example.com",
    name: { familyName: "山田", givenName: "太郎", displayName: "山田 太郎" },
    orgUnitPath: "/営業",
    organizations: [
      {
        name: "例株式会社",
        department: "営業部",
        title: "課長",
        costCenter: "CC01",
      },
    ],
    phones: [
      { type: "work", value: "03-1111-2222" },
      { type: "mobile", value: "090-0000-0000" },
      { type: "work_fax", value: "03-1111-2223" },
    ],
    addresses: [{ type: "work", formatted: "東京都千代田区1-1-1" }],
    locations: [{ type: "desk", buildingId: "本社", deskCode: "5F-12" }],
    emails: [
      { address: "taro@example.com", primary: true },
      { address: "taro.sub@example.com", type: "work" },
    ],
    externalIds: [{ type: "organization", value: "E12345" }],
    relations: [{ type: "manager", value: "boss@example.com" }],
    websites: [{ type: "work", value: "https://example.com", primary: true }],
    ims: [{ type: "work", protocol: "skype", im: "taro.skype", primary: true }],
    languages: [{ languageCode: "ja" }],
    gender: { type: "male" },
    notes: { value: "テストメモ", contentType: "text_plain" },
    keywords: [{ type: "custom", customType: "tag", value: "VIP" }],
    includeInGlobalAddressList: true,
    archived: false,
    recoveryEmail: "taro.rec@example.com",
    recoveryPhone: "+819000000000",
    aliases: ["taro.alias@example.com"],
  };

  var row = userToRow(sample);
  var p = parseRow_(USER_SHEET_HEADERS, row);
  var rebuilt = toCreateResource(p);

  var checks = [
    ["primaryEmail", rebuilt.primaryEmail, sample.primaryEmail],
    ["familyName", rebuilt.name.familyName, "山田"],
    ["givenName", rebuilt.name.givenName, "太郎"],
    ["displayName", rebuilt.name.displayName, "山田 太郎"],
    ["orgUnitPath", rebuilt.orgUnitPath, "/営業"],
    ["company", rebuilt.organizations[0].name, "例株式会社"],
    ["department", rebuilt.organizations[0].department, "営業部"],
    ["title", rebuilt.organizations[0].title, "課長"],
    ["costCenter", rebuilt.organizations[0].costCenter, "CC01"],
    ["workPhone", rebuilt.phones[0].value, "03-1111-2222"],
    ["address", rebuilt.addresses[0].formatted, "東京都千代田区1-1-1"],
    ["buildingId", rebuilt.locations[0].buildingId, "本社"],
    ["deskCode", rebuilt.locations[0].deskCode, "5F-12"],
    ["altEmail", rebuilt.emails[1].address, "taro.sub@example.com"],
    ["employeeId", rebuilt.externalIds[0].value, "E12345"],
    ["manager", rebuilt.relations[0].value, "boss@example.com"],
    ["website", rebuilt.websites[0].value, "https://example.com"],
    ["im", rebuilt.ims[0].im, "taro.skype"],
    ["imProtocol", rebuilt.ims[0].protocol, "skype"],
    ["language", rebuilt.languages[0].languageCode, "ja"],
    ["gender", rebuilt.gender.type, "male"],
    ["notes", rebuilt.notes.value, "テストメモ"],
    ["keyword", rebuilt.keywords[0].value, "VIP"],
    ["includeInGAL", rebuilt.includeInGlobalAddressList, true],
    ["archived", rebuilt.archived, false],
    ["recoveryEmail", rebuilt.recoveryEmail, "taro.rec@example.com"],
    ["recoveryPhone", rebuilt.recoveryPhone, "+819000000000"],
  ];

  var mismatches = [];
  for (var j = 0; j < checks.length; j++) {
    if (String(checks[j][1]) !== String(checks[j][2])) {
      mismatches.push(
        checks[j][0] + ": got=" + checks[j][1] + " want=" + checks[j][2],
      );
    }
  }

  Logger.log(
    mismatches.length === 0
      ? "fieldMap self-test: OK"
      : "fieldMap self-test: NG\n" + mismatches.join("\n"),
  );
  return mismatches;
}
