#!/usr/bin/env python3
"""Computes a fingerprint of the build configuration of every image component.

A plain file diff only detects changes of the source tree. The content of an
image additionally depends on the build arguments that are passed to the build,
and those live in the release workflow instead of the source tree. Changing a
base image version or adding a build argument would therefore not be detected,
and the component would be re-used from the previous release with the old
configuration.

The script prints a JSON object for two git revisions:

    scripts/component-build-fingerprint.py <revision-a> <revision-b>

    {
      "fingerprints": {"<component>": "<sha256>", ...},
      "changed": ["<component>", ...]
    }

`changed` lists the components whose build configuration differs between the
two revisions. `SEMVER_FULL` is deliberately ignored, it only ends up as a
telemetry label and would otherwise mark every component as changed on every
release.
"""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys

WORKFLOW_PATH = ".github/workflows/dockerhub-all-in-one.yml"

# The all-in-one image only assembles the other components.
SKIP_COMPONENTS = {"all-in-one"}

# A build argument that only carries the release version.
IGNORED_ARGS = {"SEMVER_FULL"}

# The workflow environment variables that influence the content of a component
# image. The build arguments of a component are derived from the workflow, but
# the source of a mirrored base image is only referenced by the mirror job, so
# the relevant variables are listed explicitly.
COMPONENT_ENV_VARS = {
    "backend-server": [],
    "room-server": ["NODE_BASE_IMAGE", "NODE_BASE_TAG", "NODE_BASE_SOURCE"],
    "web-server": ["NODEPY_BASE_IMAGE", "NODEPY_BASE_TAG", "NODEPY_BASE_SOURCE"],
    "init-db": [],
    "dataenv-pm2": [],
    "dataenv-liquibase-pm2": ["DATAENV_IMAGE", "DATAENV_LIQUIBASE_IMAGE"],
    "openresty": [],
}

REF_PATTERN = re.compile(r"\$\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}")


def git_show(ref: str, path: str) -> str | None:
    result = subprocess.run(
        ["git", "show", f"{ref}:{path}"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        return None
    return result.stdout


def load_workflow(ref: str) -> dict | None:
    text = git_show(ref, WORKFLOW_PATH)
    if text is None:
        return None
    try:
        import yaml
    except ImportError:  # pragma: no cover - PyYAML is always present in CI
        print("ERROR: PyYAML is required", file=sys.stderr)
        raise SystemExit(2)
    try:
        return yaml.safe_load(text)
    except Exception:
        return None


def component_of_path(path: str) -> str | None:
    """Derives the component name from the dockerfile or context path."""
    path = path or ""
    # packaging/Dockerfile.<component>
    match = re.search(r"packaging/Dockerfile\.([a-z0-9-]+)$", path)
    if match:
        return match.group(1)
    # packaging/all-in-one/<component>/Dockerfile
    match = re.search(r"packaging/all-in-one/([a-z0-9-]+)/Dockerfile$", path)
    if match:
        return match.group(1)
    # init-db/Dockerfile
    if path.endswith("init-db/Dockerfile"):
        return "init-db"
    return None


def collect_components(doc: dict) -> dict[str, list[str]]:
    """Returns {component: [build argument fragments]} for every component."""
    result: dict[str, list[str]] = {}

    for job in (doc.get("jobs") or {}).values():
        # Matrix driven jobs carry the component specific arguments in the
        # matrix entry.
        matrix = ((job.get("strategy") or {}).get("matrix")) or {}
        for entry in matrix.get("include") or []:
            target = entry.get("target")
            if not target:
                continue
            result.setdefault(target, []).append(str(entry.get("extra_args") or ""))

        # Every build step passes its arguments to the build action.
        for step in job.get("steps") or []:
            with_ = step.get("with") or {}
            build_args = with_.get("build-args")
            if not build_args:
                continue
            component = component_of_path(with_.get("file") or "")
            if component is None:
                component = component_of_path(with_.get("context") or "")
            if component is None:
                continue
            result.setdefault(component, []).append(str(build_args))

    return result


def resolve_ref(name: str, env: dict) -> str:
    """Resolves a reference inside a build argument to its effective value."""
    if name in env:
        return str(env[name])
    # The prepare job copies the workflow environment into its outputs, the
    # output names are the snake case form of the environment variable.
    match = re.match(r"needs\.prepare\.outputs\.([A-Za-z0-9_]+)$", name)
    if match:
        return str(env.get(match.group(1).upper(), ""))
    return ""


def build_arg_fingerprint(build_args: str, env: dict) -> str:
    """Hashes the effective values of the build arguments."""
    parts: list[str] = []
    for line in build_args.splitlines():
        line = line.strip()
        if not line or "=" not in line:
            continue
        name, expression = line.split("=", 1)
        name = name.strip()
        if name in IGNORED_ARGS:
            continue
        refs = REF_PATTERN.findall(expression)
        if refs:
            for ref in refs:
                parts.append(f"{name}.{ref}={resolve_ref(ref, env)}")
        else:
            parts.append(f"{name}={expression}")
    return hashlib.sha256("\n".join(parts).encode()).hexdigest()


def fingerprints(doc: dict | None) -> dict[str, str]:
    """Returns {component: fingerprint of the build configuration}."""
    if doc is None:
        return {}

    env = doc.get("env") or {}
    result: dict[str, str] = {}

    for component, fragments in collect_components(doc).items():
        if component in SKIP_COMPONENTS:
            continue
        parts = sorted(build_arg_fingerprint(fragment, env) for fragment in fragments)
        for var in COMPONENT_ENV_VARS.get(component, []):
            parts.append(f"env.{var}={env.get(var, '')}")
        result[component] = hashlib.sha256("\n".join(parts).encode()).hexdigest()

    return result


def main() -> int:
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <revision-a> <revision-b>", file=sys.stderr)
        return 2

    rev_a, rev_b = sys.argv[1], sys.argv[2]
    doc_a = load_workflow(rev_a)
    doc_b = load_workflow(rev_b)

    if doc_a is None or doc_b is None:
        # The workflow did not exist at one of the revisions, every build
        # configuration has to be considered as changed.
        print(json.dumps({"fingerprints": {}, "changed": ["*"]}, ensure_ascii=False))
        return 0

    fp_a = fingerprints(doc_a)
    fp_b = fingerprints(doc_b)

    changed = sorted(
        component
        for component in set(fp_a) | set(fp_b)
        if fp_a.get(component) != fp_b.get(component)
    )

    print(
        json.dumps(
            {"fingerprints": fp_b, "changed": changed},
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
