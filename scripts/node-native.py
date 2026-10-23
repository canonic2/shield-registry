"""Node manager gates through fresh native hooks; submitted commands never execute."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("pack_fixture", Path(__file__).with_name("pack-fixture.py"))
fixtures = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixtures)


def hook(binary, project, env, agent, source, expected, selected):
    payload = {"hook_event_name": "PreToolUse", "tool_name": "Bash", "cwd": str(project),
               "session_id": "acme-node", "tool_use_id": source,
               "tool_input": {"command": source}}
    result = subprocess.run([binary, "__internal", "native-hook", "--project", str(project),
                             "--agent", agent, "--event", "PreToolUse"],
                            input=json.dumps(payload), text=True, capture_output=True, env=env, timeout=10)
    assert result.returncode == 0, result.stderr
    output = json.loads(result.stdout)
    details = output.get("hookSpecificOutput", {})
    actual = details.get("permissionDecision")
    encoded = {"allow": None, "ask": "deny"}.get(expected, expected) if agent == "codex" else expected
    assert actual == encoded, (selected, agent, source, expected, output)
    reason = details.get("permissionDecisionReason", "")
    if selected and expected == "deny":
        assert f"This project uses {selected}" in reason, (source, output)
        assert "pack_add" not in reason, output
    if expected == "ask" and "run acme-check" in source:
        assert "Inspect" in reason and "shield_policy_propose" in reason, output
        assert "pack_add" not in reason, output
    return {"selected": selected, "agent": agent, "source": source, "expected": expected}


def run(binary):
    registry = Path(__file__).resolve().parent.parent
    results = []
    for selected in [None, "npm", "pnpm", "yarn"]:
        with fixtures.fixture(registry / "packs/canonic/baseline/0.6.0/pack.yml",
                              registry / "packs/canonic/git/0.6.2/pack.yml") as (project, home, outside, env):
            config_path = project / ".shield/config.yml"
            config = json.loads(config_path.read_text())
            node_path = registry / "packs/canonic/node/0.1.0/pack.yml"
            (project / ".shield/node.yml").write_bytes(node_path.read_bytes())
            node = {"id": "canonic/node", "version": "0.1.0", "profile": "recommended", "path": "node.yml"}
            if selected:
                node["variables"] = {"package_manager": selected}
            config["packs"].append(node)
            reviewed_manager = selected or "pnpm"
            config["rules"] = "project-checks.yml"
            (project / ".shield/project-checks.yml").write_text(json.dumps({
                "schema_version": 1, "kind": "custom",
                "capabilities": ["argument-rules-v1", "structured-rules-v1"],
                "rules": [{"id": "reviewed-project-check", "decision": "allow",
                           "reason": "Acme fixture represents an operator-reviewed project rule.",
                           "conditions": {"domain": "argv", "executable": reviewed_manager,
                                          "arguments": {"kind": "exact", "values": ["run", "acme-reviewed"]}}}]}))
            config_path.write_text(json.dumps(config))
            fixtures.usable.initialize(binary, project, env)
            before = config_path.read_bytes()
            for agent in ["claude", "codex"]:
                results.append(hook(binary, project, env, agent, f"{reviewed_manager} run acme-reviewed", "allow", selected))
                results.append(hook(binary, project, env, agent, f"{reviewed_manager} run acme-reviewed --extra", "ask", selected))
                results.append(hook(binary, project, env, agent, f'cd "{outside}" && {reviewed_manager} run acme-check', "ask", selected))
                for manager in ["npm", "pnpm", "yarn"]:
                    expected = "allow" if selected in [None, manager] else "deny"
                    for source in [f"{manager} install", f"corepack {manager} install"]:
                        results.append(hook(binary, project, env, agent, source, expected, selected))
                    for source in [f"{manager} run acme-check", f"corepack {manager} run acme-check",
                                   f"node --version; {manager} install && {manager} test"]:
                        results.append(hook(binary, project, env, agent, source, "ask" if expected == "allow" else "deny", selected))
                results.append(hook(binary, project, env, agent, "corepack install", "deny" if selected else "allow", selected))
                for name, owner in [("npx", "npm"), ("pnpx", "pnpm"), ("yarnpkg", "yarn")]:
                    expected = "deny" if selected and selected != owner else "ask" if name != "yarnpkg" else "allow"
                    source = f"{name} acme-cli" if name != "yarnpkg" else "yarnpkg install"
                    results.append(hook(binary, project, env, agent, source, expected, selected))
            assert config_path.read_bytes() == before, "Hooks changed project policy"
    return {"passed": True, "projects": 4, "cases": results}


if __name__ == "__main__":
    print(json.dumps(run(sys.argv[1])))
