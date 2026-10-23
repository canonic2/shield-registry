"""Fresh native hooks over Baseline 0.5.0 or later and Git; submitted commands are never executed."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

sys.dont_write_bytecode = True


def cases(profile, version):
    local = "ask" if profile == "strict" else "allow"
    # Baseline 0.6.0 decides these by path with Shield 0.2.0's models.
    paths = tuple(int(part) for part in version.split(".")) >= (0, 6, 0)
    later = [
        ("nl-credential", "nl .aws/config", "deny"),
        ("tee-copy", "cat item.txt | tee copy.txt", local),
        ("tee-policy", "cat item.txt | tee .shield/config.yml", "deny"),
        ("symlink", "ln -s item.txt link", local),
        ("hard-link-outside", "ln ../home/secret leak", "deny"),
        ("chmod-outside", "chmod -R 777 ../home", "deny"),
        ("command-v", "command -v rg", "allow"),
        ("ulimit", "ulimit -n", "allow"),
        ("ulimit-set", "ulimit -n 4096", "ask"),
    ] if paths else []
    return later + [
        ("test-chain", "test -f item.txt && echo present", "allow"),
        ("bracket-test", "[ -d sub ] && pwd", "allow"),
        ("lookups", "type rg; which node; whoami; id -u; hostname -s", "allow"),
        ("paths", "realpath item.txt; readlink -f item.txt", "allow"),
        ("sizes", "du -sh sub | sort -h", "allow"),
        ("metadata", "stat item.txt; file item.txt", "allow"),
        ("tree", "tree -L 2 -I node_modules", "allow"),
        ("piped-text", "cat item.txt | nl -ba | column -t", "allow"),
        ("piped-join", "cat item.txt | paste -sd, -", "allow"),
        ("calculator", "echo '2^10' | bc -l", "allow"),
        ("cargo-test", "cargo test --locked", local),
        ("make-directory", "make -C sub build", local),
        ("make-variable", "make test-focus FILTER=acme", local),
        ("pnpm-dir", "pnpm --dir sub run check", local),
        ("npm-script", "npm run build -- --watch", local),
        ("check-chain", "cargo fmt && cargo clippy -- -D warnings && cargo test", local),
        ("printenv", "printenv", "deny"),
        ("env-dump", "env", "deny"),
        ("env-filter", "env | grep KEY", "deny"),
        ("printenv-chain", "echo start; printenv HOME", "deny"),
        ("keychain", "security find-generic-password -s acme -w", "deny"),
        ("gh-token", "gh auth token", "deny"),
        ("build-then-dump", "make build && printenv", "deny"),
        ("install", "npm install", "ask"),
        ("outside-make", "make -C ../other build", "ask"),
        ("nl-file", "nl item.txt", "allow" if paths else "ask"),
        ("interpreter", "python3 -m pytest", "ask"),
        ("time-keyword", "time make", local),
        # Launchers Shield cannot look inside go back to the agent to run directly.
        ("time-program", "/usr/bin/time make", "deny"),
        ("xargs", "ls | xargs echo", "deny"),
        ("chmod", "chmod +x item.txt", local if paths else "ask"),
    ]


def run(binary, baseline_pack, git_pack):
    spec = importlib.util.spec_from_file_location("baseline_native", Path(__file__).with_name("baseline-native.py"))
    baseline = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(baseline)
    results = []
    for profile in ["loose", "recommended", "strict"]:
        with tempfile.TemporaryDirectory(prefix="shield-packs-everyday-") as owned:
            root = Path(owned).resolve()
            project, home = root / "project", root / "home"
            for directory in [project, home, project / "sub", project / ".shield"]:
                directory.mkdir()
            (project / "item.txt").write_text("Acme fixture\n")
            (project / ".aws").mkdir()
            (project / ".aws/config").write_text("Acme credential fixture\n")
            (home / "secret").write_text("Acme outside fixture\n")
            version = json.loads(Path(baseline_pack).read_text())["version"]
            selections = []
            for name, pack in [("baseline", baseline_pack), ("git", git_pack)]:
                document = json.loads(Path(pack).read_text())
                (project / f".shield/{name}.yml").write_bytes(Path(pack).read_bytes())
                selections.append({"id": f"canonic/{name}", "version": document["version"], "profile": profile, "path": f"{name}.yml"})
            (project / ".shield/config.yml").write_text(json.dumps({"schema_version": 1, "packs": selections}))
            env = dict(os.environ, HOME=str(home), XDG_CACHE_HOME=str(home / "cache"))
            baseline.initialize(binary, project, env)
            for agent in ["claude", "codex"]:
                for name, source, decision in cases(profile, version):
                    payload = {"hook_event_name": "PreToolUse", "tool_name": "Bash", "cwd": str(project), "session_id": "acme-everyday",
                               "tool_use_id": f"{agent}-{name}", "tool_input": {"command": source}}
                    response = subprocess.run([binary, "__internal", "native-hook", "--project", str(project), "--agent", agent, "--event", "PreToolUse"],
                                              input=json.dumps(payload), text=True, capture_output=True, env=env, timeout=15)
                    assert response.returncode == 0, response.stderr
                    output = json.loads(response.stdout)["hookSpecificOutput"]
                    # Codex expresses Allow by abstaining and Ask by denying PreToolUse.
                    expected = {"allow": None, "ask": "deny"}.get(decision, decision) if agent == "codex" else decision
                    actual = output.get("permissionDecision")
                    results.append({"profile": profile, "agent": agent, "name": name, "decision": decision,
                                    "passed": actual == expected, **({} if actual == expected else {"actual": actual})})
            assert (project / "item.txt").read_text() == "Acme fixture\n"
    return results


if __name__ == "__main__":
    results = run(*sys.argv[1:4])
    passed = all(result["passed"] for result in results)
    print(json.dumps({"passed": passed, "cases": results, "failed": [r for r in results if not r["passed"]]}))
    sys.exit(0 if passed else 1)
