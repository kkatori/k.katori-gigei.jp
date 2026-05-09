/* global getConfig, CONFIG_KEYS,
          gwsRequest,
          logInfo, logError */

function listGroups(options) {
  var opts = options || {};
  var domain = getConfig(CONFIG_KEYS.GWS_DOMAIN);
  var params = {
    domain: domain,
    maxResults: opts.maxResults || 200,
  };
  if (opts.userKey) params.userKey = opts.userKey;

  var allGroups = [];
  var pageToken;

  do {
    if (pageToken) params.pageToken = pageToken;
    var response = gwsRequest(function () {
      return AdminDirectory.Groups.list(params);
    }, "groups.list");
    if (response.groups) {
      allGroups = allGroups.concat(response.groups);
    }
    pageToken = response.nextPageToken;
  } while (pageToken);

  return allGroups;
}

function getGroup(groupKey) {
  return gwsRequest(function () {
    return AdminDirectory.Groups.get(groupKey);
  }, "groups.get");
}

function createGroup(groupData) {
  var resource = {
    email: groupData.email,
    name: groupData.name,
    description: groupData.description || "",
  };
  var created = gwsRequest(function () {
    return AdminDirectory.Groups.insert(resource);
  }, "groups.insert");
  logInfo("gwsGroups", "createGroup", "グループ作成: " + groupData.email);
  return created;
}

function updateGroup(groupKey, updates) {
  return gwsRequest(function () {
    return AdminDirectory.Groups.update(updates, groupKey);
  }, "groups.update");
}

function deleteGroup(groupKey) {
  gwsRequest(function () {
    return AdminDirectory.Groups.remove(groupKey);
  }, "groups.remove");
  logInfo("gwsGroups", "deleteGroup", "グループ削除: " + groupKey);
  return true;
}

function listMembers(groupKey) {
  var allMembers = [];
  var pageToken;

  do {
    var params = { maxResults: 200 };
    if (pageToken) params.pageToken = pageToken;
    var response = gwsRequest(function () {
      return AdminDirectory.Members.list(groupKey, params);
    }, "members.list");
    if (response.members) {
      allMembers = allMembers.concat(response.members);
    }
    pageToken = response.nextPageToken;
  } while (pageToken);

  return allMembers;
}

function addMember(groupKey, email, role) {
  var resource = {
    email: email,
    role: role || "MEMBER",
  };
  return gwsRequest(function () {
    return AdminDirectory.Members.insert(resource, groupKey);
  }, "members.insert");
}

function removeMember(groupKey, memberKey) {
  gwsRequest(function () {
    return AdminDirectory.Members.remove(groupKey, memberKey);
  }, "members.remove");
  return true;
}

function syncGroupMembers(groupKey, desiredMembers) {
  var currentMembers = listMembers(groupKey);

  var currentMap = {};
  for (var i = 0; i < currentMembers.length; i++) {
    currentMap[currentMembers[i].email.toLowerCase()] = currentMembers[i];
  }

  var desiredMap = {};
  for (var j = 0; j < desiredMembers.length; j++) {
    desiredMap[desiredMembers[j].email.toLowerCase()] = desiredMembers[j];
  }

  var toAdd = [];
  var toRemove = [];
  var toUpdate = [];

  for (var email in desiredMap) {
    if (!currentMap[email]) {
      toAdd.push(desiredMap[email]);
    } else if (currentMap[email].role !== desiredMap[email].role) {
      toUpdate.push(desiredMap[email]);
    }
  }

  for (var currentEmail in currentMap) {
    if (!desiredMap[currentEmail]) {
      toRemove.push(currentMap[currentEmail]);
    }
  }

  var added = 0;
  var removed = 0;
  var updated = 0;
  var errors = [];

  for (var a = 0; a < toAdd.length; a++) {
    try {
      addMember(groupKey, toAdd[a].email, toAdd[a].role);
      added++;
    } catch (e) {
      errors.push({ email: toAdd[a].email, error: e.message });
    }
  }

  for (var r = 0; r < toRemove.length; r++) {
    try {
      removeMember(groupKey, toRemove[r].email);
      removed++;
    } catch (e) {
      errors.push({ email: toRemove[r].email, error: e.message });
    }
  }

  for (var u = 0; u < toUpdate.length; u++) {
    try {
      gwsRequest(function () {
        return AdminDirectory.Members.update(
          { role: toUpdate[u].role },
          groupKey,
          toUpdate[u].email,
        );
      }, "members.update");
      updated++;
    } catch (e) {
      errors.push({ email: toUpdate[u].email, error: e.message });
    }
  }

  return { added: added, removed: removed, updated: updated, errors: errors };
}
