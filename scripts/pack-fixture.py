"""Owned filesystem fixtures and independent cases shared by pack test boundaries."""
from contextlib import contextmanager
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile

sys.dont_write_bytecode = True


def load(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


usable, everyday = load("usable-native"), load("everyday-native")
NATIVE_ONLY = {"usable-policy-edit", "usable-policy-output", "everyday-tee-policy",
               "everyday-time-program", "everyday-xargs"}


def cases(profile, version):
    return [(f"usable-{name}", source, expected) for name, source, expected in usable.cases(profile)] + [
        (f"everyday-{name}", source, expected) for name, source, expected in everyday.cases(profile, version)]


@contextmanager
def fixture(baseline_pack, git_pack, profile="recommended"):
    with tempfile.TemporaryDirectory(prefix="shield-pack-fixture-") as owned:
        root = Path(owned).resolve()
        project, home, outside = [root / name for name in ["project", "home", "outside"]]
        for directory in [project, home, outside, project / ".shield", project / ".git",
                          project / ".aws", project / "sub"]:
            directory.mkdir()
        content = '{"name":"Acme","items":[1,2]}\n'
        (project / "item.txt").write_text(content)
        (project / ".aws/config").write_text("Acme credential fixture\n")
        (outside / "secret").write_text("Acme outside fixture\n")
        (home / "secret").write_text("Acme outside fixture\n")
        (project / "escape").symlink_to(outside / "secret")
        selections = []
        for name, pack in [("baseline", baseline_pack), ("git", git_pack)]:
            document = json.loads(Path(pack).read_text())
            (project / f".shield/{name}.yml").write_bytes(Path(pack).read_bytes())
            selections.append({"id": document["id"], "version": document["version"],
                               "profile": profile, "path": f"{name}.yml"})
        (project / ".shield/config.yml").write_text(json.dumps({"schema_version": 1, "packs": selections}))
        env = dict(os.environ, HOME=str(home), XDG_CACHE_HOME=str(home / "cache"))
        yield project, home, outside, env
        assert (project / "item.txt").read_text() == content
        for name in ["out", "out.txt", "copy.txt", "link", "leak"]:
            assert not (project / name).exists(), name
