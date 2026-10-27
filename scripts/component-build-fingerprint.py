#!/usr/bin/env python3
"""Computes a fingerprint of the build configuration of every image component.

A plain file diff only detects changes of the source tree. The content of an
image additionally depends on the build definition that is passed to the build,
and that lives in the release workflow instead of the source tree: the build
arguments (base image versions, registry, ...), the context, the Dockerfile
path, the target stage and the platform list. Changing any of them would
otherwise not be detected, and the component would be re-used from the previous
release with the old configuration.

The script exits non-zero when the workflow cannot be loaded or parsed, so the
caller has to fall back to a full rebuild instead of reusing stale images.

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

# Build arguments that only carry release metadata and never change image
# content: the version label and the reproducible-build timestamp.
IGNORED_ARGS = {"SEMVER_FULL", "SOURCE_DATE_EPOCH"}

# The workflow environment variables that influence the content of a component
# image. A base image that is built by the `构建基础镜像` workflow changes the
# component content through its tag, so the tag is part of the fingerprint and
# rebuilding a base image has to bump it.
COMPONENT_ENV_VARS = {
    "backend-server": [],
    "room-server": ["NODE_BASE_IMAGE", "NODE_BASE_TAG"],
    "web-server": ["NODEPY_BASE_IMAGE", "NODEPY_BASE_TAG"],
    "init-db": [],
    "dataenv-pm2": [],
    "dataenv-liquibase-pm2": ["DATAENV_IMAGE", "DATAENV_LIQUIBASE_IMAGE"],
    "openresty": [],
}

REF_PATTERN = re.compile(r"\$\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}")
MATRIX_PATTERN = re.compile(r"\$\{\{\s*matrix\.([A-Za-z0-9_-]+)\s*\}\}")


def resolve_matrix(value, entry: dict) -> str:
    """Replaces `${{ matrix.<key> }}` with the value of the matrix entry."""
    if not isinstance(value, str):
        return "" if value is None else str(value)
    return MATRIX_PATTERN.sub(lambda match: str(entry.get(match.group(1), "")), value)


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


def collect_components(doc: dict) -> dict[str, list[dict]]:
    """Returns {component: [build definitions]} for every component.

    A build definition carries every workflow level value that can change the
    produced image, not only the build arguments.
    """
    result: dict[str, list[dict]] = {}

    def add(component: str, definition: dict) -> None:
        canonical = {key: "" if value is None else str(value) for key, value in definition.items()}
        result.setdefault(component, []).append(canonical)

    for job in (doc.get("jobs") or {}).values():
        matrix = ((job.get("strategy") or {}).get("matrix")) or {}
        entries = matrix.get("include") or [{}]

        # Every build step is expanded once per matrix entry, because the step
        # usually carries `file: ${{ matrix.dockerfile }}`. Without the
        # expansion the component could not be derived from the step and the
        # platform, target and context would silently stay out of the
        # fingerprint.
        for step in job.get("steps") or []:
            if not isinstance(step, dict):
                continue
            with_ = step.get("with") or {}
            build_args = with_.get("build-args")
            if not build_args:
                continue
            for entry in entries:
                if not isinstance(entry, dict):
                    continue
                context = resolve_matrix(with_.get("context"), entry)
                dockerfile = resolve_matrix(with_.get("file"), entry)
                # Matrix driven workflows name the component in the matrix and
                # only reference it from the step, so both have to be kept.
                target = resolve_matrix(with_.get("target"), entry) or str(entry.get("target") or "")
                component = component_of_path(dockerfile)
                if component is None:
                    component = component_of_path(context)
                if component is None:
                    continue
                add(
                    component,
                    {
                        "context": context,
                        "dockerfile": dockerfile,
                        "target": target or component,
                        "platforms": resolve_matrix(with_.get("platforms"), entry),
                        "build_args": resolve_matrix(build_args, entry),
                    },
                )

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


def definition_fingerprint(definition: dict, env: dict) -> str:
    """Hashes one build definition: context, Dockerfile, target, platform, args."""
    parts = [
        f"context={definition.get('context', '')}",
        f"dockerfile={definition.get('dockerfile', '')}",
        f"target={definition.get('target', '')}",
        f"platforms={definition.get('platforms', '')}",
        f"args={build_arg_fingerprint(definition.get('build_args', ''), env)}",
    ]
    return hashlib.sha256("\n".join(parts).encode()).hexdigest()


def fingerprints(doc: dict | None) -> dict[str, str]:
    """Returns {component: fingerprint of the build configuration}."""
    if doc is None:
        return {}

    env = doc.get("env") or {}
    result: dict[str, str] = {}

    for component, definitions in collect_components(doc).items():
        if component in SKIP_COMPONENTS:
            continue
        parts = sorted(definition_fingerprint(definition, env) for definition in definitions)
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
        # The workflow did not exist at one of the revisions and every build
        # configuration has to be considered as changed. The caller turns the
        # non-zero exit status into a full rebuild.
        print(
            f"ERROR: cannot load {WORKFLOW_PATH} at '{rev_a}' or '{rev_b}'",
            file=sys.stderr,
        )
        return 1

    fp_a = fingerprints(doc_a)
    fp_b = fingerprints(doc_b)

    if not fp_a or not fp_b:
        # A workflow without any recognised build definition would compare as
        # "nothing changed", which is the opposite of what the caller needs.
        print(
            f"ERROR: no build definitions found in {WORKFLOW_PATH} at '{rev_a}' or '{rev_b}'",
            file=sys.stderr,
        )
        return 1

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
