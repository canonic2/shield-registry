"""Evaluate filename listings and unsafe neighbors; never execute submitted commands."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("baseline", Path(__file__).with_name("baseline-native.py"))
baseline = importlib.util.module_from_spec(spec)
spec.loader.exec_module(baseline)


def run(binary, pack):
    results = []
    for profile in ["loose", "recommended", "strict"]:
        with tempfile.TemporaryDirectory(prefix="shield-hidden-listings-") as owned:
            root = Path(owned).resolve()
            project, home, outside = [root / p for p in ["project", "home", "outside"]]
            for folder in [project, home, outside]:
                folder.mkdir()
            (project / ".shield").mkdir()
            (project / ".git").mkdir()
            (project / "src").mkdir()
            (project / "src/item.txt").write_text("Acme fixture\n")
            (project / ".mcp.json").write_text('{}\n')
            (project / ".ignore").write_text('!**/.shield/**\n')
            (outside / "item.txt").write_text("Acme outside\n")
            (project / "escape").symlink_to(outside, target_is_directory=True)
            document = json.loads(Path(pack).read_text())
            (project / ".shield/pack.yml").write_bytes(Path(pack).read_bytes())
            (project / ".shield/config.yml").write_text(json.dumps({"schema_version":1, "packs":[{
                "id":"canonic/baseline", "version":document["version"], "profile":profile, "path":"pack.yml"}]}))
            env = dict(os.environ, HOME=str(home), XDG_CACHE_HOME=str(home / "cache"))
            baseline.initialize(binary, project, env)
            cases = [
                ("rg --files --hidden -g '!.git' .", "allow"),
                ("rg --hidden --files -g AGENTS.md -g .gitignore", "allow"),
                ("rg --no-config --no-ignore --hidden --files .", "allow"),
                ("rg --files --hidden --glob='*.txt' src", "allow"),
                ("pwd && rg --files --hidden -g '!.git' .", "allow"),
                ("rg --hidden Acme .", "deny"),
                ("rg --hidden --files-with-matches Acme .", "deny"),
                ("rg --files --hidden --follow .", "deny"),
                ("rg --files --hidden --pre sh .", "deny"),
                (f"rg --files --hidden '{outside}'", "deny"),
                ("rg --files --hidden escape", "deny"),
                ("rg --files --hidden .shield/review", "deny"),
                ("rg Acme .shield/review", "deny"),
                ("rg Acme .mcp.json", "ask"),
            ]
            state = (project / ".shield/config.yml").read_bytes()
            for agent in ["claude", "codex"]:
                for index, (source, decision) in enumerate(cases):
                    payload = {"hook_event_name":"PreToolUse", "tool_name":"Bash", "cwd":str(project),
                               "session_id":"acme-hidden-listings", "tool_use_id":str(index), "tool_input":{"command":source}}
                    response = subprocess.run([binary,"__internal","native-hook","--project",str(project),"--agent",agent,"--event","PreToolUse"],
                                              input=json.dumps(payload), text=True, capture_output=True, env=env, timeout=15)
                    assert response.returncode == 0, response.stderr
                    output = json.loads(response.stdout)["hookSpecificOutput"]
                    observed = output.get("permissionDecision", "allow")
                    expected = "deny" if agent == "codex" and decision == "ask" else decision
                    assert observed == expected, (profile, agent, source, output)
                    results.append({"profile":profile,"agent":agent,"decision":observed})
            assert (project / ".shield/config.yml").read_bytes() == state
            assert (project / "src/item.txt").read_text() == "Acme fixture\n"
    return results


if __name__ == "__main__":
    print(json.dumps({"passed":True, "cases":run(*sys.argv[1:3])}))
