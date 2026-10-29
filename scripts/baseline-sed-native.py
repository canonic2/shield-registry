"""Verify sed policy at native hooks with real files; submitted edits never run."""
import importlib.util
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("pack_native", Path(__file__).with_name("pack-native.py"))
native = importlib.util.module_from_spec(spec)
spec.loader.exec_module(native)


def run(binary):
    root = Path(__file__).resolve().parent.parent
    baseline = root / "packs/canonic/baseline/0.10.0/pack.yml"
    git = root / "packs/canonic/git/0.7.0/pack.yml"
    results = []
    for profile in ["loose", "recommended", "strict"]:
        with native.fixtures.fixture(baseline, git, profile) as (project, home, outside, env):
            native.fixtures.usable.initialize(binary, project, env)
            state = (project / ".shield/config.yml").read_bytes()
            content = (project / "item.txt").read_bytes()
            safe = "ask" if profile == "strict" else "allow"
            cases = [
                ("bsd-print", "sed -i '' '1p' item.txt", safe),
                ("bsd-edit", "sed -i '' 's/Acme/Example/' item.txt", safe),
                ("bsd-extended", "sed -E -i '' 's/(Acme)/\\1-example/' item.txt", safe),
                ("outside-link", "sed -i '' 's/a/b/' escape", "deny"),
                ("outside-path", f"sed -i '' 's/a/b/' '{outside}/secret'", "deny"),
                ("credentials", "sed -i '' 's/a/b/' .aws/config", "deny"),
                ("policy", "sed -i '' 's/a/b/' .shield/config.yml", "deny"),
                ("compound-missing", "printf a > missing; sed -i '' 's/a/b/' item.txt", "deny"),
            ]
            for agent in ["claude", "codex"]:
                for name, source, expected in cases:
                    native.hook(binary, project, env, agent, "PreToolUse", name, source, expected)
                    results.append({"profile": profile, "agent": agent, "name": name, "expected": expected})
            assert (project / "item.txt").read_bytes() == content
            assert (project / ".shield/config.yml").read_bytes() == state
    return {"passed": True, "cases": results}


if __name__ == "__main__":
    print(json.dumps(run(sys.argv[1])))
