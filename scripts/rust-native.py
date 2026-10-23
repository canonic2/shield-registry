"""Rust policy through fresh native hooks; submitted Rust commands never run."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("pack_fixture", Path(__file__).with_name("pack-fixture.py"))
fixtures = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixtures)


def run(binary):
    registry = Path(__file__).resolve().parent.parent
    results = []
    for profile in ["loose", "recommended", "strict"]:
        with fixtures.fixture(registry / "packs/canonic/baseline/0.6.0/pack.yml",
                              registry / "packs/canonic/git/0.6.2/pack.yml", profile) as (project, home, outside, env):
            config_path = project / ".shield/config.yml"
            config = json.loads(config_path.read_text())
            for name in ["rust", "node"]:
                source = registry / f"packs/canonic/{name}/0.1.0/pack.yml"
                (project / f".shield/{name}.yml").write_bytes(source.read_bytes())
                selected = {"id": f"canonic/{name}", "version": "0.1.0", "profile": profile, "path": f"{name}.yml"}
                if name == "rust":
                    selected["variables"] = {"cargo_executable": str(home / ".cargo/bin/cargo")}
                config["packs"].append(selected)
            config_path.write_text(json.dumps(config))
            (project / "src").mkdir()
            (project / "src/lib.rs").write_text("pub fn acme() {}\n")
            (project / "target.json").write_text("{}\n")
            (outside / "target.json").write_text("{}\n")
            (project / "Cargo.toml").write_text('[package]\nname = "acme"\nversion = "0.1.0"\n')
            fixtures.usable.initialize(binary, project, env)
            before = config_path.read_bytes()
            routine = "ask" if profile == "strict" else "allow"
            dependency = "deny" if profile == "strict" else "allow"
            review = "deny" if profile == "strict" else "ask"
            sensitive = "ask" if profile == "loose" else "deny"
            scenarios = [
                ("cargo --version", "allow"),
                ("cargo help", "allow"),
                ("cargo help acme-plugin", review),
                ("cargo +stable help build", review),
                ("rustup run stable cargo help acme-plugin", review),
                ("cargo build --locked", routine),
                ("cargo +stable build --locked", routine),
                ("cargo test --locked --lib tests::acme -- --nocapture", routine),
                ("cargo nextest run --locked -E 'test(acme)'", routine),
                ("cargo fmt -- --check", routine),
                ("cargo build --manifest-path Cargo.toml --target-dir artifacts", routine),
                ("cargo build --target-dir=../outside/new", "deny"),
                ("cargo build --manifest-path=../outside/Cargo.toml", "deny"),
                ("cargo build --target-dir=.shield/cache", "deny"),
                ("cargo build --target-dir=escape/new", "deny"),
                ("rustfmt --check src/lib.rs", routine),
                ("rustfmt ../outside/lib.rs", "deny"),
                ("cargo vendor third-party", dependency),
                ("cargo clean", review),
                ("cargo llvm-cov clean", review),
                ("cargo install --path .", review),
                ("cargo publish --dry-run", routine),
                ("cargo publish", review),
                ("cargo login", sensitive),
                ("rustup run stable cargo login --unknown", sensitive),
                ("cargo -q --color=never logout --unknown", sensitive),
                ("cargo add config", dependency),
                ("cargo test login", routine),
                ("rustup run stable cargo add serde", dependency),
                ("cargo build --target=../outside/target.json", "deny"),
                ("cargo build --target=target.json", routine),
                ("cargo build --target=escape/target.json", "deny"),
                ("cargo +stable build --target=.shield/target.json", "deny"),
                ("rustup run stable rustc src/lib.rs --target=../outside/target.json", "deny"),
                ("cargo build --unknown", review),
                ("cargo build --config=build.rustc-wrapper=acme", review),
                ("rustup run stable sh -c 'echo acme'", review),
                ("rustup run stable cargo build --locked", routine),
                (f"{home}/.cargo/bin/cargo build --locked", routine),
                ("cargo build && npm test", "ask"),
            ]
            for agent in ["claude", "codex"]:
                for index, (source, expected) in enumerate(scenarios):
                    payload = {"hook_event_name": "PreToolUse", "tool_name": "Bash", "cwd": str(project),
                               "session_id": "acme-rust", "tool_use_id": f"{profile}-{agent}-{index}",
                               "tool_input": {"command": source}}
                    result = subprocess.run([binary, "__internal", "native-hook", "--project", str(project),
                                             "--agent", agent, "--event", "PreToolUse"], input=json.dumps(payload),
                                            text=True, capture_output=True, env=env, timeout=15)
                    assert result.returncode == 0, result.stderr
                    output = json.loads(result.stdout)
                    details = output.get("hookSpecificOutput", {})
                    encoded = {"allow": None, "ask": "deny"}.get(expected, expected) if agent == "codex" else expected
                    assert details.get("permissionDecision") == encoded, (profile, agent, source, expected, output)
                    results.append({"profile": profile, "agent": agent, "source": source, "expected": expected})
            assert config_path.read_bytes() == before, "Hooks changed project configuration"
    return {"passed": True, "projects": 3, "cases": results}


if __name__ == "__main__":
    print(json.dumps(run(sys.argv[1])))
