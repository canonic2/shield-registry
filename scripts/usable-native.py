"""Fresh native hooks over composed packs; submitted commands are never executed."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

sys.dont_write_bytecode = True
def initialize(binary, project, env):
    spec = importlib.util.spec_from_file_location("baseline_native", Path(__file__).with_name("baseline-native.py"))
    baseline = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(baseline)
    baseline.initialize(binary, project, env)


def cases(profile):
    local = "ask" if profile == "strict" else "allow"
    destructive = "ask" if profile == "loose" else "deny"
    return [
        ("sed-read", "sed -n '1,20p' item.txt", "allow"),
        ("awk-read", "awk '{print $1}' item.txt", "allow"),
        ("jq-read", "jq -r '.name' item.txt", "allow"),
        ("jq-pipe", "jq '.items | length' item.txt", "allow"),
        ("sort-read", "sort -r item.txt", "allow"),
        ("uniq-read", "uniq -c item.txt", "allow"),
        ("cut-read", "cut -f1 item.txt", "allow"),
        ("diff-read", "diff -u item.txt item.txt", "allow"),
        ("cmp-read", "cmp -s item.txt item.txt", "allow"),
        ("pipeline", "sed -n '1p' item.txt | awk '{print $1}' | sort | uniq", "allow"),
        ("sed-escape", "sed -n '1p' escape", "deny"),
        ("jq-credential", "jq '.' .aws/config", "deny"),
        ("awk-credential", "awk '{print $1}' .aws/config", "deny"),
        ("sort-credential", "sort .aws/config", "deny"),
        ("policy-read", "sed -n '1p' .shield/config.yml", "allow"),
        ("policy-edit", "sed -i '' '1p' .shield/config.yml", "deny"),
        ("policy-output", "sort -o .shield/config.yml item.txt", "deny"),
        ("sed-code", "sed -n '1p; e id' item.txt", "ask"),
        ("awk-code", "awk '{system(\"id\")}' item.txt", "ask"),
        ("jq-environment", "jq env", "ask"),
        ("sort-output", "sort -o out.txt item.txt", "ask"),
        ("log-count", "git log --oneline -17", "allow"),
        ("status-u", "git status -u", "allow"),
        ("branch-vv", "git branch -vv", "allow"),
        ("reflog", "git reflog", "allow"),
        ("branch-delete", "git branch -d feature", local),
        ("gc-auto", "git gc --auto", local),
        ("rebase-continue", "git rebase --continue", local),
        ("rebase-abort", "git rebase --abort", local),
        ("stash", "git stash", local),
        ("init-dot", "git init -b main .", local),
        ("amend", "git commit --amend --no-edit", "ask"),
        ("rebase", "git rebase -i HEAD~3", "deny" if profile == "strict" else "ask"),
        ("hook-bypass", "git commit --amend --no-verify", destructive),
        ("rebase-hook-bypass", "git rebase --no-verify main", destructive),
        ("force-delete", "git branch -D feature", destructive),
        ("force-push", "git push --force origin main", destructive),
        ("hard-reset", "git reset --hard HEAD", destructive),
        ("immediate-prune", "git gc --prune=now", destructive),
        ("helper", "git log -5 --ext-diff", "ask"),
        ("output-file", "git log -5 --output=out", "ask"),
    ]


def run(binary, baseline_pack, git_pack):
    results = []
    for profile in ["loose", "recommended", "strict"]:
        with tempfile.TemporaryDirectory(prefix="shield-packs-usable-") as owned:
            root = Path(owned).resolve()
            project, home, outside = [root / name for name in ["project", "home", "outside"]]
            for directory in [project, home, outside]:
                directory.mkdir()
            (project / ".shield").mkdir()
            (project / ".git").mkdir()
            (project / ".aws").mkdir()
            (project / ".aws/config").write_text("Acme credential fixture\n")
            (project / "item.txt").write_text('{"name":"Acme","items":[1,2]}\n')
            (outside / "secret").write_text("Acme outside fixture\n")
            (project / "escape").symlink_to(outside / "secret")
            selections = []
            for name, pack in [("baseline", baseline_pack), ("git", git_pack)]:
                document = json.loads(Path(pack).read_text())
                (project / f".shield/{name}.yml").write_bytes(Path(pack).read_bytes())
                selections.append({"id": f"canonic/{name}", "version": document["version"], "profile": profile, "path": f"{name}.yml"})
            (project / ".shield/config.yml").write_text(json.dumps({"schema_version": 1, "packs": selections}))
            env = dict(os.environ, HOME=str(home), XDG_CACHE_HOME=str(home / "cache"))
            initialize(binary, project, env)
            state = (project / ".shield/config.yml").read_bytes()
            for agent in ["claude", "codex"]:
                for name, source, decision in cases(profile):
                    payload = {"hook_event_name": "PreToolUse", "tool_name": "Bash", "cwd": str(project), "session_id": "acme-usable",
                               "tool_use_id": f"{agent}-{name}", "tool_input": {"command": source}}
                    response = subprocess.run([binary, "__internal", "native-hook", "--project", str(project), "--agent", agent, "--event", "PreToolUse"], input=json.dumps(payload), text=True, capture_output=True, env=env, timeout=15)
                    assert response.returncode == 0, response.stderr
                    output = json.loads(response.stdout)["hookSpecificOutput"]
                    if agent == "codex" and decision == "allow":
                        assert "permissionDecision" not in output, (profile, name, output)
                    else:
                        expected = "deny" if agent == "codex" and decision == "ask" else decision
                        assert output["permissionDecision"] == expected, (profile, agent, name, decision, output)
                    results.append({"profile": profile, "agent": agent, "name": name, "decision": decision})
            for name, source, expected in [
                ("explicit-cwd", f"git -C '{project}' log --oneline -17", "allow"),
                ("missing-cwd", "git log --oneline -17", "allow"),
                ("explicit-force", f"git -C '{project}' reset --hard HEAD", None if profile == "loose" else "deny"),
                ("explicit-amend", f"git -C '{project}' commit --amend --no-edit", None),
                ("explicit-branch-delete", f"git -C '{project}' branch -d feature", None if profile == "strict" else "allow"),
            ]:
                payload = {"hook_event_name": "PermissionRequest", "tool_name": "Bash", "cwd": str(project),
                           "session_id": "acme-usable", "tool_input": {"command": source}}
                response = subprocess.run([binary, "__internal", "native-hook", "--project", str(project), "--agent", "codex", "--event", "PermissionRequest"], input=json.dumps(payload), text=True, capture_output=True, env=env, timeout=15)
                assert response.returncode == 0, response.stderr
                output = json.loads(response.stdout)
                assert output.get("hookSpecificOutput", {}).get("decision", {}).get("behavior") == expected, (profile, name, output)
                results.append({"profile": profile, "agent": "codex", "name": name, "decision": expected})
            assert (project / ".shield/config.yml").read_bytes() == state
            assert not (project / "out").exists()
            assert not (project / "out.txt").exists()
            assert (project / "item.txt").read_text() == '{"name":"Acme","items":[1,2]}\n'
    return results


if __name__ == "__main__":
    print(json.dumps({"passed": True, "cases": run(*sys.argv[1:4])}))
