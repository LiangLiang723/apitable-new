#!/usr/bin/env bash
set -euo pipefail

# Lightweight smoke checklist for self-hosted enterprise mode.
# This script does not replace full e2e tests; it verifies that the expected
# environment variables are present and gives operators a deterministic manual
# checklist for app-level validation.

: "${SELF_HOSTED_ENTERPRISE:=}"
: "${API_MAX_MODIFY_RECORD_COUNTS:=1000}"

if [[ "${SELF_HOSTED_ENTERPRISE}" != "true" ]]; then
  echo "ERROR: SELF_HOSTED_ENTERPRISE must be true for this smoke check." >&2
  exit 1
fi

if ! [[ "${API_MAX_MODIFY_RECORD_COUNTS}" =~ ^[0-9]+$ ]]; then
  echo "ERROR: API_MAX_MODIFY_RECORD_COUNTS must be a positive integer." >&2
  exit 1
fi

if [[ "${API_MAX_MODIFY_RECORD_COUNTS}" -lt 100 ]]; then
  echo "ERROR: API_MAX_MODIFY_RECORD_COUNTS is too low for enhanced self-hosted mode." >&2
  exit 1
fi

cat <<'EOF'
Self-hosted enterprise env looks OK.

Manual smoke checklist:

1. Start backend-server, room-server, and frontend/datasheet with:
   SELF_HOSTED_ENTERPRISE=true
   API_MAX_MODIFY_RECORD_COUNTS=1000

2. Register or log in.
3. Create a new space.
4. Open space subscription/management info and verify plan/product is Enterprise/enterprise.
5. Create a datasheet.
6. Add more records than the old free single-sheet limit.
7. Add enough records to exceed the old free space total-row limit.
8. Create multiple Gantt/Calendar/Gallery/Kanban/Form views if those UI entries are enabled.
9. Upload an attachment using the configured storage backend.
10. Call Fusion API batch write up to API_MAX_MODIFY_RECORD_COUNTS records.
11. Confirm there is no payment reminder, PRICE_MODAL, renew/upgrade modal, or usage warning modal.
12. Confirm unavailable enterprise/hosted-only features stay hidden or return a clear unsupported response.

If any feature depends on missing private enterprise code, hosted cloud services,
missing DB tables, or missing third-party configuration, keep it hidden/unsupported.
EOF
