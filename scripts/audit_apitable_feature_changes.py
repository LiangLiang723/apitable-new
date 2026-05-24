#!/usr/bin/env python3
"""
Audit APITable commits for removed features and added limits.

Usage:
  python3 scripts/audit_apitable_feature_changes.py \
    --base d112100dde24c44c7288fd0a6e4339ad1cb273b3 \
    --head develop \
    --out apitable_feature_audit.csv

The script intentionally outputs candidates. Review the CSV manually before
restoring any feature: enterprise/private cloud dependencies should remain
hidden unless the full implementation is available and build-safe.
"""

from __future__ import annotations

import argparse
import csv
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

DELETE_PATTERN_WORDS = (
    "enterprise|hosted|billing|subscribe|subscription|task|reminder|template|"
    "mail|qiniu|callback|widget|automation|audit|backup|sso|saml|integration|"
    "payment|trial|plan"
)
LIMIT_PATTERN_WORDS = (
    "limit|quota|usage|payment|billing|subscription|subscribe|trial|deadline|"
    "plan|credit|overLimit|isAllowOverLimit|max[A-Za-z]*|forbidden|"
    "api_forbidden|allowCreditOverLimit|apiCallNumsPerMonth|"
    "apiCallUsedNumsCurrentMonth|usageWarnModal|PRICE_MODAL"
)
PRIVATE_DEPENDENCY_WORDS = (
    "enterprise/|/enterprise|hosted|cloud|payment|billing|subscribe|"
    "subscription|sso|saml|audit|backup|private|license"
)
LIKELY_SAFE_RESTORE_WORDS = "template|mail|qiniu|callback|task|reminder|widget"

DELETE_PATTERNS = re.compile(f"({DELETE_PATTERN_WORDS})", re.I)
LIMIT_PATTERNS = re.compile(f"({LIMIT_PATTERN_WORDS})", re.I)
PRIVATE_DEPENDENCY_PATTERNS = re.compile(f"({PRIVATE_DEPENDENCY_WORDS})", re.I)
LIKELY_SAFE_RESTORE_PATTERNS = re.compile(f"({LIKELY_SAFE_RESTORE_WORDS})", re.I)


@dataclass
class Candidate:
    sha: str
    date: str
    subject: str
    classification: str
    files: str
    recommendation: str
    reasons: str


def run_git(args: list[str]) -> str:
    return subprocess.check_output(["git", *args], text=True, errors="replace")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="d112100dde24c44c7288fd0a6e4339ad1cb273b3")
    parser.add_argument("--head", default="develop")
    parser.add_argument("--out", default="apitable_feature_audit.csv")
    return parser.parse_args()


def recommend(files: list[str], reasons: list[str]) -> str:
    blob = "\n".join(files + reasons)
    if PRIVATE_DEPENDENCY_PATTERNS.search(blob):
        return "KEEP_HIDDEN_OR_UNSUPPORTED_UNLESS_FULL_DEPENDENCIES_EXIST"
    if LIKELY_SAFE_RESTORE_PATTERNS.search(blob):
        return "MANUAL_REVIEW_POSSIBLY_RESTORABLE"
    return "MANUAL_REVIEW_REQUIRED"


def audit_commit(sha: str) -> Candidate | None:
    meta = run_git(["show", "-s", "--format=%ad|%s", "--date=iso-strict", sha])
    try:
        date, subject = meta.strip().split("|", 1)
    except ValueError:
        date, subject = "", meta.strip()

    name_status = run_git(["show", "--name-status", "--format=", sha])
    patch = run_git(["show", "--unified=0", "--format=", sha])

    files: list[str] = []
    reasons: list[str] = []
    classes: set[str] = set()

    for line in name_status.splitlines():
        parts = line.split("\t")
        if len(parts) < 2:
            continue
        status, path = parts[0], parts[-1]
        if DELETE_PATTERNS.search(path) or LIMIT_PATTERNS.search(path):
            files.append(path)
        if status.startswith("D") and DELETE_PATTERNS.search(path):
            classes.add("REMOVE_FEATURE_CANDIDATE")
            reasons.append(f"deleted feature-like file: {path}")

    added_lines: list[str] = []
    removed_lines: list[str] = []

    for line in patch.splitlines():
        if (
            line.startswith("+")
            and not line.startswith("+++")
            and LIMIT_PATTERNS.search(line)
        ):
            added_lines.append(line[:240])
        elif (
            line.startswith("-")
            and not line.startswith("---")
            and DELETE_PATTERNS.search(line)
        ):
            removed_lines.append(line[:240])

    if added_lines:
        classes.add("ADD_LIMIT_CANDIDATE")
        reasons.append(
            "added limit/billing/usage lines: " + " | ".join(added_lines[:8])
        )
    if removed_lines:
        classes.add("REMOVE_FEATURE_CANDIDATE")
        reasons.append("removed feature-like lines: " + " | ".join(removed_lines[:8]))

    if not classes:
        return None

    unique_files = sorted(set(files))[:40]
    limited_reasons = reasons[:12]
    return Candidate(
        sha=sha,
        date=date,
        subject=subject,
        classification=",".join(sorted(classes)),
        files=" | ".join(unique_files),
        recommendation=recommend(unique_files, limited_reasons),
        reasons=" || ".join(limited_reasons),
    )


def main() -> None:
    args = parse_args()
    commits = run_git(
        ["log", "--reverse", "--format=%H", f"{args.base}..{args.head}"]
    ).splitlines()
    candidates = [candidate for sha in commits if (candidate := audit_commit(sha))]

    out_path = Path(args.out)
    with out_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "sha",
                "date",
                "subject",
                "classification",
                "files",
                "recommendation",
                "reasons",
            ],
        )
        writer.writeheader()
        writer.writerows(candidate.__dict__ for candidate in candidates)

    print(f"scanned commits: {len(commits)}")
    print(f"candidate commits: {len(candidates)}")
    print(f"output: {out_path}")


if __name__ == "__main__":
    main()
