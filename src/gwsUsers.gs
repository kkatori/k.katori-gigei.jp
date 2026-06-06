/* global CONFIG_KEYS, getConfig, gwsRequest */

// Directory API のユーザー操作プリミティブ。
// 成功時のログシート追記は行わない（一括処理の高速化のため、記録は bulkRunner 側で集約）。

// 全ユーザーを取得（拡張属性まで含めるため projection=full）。
function listAllUsers() {
  var domain = getConfig(CONFIG_KEYS.GWS_DOMAIN);
  var params = { domain: domain, maxResults: 500, projection: "full" };
  var all = [];
  var pageToken;

  do {
    if (pageToken) params.pageToken = pageToken;
    var resp = gwsRequest(function () {
      return AdminDirectory.Users.list(params);
    }, "users.list");
    if (resp.users) all = all.concat(resp.users);
    pageToken = resp.nextPageToken;
  } while (pageToken);

  return all;
}

function getUser(userKey) {
  return gwsRequest(function () {
    return AdminDirectory.Users.get(userKey, { projection: "full" });
  }, "users.get");
}

function insertUser(resource) {
  return gwsRequest(function () {
    return AdminDirectory.Users.insert(resource);
  }, "users.insert");
}

// patch は指定したフィールドのみ更新する（未指定の項目は維持）。
function patchUser(userKey, resource) {
  return gwsRequest(function () {
    return AdminDirectory.Users.patch(resource, userKey);
  }, "users.patch");
}

function setSuspended(userKey, suspended) {
  return patchUser(userKey, { suspended: suspended });
}

function removeUser(userKey) {
  return gwsRequest(function () {
    return AdminDirectory.Users.remove(userKey);
  }, "users.remove");
}

function listAliases(userKey) {
  var resp = gwsRequest(function () {
    return AdminDirectory.Users.Aliases.list(userKey);
  }, "aliases.list");
  var result = [];
  if (resp && resp.aliases) {
    for (var i = 0; i < resp.aliases.length; i++) {
      result.push(resp.aliases[i].alias);
    }
  }
  return result;
}

// 別名を desired（あるべき集合）へ同期する。差分のみ insert / remove。
// 別名列が指定された行でのみ呼ぶこと（現在値取得の API コストを抑えるため）。
function syncAliases(userKey, desired) {
  var current = listAliases(userKey);
  var i, alias;

  for (i = 0; i < desired.length; i++) {
    alias = desired[i];
    if (current.indexOf(alias) === -1) {
      gwsRequest(
        (function (a) {
          return function () {
            return AdminDirectory.Users.Aliases.insert({ alias: a }, userKey);
          };
        })(alias),
        "aliases.insert",
      );
    }
  }

  for (i = 0; i < current.length; i++) {
    alias = current[i];
    if (desired.indexOf(alias) === -1) {
      gwsRequest(
        (function (a) {
          return function () {
            return AdminDirectory.Users.Aliases.remove(userKey, a);
          };
        })(alias),
        "aliases.remove",
      );
    }
  }
}

// 作成時、対象ユーザーが既に存在することを示すエラーかどうか。
// Advanced Service の例外はメッセージで判別する。
function isAlreadyExistsError_(e) {
  var m = (e && e.message ? e.message : "").toLowerCase();
  return (
    m.indexOf("already exists") !== -1 ||
    m.indexOf("entity already exists") !== -1 ||
    m.indexOf("duplicate") !== -1
  );
}
