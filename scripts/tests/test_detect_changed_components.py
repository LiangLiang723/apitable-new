import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


DETECTOR = Path(__file__).resolve().parents[1] / "detect-changed-components.sh"
ALL_COMPONENTS = {
    "backend-server", "room-server", "web-server", "init-db",
    "dataenv-pm2", "dataenv-liquibase-pm2", "openresty",
}


class DetectChangedComponentsTest(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.repo = Path(temporary.name)
        self.run_git("init", "-q")
        self.run_git("config", "user.name", "Fixture")
        self.run_git("config", "user.email", "fixture@example.invalid")
        self.run_git("config", "commit.gpgsign", "false")
        (self.repo / "scripts").mkdir()
        shutil.copy(DETECTOR, self.repo / "scripts")
        fingerprint = self.repo / "scripts/component-build-fingerprint.py"
        fingerprint.write_text("#!/bin/sh\nprintf '%s\\n' '{\"changed\":[]}'\n")
        fingerprint.chmod(0o755)
        (self.repo / "README.md").write_text("baseline")
        self.commit()
        self.run_git("tag", "v1.0.0")

    def run_git(self, *args):
        subprocess.run(["git", *args], cwd=self.repo, check=True, capture_output=True)

    def commit(self):
        self.run_git("add", ".")
        self.run_git("commit", "-qm", "fixture")

    def changes(self, env=None):
        result = subprocess.run(
            ["bash", "scripts/detect-changed-components.sh", "v1.0.0", "HEAD"],
            cwd=self.repo, env=env, check=True, capture_output=True, text=True,
        )
        return set(json.loads(result.stdout)["changed"])

    def test_many_changed_paths(self):
        files = self.repo / "packages/datasheet"
        files.mkdir(parents=True)
        for index in range(3400):
            (files / ("file_" + str(index) + "_" + "long" * 24)).touch()
        self.commit()
        self.assertEqual(self.changes(), {"web-server"})

    def test_ignore_rules_are_build_inputs(self):
        (self.repo / ".dockerignore").write_text("backend-server/application/src/main/resources/obsolete")
        self.commit()
        self.assertEqual(self.changes(), {"backend-server", "room-server", "web-server"})

    def test_documentation_only(self):
        (self.repo / "README.md").write_text("updated")
        self.commit()
        self.assertEqual(self.changes(), set())

    def test_comparison_errors_fall_back_to_all_components(self):
        git = shutil.which("git")
        wrapper = self.repo / "git"
        wrapper.write_text(
            '#!/bin/sh\nif [ "$1" = diff ]; then exit 128; fi\n'
            'exec "$REAL_GIT" "$@"\n'
        )
        wrapper.chmod(0o755)
        env = dict(os.environ, REAL_GIT=git, PATH=str(self.repo) + os.pathsep + os.environ["PATH"])
        self.assertEqual(self.changes(env), ALL_COMPONENTS)
