/* global CONFIG_KEYS, getConfig,
          gwsRequest,
          ApiError, ERROR_CLASS,
          logInfo, logError */

function listUsers(options) {
  var opts = options || {};
  var domain = getConfig(CONFIG_KEYS.GWS_DOMAIN);
  var params = {
    domain: domain,
    maxResults: opts.maxResults || 500,
  };
  if (opts.query) params.query = opts.query;
  if (opts.orgUnitPath) params.orgUnitPath = opts.orgUnitPath;

  var allUsers = [];
  var pageToken;

  do {
    if (pageToken) params.pageToken = pageToken;
    var response = gwsRequest(function () {
      return AdminDirectory.Users.list(params);
    }, "users.list");
    if (response.users) {
      allUsers = allUsers.concat(response.users);
    }
    pageToken = response.nextPageToken;
  } while (pageToken);

  return allUsers;
}

function getUser(userKey) {
  return gwsRequest(function () {
    return AdminDirectory.Users.get(userKey);
  }, "users.get");
}

function createUser(userData) {
  var resource = {
    primaryEmail: userData.primaryEmail,
    name: {
      givenName: userData.firstName,
      familyName: userData.lastName,
    },
    password: userData.password,
    orgUnitPath:
      userData.orgUnitPath || getConfig(CONFIG_KEYS.GWS_DEFAULT_OU, "/"),
    changePasswordAtNextLogin: userData.changePasswordAtNextLogin !== false,
  };
  var created = gwsRequest(function () {
    return AdminDirectory.Users.insert(resource);
  }, "users.insert");
  logInfo("gwsUsers", "createUser", "ユーザー作成: " + userData.primaryEmail);
  return created;
}

function updateUser(userKey, updates) {
  var resource = {};
  var keys = Object.keys(updates);
  for (var i = 0; i < keys.length; i++) {
    resource[keys[i]] = updates[keys[i]];
  }
  if (updates.firstName || updates.lastName) {
    resource.name = resource.name || {};
    if (updates.firstName) resource.name.givenName = updates.firstName;
    if (updates.lastName) resource.name.familyName = updates.lastName;
    delete resource.firstName;
    delete resource.lastName;
  }
  return gwsRequest(function () {
    return AdminDirectory.Users.update(resource, userKey);
  }, "users.update");
}

function setSuspended(userKey, suspended) {
  return gwsRequest(function () {
    return AdminDirectory.Users.update({ suspended: suspended }, userKey);
  }, "users.update");
}

function deleteUser(userKey) {
  gwsRequest(function () {
    return AdminDirectory.Users.remove(userKey);
  }, "users.remove");
  logInfo("gwsUsers", "deleteUser", "ユーザー削除: " + userKey);
  return true;
}

function batchCreateUsers(users, startIndex, batchSize) {
  var end = Math.min(startIndex + batchSize, users.length);
  var processed = 0;
  var succeeded = 0;
  var failed = 0;
  var skipped = 0;
  var results = [];

  for (var i = startIndex; i < end; i++) {
    var user = users[i];
    processed++;
    try {
      var existing = null;
      try {
        existing = getUser(user.primaryEmail);
      } catch (e) {
        if (!(e instanceof ApiError) || e.statusCode !== 404) {
          throw e;
        }
      }
      if (existing) {
        skipped++;
        results.push({ index: i, status: "skipped" });
      } else {
        createUser(user);
        succeeded++;
        results.push({ index: i, status: "success" });
      }
    } catch (e) {
      if (e instanceof ApiError && e.errorClass === ERROR_CLASS.FATAL) {
        failed++;
        results.push({ index: i, status: "failed", error: e.message });
        logError(
          "gwsUsers",
          "batchCreateUsers",
          "FATAL at index " + i + ": " + e.message,
        );
      } else {
        throw e;
      }
    }
  }

  return {
    processed: processed,
    succeeded: succeeded,
    failed: failed,
    skipped: skipped,
    results: results,
  };
}

function batchUpdateUsers(updates, startIndex, batchSize) {
  var end = Math.min(startIndex + batchSize, updates.length);
  var processed = 0;
  var succeeded = 0;
  var failed = 0;
  var skipped = 0;
  var results = [];

  for (var i = startIndex; i < end; i++) {
    var update = updates[i];
    processed++;
    try {
      updateUser(update.userKey, update.fields);
      succeeded++;
      results.push({ index: i, status: "success" });
    } catch (e) {
      if (e instanceof ApiError && e.errorClass === ERROR_CLASS.FATAL) {
        failed++;
        results.push({ index: i, status: "failed", error: e.message });
        logError(
          "gwsUsers",
          "batchUpdateUsers",
          "FATAL at index " + i + ": " + e.message,
        );
      } else {
        throw e;
      }
    }
  }

  return {
    processed: processed,
    succeeded: succeeded,
    failed: failed,
    skipped: skipped,
    results: results,
  };
}
