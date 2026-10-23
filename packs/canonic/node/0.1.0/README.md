# Node permissions 0.1.0

Permission policy for Node, npm, pnpm, Yarn and explicit Corepack routes,
compatible with Shield 0.2 and 0.3.
A pack installs policy, not Node or packages.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Exact version/help, listed npm metadata queries | Allow | Allow | Allow |
| Default npm init | Allow | Allow | Ask |
| Project scripts/tests/dev servers, plain project Node scripts and Node test runner | Ask | Ask | Ask |
| Listed local dependency changes, including lifecycle scripts | Allow | Allow | Deny |
| Package execution/initializers, Node inline code/preloads, unlisted execution | Ask | Ask | Deny |
| Publishing, registry access changes | Ask | Ask | Deny |
| Global operations, authentication, tokens and configuration | Ask | Deny | Deny |
| Unlisted manager syntax and implicit script names | Ask | Ask | Ask |

Supported executable spellings are bare names and paths under `/bin`, `/usr/bin`,
`/usr/local/bin` and `/opt/homebrew/bin`. Other spellings need their own policy.
The command association in catalog v2 advertises `node`, `npm`, `npx`, `pnpm`,
`pn`, `pnpx`, `pnx`, `yarn`, `yarnpkg` and `corepack`; discovery
can suggest a pack for other paths without claiming its rules permit them.

## Optional package-manager choice

Setup asks **Require a specific package manager?** The first option, **Any
supported package manager**, leaves `package_manager` unset; it has no default.
Lockfiles can preselect npm, pnpm or Yarn, but only confirmation binds a choice.

With no selection, listed `npm install`, `pnpm install`, `yarn install` and
`corepack install` allow under Recommended. With pnpm selected, pnpm's listed
operations keep their normal profile decisions; npm/npx and Yarn/yarnpkg deny
with “This project uses pnpm. Use pnpm instead.” Selection applies to inspection
too, including other managers' version commands. Node itself remains available.
The pnpm family includes `pn`, `pnpx` and `pnx`; npm includes `npx`, and Yarn
includes `yarnpkg`. Selecting an executor's family never allows arbitrary code:
`pnpm exec`, `pnpm dlx`, `pnpx`, `pnx` and `npx` still ask under Recommended.

The restriction is a pack precondition, so a more specific pack allowance or
Baseline allowance cannot bypass a wrong-manager Deny. Project custom-rule
authority and core protection retain Shield's normal precedence. The choice is
resolved before compilation; hooks do not reread lockfiles or manifests to choose
a manager and do not look up variables while matching.

For a published pack, reviewed setup/configuration uses:

```sh
shield add main/canonic/node --profile recommended --set package_manager=pnpm
shield packs configure main/canonic/node --set package_manager=yarn
shield packs configure main/canonic/node --unset package_manager
```

Use `--local` for a personal binding. Agents can propose `pack_configure` changes;
the user still reviews activation. Supported absolute executable spellings follow
the same manager restriction; other spellings require separate policy.

## Corepack

`corepack npm …`, `corepack pnpm …` and `corepack yarn …` use the respective
manager's exact declared policy grammar. Supported executor/alias routes include
`corepack npx`, `corepack pnpx` and `corepack yarnpkg`. With pnpm selected,
`corepack pnpm install` allows under Recommended and `corepack yarn install`
denies. This is declarative pack policy; no wrapper support or variable lookup
is added to Shield's shell analyzer.

