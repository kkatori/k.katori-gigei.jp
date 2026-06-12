/* global GROUP_TYPES, callApi_, cloudIdentityGet_ */

// 10_GroupTypeResolver.gs
// Dynamic / security group detection via the Cloud Identity API (design 2/2,
// section 3). Per-execution in-memory cache avoids duplicate lookups within a
// job run. Destructive operations on 動的/セキュリティ groups are excluded.

var SECURITY_LABEL = "cloudidentity.googleapis.com/groups.security";
var DYNAMIC_LABEL = "cloudidentity.googleapis.com/groups.dynamic";

var groupTypeCache_ = {};
var customerIdCache_ = null;

// Returns one of GROUP_TYPES for the given group email.
// Groups not found in Cloud Identity are treated as 通常 (e.g. just-created
// groups not yet propagated). Other API errors propagate to the caller.
function resolveGroupType_(email) {
  var key = String(email).toLowerCase();
  if (groupTypeCache_[key]) return groupTypeCache_[key];
  var type;
  try {
    var lookup = cloudIdentityGet_(
      "groups:lookup?groupKey.id=" + encodeURIComponent(email),
    );
    var group = cloudIdentityGet_(lookup.name); // lookup.name = 'groups/{id}'
    type = classifyGroup_(group);
  } catch (e) {
    if (e.code === 404) {
      type = GROUP_TYPES.NORMAL;
    } else {
      throw e;
    }
  }
  groupTypeCache_[key] = type;
  return type;
}

function classifyGroup_(group) {
  var labels = group.labels || {};
  if (Object.prototype.hasOwnProperty.call(labels, SECURITY_LABEL))
    return GROUP_TYPES.SECURITY;
  if (
    group.dynamicGroupMetadata ||
    Object.prototype.hasOwnProperty.call(labels, DYNAMIC_LABEL)
  ) {
    return GROUP_TYPES.DYNAMIC;
  }
  return GROUP_TYPES.NORMAL;
}

// One page of Cloud Identity groups.list (view=FULL) for inventory matching.
// Returns {groups: [], nextPageToken: ''}.
function listGroupTypesPage_(pageToken) {
  var query =
    "groups?parent=" +
    encodeURIComponent("customers/" + getCustomerId_()) +
    "&view=FULL&pageSize=500" +
    (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : "");
  return cloudIdentityGet_(query);
}

function getCustomerId_() {
  if (!customerIdCache_) {
    customerIdCache_ = callApi_("Customers.get", function () {
      return AdminDirectory.Customers.get("my_customer").id;
    });
  }
  return customerIdCache_;
}
