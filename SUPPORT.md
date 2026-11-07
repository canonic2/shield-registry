# Getting help

Start with the [README quickstart](README.md#start-with-a-pack), then read the
selected pack's coverage guide. [Documentation](docs/README.md) covers profiles,
updates, trust and contributing.

## Where to report a problem

| Problem | Destination |
| --- | --- |
| A pack allows, asks or denies the wrong operation | [Pack decision report](https://github.com/canonic2/shield-registry/issues/new?template=pack-decision.yml) |
| A tool or operation needs coverage | [Pack request](https://github.com/canonic2/shield-registry/issues/new?template=pack-request.yml) |
| Catalog acquisition, publication, registry tooling or documentation | [Registry report](https://github.com/canonic2/shield-registry/issues/new?template=registry-problem.yml) |
| Shield CLI, evaluator or native agent integration | [Shield client source and guides](https://github.com/canonic2/canonic/tree/main/packages/shield) |
| A security-sensitive finding | [Security reporting](SECURITY.md) |

If you cannot tell which component owns the problem, use a registry report and
describe what you observed. General questions can use a blank issue in the
[issue chooser](https://github.com/canonic2/shield-registry/issues/new/choose).

## Make a decision report reproducible

Include the installed pack ID and version, selected profile, Shield version,
tool version, host agent and operating system. Give the smallest command or MCP
request that demonstrates the issue, what happened, and what you expected.
Mention other installed packs or project rules that may affect the decision.

Use placeholders for credentials, personal paths and private repository names.
Include relevant excerpts rather than complete configuration or environment
dumps. Do not execute a destructive command just to demonstrate a policy issue.

An Ask decision does not always produce a visible prompt: the agent host controls
approval and fallback behavior. A recently published pack also does not update
installed policy automatically. Check the retained version and review any update
as described in [discovery and updates](docs/command-discovery.md).
