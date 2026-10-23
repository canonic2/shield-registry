"""Fresh native-hook acceptance for vendor replies and protection boundaries."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("pack_fixture", Path(__file__).with_name("pack-fixture.py"))
fixtures = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixtures)


def hook(binary, project, env, agent, event, name, source, expected, workdir=None):
    tool_input = {"command": source}
    if workdir is not None:
        tool_input["workdir"] = str(workdir)
    payload = {"hook_event_name": event, "tool_name": "Bash", "cwd": str(project),
               "session_id": "acme-pack-test", "tool_input": tool_input}
    if event == "PreToolUse":
        payload["tool_use_id"] = f"{agent}-{name}"
    result = subprocess.run(
        [binary, "__internal", "native-hook", "--project", str(project), "--agent", agent, "--event", event],
        input=json.dumps(payload), text=True, capture_output=True, env=env, timeout=10)
    assert result.returncode == 0, result.stderr
    output = json.loads(result.stdout)
    details = output.get("hookSpecificOutput", {})
    if event == "PermissionRequest":
        if expected != "ask":
            assert details.get("hookEventName") == event, output
        actual = details.get("decision", {}).get("behavior")
        encoded = None if expected == "ask" else expected
    else:
        assert details.get("hookEventName") == event, output
        actual = details.get("permissionDecision")
        encoded = {"allow": None, "ask": "deny"}.get(expected, expected) if agent == "codex" else expected
    assert actual == encoded, (agent, event, name, expected, output)


def run(binary, baseline_pack, git_pack):
    results = []
    version = json.loads(Path(baseline_pack).read_text())["version"]
    for profile in ["loose", "recommended", "strict"]:
        with fixtures.fixture(baseline_pack, git_pack, profile) as (project, home, outside, env):
            fixtures.usable.initialize(binary, project, env)
            state = (project / ".shield/config.yml").read_bytes()
            boundaries = [(name, source, expected) for name, source, expected in fixtures.cases(profile, version)
                          if name in fixtures.NATIVE_ONLY]
            boundaries += [("allow-reply", "git status -u", "allow"),
                           ("ask-reply", "npm install", "ask"), ("deny-reply", "printenv", "deny")]
            if version == "0.8.0":
                boundaries += [("pager-less", "less item.txt", "ask"),
                               ("pager-more", "more item.txt", "ask"),
                               ("pager-flags", "less -F item.txt", "ask"),
                               ("pager-command", "less '+!helper' item.txt", "ask"),
                               ("pager-log", "less -o out.txt item.txt", "ask"),
                               ("pager-outside", f"less '{outside}/secret'", "ask")]
            for agent in ["claude", "codex"]:
                for name, source, expected in boundaries:
                    hook(binary, project, env, agent, "PreToolUse", name, source, expected)
                    results.append({"profile": profile, "agent": agent, "name": name})
            # Tool IDs are deliberately absent: PermissionRequest does not require them.
            for name, source, expected, workdir in [
                ("explicit-cwd", f"git -C '{project}' log --oneline -17", "allow", None),
                ("cwd-fallback", "git log --oneline -17", "allow", None),
                ("explicit-force", f"git -C '{project}' reset --hard HEAD", "ask" if profile == "loose" else "deny", None),
                ("explicit-amend", f"git -C '{project}' commit --amend --no-edit", "ask", None),
                ("explicit-branch-delete", f"git -C '{project}' branch -d feature", "ask" if profile == "strict" else "allow", None),
                ("workdir-precedence", "cat item.txt", "deny", outside),
                ("permission-deny", "printenv", "deny", None),
            ]:
                hook(binary, project, env, "codex", "PermissionRequest", name, source, expected, workdir)
                results.append({"profile": profile, "agent": "codex", "name": name})
            assert (project / ".shield/config.yml").read_bytes() == state
    return {"passed": True, "cases": results}


if __name__ == "__main__":
    print(json.dumps(run(*sys.argv[1:4])))
