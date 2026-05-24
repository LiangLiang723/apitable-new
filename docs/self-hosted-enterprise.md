# Self-hosted enterprise mode

This fork adds a self-hosted enterprise mode for legal self-hosted deployments.

## Enable

Set these environment variables on backend-server, room-server, and the frontend/datasheet service:

```bash
SELF_HOSTED_ENTERPRISE=true
API_MAX_MODIFY_RECORD_COUNTS=1000
```

`API_MAX_MODIFY_RECORD_COUNTS` remains a request-safety guard. Increase it only when your database and room-server capacity can handle larger Fusion API batch writes.

## What it changes

When `SELF_HOSTED_ENTERPRISE=true`:

- backend entitlement returns `Enterprise / enterprise` subscription info;
- default subscription features become enterprise-like/unlimited;
- Fusion API usage guard is skipped;
- room-server usage verification flags are enabled automatically;
- payment reminder / usage warning modal is disabled for enterprise/self-hosted mode;
- the static import of enterprise-only `usageWarnModal` is removed to avoid build failures when enterprise private code is unavailable.

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
- AI agents;
- AI message credits;
- automation runs;
- trash/time-machine/activity/audit retention.

Capacity is set to a very large positive value, 1 PiB, instead of `-1`, because several code paths perform byte arithmetic.

API QPS is set to `1_000_000` instead of `-1`, to avoid breaking rate limiter assumptions.

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
4. Create a datasheet.
5. Add records past the old free row limit.
6. Upload an attachment larger than the old small quota if your storage backend is configured.
7. Call Fusion API batch write with up to `API_MAX_MODIFY_RECORD_COUNTS` records.
8. Confirm no payment reminder, upgrade, renew, or usage warning modal appears.
