# Command discovery and reviewed installation

Shield uses authenticated command hints to suggest relevant permission packs
when a command needs review. Discovery does not authorize a command or install
a pack. Publishing registry artifacts does not change project policy.

## Catalog hints

Catalog v2 carries `commands`, a map from stable pack IDs to command basenames.
The catalog signature covers these hints. Shield builds an inverted index when
it authenticates a catalog outside the hook, then looks up the decisive analyzed
command from a native Ask. Hooks perform no network or artifact acquisition.

Installed source/pack instances are excluded from installation offers. Multiple
matches remain explicit alternatives. Host approval, automatic Ask handling and
a reviewed policy change remain separate decisions.

V1-only clients refuse catalog v2. Clients supporting v2 can still read v1,
without inventing hints that are absent. Keep client compatibility in mind when
publishing catalog metadata; see [maintaining the registry](maintaining.md).

## Inspect and add a pack

In an initialized project, refresh discovery and inspect the proposed pack:

```sh
shield pack search main/
shield pack info main/canonic/node
shield pack add main/canonic/node --profile recommended
```

Review and confirm the proposed permissions. A personal package-manager choice
can be supplied with `--set package_manager=pnpm` on Node addition; `--local`
selects personal scope. Leaving the setting unset permits the supported
managers' declared operations. Read the current
[Node pack guide](../packs/canonic/node/0.4.0/README.md) for exact coverage.

Claude and Codex also receive the MCP proposal route: inspect with `pack_info`,
propose `{"kind":"pack_add","reference":"main/canonic/node"}` through
`policy_propose`, then submit its exact `apply_arguments` to
`policy_apply` for user review. No intercepted callback installs policy.

## Update installed policy

Publishing a newer version does not rewrite installed releases. Request and
review an update explicitly, for example:

```sh
shield pack update main/canonic/baseline
```

Updating the Shield executable may also require `shield mcp setup --agent claude` or
`shield mcp setup --agent codex` to review and repair digest-bound hook registration.
Resume the host session with that registration. Client installation and registry
publication are separate from project activation.

For a project script Ask, inspect the script, hooks and arguments first.
Propose a narrow project rule only when its effects are appropriate, with an
explanation for user review. Public packs do not encode custom script approvals.
