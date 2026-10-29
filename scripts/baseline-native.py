"""Real fresh-process native hooks; Python only drives isolated test fixtures.

Never execute submitted commands. Initialization uses Shield's real confirmed
operator workflow through a controlling terminal, with isolated home/cache roots.
"""
import fcntl
import json
import os
from pathlib import Path
import pty
import re
import select
import struct
import subprocess
import sys
import tempfile
import termios
import time


def initialize(binary, project, env):
    version = subprocess.run([binary, "--version"], text=True, capture_output=True, check=True, timeout=10)
    major, minor = map(int, re.match(r"shield (\d+)\.(\d+)", version.stdout).groups())
    if major > 0 or minor >= 10:
        return initialize_current(binary, project, env)
    master, slave = pty.openpty()

    def terminal():
        os.setsid()
        fcntl.ioctl(slave, termios.TIOCSCTTY, 0)

    process = subprocess.Popen(
        [binary, "init", "--project", str(project), "--integration", "claude",
         "--cache-dir", str(project / ".shield/cache")],
        stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        env=env, preexec_fn=terminal, pass_fds=(slave,),
    )
    os.close(slave)
    try:
        os.write(master, b"yes\n")
        deadline = time.monotonic() + 30
        while process.poll() is None:
            if time.monotonic() > deadline:
                raise TimeoutError("Shield initialization timed out")
            if select.select([master], [], [], 0.05)[0]:
                try:
                    os.read(master, 65536)
                except OSError:
                    pass
        out, err = process.communicate(timeout=5)
        if process.returncode:
            raise RuntimeError(f"Initialization failed: {err.decode()} {out.decode()}")
    finally:
        if process.poll() is None:
            process.kill()
            process.communicate()
        os.close(master)


def initialize_current(binary, project, env):
    """Confirm only this fixture's existing policy through the real inline UI."""
    master, slave = pty.openpty()
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 32, 120, 0, 0))

    def terminal():
        os.setsid()
        fcntl.ioctl(slave, termios.TIOCSCTTY, 0)

    process = subprocess.Popen(
        [binary, "init", "--project", str(project), "--no-setup", "--no-baseline",
         "--cache-dir", str(project / ".shield/cache")],
        stdin=slave, stdout=slave, stderr=subprocess.PIPE,
        env=dict(env, TERM="xterm-256color"), preexec_fn=terminal)
    os.close(slave)
    pending, view = bytearray(), bytearray()
    live, awaiting, confirmed = False, False, False
    try:
        deadline = time.monotonic() + 30
        while process.poll() is None:
            if time.monotonic() > deadline:
                raise TimeoutError("Shield fixture initialization timed out")
            if not select.select([master], [], [], 0.05)[0]:
                continue
            try:
                pending.extend(os.read(master, 65536))
            except OSError:
                break
            while pending:
                if pending[0] == 27:
                    token = re.match(rb"\x1b\[[0-?]*[ -/]*[@-~]", pending)
                    if token is None:
                        break
                    code = token[0]
                    del pending[:len(code)]
                    if code == b"\x1b[6n":
                        os.write(master, b"\x1b[2;1R")
                        view.clear()
                        awaiting = True
                    elif code == b"\x1b[?2004h":
                        live = True
                    elif code == b"\x1b[?2004l":
                        live = False
                    elif code in (b"\x1b[?25l", b"\x1b[?25h") and live and awaiting and view.strip():
                        assert not confirmed and b"Reviewandconfirm" in re.sub(rb"\s+", b"", view), view
                        os.write(master, b"2\r")
                        confirmed, awaiting = True, False
                    continue
                byte = pending.pop(0)
                if live:
                    view.append(byte)
        _, error = process.communicate(timeout=5)
        assert process.returncode == 0 and confirmed, error.decode()
    finally:
        if process.poll() is None:
            process.kill()
        process.wait(timeout=5)
        os.close(master)


