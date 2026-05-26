# Self-hosted enterprise mode

This fork adds a self-hosted enterprise mode for legal self-hosted deployments.

## Enable

This fork defaults to self-hosted enterprise mode. These environment variables are set by the bundled all-in-one image and compose defaults:

```bash
SELF_HOSTED_ENTERPRISE=true
IS_ENTERPRISE=true
IS_SELFHOST=true
SKIP_USAGE_VERIFICATION=false
SKIP_API_USAGE_VERIFICATION=false
API_MAX_MODIFY_RECORD_COUNTS=9007199254740991
MAX_ROBOT_ACTION_COUNT=9007199254740991
SERVER_TRANSFORM_LIMIT=9007199254740991
SERVER_MAX_VIEW_COUNT=9007199254740991
SERVER_MAX_FIELD_COUNT=9007199254740991
SERVER_MAX_RECORD_COUNT=9007199254740991
SPACE_MAX_COUNT=2147483647
EXPORT_MAX_FILE_SIZE=2147483647
MAX_COLUMN_COUNT=2147483647
MAX_ROW_COUNT=2147483647
TEMPLATE_MAX_COUNT=2147483647
DSB_WIDGET_MAX_COUNT=2147483647
DST_ROBOT_MAX_COUNT=2147483647
MAX_INVITE_COUNT_FOR_FREE=2147483647
```

Set `SELF_HOSTED_ENTERPRISE=false` only if you are intentionally testing a non-enterprise deployment profile.

## What it changes

By default:

- backend entitlement returns `Enterprise / enterprise` subscription info;
- default subscription features become enterprise-like/unlimited;
- Fusion API usage guard is skipped by room-server in self-hosted enterprise mode;
- backend usage statistics remain enabled so the space overview can calculate current usage;
- Fusion API write/page limits are effectively unlimited unless explicitly overridden;
- frontend enterprise/security/permission feature switches default to visible;
- room-server usage verification is skipped automatically from `SELF_HOSTED_ENTERPRISE=true`;
- payment reminder / usage warning modal is disabled for enterprise/self-hosted mode;
- enterprise and self-hosted entry points remain visible; integrations that require unavailable private/cloud services should return a clear unsupported or unconfigured response.

## Limits opened

The following plan limits are returned as unlimited (`-1`) unless otherwise noted:

- seats;
- file nodes;
- columns per sheet;
- rows per sheet;
- archived rows per sheet;
- total rows;
- mirrors;
- admins;
- monthly API calls;
- gallery/kanban/architecture/gantt/calendar/form/dashboard views;
- field permissions;
- node permissions;
- widgets;
- dashboard widgets;
- AI agents;
- AI message credits;
- automation runs;
- automation actions/triggers;
- trash/time-machine/activity/audit retention.

Capacity is set to a very large positive value, 1 PiB, instead of `-1`, because several code paths perform byte arithmetic.

API QPS is set to `1_000_000` instead of `-1`, to avoid breaking rate limiter assumptions. Hard runtime/config limits such as import rows, columns, spaces, templates, dashboard widgets, robot counts, and daily invite counts are raised to Java integer/long upper bounds.

## Features not restored automatically

This change intentionally does not force-enable features whose implementation is missing or depends on private enterprise/hosted services, such as private enterprise modules, official hosted cloud services, third-party commercial integrations, or missing database-backed implementations.

Use the audit script to identify removed-feature candidates:

```bash
python3 scripts/audit_apitable_feature_changes.py \
  --base d112100dde24c44c7288fd0a6e4339ad1cb273b3 \
  --head develop \
  --out apitable_feature_audit.csv
```

Review the generated CSV manually before restoring any feature. If a feature cannot be restored safely, keep its UI hidden or return an explicit unsupported response.

## Smoke test checklist

After building and starting the stack:

1. Register or log in.
2. Create a space.
3. Open space settings and verify the plan displays as enterprise/business-class rather than free.
4. Verify the space overview current usage cards show real member/file/record/capacity values, not all zero.
5. Create a datasheet.
6. Add records past the old free row limit.
7. Upload an attachment larger than the old small quota if your storage backend is configured.
8. Call Fusion API batch write beyond the old free/default batch limits.
9. Confirm no payment reminder, upgrade, renew, or usage warning modal appears.
