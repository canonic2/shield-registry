# Shield Registry

Shield Registry contains one experimental Git permission pack: `canonic/git`.
The signed catalog is served through GitHub Pages. Packs are declarative policy
data; installing one does not install Git or agent interception.

## Git coverage

The pack matches selected literal `git` argument forms. It does not authenticate
the executable or classify effective repository configuration, hooks, aliases,
transport helpers or shell syntax. Unmatched requests ask in every profile.
See [Git's coverage and profiles](packs/canonic/git/0.1.0/README.md).

## Validate and publish

Use Node 24 or newer and a local Shield 0.1.x binary. Publication uses Node
built-ins; development checks install the pinned JSON Schema validator with
`npm ci --ignore-scripts`. The publication key stays outside the checkout and
is never sent to CI.

```sh
npm ci --ignore-scripts
npm test
node scripts/registry-release.mjs build . /path/to/private-ed25519.pem /path/to/shield
node scripts/registry-release.mjs check public
```

`release.json` selects exact pack paths, a monotonically increasing catalog
sequence and UTC expiry. Building invokes the Rust validator and behavioral
fixtures before signing the exact catalog bytes. Retained versions cannot change
bytes or disappear from the catalog. Publish a new pack version for rule changes;
increment the catalog sequence for every refresh, including expiry renewal.
Catalog expiry blocks new acquisition; retained installed policy works offline.

Review and commit source and generated `public/` together. The Pages workflow
checks signatures and artifact digests before deploying the reviewed public
directory. Pull requests run the same checks without publication permissions.
Signing and publication do not authorize policy installation in a user's project.

Contributions include rules, all three monotonic profiles, expected decisions,
coverage documentation and a license. Maintainers validate proposed content with
Shield locally and sign a new reviewed catalog. Contributions cannot run pack code.

## License

Registry tooling and permission packs are licensed under [MIT](LICENSE).

## Policy schema

[schemas/policy.schema.json](schemas/policy.schema.json) defines initial
`schema_version: 1` pack, custom-rule and decision-fixture documents. Packs
start with `argv-v1`; optional capabilities follow in order:
`possible-effects-v1`, then `dependencies-v1`. Effect predicates require the
effect capability in packs. Dependency declarations and `dependencies-v1` must
be present together; omit both for Git. Custom rules can use effects directly.
Rust additionally validates SemVer, profile ordering, authority and dependency
closures. Wire and result protocols have independent version fields.
