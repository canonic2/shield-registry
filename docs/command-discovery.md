# Command discovery and Node rollout

Catalog v2 carries command hints for the Node, Rust and Git packs.
Baseline 0.7.0 establishes the project-script review boundary. Building,
validating or publishing registry artifacts does not change live project policy.

Catalog ownership and authentication cover `commands`, a map from listed stable
pack IDs to multiple executable basenames. Shield retains an inverted index when
it authenticates a catalog outside the hook, then looks up the decisive analyzed
command from a native Ask. Hooks perform no network or artifact acquisition.
Current registry aliases resolve to captured source identities; installed
source/pack instances are excluded. Multiple matches remain explicit alternatives.

Claude and Codex share the offer and supported MCP route: inspect with
`shield_info`, propose `{"kind":"pack_add","reference":"main/canonic/node"}`
through `shield_policy_propose`, then submit its exact `apply_arguments` to
`shield_policy_apply` for user review. Relevance is not permission, and no callback
installs or activates policy. Host approval, configured automatic Ask allowance,
and a reviewed policy change have separate meanings.

## Maintainer rollout, after review

1. Build and validate the updated client before exposing catalog v2. From the
   Canonic workspace, `make -C packages/shield build` makes the release executable.
   `make -C packages/shield install-local` installs it when separately authorized.
   Shield 0.3.0 supports this catalog and the Rust pack's required capabilities.
2. From this registry, run
   `npm test -- --shield ../canonic/packages/shield/target/release/shield`.
   Fresh native acceptance is separate:
   `npm run test:native -- --shield ../canonic/packages/shield/target/release/shield`.
3. Renew `release.json.expires_at` if necessary. Run
   `npm run release -- canonic/node@0.1.0 --key /path/to/private-ed25519.pem --shield ../canonic/packages/shield/target/release/shield`.
   The helper sets the sequence above the signed catalog, runs the full registry
   suite, validates new policy/fixtures, signs and verifies public artifacts.
   The reviewed manifest already includes Baseline 0.7.0; publication processes
   every listed release, including any other prepared packs, so review its full
   scope before signing. The helper takes one pack reference, not a list.
   Review all source and generated `public/` changes. Commit/push to `main` only
   with publication authorization; its workflow deploys GitHub Pages.
4. In a live project, after the client and catalog are available, refresh local
   discovery with `shield search main/`. Updating an installed executable may
   require `shield setup claude` / `shield setup codex` to review and repair
   digest-bound hook registration. Resume the host session with that registration.
5. An ordinary `npm view express version` Ask can suggest the Node pack. The user
   reviews the proposed profile before activation; alternatively the user can run
   `shield info main/canonic/node` and
   `shield add main/canonic/node --profile recommended` in their terminal.
   To apply the script boundary without Node, review a Baseline update with
   `shield update main/canonic/baseline`. A personal manager choice can be supplied
   with `--set package_manager=pnpm` on Node addition (and `--local` for personal
   scope); leaving it unset permits all supported managers' declared operations.

V1-only clients refuse catalog v2. New clients still read v1 but do not invent
command associations when hints are absent. Checkpoints containing the new index
require the updated client too. Roll out the client first and retain state backups
according to the client upgrade process; do not downgrade that state in place.

Recommended Node allows listed metadata/audit reports and local dependency installs,
asks for project scripts, package execution/inline code/publication, and denies global,
authentication and configuration operations. Its optional `package_manager` choice
restricts npm/pnpm/Yarn and their aliases; unset permits every supported manager's
listed routine operations. Corepack's explicit routes follow the same gate and
operation grammar. Unqualified Corepack setup denies when a manager is selected.
Strict denies listed dependency installs and asks for routine project scripts. See the
[pack guide](../packs/canonic/node/0.1.0/README.md) for exact coverage, Baseline
composition and source-analysis limits. Nvm and process ownership are outside
this pack; it does not solve `kill $pid`.

Both agents receive initial exact-command proposal routes for ordinary literal
Asks. For scripts, inspect definitions, hooks and arguments first; propose a
narrow project rule only when the effects are appropriate, with an explanation
for user review. Public packs do not encode custom script approvals. Baseline
0.7.0 applies that boundary without Node installed; Node's explicit script rules
also preserve review alongside Baseline 0.6.0. Installing new source releases is
an explicit reviewed change; nothing here rewrites installed releases in place.