Unqualified `corepack install` installs the project-configured package manager,
not project dependencies. It allows under Loose/Recommended while no manager is
selected. Once one is selected, it denies with guidance to use the chosen manager
directly or through an explicit Corepack route: the pack cannot prove that mutable
project metadata names that same manager. Exact Corepack version/help remains
available. Version-qualified routes such as `corepack pnpm@9 install` and unknown
global options retain review when unset and deny when a manager is selected.
Global installs, shim enable/disable, preparation and manager/configuration changes
are separate host-configuration operations. See [Corepack](https://github.com/nodejs/corepack).

## Operation boundaries

`npm view express version` inspects metadata using the configured registry and
credentials. Metadata flags are bounded (`--json`); registry/config overrides
require review. Exact version/help forms permit no additional options.
`npm audit` reports allow, with `--json` and bounded `--omit` values. Reports may
contact the configured registry and use credentials. `audit fix` and unknown
audit options retain review; registry overrides keep their stricter decision.

Distribution-tag mutations follow publication policy: Ask in Loose/Recommended,
Deny in Strict. This covers npm `dist-tag`/`dist-tags add` and `rm` (including
mutation subcommand aliases), Yarn Classic
`tag add/remove`, and modern Yarn `npm tag add/remove`, including declared
workspace/directory and explicit Corepack routes. Unlisted tag-listing forms
retain review; a custom script named `tag` or `dist-tags` retains script review.
Existing stronger guards still apply: npm's `set` token also matches the
configuration guard, which denies in Recommended and Strict.

Declared routes include npm `--prefix`, `--workspace`/`-w`, `--workspaces`, pnpm
`--dir`/`-C`, `--filter`/`-F`, `--recursive`/`-r`, and Yarn `--cwd`/`workspace`.
Supported attached npm/pnpm forms have the same decision. One leading selector
routes to the underlying declared grammar: install follows install policy,
inspection follows inspection policy, and a script still asks. Relative directory
spellings exclude hidden components and `..`; absolute/parent paths, combinations
of selectors, arbitrary options and other forms retain review. These are spelling
checks, not symlink or runtime containment. Corepack's explicit manager routes
reuse the same grammars. Config/cache/registry overrides retain separate review.

Direct project-local tool executables are not blanket-allowed by this pack;
use reviewed project rules or deliberately scoped tool packs. Baseline has its
own named quality-tool rules. Version-qualified Corepack routes and versioned
runtime paths retain review (or manager-selection refusal); runtime installation
and sourced Nvm initialization remain outside this pack.

Public packs do not approve custom project scripts, including familiar names such
as test, build, lint and dev. Explicit `npm run`, pnpm/Yarn `run`, lifecycle
shortcuts, declared shorthand, plain project Node scripts and `node --test` ask
in every profile. Stronger manager-selection, configuration and execution-risk
refusals still apply. Unknown manager shorthand also asks. The agent should inspect
the script definition, lifecycle hooks and arguments; if its effects are appropriate
for the task, propose a narrow project rule and explain those effects in
`agent_reason`. Submit the returned exact `apply_arguments` to
`shield_policy_apply` for user review. Proposal creation approves no command and
activates no policy. A reviewed project rule can allow a specific script;
custom rule authority and shell-analysis restrictions still apply.
Scripts may start servers, write outside the project or access the network.
Inline execution, stdin, preloads, loaders and alternate script locations retain
review. See [Node CLI](https://nodejs.org/api/cli.html) for execution options.

Dependency changes can download and execute code. Loose and Recommended deliberately
trust lifecycle scripts for the listed local install forms; Strict denies them.
Manager versions and project configuration differ in which scripts run. `npm run` and tests remain
code execution with that flag. See [npm install](https://docs.npmjs.com/cli/v11/commands/npm-install/)
and [npm exec](https://docs.npmjs.com/cli/commands/npm-exec/).
`npx --no-install` still executes code and receives the same review boundary.
pnpm install/add/update/remove/rebuild and listed Yarn Classic/modern
install/add/remove/upgrade/up forms have separate grammars. Explicit run/test/start
forms require project review. Unknown options, implicit arbitrary command names,
alternate configuration locations and package execution retain review.
The pack does not promise containment for plugins, `.pnpmfile` hooks, imports,
shared package caches or ambient settings. See [pnpm CLI](https://pnpm.io/pnpm-cli)
and [Yarn CLI](https://yarnpkg.com/cli).
Global/configuration risk tokens are conservative, including attached values and
short clusters; a script argument resembling one can require review too.

Baseline supplies ordinary directory/file operations, syntax checks and version
checks. It is optional; this pack has no dependency. Baseline 0.7.0 also requires
project script review. Node's explicit script rules preserve Ask alongside older
Baseline 0.6.0 script allowances. Baseline's
yielding npm/Node review rules defer to concrete Node rules. Overlapping concrete
rules use the normal most restrictive decision, so an explicit project Ask/Deny
remains authoritative. The Node pack's broad unlisted rules yield to concrete
Baseline rules, including supported Node syntax checks. The fixture suite checks
composition with both Baseline versions. Other independently installed policies
retain their normal authority; review the complete proposed configuration.

For Express setup under Recommended with Baseline: `node --version; npm --version;
npm view express version` allows; project file creation follows Baseline's path
rules; `npm init -y` and `npm install express@5` allow when the manager
is unset or npm is selected. `npm test` asks until project policy permits it.
With pnpm or Yarn selected, that npm workflow denies
and the agent is told which manager to use. Strict denies the listed install. The pack does
not remove shell-analysis uncertainty: creating and entering a new directory in
one callback can still ask in any profile before that directory exists. Node inline code used
to write project files also retains review in Loose and Recommended. The pack does
not establish process ownership or solve a `kill $pid` smoke test.

Nvm/runtime installation and selection are outside this pack. No permission here
models sourced shell functions, grants arbitrary shell initialization or establishes
runtime process ownership.

Regenerate policy and inventory with `node scripts/build-node-pack.mjs` and
fixtures with `node scripts/build-node-cases.mjs`.
`cases.json` holds independent expected decisions; `scripts/node-pack.test.mjs`
validates them and their composition through Shield. Licensed under MIT.