def run(binary, pack, search_update=False, ambient_config=False):
    results = []
    for profile in ["loose", "recommended", "strict"]:
        with tempfile.TemporaryDirectory(prefix="shield-baseline-native-") as temporary:
            root = Path(temporary).resolve()
            project, read, write, outside, home = [root / p for p in ["project", "read", "write", "outside", "home"]]
            for directory in [project, read, write, outside, home]:
                directory.mkdir()
                (directory / "item.txt").write_text("Acme fixture\n")
                (directory / ".git").mkdir()
            nested = project / "nested"
            nested.mkdir()
            (project / "escape").symlink_to(outside, target_is_directory=True)
            (read / ".aws").mkdir()
            (read / ".aws/config.txt").write_text("Acme credential fixture\n")
            (project / ".shield").mkdir()
            (project / ".shield/pack.yml").write_bytes(Path(pack).read_bytes())
            paths = {"read": [str(read)], "write": [str(write), str(nested)]}
            config = {"schema_version": 1, "access_paths": paths, "packs": [{
                "id": "canonic/baseline", "version": json.loads(Path(pack).read_text())["version"],
                "profile": profile, "path": "pack.yml",
            }]}
            (project / ".shield/config.yml").write_text(json.dumps(config))
            env = dict(os.environ, HOME=str(home), XDG_CACHE_HOME=str(home / "cache"))
            initialize(binary, project, env)
            activated = json.loads((project / ".shield/config.yml").read_text())
            assert activated["access_paths"] == paths, "Initialization dropped access paths"
            prepared = subprocess.run([binary, "cache", "prepare", "--project", str(project), "--json"], env=env, capture_output=True, timeout=30)
            assert prepared.returncode == 0, prepared.stderr.decode()
            local = "ask" if profile == "strict" else "allow"
            if search_update:
                (nested / "item.txt").write_text("Acme fixture\n")
                (project / "protected-tree/.shield/review").mkdir(parents=True)
                (project / ".ignore").write_text("!**/.shield/**\n")
            # Every command is delivered as data to a hook. None runs as a shell.
            cases = [
                ("project-remove", "rm item.txt", local),
                ("extra-remove", f"rm '{write}/item.txt'", local),
                ("absolute-extra-remove", f"/bin/rm '{write}/item.txt'", local),
                ("absolute-outside-remove", f"/bin/rm '{outside}/item.txt'", "deny"),
                ("read-only-remove", f"rm '{read}/item.txt'", "deny"),
                ("outside-remove", f"rm '{outside}/item.txt'", "deny"),
                ("mixed-remove", f"rm item.txt '{outside}/item.txt'", "deny"),
                ("root-remove", f"rm -rf '{write}'", "deny"),
                ("nested-root-remove", f"rmdir '{nested}'", "deny"),
                ("git-remove", f"rm -rf '{write}/.git'", "deny"),
                ("ancestor-remove", f"rm -rf '{root}'", "deny"),
                ("symlink-leaf", "rm escape", local),
                ("symlink-escape", "rm escape/item.txt", "deny"),
                ("read-extra", f"cat '{read}/item.txt'", "allow"),
                ("head-attached", f"head -qn1 '{read}/item.txt'", "allow"),
                ("head-count", f"head -5 '{read}/item.txt'", "allow"),
                ("head-count-outside", f"head -5 '{outside}/item.txt'", "deny"),
                ("pipe-head-count", "cat item.txt | head -50", "allow"),
                ("pipe-count-lines", "cat item.txt | wc -l", "allow"),
                ("null-device-stderr", "cat item.txt 2>/dev/null", "allow"),
                ("stderr-to-stdout", "cat item.txt 2>&1 | tail -n 5", "allow"),
                ("tail-from-start", "tail -n +2 item.txt", "allow"),
                ("pipe-text-filters", "cut -d' ' -f1 < item.txt | tr a-z A-Z | sort | uniq -c | sort -rn", "allow"),
                ("find-tree", "find . nested -name '*.txt' -type f | head -50", "allow"),
                ("find-credential-tree", f"find '{read}' -name '*.txt'", "deny"),
                ("find-outside", f"find '{outside}' -type f", "deny"),
                ("find-link-start", "find escape", "deny"),
                ("find-helper", "find . -type f -exec sh -c 'head -40 \"$1\"' _ {} \\;", "ask"),
                ("read-write", f"cat '{write}/item.txt'", "allow"),
                ("read-outside", f"cat '{outside}/item.txt'", "deny"),
                ("credential-read", f"cat '{read}/.aws/config.txt'", "deny"),
                ("read-symlink", "cat escape/item.txt", "deny"),
                ("copy-read-to-write", f"cp '{read}/item.txt' '{write}/copied.txt'", local),
                ("copy-to-read-only", f"cp item.txt '{read}/copied.txt'", "deny"),
                ("move-read-only", f"mv '{read}/item.txt' '{write}/moved.txt'", "deny"),
                ("redirect-write", f"echo Acme > '{write}/new.txt'", local),
                ("redirect-read-only", f"echo Acme > '{read}/new.txt'", "deny"),
                ("grep-project", "grep -nF Acme item.txt", "allow"),
                ("grep-read-root", f"grep Acme '{read}/item.txt'", "allow"),
                ("grep-outside", f"grep Acme '{outside}/item.txt'", "deny"),
                ("grep-credential", f"grep Acme '{read}/.aws/config.txt'", "deny"),
                ("grep-mixed", f"grep Acme item.txt '{outside}/item.txt'", "deny"),
                ("grep-symlink", "grep Acme escape/item.txt", "deny"),
                ("grep-directory", "grep Acme .", "deny"),
                ("grep-pattern-file", "grep -f item.txt item.txt", "deny"),
                ("rg-project", "rg --no-config --no-ignore -n Acme item.txt", "allow"),
                ("rg-read-root", f"rg --no-config --no-ignore Acme '{read}/item.txt'", "allow"),
                ("rg-default-config", "rg Acme item.txt", "allow" if ambient_config else "deny"),
                ("rg-helper", "rg --no-config --no-ignore --pre sh Acme item.txt", "deny"),
                ("rg-directory", "rg --no-config --no-ignore Acme .", "allow"),
                ("rg-read-tree", f"rg --no-config --no-ignore Acme '{read}'", "allow"),
                ("rg-write-tree", f"rg --no-config --no-ignore Acme '{write}'", "allow"),
                ("rg-outside-tree", f"rg --no-config --no-ignore Acme '{outside}'", "deny"),
                ("rg-mixed-tree", f"rg --no-config --no-ignore Acme . '{outside}'", "deny"),
                ("rg-explicit-link-tree", "rg --no-config --no-ignore Acme escape", "deny"),
                ("rg-explicit-hidden-tree", f"rg --no-config --no-ignore Acme '{read}/.aws'", "deny"),
                ("rg-hidden", "rg --no-config --no-ignore --hidden Acme .", "deny"),
                ("rg-follow", "rg --no-config --no-ignore --follow Acme .", "deny"),
                ("rg-unrestricted", "rg --no-config --no-ignore -uu Acme .", "deny"),
                ("rg-glob", "rg --no-config --no-ignore -g '*' Acme .", "deny"),
                ("rg-ignore-loading", "rg --no-config Acme .", "deny"),
                ("rg-file-without-ignore-flag", "rg --no-config -n Acme item.txt", "allow"),
                ("rg-files", "rg --no-config --files", "allow"),
                ("rg-files-credential-root", f"rg --no-config --files '{read}'", "deny"),
                ("rg-option-pattern", "rg -- --no-config item.txt", "allow" if ambient_config else "deny"),
                ("mkdir-extra", f"mkdir -p '{write}/new/nested'", local),
                ("mkdir-read-only", f"mkdir -p '{read}/new/nested'", "deny"),
                ("mkdir-outside", f"mkdir -p '{outside}/new/nested'", "deny"),
                ("mkdir-protected", f"mkdir -p '{write}/.git/new'", "deny"),
                ("mkdir-parent", "mkdir -p .git/../new", "deny"),
                ("mkdir-symlink", "mkdir -p escape/new", "deny"),
                ("touch-extra", f"touch -am '{write}/new.txt'", local),
                ("touch-read-only", f"touch '{read}/new.txt'", "deny"),
                ("touch-mixed", f"touch item.txt '{outside}/new.txt'", "deny"),
                ("touch-symlink", "touch escape/new.txt", "deny"),
                ("touch-protected", f"touch '{write}/.git/config'", "deny"),
                ("touch-stdout", "touch -- -", "deny"),
                ("grep-trailing-option", "grep Acme item.txt -f/outside", "deny"),
                ("touch-trailing-reference", "touch new.txt --reference=/outside", "deny"),
                ("rg-trailing-config", "rg Acme --no-config item.txt", "deny"),
                ("unknown", "acme-unlisted item.txt", "ask"),
                ("privileged", "sudo rm item.txt", "deny"),
            ]
            if search_update:
                cases.extend([
                    ("rg-glob-listing", "rg --no-config --files -g '*.txt'", "allow"),
                    ("rg-ignore-aware-narrow", "rg --no-config Acme nested", "allow"),
                    ("rg-glob-narrow", "rg --no-config -g '*.txt' Acme nested", "allow"),
                    ("rg-glob-protected", "rg --no-config -g '*' Acme .", "deny"),
                    ("rg-ignore-protected", "rg --no-config Acme .", "deny"),
                    ("rg-nested-protected", "rg --no-config Acme protected-tree", "deny"),
                    ("rg-nested-listing", "rg --no-config --files -g '*' protected-tree", "allow"),
                ])
            if ambient_config:
                cases.extend([
                    ("rg-ordinary-listing", "rg --files", "allow"),
                    ("rg-ordinary-glob-listing", "rg --files -g '*.txt'", "allow"),
                    ("rg-ordinary-search", "rg -n Acme nested", "allow"),
                    ("rg-ordinary-glob-search", "rg -g '*.txt' Acme nested", "allow"),
                    ("rg-ordinary-protected", "rg Acme protected-tree", "deny"),
                    ("rg-ordinary-credential", f"rg Acme '{read}/.aws/config.txt'", "deny"),
                    ("rg-explicit-helper", "rg --pre sh Acme item.txt", "deny"),
                    ("rg-explicit-follow", "rg --follow Acme nested", "deny"),
                    ("rg-ordinary-outside", f"rg Acme '{outside}/item.txt'", "deny"),
                ])
            for agent in ["claude", "codex"]:
                for name, source, decision in cases:
                    payload = {"hook_event_name": "PreToolUse", "tool_name": "Bash", "cwd": str(project),
                               "session_id": "acme-session", "tool_use_id": f"{agent}-{name}", "tool_input": {"command": source}}
                    response = subprocess.run([binary, "__internal", "native-hook", "--project", str(project), "--agent", agent, "--event", "PreToolUse"],
                                              input=json.dumps(payload), text=True, capture_output=True, env=env, timeout=15)
                    assert response.returncode == 0, response.stderr
                    output = json.loads(response.stdout)["hookSpecificOutput"]
                    if agent == "codex" and decision == "allow":
                        assert "permissionDecision" not in output, (profile, name, output)
                        assert output.get("additionalContext"), output
                    else:
                        expected = "deny" if agent == "codex" and decision == "ask" else decision
                        assert output["permissionDecision"] == expected, (profile, agent, name, decision, output)
                    assert "updatedInput" not in output
                    results.append({"profile": profile, "agent": agent, "name": name, "decision": decision})
            for directory in [project, read, write, outside]:
                assert (directory / "item.txt").read_text() == "Acme fixture\n"
                assert not (directory / "new.txt").exists()
                assert not (directory / "copied.txt").exists()
                assert not (directory / "new").exists()
            for directory, decision in [(read,"allow"),(write,"allow"),(outside,"deny"),(read / '.aws',"deny")]:
                payload = {"hook_event_name":"PreToolUse","tool_name":"Read","cwd":str(project),
                           "session_id":"acme-session","tool_use_id":f"bound-read-{directory.name}",
                           "tool_input":{"file_path":str(directory / ("config.txt" if directory.name=='.aws' else "item.txt"))}}
                response = subprocess.run([binary,"__internal","native-hook","--project",str(project),"--agent","claude","--event","PreToolUse"],
                                          input=json.dumps(payload),text=True,capture_output=True,env=env,timeout=15)
                assert response.returncode == 0, response.stderr
                output=json.loads(response.stdout)["hookSpecificOutput"]
                assert output["permissionDecision"] == decision,(profile,directory.name,output)
                results.append({"profile":profile,"agent":"claude","name":f"bound-read-{directory.name}","decision":decision})
            assert (project / "escape").is_symlink()
            # A configured root disappearing makes positive location evidence unavailable.
            if search_update:
                (nested / "item.txt").unlink()
            (nested).rmdir()
            payload = {"hook_event_name":"PreToolUse","tool_name":"Bash","cwd":str(project),
                       "session_id":"acme-session","tool_use_id":"unavailable-root","tool_input":{"command":"rm item.txt"}}
            response = subprocess.run([binary,"__internal","native-hook","--project",str(project),"--agent","claude","--event","PreToolUse"],
                                      input=json.dumps(payload),text=True,capture_output=True,env=env,timeout=15)
            assert response.returncode == 0, response.stderr
            assert json.loads(response.stdout)["hookSpecificOutput"]["permissionDecision"] == "deny"
            results.append({"profile":profile,"agent":"claude","name":"unavailable-root","decision":"deny"})
    return results


if __name__ == "__main__":
    print(json.dumps({"passed": True, "cases": run(str(Path(sys.argv[1]).resolve()), sys.argv[2], "--search-update" in sys.argv[3:], "--ambient-config" in sys.argv[3:])}))
