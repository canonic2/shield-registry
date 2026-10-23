"""One Shield process checks the complete policy corpus across all profiles."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("pack_fixture", Path(__file__).with_name("pack-fixture.py"))
fixtures = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixtures)


def run(binary, baseline_pack, git_pack):
    version = json.loads(Path(baseline_pack).read_text())["version"]
    with fixtures.fixture(baseline_pack, git_pack) as (project, home, outside, env):
        cases = []
        for profile in ["loose", "recommended", "strict"]:
            for name, source, expected in fixtures.cases(profile, version):
                if name in fixtures.NATIVE_ONLY:
                    continue
                cases.append({"name": f"{name}-{profile}", "profile": profile, "expected": expected,
                              "input": {"kind": "shell", "source": source, "dialect": "posix",
                                        "dialect_version": None, "original_input": {"command": source}}})
        path = project.parent / "cases.json"
        path.write_text(json.dumps({"schema_version": 1, "cases": cases}))
        config = (project / ".shield/config.yml").read_bytes()
        result = subprocess.run([binary, "__internal", "test-pack", "--pack", baseline_pack,
                                 "--with-pack", git_pack, "--cases", str(path)],
                                cwd=project, env=env, capture_output=True, text=True, timeout=10)
        assert result.returncode == 0, result.stderr + result.stdout
        report = json.loads(result.stdout)
        assert report["passed"] and len(report["cases"]) == len(cases), report
        assert (project / ".shield/config.yml").read_bytes() == config
        assert not (project / ".shield/review").exists(), "Batch tests must not enroll or activate policy"
        return report


if __name__ == "__main__":
    print(json.dumps(run(*sys.argv[1:4])))
